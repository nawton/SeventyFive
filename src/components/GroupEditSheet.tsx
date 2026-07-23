import { useEffect, useState } from 'react'
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TouchableWithoutFeedback, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { SafeScreen } from '@/components/SafeScreen'
import { GlassCircleButton } from '@/components/GlassButton'
import { AppTextInput } from '@/components/AppTextInput'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { Ionicons } from '@/components/Icon'
import { compressImage } from '@/lib/image'
import { SPORTS, TAGS } from '@/components/GroupWizard'
import { updateGroup, type Group, type GroupSport } from '@/services/groups'
import {
  BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, useThemeStrings, THEME_DARK,
} from '@/lib/theme'

// =============================================================================
// REDIGERA GRUPP — allt på en sida som förlagan: bild med penna, namn,
// sport (väljare), grupptyp (upp till 3), beskrivning, integritet och plats.
// Spara sitter i headern; inga steg att klicka sig igenom.
// =============================================================================

export function GroupEditSheet({ visible, userId, group, onClose, onSaved }: {
  visible: boolean
  userId: string | null
  group: Group | null
  onClose: () => void
  onSaved: (group: Group) => void
}) {
  const T = useThemeStrings()
  const light = T.TEXT_PRIMARY !== '#FFFFFF'
  const radioEdge = light ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.4)'
  const chipEdge = light ? 'transparent' : THEME_DARK.BORDER

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sport, setSport] = useState<GroupSport>('all')
  const [tags, setTags] = useState<string[]>([])
  const [isPrivate, setIsPrivate] = useState(false)
  const [location, setLocation] = useState('')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [sportOpen, setSportOpen] = useState(false)

  // Sportväljaren är ett bottenark med appens dragfysik. Modalen tonar inte:
  // bakgrunden mörknar direkt och bara arket glider — in med fjäder, ut med
  // en snabb glidning. Färgerna bor på den inre vyn — dynamiska färger på
  // animerade noder kraschar Reanimated.
  const SHEET_OFF = 620
  const sheetY = useSharedValue(SHEET_OFF)
  const closeSport = () => {
    sheetY.value = withTiming(SHEET_OFF, { duration: 190 }, () => {
      runOnJS(setSportOpen)(false)
    })
  }
  const pan = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .onUpdate(e => { sheetY.value = Math.max(0, e.translationY) })
    .onEnd(e => {
      if (e.translationY > 110 || e.velocityY > 800) runOnJS(closeSport)()
      else sheetY.value = withSpring(0, { damping: 20, stiffness: 260 })
    })
  const sheetAnim = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }))

  useEffect(() => {
    if (visible && group) {
      setName(group.name); setDescription(group.description ?? '')
      setSport(group.sport); setTags(group.tags ?? [])
      setIsPrivate(group.is_private); setLocation(group.location ?? '')
      setImageUri(null)
    }
  }, [visible, group])

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [1, 1],
    })
    if (!res.canceled && res.assets[0]) {
      setImageUri(await compressImage(res.assets[0].uri))
    }
  }

  function pickSport() {
    Haptics.selectionAsync()
    sheetY.value = SHEET_OFF
    setSportOpen(true)
    sheetY.value = withSpring(0, { damping: 22, stiffness: 240 })
  }

  function toggleTag(tag: string) {
    Haptics.selectionAsync()
    setTags(prev => prev.includes(tag)
      ? prev.filter(t => t !== tag)
      : prev.length >= 3 ? prev : [...prev, tag])
  }

  async function save() {
    if (!group || !userId || name.trim().length < 2) return
    setSaving(true)
    try {
      const saved = await updateGroup(userId, group.id, {
        name, description, sport, tags, isPrivate,
        location: location.trim() || null,
        imageUri,
      })
      onSaved(saved)
    } catch {
      Alert.alert('Kunde inte spara ändringarna', 'Kontrollera anslutningen och försök igen.')
    } finally {
      setSaving(false)
    }
  }

  const sportOption = SPORTS.find(sp => sp.key === sport) ?? SPORTS[0]
  const canSave = name.trim().length >= 2 && !saving

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeScreen style={s.screen}>
        <View style={s.header}>
          <GlassCircleButton icon="chevron-back" size={40} iconColor={TEXT_PRIMARY}
            onPress={onClose} fallbackStyle={s.iconFallback} />
          <Text style={s.headerTitle}>Redigera grupp</Text>
          <TouchableOpacity onPress={save} hitSlop={8} disabled={!canSave} testID="editSave">
            {saving
              ? <ActivityIndicator size="small" color={T.ACCENT} />
              : <Text style={[s.saveText, { color: T.ACCENT }, !canSave && { opacity: 0.4 }]}>Spara</Text>}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.avatarWrap} onPress={pickImage} activeOpacity={0.8} testID="editImage">
            <FeedAvatar url={imageUri ?? group?.avatar_url ?? null}
              fallback={(name || '?').charAt(0).toUpperCase()} size={92} />
            <View style={[s.avatarPencil, { backgroundColor: T.ACCENT }]}>
              <Ionicons name="pencil" size={13} color={light ? '#fff' : '#000'} />
            </View>
          </TouchableOpacity>

          <Text style={s.label}>GRUPPENS NAMN</Text>
          <AppTextInput
            style={s.input}
            value={name}
            onChangeText={t => setName(t.slice(0, 80))}
            placeholder="Ge din grupp ett namn"
            testID="editName"
          />

          <Text style={s.label}>SPORT</Text>
          <TouchableOpacity style={s.pickerRow} onPress={pickSport} activeOpacity={0.7} testID="editSport">
            <Ionicons name={sportOption.icon} size={19} color={T.ACCENT} />
            <Text style={s.pickerText}>{sportOption.label}</Text>
            <Ionicons name="chevron-down" size={16} color={TEXT_SECONDARY} />
          </TouchableOpacity>

          <View style={s.labelRow}>
            <Text style={s.label}>GRUPPTYP</Text>
            <Text style={s.labelHint}>Välj upp till 3</Text>
          </View>
          <View style={s.tagWrap}>
            {TAGS.map(tag => {
              const on = tags.includes(tag)
              return (
                <TouchableOpacity key={tag}
                  style={[s.tagChip, { borderColor: on ? T.ACCENT : chipEdge }]}
                  activeOpacity={0.7} onPress={() => toggleTag(tag)} testID={`editTag-${tag}`}>
                  <Text style={[s.tagChipText, on && { color: T.ACCENT }]}>{tag}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={s.label}>BESKRIVNING</Text>
          <AppTextInput
            style={[s.input, s.inputMulti]}
            value={description}
            onChangeText={t => setDescription(t.slice(0, 500))}
            placeholder="Vad handlar gruppen om?"
            multiline
            testID="editDesc"
          />
          <Text style={s.counter}>{500 - description.length} tecken återstår</Text>

          <Text style={s.label}>INTEGRITET</Text>
          {[
            { v: false, title: 'Offentlig' },
            { v: true, title: 'Privat' },
          ].map(opt => {
            const on = isPrivate === opt.v
            return (
              <TouchableOpacity key={String(opt.v)} style={s.privacyRow} activeOpacity={0.7}
                onPress={() => { Haptics.selectionAsync(); setIsPrivate(opt.v) }}
                testID={opt.v ? 'editPrivate' : 'editPublic'}>
                <Text style={s.privacyText}>{opt.title}</Text>
                <View style={[s.radio, { borderColor: on ? T.ACCENT : radioEdge }]}>
                  {on && <View style={[s.radioDot, { backgroundColor: T.ACCENT }]} />}
                </View>
              </TouchableOpacity>
            )
          })}

          <View style={s.labelRow}>
            <Text style={s.label}>PLATS</Text>
            <Text style={s.labelHint}>Valfritt — tomt betyder Global</Text>
          </View>
          <AppTextInput
            style={s.input}
            value={location}
            onChangeText={setLocation}
            placeholder="t.ex. Skövde"
            testID="editLocation"
          />
        </ScrollView>
        </KeyboardAvoidingView>

        {/* Sportväljaren — bottenark som dras ner för att stängas */}
        <Modal visible={sportOpen} transparent animationType="none" onRequestClose={closeSport}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={s.sheetBackdrop}>
              <TouchableWithoutFeedback onPress={closeSport}>
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>
              <Animated.View style={sheetAnim}>
                <GestureDetector gesture={pan}>
                  <View style={s.sheet}>
                    <View style={s.handle} />
                    <Text style={s.sheetTitle}>Sport</Text>
                    {SPORTS.map(sp => {
                      const on = sport === sp.key
                      return (
                        <TouchableOpacity key={sp.key} style={s.sheetRow} activeOpacity={0.7}
                          onPress={() => { Haptics.selectionAsync(); setSport(sp.key); closeSport() }}
                          testID={`sportOpt-${sp.key}`}>
                          <Ionicons name={sp.icon} size={20} color={T.ACCENT} />
                          <Text style={s.sheetRowText}>{sp.label}</Text>
                          <View style={[s.radio, { borderColor: on ? T.ACCENT : radioEdge }]}>
                            {on && <View style={[s.radioDot, { backgroundColor: T.ACCENT }]} />}
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </GestureDetector>
              </Animated.View>
            </View>
          </GestureHandlerRootView>
        </Modal>
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
  headerTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  saveText: { fontSize: 16, fontWeight: '700' },

  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  avatarWrap: { alignSelf: 'center', marginTop: 8, marginBottom: 10 },
  avatarPencil: {
    position: 'absolute', bottom: -2, right: -2,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },

  label: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.4, marginTop: 18, marginBottom: 8,
  },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  labelHint: { color: TEXT_SECONDARY, fontSize: 12 },
  input: {
    backgroundColor: CARD, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
  },
  inputMulti: { minHeight: 110, textAlignVertical: 'top' },
  counter: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 6 },

  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 15,
  },
  pickerText: { flex: 1, color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },

  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    backgroundColor: CARD, borderRadius: 999, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  tagChipText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' },

  privacyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 11,
  },
  privacyText: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  radio: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 12, height: 12, borderRadius: 6 },

  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: BG, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 10, paddingBottom: 42,
  },
  handle: {
    width: 40, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.45)',
    alignSelf: 'center', marginBottom: 12,
  },
  sheetTitle: { color: TEXT_PRIMARY, fontSize: 19, fontWeight: '800', marginBottom: 6 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  sheetRowText: { flex: 1, color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
})
