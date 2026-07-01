import { useCallback, useEffect, useRef, useState } from 'react'
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
import { useFocusEffect, router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import Body from 'react-native-body-highlighter'
import { supabase } from '@/lib/supabase'
import {
  getExercises,
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  type Exercise,
} from '@/services/exercises'
import {
  getWorkoutSessions,
  createWorkoutSession,
  updateWorkoutSession,
  updateSessionExercise,
  deleteWorkoutSession,
  deleteSessionExercise,
  getCompletedSessionIds,
  getCompletedExerciseIds,
  completeSession,
  uncompleteSession,
  completeExercise,
  uncompleteExercise,
  dateForWeekday,
  type WorkoutSession,
} from '@/services/workoutSchedule'
import { getWorkoutsForDate, deleteWorkout, type StrengthWorkout } from '@/services/workouts'
import { WorkoutSection } from '@/components/WorkoutSection'
import { LoggedWorkoutRow } from '@/components/LoggedWorkoutRow'
import { getMusclesForName, bestSideForMuscles, SLUG_LABELS } from '@/lib/muscles'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import type { ExerciseCategory } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

type MuscleGroup = 'all' | 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core'

const SLUG_TO_GROUP: Record<string, MuscleGroup> = {
  chest: 'chest', 'upper-back': 'back', 'lower-back': 'back',
  trapezius: 'back', quadriceps: 'legs', hamstring: 'legs',
  gluteal: 'legs', calves: 'legs', adductors: 'legs',
  deltoids: 'shoulders', biceps: 'arms', triceps: 'arms',
  forearm: 'arms', abs: 'core', obliques: 'core',
}

const GPS_KEYWORDS = ['löpning', 'running', 'jogging', 'cykling', 'cycling', 'promenad', 'walking', 'spring', 'intervallspring', 'gång']

const CATEGORY_ICONS: Record<ExerciseCategory, React.ComponentProps<typeof Ionicons>['name']> = {
  strength: 'barbell-outline',
  cardio:   'walk-outline',
  mobility: 'body-outline',
  hiit:     'flash-outline',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso(): number {
  const d = new Date().getDay()
  return d === 0 ? 7 : d
}

function getExerciseMuscleGroup(name: string): MuscleGroup {
  for (const slug of getMusclesForName(name)) {
    const g = SLUG_TO_GROUP[slug]
    if (g) return g
  }
  return 'all'
}

// ─── Draft types for the session editor ──────────────────────────────────────

interface DraftExercise {
  key: string
  exercise_name: string
  sets: string
  reps: string
}

// ─── Session editor modal ─────────────────────────────────────────────────────

function SessionEditor({
  visible,
  session,
  exercises,
  onClose,
  onSaved,
  userId,
}: {
  visible: boolean
  session: WorkoutSession | null
  exercises: Exercise[]
  onClose: () => void
  onSaved: () => void
  userId: string
}) {
  const insets = useSafeAreaInsets()
  const [name, setName]                     = useState('')
  const [weekdays, setWeekdays]             = useState<number[]>([])
  const [multiDay, setMultiDay]             = useState(false)
  const [drafts, setDrafts]                 = useState<DraftExercise[]>([])
  const [showPicker, setShowPicker]         = useState(false)
  const [pickerFilter, setPickerFilter]     = useState('all')
  const [pickerSearch, setPickerSearch]     = useState('')
  const [saving, setSaving]                 = useState(false)
  const [deleting, setDeleting]             = useState(false)
  const [infoEx, setInfoEx]                 = useState<Exercise | null>(null)
  const [infoBodyView, setInfoBodyView]     = useState<'front' | 'back'>('front')

  useEffect(() => {
    if (infoEx) {
      setInfoBodyView(bestSideForMuscles(getMusclesForName(infoEx.name)))
    }
  }, [infoEx])

  useEffect(() => {
    if (!visible) return
    if (session) {
      setName(session.name)
      setWeekdays([...session.weekdays])
      setDrafts(session.exercises.map(e => ({
        key: e.id,
        exercise_name: e.exercise_name,
        sets: e.sets != null ? String(e.sets) : '',
        reps: e.reps ?? '',
      })))
    } else {
      setName('')
      setWeekdays([todayIso()])
      setMultiDay(false)
      setDrafts([])
    }
    setShowPicker(false)
    setPickerFilter('all')
    setPickerSearch('')
  }, [visible, session])

  // ── Sheet animation ───────────────────────────────────────────────────────────
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

  function toggleDay(d: number) {
    if (multiDay) {
      setWeekdays(prev =>
        prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
      )
    } else {
      setWeekdays([d])
    }
  }

  function toggleMultiDay() {
    setMultiDay(prev => {
      if (prev) {
        // Switching off: keep only the first selected day
        setWeekdays(w => w.length > 0 ? [w[0]] : [])
      }
      return !prev
    })
  }

  function addExercise(exName: string) {
    setDrafts(prev => [...prev, { key: Date.now().toString(), exercise_name: exName, sets: '3', reps: '10' }])
  }

  function updateDraft(key: string, field: 'sets' | 'reps', value: string) {
    setDrafts(prev => prev.map(d => d.key === key ? { ...d, [field]: value } : d))
  }

  function removeDraft(key: string) {
    setDrafts(prev => prev.filter(d => d.key !== key))
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Ange ett namn på passet'); return }
    setSaving(true)
    try {
      const exList = drafts.map(d => ({
        exercise_name: d.exercise_name,
        sets: d.sets ? parseInt(d.sets) : null,
        reps: d.reps || null,
      }))
      if (session) {
        await updateWorkoutSession(session.id, name.trim(), weekdays, exList)
      } else {
        await createWorkoutSession(userId, name.trim(), weekdays, exList)
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

  const PICKER_FILTERS = [
    { key: 'all',       label: 'Alla' },
    { key: 'cardio',    label: 'Cardio' },
    { key: 'legs',      label: 'Ben' },
    { key: 'chest',     label: 'Bröst' },
    { key: 'back',      label: 'Rygg' },
    { key: 'shoulders', label: 'Axlar' },
    { key: 'arms',      label: 'Armar' },
    { key: 'core',      label: 'Mage' },
    { key: 'mobility',  label: 'Rörlighet' },
    { key: 'hiit',      label: 'HIIT' },
  ]

  const uniqueExercises = [...new Map(exercises.map(e => [e.name.toLowerCase(), e])).values()]
  const pickerExercises = uniqueExercises.filter(e => {
    const matchesFilter = pickerFilter === 'all'
      ? true
      : ['cardio', 'mobility', 'hiit'].includes(pickerFilter)
        ? e.category === pickerFilter
        : e.category === 'strength' && getExerciseMuscleGroup(e.name) === pickerFilter
    const matchesSearch = pickerSearch.trim() === '' || e.name.toLowerCase().includes(pickerSearch.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={dismissEditor}>
      {/* Animated backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }, editorBackdropStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={dismissEditor} activeOpacity={1} />
      </Animated.View>

      {/* KAV positions the sheet at the bottom; box-none lets taps above sheet reach backdrop */}
      <KeyboardAvoidingView
        style={ed.overlayKAV}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <Animated.View style={[ed.sheet, editorSheetStyle]}>
          <GestureDetector gesture={editorHandleGesture}>
            <View style={ed.handleWrap}>
              <View style={ed.handleBar} />
            </View>
          </GestureDetector>
          <View style={ed.header}>
            <TouchableOpacity onPress={dismissEditor} style={ed.iconBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={ed.title}>{session ? 'Redigera pass' : 'Nytt pass'}</Text>
            {session ? (
              <TouchableOpacity onPress={handleDelete} style={ed.iconBtn} activeOpacity={0.7} disabled={deleting}>
                {deleting
                  ? <ActivityIndicator size="small" color="#E53935" />
                  : <Ionicons name="trash-outline" size={20} color="#E53935" />}
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={ed.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={ed.field}>
              <Text style={ed.label}>NAMN</Text>
              <TextInput
                style={ed.input}
                value={name}
                onChangeText={setName}
                placeholder="t.ex. Push-dag, Benen…"
                placeholderTextColor={TEXT_SECONDARY}
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>

            <View style={ed.field}>
              <View style={ed.dayLabelRow}>
                <Text style={ed.label}>VECKODAGAR</Text>
                <TouchableOpacity
                  style={[ed.multiBtn, multiDay && ed.multiBtnActive]}
                  onPress={toggleMultiDay}
                  activeOpacity={0.75}
                >
                  <Ionicons name="layers-outline" size={13} color={multiDay ? '#000' : TEXT_SECONDARY} />
                  <Text style={[ed.multiBtnText, multiDay && ed.multiBtnTextActive]}>Flera dagar</Text>
                </TouchableOpacity>
              </View>
              <View style={ed.dayRow}>
                {WEEKDAYS.map((d, i) => {
                  const num    = i + 1
                  const active = weekdays.includes(num)
                  return (
                    <TouchableOpacity
                      key={num}
                      style={[ed.dayBtn, active && ed.dayBtnActive]}
                      onPress={() => toggleDay(num)}
                      activeOpacity={0.7}
                    >
                      <Text style={[ed.dayText, active && ed.dayTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            <View style={ed.field}>
              <Text style={ed.label}>ÖVNINGAR</Text>
              {drafts.map(d => {
                const exInfo    = exercises.find(e => e.name === d.exercise_name)
                const isCardio  = exInfo?.category === 'cardio'
                return (
                  <View key={d.key} style={ed.exRow}>
                    <Text style={ed.exName} numberOfLines={1}>{d.exercise_name}</Text>
                    {isCardio ? (
                      <View style={ed.cardioBadge}>
                        <Ionicons name="walk-outline" size={13} color={ORANGE} />
                        <Text style={ed.cardioBadgeText}>Cardio</Text>
                      </View>
                    ) : (
                      <>
                        <TextInput
                          style={ed.exSmall}
                          value={d.sets}
                          onChangeText={v => updateDraft(d.key, 'sets', v)}
                          placeholder="Set"
                          placeholderTextColor={TEXT_SECONDARY}
                          keyboardType="number-pad"
                          returnKeyType="done"
                        />
                        <TextInput
                          style={[ed.exSmall, { width: 70 }]}
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
              <TouchableOpacity
                style={ed.pickerToggle}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={17} color={ORANGE} />
                <Text style={ed.pickerToggleText}>Lägg till övning</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[ed.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#000" />
                : <Text style={ed.saveBtnText}>Spara pass</Text>}
            </TouchableOpacity>
          </ScrollView>
          <View style={{ height: insets.bottom }} />
        </Animated.View>
      </KeyboardAvoidingView>

      <Modal visible={showPicker} animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <View style={[ed.pickerScreen, { paddingTop: insets.top }]}>
          <View style={ed.pickerHeader}>
            <TouchableOpacity onPress={() => setShowPicker(false)} style={ed.iconBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-down" size={22} color={TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={ed.title}>Lägg till övning</Text>
            <TouchableOpacity
              onPress={() => setShowPicker(false)}
              style={ed.klarBtn}
              activeOpacity={0.8}
            >
              <Text style={ed.klarBtnText}>Klar{drafts.length > 0 ? ` (${drafts.length})` : ''}</Text>
            </TouchableOpacity>
          </View>

          <View style={ed.pickerSearchBar}>
            <Ionicons name="search-outline" size={17} color={TEXT_SECONDARY} />
            <TextInput
              style={ed.pickerSearchInput}
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
            style={ed.pickerFilterStrip}
            contentContainerStyle={ed.pickerFilters}
          >
            {PICKER_FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[ed.pickerPill, pickerFilter === f.key && ed.pickerPillActive]}
                onPress={() => setPickerFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text style={[ed.pickerPillText, pickerFilter === f.key && ed.pickerPillTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={ed.pickerCount}>{pickerExercises.length} övningar</Text>

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
                  style={[ed.pickerRow, already && ed.pickerRowAdded]}
                  onPress={() => already
                    ? removeDraft(drafts.find(d => d.exercise_name === ex.name)!.key)
                    : addExercise(ex.name)
                  }
                  onLongPress={handleLongPress}
                  delayLongPress={400}
                  activeOpacity={0.7}
                >
                  <View style={[ed.pickerIcon, already && { backgroundColor: ORANGE + '20' }]}>
                    <Ionicons name={CATEGORY_ICONS[ex.category]} size={18} color={already ? ORANGE : TEXT_SECONDARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[ed.pickerRowName, already && { color: ORANGE }]}>{ex.name}</Text>
                    <Text style={ed.pickerRowSub}>{CATEGORY_LABELS[ex.category]}</Text>
                  </View>
                  <View style={[ed.pickerAddBtn, already && { backgroundColor: ORANGE, borderColor: ORANGE }]}>
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

      {/* ── Exercise info sheet ── */}
      {(() => {
        const muscles   = infoEx ? getMusclesForName(infoEx.name) : []
        const muscleData = muscles.map(slug => ({ slug, intensity: 1 as const }))
        const diffColor  = infoEx ? (DIFFICULTY_COLORS[infoEx.difficulty] ?? ORANGE) : ORANGE
        return (
          <Modal
            visible={infoEx !== null}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => { setInfoEx(null); setTimeout(() => setShowPicker(true), 350) }}
          >
            <SafeAreaView style={ed.infoScreen} edges={['top', 'bottom']}>
              <View style={ed.infoHeader}>
                <Text style={ed.infoTitle} numberOfLines={1}>{infoEx?.name}</Text>
                <TouchableOpacity onPress={() => { setInfoEx(null); setTimeout(() => setShowPicker(true), 350) }} activeOpacity={0.8} style={ed.infoClose}>
                  <Ionicons name="close" size={22} color={TEXT_PRIMARY} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={ed.infoScroll} showsVerticalScrollIndicator={false}>

                {/* Badges */}
                <View style={ed.badgeRow}>
                  <View style={ed.categoryBadge}>
                    <Text style={ed.categoryBadgeText}>{infoEx ? CATEGORY_LABELS[infoEx.category] : ''}</Text>
                  </View>
                  <View style={[ed.diffBadge, { backgroundColor: diffColor + '22', borderColor: diffColor + '55' }]}>
                    <Text style={[ed.diffBadgeText, { color: diffColor }]}>
                      {infoEx ? DIFFICULTY_LABELS[infoEx.difficulty] : ''}
                    </Text>
                  </View>
                </View>

                {/* Muscle map */}
                <View style={ed.infoCard}>
                  <View style={ed.infoCardTitleRow}>
                    <Text style={ed.infoCardTitle}>Muskelgrupper</Text>
                    <View style={ed.toggle}>
                      {(['front', 'back'] as const).map(side => (
                        <TouchableOpacity
                          key={side}
                          style={[ed.toggleBtn, infoBodyView === side && ed.toggleBtnActive]}
                          onPress={() => setInfoBodyView(side)}
                          activeOpacity={0.8}
                        >
                          <Text style={[ed.toggleText, infoBodyView === side && ed.toggleTextActive]}>
                            {side === 'front' ? 'Fram' : 'Bak'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={ed.bodyWrap}>
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
                    <View style={ed.muscleChips}>
                      {muscles.map(slug => (
                        <View key={slug} style={ed.muscleChip}>
                          <Text style={ed.muscleChipText}>{SLUG_LABELS[slug]}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={ed.noMuscles}>Inga muskler mappade för denna övning</Text>
                  )}
                </View>

                {/* Description */}
                {infoEx?.description ? (
                  <View style={ed.infoCard}>
                    <Text style={ed.infoCardTitle}>Beskrivning</Text>
                    <Text style={ed.infoDesc}>{infoEx.description}</Text>
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SchemaScreen() {
  const [exercises, setExercises]           = useState<Exercise[]>([])
  const [sessions, setSessions]             = useState<WorkoutSession[]>([])
  const [userId, setUserId]                 = useState<string | null>(null)
  const [selectedDay, setSelectedDay]       = useState<number>(todayIso())
  const [loading, setLoading]               = useState(true)
  const [editorVisible, setEditorVisible]   = useState(false)
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null)
  const [checked, setChecked]               = useState<Record<string, boolean>>({})
  const [completedIds, setCompletedIds]     = useState<Set<string>>(new Set())
  const [loggedWorkouts, setLoggedWorkouts] = useState<StrengthWorkout[]>([])

  // Ref so useFocusEffect always reads the latest selectedDay without stale closures
  const selectedDayRef = useRef(selectedDay)
  useEffect(() => { selectedDayRef.current = selectedDay }, [selectedDay])
  const userIdRef = useRef(userId)
  useEffect(() => { userIdRef.current = userId }, [userId])

  async function loadData(uid: string, dayForCompletions?: number) {
    const date = dateForWeekday(dayForCompletions ?? selectedDayRef.current)
    const [exs, sess, sessionIds, exerciseIds, logged] = await Promise.all([
      getExercises().catch(() => [] as Exercise[]),
      getWorkoutSessions(uid).catch(() => [] as WorkoutSession[]),
      getCompletedSessionIds(uid, date).catch(() => [] as string[]),
      getCompletedExerciseIds(uid, date).catch(() => [] as string[]),
      getWorkoutsForDate(uid, date).catch(() => [] as StrengthWorkout[]),
    ])
    setExercises(exs)
    setSessions(sess)
    setCompletedIds(new Set(sessionIds))
    const checkedMap: Record<string, boolean> = {}
    exerciseIds.forEach(id => { checkedMap[id] = true })
    setChecked(checkedMap)
    setLoggedWorkouts(logged)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null
      setUserId(uid)
      if (uid) loadData(uid).finally(() => setLoading(false))
      else setLoading(false)
    })
  }, [])

  useFocusEffect(useCallback(() => {
    const uid = userIdRef.current
    if (uid) loadData(uid)
  }, []))

  useEffect(() => {
    if (!userId) return
    const date = dateForWeekday(selectedDay)
    Promise.all([
      getCompletedSessionIds(userId, date).catch(() => [] as string[]),
      getCompletedExerciseIds(userId, date).catch(() => [] as string[]),
      getWorkoutsForDate(userId, date).catch(() => [] as StrengthWorkout[]),
    ]).then(([sessionIds, exerciseIds, logged]) => {
      setCompletedIds(new Set(sessionIds))
      const checkedMap: Record<string, boolean> = {}
      exerciseIds.forEach(id => { checkedMap[id] = true })
      setChecked(checkedMap)
      setLoggedWorkouts(logged)
    })
  }, [selectedDay, userId])

  function openEditor(session: WorkoutSession | null) {
    setEditingSession(session)
    setEditorVisible(true)
  }

  function toggleCheck(exId: string) {
    if (!userId) return
    const date       = dateForWeekday(selectedDay)
    const wasChecked = !!checked[exId]
    setChecked(prev => ({ ...prev, [exId]: !wasChecked }))
    const action = wasChecked
      ? uncompleteExercise(exId, userId, date)
      : completeExercise(exId, userId, date)
    action.catch((err: any) => {
      console.warn('[toggleCheck] Supabase error — rolling back:', err?.message ?? err)
      setChecked(prev => ({ ...prev, [exId]: wasChecked }))
    })
  }

  function handleComplete(sessionId: string) {
    if (!userId) return
    const date = dateForWeekday(selectedDay)
    setCompletedIds(prev => new Set([...prev, sessionId]))
    completeSession(sessionId, userId, date).catch(() => {
      setCompletedIds(prev => { const n = new Set(prev); n.delete(sessionId); return n })
    })
  }

  function handleUncomplete(sessionId: string) {
    const date = dateForWeekday(selectedDay)
    setCompletedIds(prev => { const n = new Set(prev); n.delete(sessionId); return n })
    uncompleteSession(sessionId, date).catch(() => {
      setCompletedIds(prev => new Set([...prev, sessionId]))
    })
  }

  function handleRemoveLoggedWorkout(id: string) {
    setLoggedWorkouts(prev => prev.filter(w => w.id !== id))
    deleteWorkout(id).catch(() => {
      if (userId) loadData(userId)
    })
  }

  function handleDeleteExercise(sessionId: string, exId: string) {
    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? { ...s, exercises: s.exercises.filter(e => e.id !== exId) }
        : s
    ))
    deleteSessionExercise(exId).catch(() => {
      if (userId) loadData(userId)
    })
  }

  function handleEditExercise(exId: string, sets: number | null, reps: string | null) {
    // Optimistic update — reflect new sets/reps immediately
    setSessions(prev => prev.map(s => ({
      ...s,
      exercises: s.exercises.map(e =>
        e.id === exId ? { ...e, sets, reps } : e
      ),
    })))
    updateSessionExercise(exId, sets, reps).catch(() => {
      if (userId) loadData(userId)
    })
  }

  const sessionsForDay = sessions.filter(s => s.weekdays.includes(selectedDay))

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Header ── */}
        <View style={styles.topHeader}>
          <Text style={styles.title}>Mitt schema</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => openEditor(null)} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color="#000" />
            <Text style={styles.addBtnText}>Nytt pass</Text>
          </TouchableOpacity>
        </View>

        {/* ── Week strip ── */}
        <View style={styles.weekStrip}>
          {WEEKDAYS.map((d, i) => {
            const num         = i + 1
            const active      = selectedDay === num
            const isToday     = num === todayIso()
            const daySessions = sessions.filter(s => s.weekdays.includes(num))
            const totalEx     = daySessions.reduce((a, s) => a + s.exercises.length, 0)
            const doneEx      = daySessions.reduce((a, s) =>
              a + s.exercises.filter(e => checked[e.id]).length, 0)
            const allDone     = totalEx > 0 && doneEx === totalEx
            const hasWorkout  = daySessions.length > 0

            return (
              <TouchableOpacity
                key={num}
                style={[
                  styles.weekDay,
                  active && styles.weekDayActive,
                  isToday && !active && styles.weekDayToday,
                ]}
                onPress={() => setSelectedDay(num)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.weekDayLabel,
                  active && styles.weekDayLabelActive,
                  isToday && !active && styles.weekDayLabelToday,
                ]}>
                  {d}
                </Text>
                <View style={[
                  styles.weekDayDot,
                  hasWorkout && styles.weekDayDotFull,
                  allDone && styles.weekDayDotDone,
                  active && hasWorkout && !allDone && styles.weekDayDotActive,
                ]} />
              </TouchableOpacity>
            )
          })}
        </View>

        {/* ── Day header ── */}
        <View style={styles.dayHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dayName}>
              {selectedDay === todayIso() ? 'Idag' : WEEKDAYS[selectedDay - 1]}
            </Text>
            {sessionsForDay.length > 0 && (
              <Text style={styles.daySubtitle}>
                {sessionsForDay.length} {sessionsForDay.length === 1 ? 'pass' : 'pass'} ·{' '}
                {sessionsForDay.reduce((a, s) => a + s.exercises.length, 0)} övningar
              </Text>
            )}
          </View>
        </View>

        {/* ── Sessions ── */}
        {sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="barbell-outline" size={32} color={ORANGE} />
            </View>
            <Text style={styles.emptyTitle}>Bygg ditt schema</Text>
            <Text style={styles.emptyText}>Skapa pass och lägg till övningar för varje dag</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => openEditor(null)} activeOpacity={0.8}>
              <Ionicons name="add" size={16} color="#000" />
              <Text style={styles.emptyBtnText}>Skapa första passet</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.sectionList}>
            {sessionsForDay.length === 0 ? (
              <View style={styles.restState}>
                <Ionicons name="moon-outline" size={40} color={BORDER} />
                <Text style={styles.restTitle}>Vildag</Text>
                <Text style={styles.restText}>
                  Inget pass schemalagt {WEEKDAYS[selectedDay - 1].toLowerCase()}
                </Text>
                <TouchableOpacity style={styles.restAddBtn} onPress={() => openEditor(null)} activeOpacity={0.8}>
                  <Ionicons name="add" size={14} color={ORANGE} />
                  <Text style={styles.restAddText}>Lägg till pass</Text>
                </TouchableOpacity>
              </View>
            ) : sessionsForDay.map(s => (
              <WorkoutSection
                key={s.id}
                session={s}
                checked={checked}
                isCompleted={completedIds.has(s.id)}
                onToggleExercise={toggleCheck}
                onDeleteExercise={(exId) => handleDeleteExercise(s.id, exId)}
                onEditExercise={(exId, sets, reps) => handleEditExercise(exId, sets, reps)}
                onStartCardio={(name) => router.push({ pathname: '/cardio', params: { name } })}
                onCardPress={(sessionEx) => {
                  const name   = sessionEx.exercise_name
                  const exInfo = exercises.find(e => e.name === name)
                  if (!exInfo) return
                  const hasMap = exInfo.category === 'cardio' && GPS_KEYWORDS.some(kw => name.toLowerCase().includes(kw))
                  if (hasMap) {
                    router.push({ pathname: '/cardio', params: { name } })
                  } else {
                    router.push({
                      pathname: '/exercise/[id]',
                      params: {
                        id:           exInfo.id,
                        name:         exInfo.name,
                        description:  exInfo.description ?? '',
                        category:     exInfo.category,
                        difficulty:   exInfo.difficulty,
                        initialSets:  sessionEx.sets != null ? String(sessionEx.sets) : '',
                        initialReps:  sessionEx.reps ?? '',
                        sessionExId:  sessionEx.id,
                        sessionDate:  dateForWeekday(selectedDay),
                      },
                    })
                  }
                }}
                onComplete={() => handleComplete(s.id)}
                onUncomplete={() => handleUncomplete(s.id)}
                onEdit={() => openEditor(s)}
              />
            ))}

            {/* Loggade övningar — visas alltid oavsett schemalagda pass */}
            {loggedWorkouts.length > 0 && (
              <View style={styles.loggedSection}>
                <Text style={styles.loggedSectionTitle}>Loggat</Text>
                {loggedWorkouts.map(w => (
                  <LoggedWorkoutRow
                    key={w.id}
                    workout={w}
                    onRemove={() => handleRemoveLoggedWorkout(w.id)}
                    onEdit={() => {
                      const exInfo = exercises.find(e => e.name === w.name)
                      router.push({
                        pathname: '/exercise/[id]',
                        params: {
                          id:               w.data.exercise_id,
                          name:             w.name,
                          description:      exInfo?.description ?? '',
                          category:         w.data.category,
                          difficulty:       exInfo?.difficulty ?? 'beginner',
                          initialSets:      String(w.data.sets.length),
                          initialReps:      w.data.sets[0]?.reps ? String(w.data.sets[0].reps) : '',
                          loggedWorkoutId:  w.id,
                          loggedWorkoutDate: w.data.workout_date ?? '',
                        },
                      })
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Session editor modal ── */}
      {userId && (
        <SessionEditor
          visible={editorVisible}
          session={editingSession}
          exercises={exercises}
          userId={userId}
          onClose={() => setEditorVisible(false)}
          onSaved={() => loadData(userId)}
        />
      )}
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  scroll:   { paddingBottom: 60 },

  topHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingTop:        16,
    paddingBottom:     8,
  },
  title:   { color: TEXT_PRIMARY, fontSize: 28, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ORANGE, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },

  weekStrip: {
    flexDirection: 'row', paddingHorizontal: 16,
    paddingTop: 8, paddingBottom: 4, gap: 6,
  },
  weekDay: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 14, gap: 6,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  weekDayActive:        { backgroundColor: ORANGE, borderColor: ORANGE },
  weekDayToday:         { borderColor: ORANGE },
  weekDayLabel:         { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  weekDayLabelActive:   { color: '#000', fontWeight: '800' },
  weekDayLabelToday:    { color: ORANGE },
  weekDayDot:           { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  weekDayDotFull:       { backgroundColor: ORANGE },
  weekDayDotDone:       { backgroundColor: '#4CAF50' },
  weekDayDotActive:     { backgroundColor: '#000' },

  dayHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 12,
  },
  dayName:     { color: TEXT_PRIMARY, fontSize: 26, fontWeight: '800' },
  daySubtitle: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },

  sectionList: { paddingHorizontal: 16 },

  emptyState: { alignItems: 'center', paddingVertical: 52, paddingHorizontal: 32, gap: 8 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: ORANGE + '18',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyTitle:   { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '700' },
  emptyText:    { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ORANGE, borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 11, marginTop: 8,
  },
  emptyBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },

  restState:  { alignItems: 'center', paddingVertical: 48, gap: 6 },
  restTitle:  { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '700', marginTop: 8 },
  restText:   { color: TEXT_SECONDARY, fontSize: 14 },
  restAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, borderWidth: 1, borderColor: ORANGE + '60',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9,
  },
  restAddText: { color: ORANGE, fontSize: 14, fontWeight: '600' },

  loggedSection:      { paddingTop: 4 },
  loggedSectionTitle: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600', paddingHorizontal: 4, paddingBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
})

// ─── Session editor styles ────────────────────────────────────────────────────

const ed = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  overlayKAV: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    height: '88%',
  },
  handleWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 6 },
  handleBar:  { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
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

  dayLabelRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 4,
  },
  multiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  multiBtnActive:    { backgroundColor: ORANGE, borderColor: ORANGE },
  multiBtnText:      { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  multiBtnTextActive: { color: '#000', fontWeight: '700' },

  dayRow: { flexDirection: 'row', gap: 6 },
  dayBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  dayBtnActive:  { backgroundColor: ORANGE, borderColor: ORANGE },
  dayText:       { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  dayTextActive: { color: '#000', fontWeight: '700' },

  exRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: CARD, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER, padding: 10,
  },
  exName: { flex: 1, color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  cardioBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: ORANGE + '18', borderWidth: 1, borderColor: ORANGE + '44',
  },
  cardioBadgeText: { color: ORANGE, fontSize: 12, fontWeight: '600' },
  exSmall: {
    width: 50, color: TEXT_PRIMARY, fontSize: 13,
    backgroundColor: BG, borderRadius: 8, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 8, paddingVertical: 6, textAlign: 'center',
  },

  pickerToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: CARD, borderRadius: 10,
    borderWidth: 1, borderColor: ORANGE + '50', marginTop: 4,
  },
  pickerToggleText: { color: ORANGE, fontSize: 14, fontWeight: '600' },

  pickerScreen:  { flex: 1, backgroundColor: BG },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  klarBtn: {
    backgroundColor: ORANGE, borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 9,
  },
  klarBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  pickerSearchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginVertical: 10,
    paddingHorizontal: 14, height: 46,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
  },
  pickerSearchInput:   { flex: 1, color: TEXT_PRIMARY, fontSize: 15, padding: 0 },
  pickerFilterStrip:   { height: 60, flexGrow: 0, marginBottom: 10 },
  pickerFilters:       { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  pickerPill: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  pickerPillActive:     { backgroundColor: ORANGE, borderColor: ORANGE },
  pickerPillText:       { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500' },
  pickerPillTextActive: { color: '#000', fontWeight: '700' },
  pickerCount: {
    color: TEXT_SECONDARY, fontSize: 12, paddingHorizontal: 20,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
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
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },

  saveBtn: {
    backgroundColor: ORANGE, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10,
  },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },

  // ── Info sheet ───────────────────────────────────────────────────────────────
  infoScreen: { flex: 1, backgroundColor: BG },
  infoHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  infoTitle:  { flex: 1, color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700', marginRight: 12 },
  infoClose:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  infoScroll: { padding: 20, gap: 16 },

  badgeRow: { flexDirection: 'row', gap: 8 },
  categoryBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: ORANGE + '20', borderWidth: 1, borderColor: ORANGE + '55',
  },
  categoryBadgeText: { color: ORANGE, fontSize: 13, fontWeight: '600' },
  diffBadge:         { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  diffBadgeText:     { fontSize: 13, fontWeight: '600' },

  infoCard: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER, padding: 16, gap: 12,
  },
  infoCardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoCardTitle:    { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },

  toggle: {
    flexDirection: 'row', backgroundColor: BG,
    borderRadius: 10, padding: 2,
  },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: ORANGE },
  toggleText:       { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  toggleTextActive: { color: '#000', fontWeight: '700' },

  bodyWrap:   { alignItems: 'center', paddingVertical: 8 },
  muscleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muscleChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: ORANGE + '18', borderWidth: 1, borderColor: ORANGE + '44',
  },
  muscleChipText: { color: ORANGE, fontSize: 13, fontWeight: '600' },
  noMuscles:      { color: TEXT_SECONDARY, fontSize: 13 },
  infoDesc:       { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 22 },
})
