import { useState } from 'react'
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { SafeScreen } from '@/components/SafeScreen'
import { GlassCircleButton } from '@/components/GlassButton'
import { AppTextInput } from '@/components/AppTextInput'
import { Ionicons } from '@/components/Icon'
import { compressImage } from '@/lib/image'
import { createGroup, type CreateGroupInput, type Group, type GroupSport } from '@/services/groups'
import {
  BG, CARD, ACCENT, ACCENT_CONTRAST, TEXT_PRIMARY, TEXT_SECONDARY,
  useThemeStrings, THEME_DARK, accentAlpha,
} from '@/lib/theme'

// =============================================================================
// SKAPA GRUPP — femstegsguiden (sport → taggar → namn/bild/beskrivning →
// privat/offentlig → plats), samma flöde som förlagan men i appens språk:
// temad botten, glas-X, accentknapp och radiomönstret från integritetssidorna.
// =============================================================================

export const SPORTS: Array<{ key: GroupSport; label: string; desc?: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'all',     label: 'Alla sporter', desc: 'Håll gruppen bred — allt räknas', icon: 'infinite-outline' },
  { key: 'running', label: 'Löpning',   icon: 'fitness-outline' },
  { key: 'cycling', label: 'Cykling',   icon: 'bicycle-outline' },
  { key: 'walking', label: 'Promenad',  icon: 'walk-outline' },
  { key: 'gym',     label: 'Gym',       icon: 'barbell-outline' },
]

export const TAGS = ['Bara för skojs skull', 'Kompisgäng', 'Team', 'Jobbet', 'Tränarledd', 'Familj & vänner']

const STEPS = 5

