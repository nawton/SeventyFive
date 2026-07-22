import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActionSheetIOS,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Body from 'react-native-body-highlighter'
import { getMusclesForName, bestSideForMuscles, SLUG_LABELS, getExerciseMuscleGroup, type MuscleGroup } from '@/lib/muscles'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, useThemeStrings } from '@/lib/theme'
import { toLocalDateString, weekdayOf } from '@/lib/date'
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  type Exercise,
} from '@/services/exercises'
import {
  createWorkoutSession,
  updateWorkoutSession,
  deleteWorkoutSession,
  type WorkoutSession,
} from '@/services/workoutSchedule'
import type { ExerciseCategory } from '@/types/database'

// ─── Shared schedule helpers (also imported by add.tsx) ───────────────────────

export const WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

export function todayIso(): number {
  return weekdayOf()
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const CARDIO_TYPES: Array<{
  key: string
  label: string
  icon: React.ComponentProps<typeof Ionicons>['name']
}> = [
  { key: 'running',  label: 'Löpning',  icon: 'fitness-outline' },
  { key: 'cycling',  label: 'Cykling',  icon: 'bicycle-outline' },
  { key: 'interval', label: 'Intervall', icon: 'flash-outline' },
  { key: 'walking',  label: 'Promenad', icon: 'walk-outline' },
]

const CATEGORY_ICONS: Record<ExerciseCategory, React.ComponentProps<typeof Ionicons>['name']> = {
  strength: 'barbell-outline',
  cardio:   'walk-outline',
  mobility: 'body-outline',
  hiit:     'flash-outline',
}

// Gym-pass innehåller bara styrkeövningar — cardio/rörlighet/HIIT är egna pass
const PICKER_FILTERS = [
  { key: 'all',       label: 'Alla' },
  { key: 'legs',      label: 'Ben' },
  { key: 'chest',     label: 'Bröst' },
  { key: 'back',      label: 'Rygg' },
  { key: 'shoulders', label: 'Axlar' },
  { key: 'arms',      label: 'Armar' },
  { key: 'core',      label: 'Mage' },
]

interface DraftExercise {
  key: string
  exercise_name: string
  sets: string
  reps: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SessionEditor({
  visible,
  session,
  exercises,
  onClose,
  onSaved,
  userId,
  initialDate,
  allowDelete = true,
}: {
  visible:       boolean
  session:       WorkoutSession | null
  exercises:     Exercise[]
  onClose:       () => void
  onSaved:       () => void
  userId:        string
  initialDate?:  Date
  allowDelete?:  boolean
}) {
  const T = useThemeStrings()
  const insets = useSafeAreaInsets()
  const [name, setName]                 = useState('')
  const [notes, setNotes]               = useState('')
  const [weekdays, setWeekdays]         = useState<number[]>([])
  const [repeat, setRepeat]             = useState(false)
  const [drafts, setDrafts]             = useState<DraftExercise[]>([])
  const [sessionType, setSessionType]   = useState<'gym' | 'cardio'>('gym')
  const [cardioType, setCardioType]     = useState('running')
  const [showPicker, setShowPicker]     = useState(false)
  const [pickerFilter, setPickerFilter] = useState('all')
  const [pickerSearch, setPickerSearch] = useState('')
  const [saving, setSaving]             = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [infoEx, setInfoEx]             = useState<Exercise | null>(null)
  const [infoBodyView, setInfoBodyView] = useState<'front' | 'back'>('front')

  useEffect(() => {
    if (infoEx) setInfoBodyView(bestSideForMuscles(getMusclesForName(infoEx.name)))
  }, [infoEx])

  useEffect(() => {
    if (!visible) return
    if (session) {
      // One-time sessions are stored as ONCE:YYYY-MM-DD:name
      if (session.name.startsWith('ONCE:')) {
        const parts = session.name.split(':')
        setName(parts.slice(2).join(':'))
        setRepeat(false)
      } else {
        setName(session.name)
        setRepeat(session.weekdays.length > 0)
      }
      setWeekdays([...session.weekdays])
      setNotes(session.notes ?? '')
      setSessionType(session.session_type ?? 'gym')
      setCardioType(session.cardio_type ?? 'running')
      setDrafts(session.exercises.map(e => ({
        key: e.id,
        exercise_name: e.exercise_name,
        sets: e.sets != null ? String(e.sets) : '',
        reps: e.reps ?? '',
      })))
    } else {
      const wd = initialDate ? weekdayOf(initialDate) : weekdayOf()
      setName('')
      setNotes('')
      setWeekdays([wd])
      setRepeat(false)
      setDrafts([])
      setSessionType('gym')
      setCardioType('running')
    }
    setShowPicker(false)
    setPickerFilter('all')
    setPickerSearch('')
  }, [visible, session])

  // ── Sheet animation ──────────────────────────────────────────────────────────
  const sheetTY      = useSharedValue(700)
  const backdropAnim = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      sheetTY.value      = 700
      backdropAnim.value = 0
      sheetTY.value      = withSpring(0, { damping: 26, stiffness: 260, mass: 1 })
      backdropAnim.value = withTiming(1, { duration: 260 })
    }
  }, [visible])

  function dismissEditor() {
    sheetTY.value      = withTiming(800, { duration: 300 }, () => runOnJS(onClose)())
    backdropAnim.value = withTiming(0, { duration: 250 })
  }

  const editorHandleGesture = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate(e => {
      if (e.translationY > 0) {
        sheetTY.value      = e.translationY
        backdropAnim.value = Math.max(0, 1 - e.translationY / 320)
      }
    })
    .onEnd(e => {
      if (e.translationY > 100 || e.velocityY > 600) {
        sheetTY.value      = withTiming(800, { duration: 280 }, () => runOnJS(onClose)())
        backdropAnim.value = withTiming(0, { duration: 230 })
      } else {
        sheetTY.value      = withSpring(0, { damping: 26, stiffness: 260, mass: 1 })
        backdropAnim.value = withTiming(1, { duration: 200 })
      }
    })

  const editorSheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: sheetTY.value }] }))
  const editorBackdropStyle = useAnimatedStyle(() => ({ opacity: backdropAnim.value }))

  // ── Day selection ────────────────────────────────────────────────────────────
  function toggleDay(d: number) {
    if (repeat) {
      setWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
    } else {
      setWeekdays([d])
    }
  }

  function toggleRepeat() {
    setRepeat(prev => {
      if (prev) setWeekdays(w => w.length > 0 ? [w[0]] : [])
      return !prev
    })
  }

  // ── Draft exercises ──────────────────────────────────────────────────────────
  function addExercise(exName: string) {
    // Cardio-övningar har varken set eller reps — lämna tomt så inget sparas
    const isCardio = exercises.find(e => e.name === exName)?.category === 'cardio'
    setDrafts(prev => [...prev, {
      key: Date.now().toString(),
      exercise_name: exName,
      sets: isCardio ? '' : '3',
      reps: isCardio ? '' : '10',
    }])
  }

  function updateDraft(key: string, field: 'sets' | 'reps', value: string) {
    setDrafts(prev => prev.map(d => d.key === key ? { ...d, [field]: value } : d))
  }

  function removeDraft(key: string) {
    setDrafts(prev => prev.filter(d => d.key !== key))
  }

  // ── Save / delete ────────────────────────────────────────────────────────────
  function resolvedName(): string {
    if (name.trim()) return name.trim()
    if (repeat && weekdays.length > 0)
      return weekdays.sort((a, b) => a - b).map(d => WEEKDAYS[d - 1]).join(', ')
    return 'Träningspass'
  }

  async function handleSave() {
    const missing = drafts.find(d => {
      const ex = exercises.find(e => e.name === d.exercise_name)
      if (ex?.category === 'cardio') return false
      return !d.sets.trim() || !d.reps.trim()
    })
    if (missing) {
      Alert.alert('Ange set och reps', `"${missing.exercise_name}" saknar set eller reps.`)
      return
    }
    setSaving(true)
    try {
      const exList = drafts.map(d => {
        // Cardio-övningar sparas alltid utan set/reps, även om gamla drafts har värden
        const isCardio = exercises.find(e => e.name === d.exercise_name)?.category === 'cardio'
        return {
          exercise_name: d.exercise_name,
          sets: isCardio ? null : (d.sets ? parseInt(d.sets) : null),
          reps: isCardio ? null : (d.reps || null),
        }
      })
      // Repeat OFF: store as one-time with ONCE:date:name convention, weekdays=[]
      const d = initialDate ?? new Date()
      const ds = toLocalDateString(d)
      const base          = resolvedName()
      const savedName     = repeat ? base : `ONCE:${ds}:${base}`
      const savedWeekdays = repeat ? weekdays : []

      const savedNotes = notes.trim() || null
      if (session) {
        await updateWorkoutSession(session.id, savedName, savedWeekdays, exList, savedNotes, sessionType, cardioType || null)
      } else {
        await createWorkoutSession(userId, savedName, savedWeekdays, exList, savedNotes, sessionType, cardioType || null)
      }
      onSaved()
      dismissEditor()
    } catch (e: any) {
      Alert.alert('Kunde inte spara', e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!session) return
    Alert.alert('Ta bort pass', `Ta bort "${session.name}"?`, [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Ta bort',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true)
          try {
            await deleteWorkoutSession(session.id)
            onSaved()
            dismissEditor()
          } catch (e: any) {
            Alert.alert('Fel', e.message)
          } finally {
            setDeleting(false)
          }
        },
      },
    ])
  }

  // ── Picker ───────────────────────────────────────────────────────────────────
  const uniqueExercises = [...new Map(exercises.map(e => [e.name.toLowerCase(), e])).values()]
  const pickerExercises = uniqueExercises.filter(e => {
    // Bara styrkeövningar i gym-passets väljare
    if (e.category !== 'strength') return false
    const matchesFilter = pickerFilter === 'all'
      ? true
      : getExerciseMuscleGroup(e.name) === pickerFilter
    const matchesSearch = pickerSearch.trim() === '' || e.name.toLowerCase().includes(pickerSearch.toLowerCase())
    return matchesFilter && matchesSearch
  })

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={dismissEditor}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }, editorBackdropStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={dismissEditor} activeOpacity={1} />
      </Animated.View>

      <KeyboardAvoidingView
        style={s.overlayKAV}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <Animated.View style={[s.sheet, { backgroundColor: T.BG }, editorSheetStyle]}>
          <GestureDetector gesture={editorHandleGesture}>
            <View style={s.handleWrap}>
              <View style={s.handleBar} />
            </View>
          </GestureDetector>

          <View style={s.header}>
            <TouchableOpacity onPress={dismissEditor} style={s.iconBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={s.title}>{session ? 'Redigera pass' : 'Nytt pass'}</Text>
            {session && allowDelete ? (
              <TouchableOpacity onPress={handleDelete} style={s.iconBtn} activeOpacity={0.7} disabled={deleting}>
                {deleting
                  ? <ActivityIndicator size="small" color="#FF3B4A" />
                  : <Ionicons name="trash-outline" size={20} color="#FF3B4A" />}
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Session type toggle ── */}
            <View style={s.field}>
              <Text style={s.label}>TYP AV PASS</Text>
              <View style={s.typeToggle}>
                {(['gym', 'cardio'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.typeBtn, sessionType === t && s.typeBtnActive]}
                    onPress={() => setSessionType(t)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={t === 'gym' ? 'barbell-outline' : 'fitness-outline'}
                      size={14}
                      color={sessionType === t ? '#000' : TEXT_SECONDARY}
                    />
                    <Text style={[s.typeBtnText, sessionType === t && s.typeBtnTextActive]}>
                      {t === 'gym' ? 'Gympass' : 'Cardio'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>NAMN</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="t.ex. Push-dag, Benen…"
                placeholderTextColor={TEXT_SECONDARY}
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>NOTAT</Text>
              <TextInput
                style={[s.input, s.inputMultiline]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Lägg till ett meddelande eller notat…"
                placeholderTextColor={TEXT_SECONDARY}
                autoCorrect={false}
                multiline
                numberOfLines={3}
                returnKeyType="done"
                blurOnSubmit
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>DAG</Text>
              <View style={s.dayRow}>
                {WEEKDAYS.map((d, i) => {
                  const num    = i + 1
                  const active = weekdays.includes(num)
                  return (
                    <TouchableOpacity
                      key={num}
                      style={[s.dayBtn, active && s.dayBtnActive]}
                      onPress={() => toggleDay(num)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.dayText, active && s.dayTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Upprepa toggle */}
              <TouchableOpacity
                style={[s.repeatRow, repeat && s.repeatRowActive]}
                onPress={toggleRepeat}
                activeOpacity={0.75}
              >
                <View style={[s.repeatIcon, repeat && s.repeatIconActive]}>
                  <Ionicons name="repeat" size={15} color={repeat ? '#000' : TEXT_SECONDARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.repeatLabelRow}>
                    <Text style={[s.repeatLabel, repeat && s.repeatLabelActive]}>Upprepa varje vecka</Text>
                    <TouchableOpacity
                      onPress={() => Alert.alert(
                        'Upprepa varje vecka',
                        'På: passet visas automatiskt varje vald veckodag och fortsätter tills du tar bort det.\n\nAv: passet visas bara en enda gång, på den dag du väljer.',
                        [{ text: 'OK' }],
                      )}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="information-circle-outline" size={16} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                  </View>
                  <Text style={s.repeatSub}>
                    {repeat
                      ? weekdays.length > 0
                        ? weekdays.sort().map(d => WEEKDAYS[d - 1]).join(', ')
                        : 'Välj dagar ovan'
                      : 'Passet visas bara den valda dagen'}
                  </Text>
                </View>
                <View style={[s.swToggle, repeat && s.swToggleActive]}>
                  <View style={[s.swThumb, repeat && s.swThumbActive]} />
                </View>
              </TouchableOpacity>
            </View>

            {/* ── Cardio type picker ── */}
            {sessionType === 'cardio' && (
              <View style={s.field}>
                <Text style={s.label}>AKTIVITET</Text>
                <View style={s.cardioTypeGrid}>
                  {CARDIO_TYPES.map(ct => (
                    <TouchableOpacity
                      key={ct.key}
                      style={[s.cardioTypeBtn, cardioType === ct.key && s.cardioTypeBtnActive]}
                      onPress={() => setCardioType(ct.key)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={ct.icon}
                        size={20}
                        color={cardioType === ct.key ? '#000' : TEXT_SECONDARY}
                      />
                      <Text style={[s.cardioTypeTxt, cardioType === ct.key && s.cardioTypeTxtActive]}>
                        {ct.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ── Gym exercises ── */}
            {sessionType === 'gym' && (
            <View style={s.field}>
              <Text style={s.label}>ÖVNINGAR</Text>
              {drafts.map(d => {
                const exInfo   = exercises.find(e => e.name === d.exercise_name)
                const isCardio = exInfo?.category === 'cardio'
                return (
                  <View key={d.key} style={s.exRow}>
                    <Text style={s.exName} numberOfLines={1}>{d.exercise_name}</Text>
                    {isCardio ? (
                      <View style={s.cardioBadge}>
                        <Ionicons name="walk-outline" size={13} color={ORANGE} />
                        <Text style={s.cardioBadgeText}>Cardio</Text>
                      </View>
                    ) : (
                      <>
                        <TextInput
                          style={s.exSmall}
                          value={d.sets}
                          onChangeText={v => updateDraft(d.key, 'sets', v)}
                          placeholder="Set"
                          placeholderTextColor={TEXT_SECONDARY}
                          keyboardType="number-pad"
                          returnKeyType="done"
                        />
                        <TextInput
                          style={[s.exSmall, { width: 70 }]}
                          value={d.reps}
                          onChangeText={v => updateDraft(d.key, 'reps', v)}
                          placeholder="Reps"
                          placeholderTextColor={TEXT_SECONDARY}
                          returnKeyType="done"
                        />
                      </>
                    )}
                    <TouchableOpacity onPress={() => removeDraft(d.key)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={20} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                  </View>
                )
              })}
              <TouchableOpacity style={s.pickerToggle} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
                <Ionicons name="add" size={17} color={ORANGE} />
                <Text style={s.pickerToggleText}>Lägg till övning</Text>
              </TouchableOpacity>
            </View>
            )}

            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#000" />
                : <Text style={s.saveBtnText}>Spara pass</Text>}
            </TouchableOpacity>
          </ScrollView>

          <View style={{ height: insets.bottom }} />
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Exercise picker */}
      <Modal visible={showPicker} animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <View style={[s.pickerScreen, { paddingTop: insets.top }]}>
          <View style={s.pickerHeader}>
            <TouchableOpacity onPress={() => setShowPicker(false)} style={s.iconBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-down" size={22} color={TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={s.title}>Lägg till övning</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)} style={s.klarBtn} activeOpacity={0.8}>
              <Text style={s.klarBtnText}>Klar{drafts.length > 0 ? ` (${drafts.length})` : ''}</Text>
            </TouchableOpacity>
          </View>

          <View style={s.pickerSearchBar}>
            <Ionicons name="search-outline" size={17} color={TEXT_SECONDARY} />
            <TextInput
              style={s.pickerSearchInput}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder="Sök övning…"
              placeholderTextColor={TEXT_SECONDARY}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {pickerSearch.length > 0 && (
              <TouchableOpacity onPress={() => setPickerSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.pickerFilterStrip}
            contentContainerStyle={s.pickerFilters}
          >
            {PICKER_FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[s.pickerPill, pickerFilter === f.key && s.pickerPillActive]}
                onPress={() => setPickerFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text style={[s.pickerPillText, pickerFilter === f.key && s.pickerPillTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.pickerCount}>{pickerExercises.length} övningar</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {pickerExercises.map(ex => {
              const already = drafts.some(d => d.exercise_name === ex.name)

              function handleLongPress() {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                if (Platform.OS === 'ios') {
                  ActionSheetIOS.showActionSheetWithOptions(
                    {
                      title: ex.name,
                      options: ['Avbryt', already ? 'Ta bort från pass' : 'Lägg till i pass', 'Mer info'],
                      cancelButtonIndex: 0,
                    },
                    (i) => {
                      if (i === 1) already
                        ? removeDraft(drafts.find(d => d.exercise_name === ex.name)!.key)
                        : addExercise(ex.name)
                      if (i === 2) { setShowPicker(false); setTimeout(() => setInfoEx(ex), 350) }
                    },
                  )
                } else {
                  Alert.alert(ex.name, undefined, [
                    { text: already ? 'Ta bort från pass' : 'Lägg till i pass', onPress: () => already ? removeDraft(drafts.find(d => d.exercise_name === ex.name)!.key) : addExercise(ex.name) },
                    { text: 'Mer info', onPress: () => { setShowPicker(false); setTimeout(() => setInfoEx(ex), 350) } },
                    { text: 'Avbryt', style: 'cancel' },
                  ])
                }
              }

              return (
                <TouchableOpacity
                  key={ex.id}
                  style={[s.pickerRow, already && s.pickerRowAdded]}
                  onPress={() => already
                    ? removeDraft(drafts.find(d => d.exercise_name === ex.name)!.key)
                    : addExercise(ex.name)
                  }
                  onLongPress={handleLongPress}
                  delayLongPress={400}
                  activeOpacity={0.7}
                >
                  <View style={[s.pickerIcon, already && { backgroundColor: ORANGE + '20' }]}>
                    <Ionicons name={CATEGORY_ICONS[ex.category]} size={18} color={already ? ORANGE : TEXT_SECONDARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.pickerRowName, already && { color: ORANGE }]}>{ex.name}</Text>
                    <Text style={s.pickerRowSub}>{CATEGORY_LABELS[ex.category]}</Text>
                  </View>
                  <View style={[s.pickerAddBtn, already && { backgroundColor: ORANGE, borderColor: ORANGE }]}>
                    <Ionicons name={already ? 'checkmark' : 'add'} size={18} color={already ? '#000' : TEXT_SECONDARY} />
                  </View>
                </TouchableOpacity>
              )
            })}
            {pickerExercises.length === 0 && (
              <Text style={{ color: TEXT_SECONDARY, textAlign: 'center', marginTop: 40, fontSize: 15 }}>
                Inga övningar hittades
              </Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Exercise info sheet */}
      {(() => {
        const muscles    = infoEx ? getMusclesForName(infoEx.name) : []
        const muscleData = muscles.map(slug => ({ slug, intensity: 1 as const }))
        const diffColor  = infoEx ? (DIFFICULTY_COLORS[infoEx.difficulty] ?? ORANGE) : ORANGE
        return (
          <Modal
            visible={infoEx !== null}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => { setInfoEx(null); setTimeout(() => setShowPicker(true), 350) }}
          >
            <SafeAreaView style={s.infoScreen} edges={['top', 'bottom']}>
              <View style={s.infoHeader}>
                <Text style={s.infoTitle} numberOfLines={1}>{infoEx?.name}</Text>
                <TouchableOpacity
                  onPress={() => { setInfoEx(null); setTimeout(() => setShowPicker(true), 350) }}
                  activeOpacity={0.8}
                  style={s.infoClose}
                >
                  <Ionicons name="close" size={22} color={TEXT_PRIMARY} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={s.infoScroll} showsVerticalScrollIndicator={false}>
                <View style={s.badgeRow}>
                  <View style={s.categoryBadge}>
                    <Text style={s.categoryBadgeText}>{infoEx ? CATEGORY_LABELS[infoEx.category] : ''}</Text>
                  </View>
                  <View style={[s.diffBadge, { backgroundColor: diffColor + '22' }]}>
                    <Text style={[s.diffBadgeText, { color: diffColor }]}>
                      {infoEx ? DIFFICULTY_LABELS[infoEx.difficulty] : ''}
                    </Text>
                  </View>
                </View>

                <View style={s.infoCard}>
                  <View style={s.infoCardTitleRow}>
                    <Text style={s.infoCardTitle}>Muskelgrupper</Text>
                    <View style={s.toggle}>
                      {(['front', 'back'] as const).map(side => (
                        <TouchableOpacity
                          key={side}
                          style={[s.toggleBtn, infoBodyView === side && s.toggleBtnActive]}
                          onPress={() => setInfoBodyView(side)}
                          activeOpacity={0.8}
                        >
                          <Text style={[s.toggleText, infoBodyView === side && s.toggleTextActive]}>
                            {side === 'front' ? 'Fram' : 'Bak'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={s.bodyWrap}>
                    <Body
                      data={muscleData}
                      side={infoBodyView}
                      gender="male"
                      scale={1.6}
                      colors={[ORANGE]}
                      defaultFill="#2A2A2C"
                      border="rgba(255,255,255,0.10)"
                    />
                  </View>
                  {muscles.length > 0 ? (
                    <View style={s.muscleChips}>
                      {muscles.map(slug => (
                        <View key={slug} style={s.muscleChip}>
                          <Text style={s.muscleChipText}>{SLUG_LABELS[slug]}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={s.noMuscles}>Inga muskler mappade för denna övning</Text>
                  )}
                </View>

                {infoEx?.description ? (
                  <View style={s.infoCard}>
                    <Text style={s.infoCardTitle}>Beskrivning</Text>
                    <Text style={s.infoDesc}>{infoEx.description}</Text>
                  </View>
                ) : null}
              </ScrollView>
            </SafeAreaView>
          </Modal>
        )
      })()}
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlayKAV: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    height: '88%',
  },
  handleWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 6 },
  handleBar:  { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  title:  { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 20 },

  field: { gap: 10 },
  label: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, paddingHorizontal: 4 },
  input: {
    backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    color: TEXT_PRIMARY, fontSize: 16,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  inputMultiline: {
    minHeight: 80, textAlignVertical: 'top',
  },

  repeatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    padding: 14, marginTop: 4,
  },
  repeatRowActive: { backgroundColor: ORANGE + '14', borderColor: ORANGE + '40' },
  repeatIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: BG, alignItems: 'center', justifyContent: 'center',
  },
  repeatIconActive: { backgroundColor: ORANGE },
  repeatLabelRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  repeatLabel:      { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  repeatLabelActive:{ color: ORANGE },
  repeatSub:        { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  swToggle: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: BORDER, padding: 2,
    justifyContent: 'center',
  },
  swToggleActive:  { backgroundColor: ORANGE },
  swThumb: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: TEXT_SECONDARY,
  },
  swThumbActive: {
    backgroundColor: '#000',
    transform: [{ translateX: 18 }],
  },

  dayRow: { flexDirection: 'row', gap: 6 },
  dayBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10,
    backgroundColor: CARD,
    borderWidth: 1, borderColor: BORDER,
  },
  dayBtnActive:  { backgroundColor: ORANGE, borderColor: ORANGE },
  dayText:       { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  dayTextActive: { color: '#000', fontWeight: '700' },

  exRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: CARD, borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  exName: { flex: 1, color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  cardioBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: ORANGE + '1E',
  },
  cardioBadgeText: { color: ORANGE, fontSize: 12, fontWeight: '600' },
  exSmall: {
    width: 50, color: TEXT_PRIMARY, fontSize: 13,
    backgroundColor: BG, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6, textAlign: 'center',
  },

  pickerToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: ORANGE + '16', borderRadius: 10, marginTop: 4,
    borderWidth: 1, borderColor: ORANGE + '40',
  },
  pickerToggleText: { color: ORANGE, fontSize: 14, fontWeight: '600' },

  pickerScreen: { flex: 1, backgroundColor: BG },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
  },
  klarBtn:     { backgroundColor: ORANGE, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9 },
  klarBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  pickerSearchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginVertical: 10,
    paddingHorizontal: 14, height: 46,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
  },
  pickerSearchInput:    { flex: 1, color: TEXT_PRIMARY, fontSize: 15, padding: 0 },
  pickerFilterStrip:    { height: 60, flexGrow: 0, marginBottom: 10 },
  pickerFilters:        { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  pickerPill: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: CARD,
    borderWidth: 1, borderColor: BORDER,
  },
  pickerPillActive:     { backgroundColor: ORANGE, borderColor: ORANGE },
  pickerPillText:       { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500' },
  pickerPillTextActive: { color: '#000', fontWeight: '700' },
  pickerCount: {
    color: TEXT_SECONDARY, fontSize: 12, paddingHorizontal: 20,
    paddingBottom: 12,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  pickerRowAdded: { backgroundColor: ORANGE + '08' },
  pickerIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  pickerRowName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  pickerRowSub:  { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  pickerAddBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  saveBtn: {
    backgroundColor: ORANGE, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },

  typeToggle: {
    flexDirection: 'row', gap: 8,
  },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 12, borderRadius: 12,
    backgroundColor: CARD,
    borderWidth: 1, borderColor: BORDER,
  },
  typeBtnActive:     { backgroundColor: ORANGE, borderColor: ORANGE },
  typeBtnText:       { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600' },
  typeBtnTextActive: { color: '#000', fontWeight: '700' },

  cardioTypeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  cardioTypeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 11, paddingHorizontal: 14,
    borderRadius: 12, backgroundColor: CARD,
    borderWidth: 1, borderColor: BORDER,
  },
  cardioTypeBtnActive:  { backgroundColor: ORANGE, borderColor: ORANGE },
  cardioTypeTxt:        { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600' },
  cardioTypeTxtActive:  { color: '#000', fontWeight: '700' },

  infoScreen: { flex: 1, backgroundColor: BG },
  infoHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
  },
  infoTitle:  { flex: 1, color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700', marginRight: 12 },
  infoClose:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  infoScroll: { padding: 20, gap: 16 },

  badgeRow: { flexDirection: 'row', gap: 8 },
  categoryBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: ORANGE + '20',
  },
  categoryBadgeText: { color: ORANGE, fontSize: 13, fontWeight: '600' },
  diffBadge:         { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  diffBadgeText:     { fontSize: 13, fontWeight: '600' },

  infoCard: {
    backgroundColor: CARD, borderRadius: 16, padding: 16, gap: 12,
    borderWidth: 1, borderColor: BORDER,
  },
  infoCardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoCardTitle:    { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },

  toggle: { flexDirection: 'row', backgroundColor: BG, borderRadius: 10, padding: 2 },
  toggleBtn:        { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  toggleBtnActive:  { backgroundColor: ORANGE },
  toggleText:       { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  toggleTextActive: { color: '#000', fontWeight: '700' },

  bodyWrap:       { alignItems: 'center', paddingVertical: 8 },
  muscleChips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muscleChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: ORANGE + '1E',
  },
  muscleChipText: { color: ORANGE, fontSize: 13, fontWeight: '600' },
  noMuscles:      { color: TEXT_SECONDARY, fontSize: 13 },
  infoDesc:       { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 22 },
})
