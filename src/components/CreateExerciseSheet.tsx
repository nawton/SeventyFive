import { useEffect, useState } from 'react'
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import Body from 'react-native-body-highlighter'
import { Ionicons } from '@/components/Icon'
import { GlassCircleButton } from '@/components/GlassButton'
import { AppTextInput } from '@/components/AppTextInput'
import { useT } from '@/lib/i18n'
import { SLUG_LABELS, bestSideForMuscles, type Slug } from '@/lib/muscles'
import {
  createCustomExercise, EQUIPMENT_LABELS, EXERCISE_TYPE_INFO,
  type Exercise, type ExerciseEquipment, type ExerciseType,
} from '@/services/exercises'
import {
  BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT, accentAlpha, useCardChrome, useThemeStrings,
} from '@/lib/theme'

// =============================================================================
// SKAPA EGEN ÖVNING — för övningar som saknas i biblioteket. Namn, utrustning,
// primär muskel (styr muskelkartan), övriga muskler och övningstyp. Undersidor
// för varje val, som förlagan: formulär → väljarlista → tillbaka.
// =============================================================================

type Page = 'form' | 'equipment' | 'muscle' | 'otherMuscles' | 'type'

/** Var på kroppen muskeln sitter, som andel av höjden uppifrån — cirkeln
    panoreras dit så vald muskel hamnar i mitten (vader nere, axlar uppe) */
const MUSCLE_CENTER: Partial<Record<Slug, number>> = {
  trapezius: 0.16, deltoids: 0.20, chest: 0.24, 'upper-back': 0.25,
  biceps: 0.29, triceps: 0.29, abs: 0.34, obliques: 0.34,
  'lower-back': 0.36, forearm: 0.38, gluteal: 0.46, adductors: 0.52,
  quadriceps: 0.55, hamstring: 0.58, tibialis: 0.74, calves: 0.75,
}

/** Miniatyrkropp inzoomad och panorerad så vald muskel ligger mitt i cirkeln */
function MuscleThumb({ slug }: { slug: Slug }) {
  const [bodyH, setBodyH] = useState(0)
  const frac = MUSCLE_CENTER[slug] ?? 0.35
  return (
    <View style={s.muscleThumb}>
      <View
        onLayout={e => setBodyH(e.nativeEvent.layout.height)}
        style={{ transform: [{ translateY: bodyH ? (0.5 - frac) * bodyH : 0 }] }}
      >
        <Body
          data={[{ slug, intensity: 1 as const }]}
          side={bestSideForMuscles([slug])}
          gender="male"
          scale={0.45}
          colors={['#FFA817']}
          defaultFill="#3A3A3C"
        />
      </View>
    </View>
  )
}

// Bara tränbara muskler — SLUG_LABELS innehåller även hår, huvud, händer m.m.
const MUSCLE_SLUGS: Slug[] = [
  'chest', 'upper-back', 'lower-back', 'trapezius', 'deltoids',
  'biceps', 'triceps', 'forearm', 'abs', 'obliques',
  'quadriceps', 'hamstring', 'gluteal', 'adductors', 'calves', 'tibialis',
]
const EQUIPMENT_KEYS = Object.keys(EQUIPMENT_LABELS) as ExerciseEquipment[]
const TYPE_KEYS = Object.keys(EXERCISE_TYPE_INFO) as ExerciseType[]