export function GroupWizard({ visible, userId, onClose, onCreated }: {
  visible: boolean
  userId: string | null
  onClose: () => void
  onCreated: (group: Group) => void
}) {
  const T = useThemeStrings()
  const light = T.TEXT_PRIMARY !== '#FFFFFF'
  const radioEdge = light ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.4)'
  const cardEdge = light ? 'transparent' : THEME_DARK.BORDER

  const [step, setStep] = useState(0)
  const [sport, setSport] = useState<GroupSport>('all')
  const [tags, setTags] = useState<string[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [isPrivate, setIsPrivate] = useState(false)
  const [useLocation, setUseLocation] = useState(false)
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)

  function reset() {
    setStep(0); setSport('all'); setTags([]); setName(''); setDescription('')
    setImageUri(null); setIsPrivate(false); setUseLocation(false); setLocation('')
  }

  function close() { reset(); onClose() }

  function toggleTag(tag: string) {
    Haptics.selectionAsync()
    setTags(prev => prev.includes(tag)
      ? prev.filter(t => t !== tag)
      : prev.length >= 3 ? prev : [...prev, tag])
  }

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [1, 1] })
    if (!res.canceled && res.assets[0]) {
      setImageUri(await compressImage(res.assets[0].uri))
    }
  }

  const canNext = step === 2 ? name.trim().length >= 2 : true

  async function next() {
    Haptics.selectionAsync()
    if (step < STEPS - 1) { setStep(step + 1); return }
    if (!userId) return
    setSaving(true)
    try {
      const input: CreateGroupInput = {
        name, description, sport, tags,
        isPrivate,
        location: useLocation ? location : null,
        imageUri,
      }
      const saved = await createGroup(userId, input)
      reset()
      onCreated(saved)
    } catch {
      Alert.alert('Kunde inte skapa gruppen', 'Kontrollera anslutningen och försök igen.')
    } finally {
      setSaving(false)
    }
  }

  const titles = [
    'Välj gruppens sport',
    'Vad beskriver din grupp bäst?',
    'Anpassa gruppen',
    'Privat eller offentlig?',
    'Var finns gruppen?',
  ]
  const intros = [
    'Håll gruppen bred med Alla sporter eller välj en specifik sporttyp.',
    'Välj upp till tre taggar så andra förstår vad gruppen handlar om.',
    'Ge gruppen ett namn, en bild och en beskrivning.',
    'Du bestämmer vem som kan gå med.',
    'Välj Global om gruppen inte hör till en specifik plats.',
  ]

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeScreen style={s.screen}>
        <View style={s.header}>
          {step > 0 ? (
            <GlassCircleButton icon="chevron-back" size={40} iconColor={TEXT_PRIMARY}
              onPress={() => setStep(step - 1)} fallbackStyle={s.iconFallback} />
          ) : <View style={{ width: 40 }} />}
          <GlassCircleButton icon="close" size={40} iconColor={TEXT_PRIMARY}
            onPress={close} fallbackStyle={s.iconFallback} />
        </View>

        {/* Stegindikator */}
        <View style={s.progressRow}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[s.progressBar, { backgroundColor: i <= step ? T.ACCENT : light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.14)' }]} />
          ))}
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>{titles[step]}</Text>
          <Text style={s.intro}>{intros[step]}</Text>

          {/* ── 1. Sport ── */}
          {step === 0 && SPORTS.map(sp => {
            const on = sport === sp.key
            return (
              <TouchableOpacity key={sp.key} style={s.optionRow} activeOpacity={0.7}
                onPress={() => { Haptics.selectionAsync(); setSport(sp.key) }} testID={`sport-${sp.key}`}>
                <View style={s.optionIcon}>
                  <Ionicons name={sp.icon} size={21} color={T.ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.optionTitle}>{sp.label}</Text>
                  {sp.desc ? <Text style={s.optionBody}>{sp.desc}</Text> : null}
                </View>
                <View style={[s.radio, { borderColor: on ? T.ACCENT : radioEdge }]}>
                  {on && <View style={[s.radioDot, { backgroundColor: T.ACCENT }]} />}
                </View>
              </TouchableOpacity>
            )
          })}

          {/* ── 2. Taggar ── */}
          {step === 1 && TAGS.map(tag => {
            const on = tags.includes(tag)
            return (
              <TouchableOpacity key={tag}
                style={[s.tagCard, { borderColor: on ? T.ACCENT : cardEdge }]}
                activeOpacity={0.7} onPress={() => toggleTag(tag)} testID={`tag-${tag}`}>
                <Text style={s.optionTitle}>{tag}</Text>
                <View style={[s.checkbox, { borderColor: on ? T.ACCENT : radioEdge }, on && { backgroundColor: T.ACCENT }]}>
                  {on && <Ionicons name="checkmark" size={14} color={light ? '#fff' : '#000'} />}
                </View>
              </TouchableOpacity>
            )
          })}

          {/* ── 3. Namn, bild, beskrivning ── */}
          {step === 2 && (
            <>
              <TouchableOpacity style={s.imageTile} onPress={pickImage} activeOpacity={0.8} testID="groupImage">
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={s.imagePreview} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={30} color={TEXT_SECONDARY} />
                    <Text style={s.imageTileText}>Ladda upp bild</Text>
                  </>
                )}
                <View style={[s.imagePencil, { backgroundColor: T.ACCENT }]}>
                  <Ionicons name="pencil" size={13} color={light ? '#fff' : '#000'} />
                </View>
              </TouchableOpacity>

              <View style={s.fieldHead}>
                <Text style={s.fieldLabel}>GRUPPENS NAMN</Text>
                <Text style={s.fieldReq}>Obligatoriskt</Text>
              </View>
              <AppTextInput
                style={s.input}
                value={name}
                onChangeText={t => setName(t.slice(0, 80))}
                placeholder="Ge din grupp ett namn"
                testID="groupName"
              />
              <Text style={s.counter}>{80 - name.length} tecken återstår</Text>

              <Text style={[s.fieldLabel, { marginTop: 14 }]}>BESKRIVNING</Text>
              <AppTextInput
                style={[s.input, s.inputMulti]}
                value={description}
                onChangeText={t => setDescription(t.slice(0, 500))}
                placeholder="Vad handlar gruppen om?"
                multiline
                testID="groupDesc"
              />
              <Text style={s.counter}>{500 - description.length} tecken återstår</Text>
            </>
          )}

          {/* ── 4. Privat/offentlig ── */}
          {step === 3 && (
            <>
              <Text style={s.sectionLabel}>INTEGRITET</Text>
              {[
                { v: false, title: 'Offentlig', body: 'Alla i SeventyFive kan gå med i gruppen direkt och se dess medlemmar.' },
                { v: true, title: 'Privat', body: 'Man begär medlemskap, och bara du som skapare godkänner nya medlemmar.' },
              ].map(opt => {
                const on = isPrivate === opt.v
                return (
                  <TouchableOpacity key={String(opt.v)} style={s.privacyRow} activeOpacity={0.7}
                    onPress={() => { Haptics.selectionAsync(); setIsPrivate(opt.v) }} testID={opt.v ? 'privacy-private' : 'privacy-public'}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.optionTitle}>{opt.title}</Text>
                      <Text style={s.optionBody}>{opt.body}</Text>
                    </View>
                    <View style={[s.radio, { borderColor: on ? T.ACCENT : radioEdge }]}>
                      {on && <View style={[s.radioDot, { backgroundColor: T.ACCENT }]} />}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </>
          )}

          {/* ── 5. Plats ── */}
          {step === 4 && (
            <>
              <TouchableOpacity
                style={[s.tagCard, { borderColor: !useLocation ? T.ACCENT : cardEdge }]}
                activeOpacity={0.7} onPress={() => { Haptics.selectionAsync(); setUseLocation(false) }} testID="loc-global">
                <View style={s.locRow}>
                  <Ionicons name="earth-outline" size={20} color={T.ACCENT} />
                  <Text style={s.optionTitle}>Global</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.tagCard, { borderColor: useLocation ? T.ACCENT : cardEdge }]}
                activeOpacity={0.7} onPress={() => { Haptics.selectionAsync(); setUseLocation(true) }} testID="loc-place">
                <View style={s.locRow}>
                  <Ionicons name="location-outline" size={20} color={T.ACCENT} />
                  <Text style={s.optionTitle}>En specifik plats</Text>
                </View>
              </TouchableOpacity>
              {useLocation && (
                <AppTextInput
                  style={[s.input, { marginTop: 4 }]}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="t.ex. Skövde"
                  testID="groupLocation"
                />
              )}
            </>
          )}
        </ScrollView>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Text style={s.footerHint}>Du kan alltid ändra detta senare</Text>
          <TouchableOpacity
            style={[s.nextBtn, (!canNext || saving) && { opacity: 0.4 }]}
            onPress={next}
            disabled={!canNext || saving}
            activeOpacity={0.85}
            testID="wizardNext"
          >
            {saving
              ? <ActivityIndicator color={light ? '#fff' : '#000'} />
              : <Text style={s.nextBtnText}>{step === STEPS - 1 ? 'Skapa grupp' : 'Nästa'}</Text>}
          </TouchableOpacity>
        </View>
        </KeyboardAvoidingView>
      </SafeScreen>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  iconFallback: { backgroundColor: CARD },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 18 },
  progressBar: { flex: 1, height: 4, borderRadius: 2 },

  scroll: { paddingHorizontal: 20, paddingBottom: 24 },
  title: { color: TEXT_PRIMARY, fontSize: 28, fontWeight: '800', lineHeight: 34 },
  intro: { color: TEXT_SECONDARY, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 22 },

  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  optionIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: accentAlpha('14'),
    alignItems: 'center', justifyContent: 'center',
  },
  optionTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  optionBody: { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 19, marginTop: 3 },

  radio: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 13, height: 13, borderRadius: 7 },

  tagCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 16, paddingVertical: 17, marginBottom: 10,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },

  imageTile: {
    alignSelf: 'center', width: 150, height: 150, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', gap: 8,
    marginBottom: 22,
  },
  imagePreview: { width: 150, height: 150, borderRadius: 20 },
  imageTileText: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
  imagePencil: {
    position: 'absolute', bottom: -8, right: -8,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },

  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 8 },
  fieldReq: { color: TEXT_SECONDARY, fontSize: 12 },
  input: {
    backgroundColor: CARD, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
  },
  inputMulti: { minHeight: 110, textAlignVertical: 'top' },
  counter: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 6 },

  sectionLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 6 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 15 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  footer: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8, gap: 10, alignItems: 'center' },
  footerHint: { color: TEXT_SECONDARY, fontSize: 13 },
  nextBtn: {
    alignSelf: 'stretch', backgroundColor: ACCENT, borderRadius: 999,
    paddingVertical: 15, alignItems: 'center',
  },
  nextBtnText: { color: ACCENT_CONTRAST, fontSize: 16, fontWeight: '700' },
})