export function CreateExerciseSheet({ visible, onClose, onCreated }: {
  visible: boolean
  onClose: () => void
  /** Den nyskapade övningen — läggs in i väljarens lista och kan väljas direkt */
  onCreated: (exercise: Exercise) => void
}) {
  const t = useT()
  const T = useThemeStrings()
  const chrome = useCardChrome()
  const insets = useSafeAreaInsets()

  const [page, setPage] = useState<Page>('form')
  const [name, setName] = useState('')
  const [equipment, setEquipment] = useState<ExerciseEquipment | null>(null)
  const [primaryMuscle, setPrimaryMuscle] = useState<Slug | null>(null)
  const [otherMuscles, setOtherMuscles] = useState<Slug[]>([])
  const [exerciseType, setExerciseType] = useState<ExerciseType | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) {
      setPage('form')
      setName('')
      setEquipment(null)
      setPrimaryMuscle(null)
      setOtherMuscles([])
      setExerciseType(null)
    }
  }, [visible])

  const canSave = name.trim().length > 0 && equipment !== null &&
    primaryMuscle !== null && exerciseType !== null

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const created = await createCustomExercise({
        name: name.trim(),
        equipment: equipment!,
        primaryMuscle: primaryMuscle!,
        otherMuscles,
        exerciseType: exerciseType!,
      })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onCreated(created)
      onClose()
    } catch {
      Alert.alert(t('Kunde inte spara'), t('Kontrollera din anslutning och försök igen.'))
    } finally {
      setSaving(false)
    }
  }

  function toggleOtherMuscle(slug: Slug) {
    Haptics.selectionAsync()
    setOtherMuscles(prev =>
      prev.includes(slug) ? prev.filter(x => x !== slug) : [...prev, slug])
  }

  const pageTitle =
    page === 'equipment'    ? t('Välj utrustning')
    : page === 'muscle'       ? t('Primär muskelgrupp')
    : page === 'otherMuscles' ? t('Lägg till muskler')
    : page === 'type'         ? t('Välj övningstyp')
    : t('Skapa övning')

  /** Formulärrad i inställningsstil: etikett, valt värde och chevron */
  function PickerRow({ label, value, placeholder, onPress, last }: {
    label: string
    value: string | null
    placeholder: string
    onPress: () => void
    last?: boolean
  }) {
    return (
      <TouchableOpacity
        style={[s.pickerRow, !last && s.pickerRowBorder]}
        onPress={onPress}
        activeOpacity={0.7}
        testID={`create-${label}`}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.pickerLabel}>{label}</Text>
          <Text style={value ? s.pickerValue : s.pickerPlaceholder}>
            {value ?? placeholder}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={TEXT_SECONDARY} />
      </TouchableOpacity>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <GlassCircleButton
            icon={page === 'form' ? 'close' : 'chevron-back'}
            size={40}
            iconColor={TEXT_PRIMARY}
            onPress={page === 'form' ? onClose : () => setPage('form')}
            fallbackStyle={s.iconBtnFallback}
          />
          <Text style={s.title}>{pageTitle}</Text>
          {page === 'form' ? (
            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: T.ACCENT }, (!canSave || saving) && { opacity: 0.35 }]}
              onPress={handleSave}
              disabled={!canSave || saving}
              activeOpacity={0.8}
              testID="createExerciseSave"
            >
              <Text style={s.saveBtnText}>{saving ? t('Sparar …') : t('Spara')}</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 64 }} />}
        </View>

        {/* ── Formuläret ── */}
        {page === 'form' && (
          <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
            <Text style={s.fieldLabel}>{t('ÖVNINGSNAMN')}</Text>
            <AppTextInput
              style={s.nameInput}
              value={name}
              onChangeText={setName}
              placeholder={t('T.ex. Landmine press')}
              placeholderTextColor="rgba(128,128,128,0.6)"
              autoFocus
              testID="exerciseName"
            />

            <View style={[s.card, chrome]}>
              <PickerRow
                label={t('Utrustning')}
                value={equipment ? t(EQUIPMENT_LABELS[equipment]) : null}
                placeholder={t('Välj')}
                onPress={() => setPage('equipment')}
              />
              <PickerRow
                label={t('Primär muskelgrupp')}
                value={primaryMuscle ? t(SLUG_LABELS[primaryMuscle]) : null}
                placeholder={t('Välj')}
                onPress={() => setPage('muscle')}
              />
              <View style={[s.pickerRow, s.pickerRowBorder, { alignItems: 'flex-start' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.pickerLabel}>{t('Fler muskler')}</Text>
                  <View style={s.chipWrap}>
                    {otherMuscles.map(sl => (
                      <TouchableOpacity
                        key={sl}
                        style={s.muscleChip}
                        onPress={() => toggleOtherMuscle(sl)}
                        activeOpacity={0.7}
                        testID={`removeMuscle-${sl}`}
                      >
                        <Text style={s.muscleChipText}>{t(SLUG_LABELS[sl])}</Text>
                        <Ionicons name="close" size={13} color={ACCENT} />
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={s.addChip}
                      onPress={() => setPage('otherMuscles')}
                      activeOpacity={0.7}
                      testID="addMuscle"
                    >
                      <Ionicons name="add" size={16} color={ACCENT} />
                      {otherMuscles.length === 0 && (
                        <Text style={s.addChipText}>{t('Lägg till muskel')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <PickerRow
                label={t('Övningstyp')}
                value={exerciseType ? t(EXERCISE_TYPE_INFO[exerciseType].label) : null}
                placeholder={t('Välj')}
                onPress={() => setPage('type')}
                last
              />
            </View>

            <Text style={s.hint}>
              {t('Övningen blir bara synlig för dig och dyker upp i övningsväljaren under sin muskelgrupp.')}
            </Text>
          </ScrollView>
        )}

        {/* ── Utrustning ── */}
        {page === 'equipment' && (
          <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}>
            {EQUIPMENT_KEYS.map(key => (
              <TouchableOpacity
                key={key}
                style={[s.optionRow, equipment === key && s.optionRowActive]}
                onPress={() => { Haptics.selectionAsync(); setEquipment(key); setPage('form') }}
                activeOpacity={0.7}
                testID={`equipment-${key}`}
              >
                <Text style={[s.optionText, equipment === key && { color: ACCENT, fontWeight: '700' }]}>
                  {t(EQUIPMENT_LABELS[key])}
                </Text>
                {equipment === key && <Ionicons name="checkmark" size={18} color={ACCENT} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Primär muskel ── */}
        {page === 'muscle' && (
          <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}>
            {MUSCLE_SLUGS.map(slug => (
              <TouchableOpacity
                key={slug}
                style={[s.optionRow, primaryMuscle === slug && s.optionRowActive]}
                onPress={() => { Haptics.selectionAsync(); setPrimaryMuscle(slug); setPage('form') }}
                activeOpacity={0.7}
                testID={`muscle-${slug}`}
              >
                <MuscleThumb slug={slug} />
                <Text style={[s.optionText, { flex: 1 }, primaryMuscle === slug && { color: ACCENT, fontWeight: '700' }]}>
                  {t(SLUG_LABELS[slug])}
                </Text>
                {primaryMuscle === slug && <Ionicons name="checkmark" size={18} color={ACCENT} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Övriga muskler (flervalslista) ── */}
        {page === 'otherMuscles' && (
          <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}>
            {MUSCLE_SLUGS.filter(sl => sl !== primaryMuscle).map(slug => {
              const on = otherMuscles.includes(slug)
              return (
                <TouchableOpacity
                  key={slug}
                  style={[s.optionRow, on && s.optionRowActive]}
                  onPress={() => toggleOtherMuscle(slug)}
                  activeOpacity={0.7}
                  testID={`other-${slug}`}
                >
                  <MuscleThumb slug={slug} />
                  <Text style={[s.optionText, { flex: 1 }, on && { color: ACCENT, fontWeight: '700' }]}>
                    {t(SLUG_LABELS[slug])}
                  </Text>
                  <View style={[s.checkbox, on && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
                    {on && <Ionicons name="checkmark" size={13} color="#000" />}
                  </View>
                </TouchableOpacity>
              )
            })}
            <TouchableOpacity style={s.doneBtn} onPress={() => setPage('form')} activeOpacity={0.8}>
              <Text style={s.doneBtnText}>{t('Klar')}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── Övningstyp ── */}
        {page === 'type' && (
          <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}>
            {TYPE_KEYS.map(key => {
              const info = EXERCISE_TYPE_INFO[key]
              const on = exerciseType === key
              return (
                <TouchableOpacity
                  key={key}
                  style={[s.typeRow, on && s.optionRowActive]}
                  onPress={() => { Haptics.selectionAsync(); setExerciseType(key); setPage('form') }}
                  activeOpacity={0.7}
                  testID={`type-${key}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.optionText, on && { color: ACCENT, fontWeight: '700' }]}>
                      {t(info.label)}
                    </Text>
                    <Text style={s.typeExample}>{t('Exempel: {names}', { names: t(info.example) })}</Text>
                    <View style={s.badgeRow}>
                      {info.badges.map(b => (
                        <View key={b} style={s.badge}>
                          <Text style={s.badgeText}>{t(b)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  {on && <Ionicons name="checkmark" size={18} color={ACCENT} />}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, gap: 10,
  },
  iconBtnFallback: { backgroundColor: CARD },
  title: { flex: 1, color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  saveBtn: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, minWidth: 64, alignItems: 'center' },
  saveBtnText: { color: '#000', fontSize: 14, fontWeight: '800' },

  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },

  fieldLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.2, marginTop: 6,
  },
  nameInput: {
    backgroundColor: CARD, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    color: TEXT_PRIMARY, fontSize: 16, marginBottom: 8,
  },

  card: { backgroundColor: CARD, borderRadius: 16 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, gap: 10,
  },
  pickerRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.25)' },
  pickerLabel: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  pickerValue: { color: ACCENT, fontSize: 13, marginTop: 3, fontWeight: '600' },
  pickerPlaceholder: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 3 },

  hint: { color: TEXT_SECONDARY, fontSize: 12, lineHeight: 18, marginTop: 4 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  muscleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: accentAlpha('16'), borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 6,
  },
  muscleChipText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
  addChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: accentAlpha('55'), borderStyle: 'dashed',
    borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6,
  },
  addChipText: { color: ACCENT, fontSize: 13, fontWeight: '600' },

  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: CARD, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 15, gap: 12,
  },
  muscleThumb: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,168,23,0.08)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  optionRowActive: { backgroundColor: accentAlpha('14') },
  optionText: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },

  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: 'rgba(128,128,128,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },

  typeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  typeExample: { color: TEXT_SECONDARY, fontSize: 12.5, marginTop: 3 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  badge: {
    backgroundColor: 'rgba(128,128,128,0.18)', borderRadius: 7,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeText: { color: TEXT_PRIMARY, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  doneBtn: {
    backgroundColor: ACCENT, borderRadius: 999,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  doneBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
})
