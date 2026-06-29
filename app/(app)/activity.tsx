import { useCallback, useEffect, useState } from 'react'
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
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
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
  deleteWorkoutSession,
  type WorkoutSession,
} from '@/services/workoutSchedule'
import { getMusclesForName } from '@/lib/muscles'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import type { ExerciseCategory } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

const CATEGORIES: Array<{ key: ExerciseCategory | 'all'; label: string }> = [
  { key: 'all',      label: 'Alla' },
  { key: 'strength', label: 'Styrka' },
  { key: 'cardio',   label: 'Cardio' },
  { key: 'mobility', label: 'Rörlighet' },
  { key: 'hiit',     label: 'HIIT' },
]

type MuscleGroup = 'all' | 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core'

const MUSCLE_GROUPS: Array<{ key: MuscleGroup; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'all',       label: 'Alla',   icon: 'apps-outline' },
  { key: 'chest',     label: 'Bröst',  icon: 'body-outline' },
  { key: 'back',      label: 'Rygg',   icon: 'git-merge-outline' },
  { key: 'legs',      label: 'Ben',    icon: 'walk-outline' },
  { key: 'shoulders', label: 'Axlar',  icon: 'barbell-outline' },
  { key: 'arms',      label: 'Armar',  icon: 'fitness-outline' },
  { key: 'core',      label: 'Mage',   icon: 'ellipse-outline' },
]

const SLUG_TO_GROUP: Record<string, MuscleGroup> = {
  chest: 'chest', 'upper-back': 'back', 'lower-back': 'back',
  trapezius: 'back', quadriceps: 'legs', hamstring: 'legs',
  gluteal: 'legs', calves: 'legs', adductors: 'legs',
  deltoids: 'shoulders', biceps: 'arms', triceps: 'arms',
  forearm: 'arms', abs: 'core', obliques: 'core',
}

const CATEGORY_ICONS: Record<ExerciseCategory, React.ComponentProps<typeof Ionicons>['name']> = {
  strength: 'barbell-outline',
  cardio:   'walk-outline',
  mobility: 'body-outline',
  hiit:     'flash-outline',
}

const GPS_KEYWORDS = ['löpning', 'running', 'jogging', 'cykling', 'cycling', 'promenad', 'walking', 'spring', 'intervallspring', 'gång']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayIso(): number {
  // getDay() returns 0=Sun, we want 1=Mon…7=Sun
  const d = new Date().getDay()
  return d === 0 ? 7 : d
}

function usesMap(name: string) {
  return GPS_KEYWORDS.some(kw => name.toLowerCase().includes(kw))
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
  key: string          // local React key
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
  const [name, setName]             = useState('')
  const [weekdays, setWeekdays]     = useState<number[]>([])
  const [drafts, setDrafts]         = useState<DraftExercise[]>([])
  const [showPicker, setShowPicker]     = useState(false)
  const [pickerFilter, setPickerFilter] = useState('all')
  const [pickerSearch, setPickerSearch] = useState('')
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState(false)

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
      setDrafts([])
    }
    setShowPicker(false)
    setPickerFilter('all')
    setPickerSearch('')
  }, [visible, session])

  function toggleDay(d: number) {
    setWeekdays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    )
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
      onClose()
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
            onClose()
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
    { key: 'legs',      label: 'Ben' },
    { key: 'chest',     label: 'Bröst' },
    { key: 'back',      label: 'Rygg' },
    { key: 'shoulders', label: 'Axlar' },
    { key: 'arms',      label: 'Armar' },
    { key: 'core',      label: 'Mage' },
    { key: 'cardio',    label: 'Cardio' },
    { key: 'mobility',  label: 'Rörlighet' },
    { key: 'hiit',      label: 'HIIT' },
  ]

  // Deduplicate by name (DB may have duplicate rows), then filter
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={ed.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={ed.sheet}>
          {/* Header */}
          <View style={ed.header}>
            <TouchableOpacity onPress={onClose} style={ed.iconBtn} activeOpacity={0.7}>
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
            {/* Name */}
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

            {/* Weekdays */}
            <View style={ed.field}>
              <Text style={ed.label}>VECKODAGAR</Text>
              <View style={ed.dayRow}>
                {WEEKDAYS.map((d, i) => {
                  const num = i + 1
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

            {/* Exercises */}
            <View style={ed.field}>
              <Text style={ed.label}>ÖVNINGAR</Text>

              {drafts.map(d => (
                <View key={d.key} style={ed.exRow}>
                  <Text style={ed.exName} numberOfLines={1}>{d.exercise_name}</Text>
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
                  <TouchableOpacity onPress={() => removeDraft(d.key)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={20} color={TEXT_SECONDARY} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Open fullscreen picker */}
              <TouchableOpacity
                style={ed.pickerToggle}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={17} color={ORANGE} />
                <Text style={ed.pickerToggleText}>Lägg till övning</Text>
              </TouchableOpacity>
            </View>

            {/* Save */}
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
        </View>
      </KeyboardAvoidingView>

      {/* ── Fullscreen exercise picker ── */}
      <Modal visible={showPicker} animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <View style={[ed.pickerScreen, { paddingTop: insets.top }]}>

          {/* Header */}
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

          {/* Search bar */}
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

          {/* Filter pills */}
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

          {/* Count */}
          <Text style={ed.pickerCount}>{pickerExercises.length} övningar</Text>

          {/* Exercise list */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {pickerExercises.map(ex => {
              const already = drafts.some(d => d.exercise_name === ex.name)
              return (
                <TouchableOpacity
                  key={ex.id}
                  style={[ed.pickerRow, already && ed.pickerRowAdded]}
                  onPress={() => already
                    ? removeDraft(drafts.find(d => d.exercise_name === ex.name)!.key)
                    : addExercise(ex.name)
                  }
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
    </Modal>
  )
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({ exercise, query }: { exercise: Exercise; query: string }) {
  const diffColor = DIFFICULTY_COLORS[exercise.difficulty]
  const icon = CATEGORY_ICONS[exercise.category]
  const hasMap = exercise.category === 'cardio' && usesMap(exercise.name)

  function HighlightedName() {
    if (!query) return <Text style={styles.cardName}>{exercise.name}</Text>
    const idx = exercise.name.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return <Text style={styles.cardName}>{exercise.name}</Text>
    return (
      <Text style={styles.cardName}>
        {exercise.name.slice(0, idx)}
        <Text style={styles.highlight}>{exercise.name.slice(idx, idx + query.length)}</Text>
        {exercise.name.slice(idx + query.length)}
      </Text>
    )
  }

  function handlePress() {
    if (hasMap) {
      router.push({ pathname: '/cardio', params: { name: exercise.name } })
    } else {
      router.push({
        pathname: '/exercise/[id]',
        params: { id: exercise.id, name: exercise.name, description: exercise.description ?? '', category: exercise.category, difficulty: exercise.difficulty },
      })
    }
  }

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.75}>
      <View style={styles.cardLeft}>
        <View style={styles.cardIcon}>
          <Ionicons name={icon} size={22} color={ORANGE} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <HighlightedName />
        {exercise.description && (
          <Text style={styles.cardDescription} numberOfLines={2}>{exercise.description}</Text>
        )}
        <View style={styles.cardMeta}>
          <View style={[styles.badge, { backgroundColor: diffColor + '22', borderColor: diffColor + '55' }]}>
            <Text style={[styles.badgeText, { color: diffColor }]}>{DIFFICULTY_LABELS[exercise.difficulty]}</Text>
          </View>
          <Text style={styles.categoryText}>{CATEGORY_LABELS[exercise.category]}</Text>
          {hasMap && <Ionicons name="map-outline" size={13} color={ORANGE} />}
        </View>
      </View>
      <Ionicons name={hasMap ? 'chevron-forward' : 'add-circle-outline'} size={18} color={hasMap ? '#444' : ORANGE} style={{ alignSelf: 'center' }} />
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type ScreenTab = 'schema' | 'exercises'

export default function ActivityScreen() {
  const [exercises, setExercises]       = useState<Exercise[]>([])
  const [sessions, setSessions]         = useState<WorkoutSession[]>([])
  const [userId, setUserId]             = useState<string | null>(null)
  const [activeTab, setActiveTab]       = useState<ScreenTab>('schema')
  const [selectedDay, setSelectedDay]   = useState<number>(todayIso())
  const [catFilter, setCatFilter]       = useState<ExerciseCategory | 'all'>('all')
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup>('all')
  const [searchQuery, setSearchQuery]   = useState('')
  const [loading, setLoading]           = useState(true)
  const [editorVisible, setEditorVisible]   = useState(false)
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null)
  const [checked, setChecked]               = useState<Record<string, boolean>>({})

  async function loadData(uid: string) {
    const [exs, sess] = await Promise.all([
      getExercises().catch(() => [] as Exercise[]),
      getWorkoutSessions(uid).catch(() => [] as WorkoutSession[]),
    ])
    setExercises(exs)
    setSessions(sess)
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
    if (userId) loadData(userId)
  }, [userId]))

  function openEditor(session: WorkoutSession | null) {
    setEditingSession(session)
    setEditorVisible(true)
  }

  function toggleCheck(exId: string) {
    setChecked(prev => ({ ...prev, [exId]: !prev[exId] }))
  }

  const sessionsForDay  = sessions.filter(s => s.weekdays.includes(selectedDay))
  const sessionsOtherDay = sessions.filter(s => !s.weekdays.includes(selectedDay))

  // Exercise filtering
  const byCategory = catFilter === 'all' ? exercises : exercises.filter(e => e.category === catFilter)
  const byMuscle   = catFilter === 'strength' && muscleFilter !== 'all'
    ? byCategory.filter(e => getExerciseMuscleGroup(e.name) === muscleFilter)
    : byCategory
  const filtered   = searchQuery.trim()
    ? byMuscle.filter(e =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    : byMuscle

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>

      {/* ── Top header (always visible) ── */}
      <View style={styles.topHeader}>
        <Text style={styles.title}>Träning</Text>
        <View style={styles.tabRow}>
          {(['schema', 'exercises'] as ScreenTab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.screenTab, activeTab === t && styles.screenTabActive]}
              onPress={() => setActiveTab(t)}
              activeOpacity={0.7}
            >
              <Text style={[styles.screenTabText, activeTab === t && styles.screenTabTextActive]}>
                {t === 'schema' ? 'Mitt schema' : 'Övningar'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Schema tab ── */}
      {activeTab === 'schema' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.schemaScroll}>

          {/* ── Week strip ── */}
          <View style={styles.weekStrip}>
            {WEEKDAYS.map((d, i) => {
              const num     = i + 1
              const active  = selectedDay === num
              const isToday = num === todayIso()
              const daysSessions = sessions.filter(s => s.weekdays.includes(num))
              const totalEx = daysSessions.reduce((acc, s) => acc + s.exercises.length, 0)
              const doneEx  = daysSessions.reduce((acc, s) =>
                acc + s.exercises.filter(e => checked[e.id]).length, 0)
              const allDone = totalEx > 0 && doneEx === totalEx
              return (
                <TouchableOpacity
                  key={num}
                  style={[styles.weekDay, active && styles.weekDayActive, isToday && !active && styles.weekDayToday]}
                  onPress={() => setSelectedDay(num)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.weekDayLabel, active && styles.weekDayLabelActive, isToday && !active && styles.weekDayLabelToday]}>
                    {d}
                  </Text>
                  <View style={[
                    styles.weekDayDot,
                    daysSessions.length > 0 && styles.weekDayDotFull,
                    allDone && styles.weekDayDotDone,
                    active && daysSessions.length > 0 && !allDone && styles.weekDayDotActive,
                  ]} />
                </TouchableOpacity>
              )
            })}
          </View>

          {/* ── Selected day header ── */}
          <View style={styles.dayHeader}>
            <View>
              <Text style={styles.dayName}>
                {selectedDay === todayIso() ? 'Idag' : WEEKDAYS[selectedDay - 1]}
              </Text>
              {sessionsForDay.length > 0 && (
                <Text style={styles.daySubtitle}>
                  {sessionsForDay.length} pass · {sessionsForDay.reduce((a, s) => a + s.exercises.length, 0)} övningar
                </Text>
              )}
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={() => openEditor(null)} activeOpacity={0.8}>
              <Ionicons name="add" size={20} color="#000" />
              <Text style={styles.addBtnText}>Nytt pass</Text>
            </TouchableOpacity>
          </View>

          {/* ── Today's sessions — workout cards ── */}
          {sessionsForDay.length > 0 ? (
            <View style={styles.sessionList}>
              {sessionsForDay.map(s => {
                const total     = s.exercises.length
                const doneCount = s.exercises.filter(e => checked[e.id]).length
                const allDone   = total > 0 && doneCount === total
                const pct       = total > 0 ? doneCount / total : 0
                return (
                  <View key={s.id} style={[styles.workoutCard, allDone && styles.workoutCardDone]}>

                    {/* Header row */}
                    <View style={styles.workoutCardHeader}>
                      <View style={[styles.sessionIcon, allDone && styles.sessionIconDone]}>
                        <Ionicons
                          name={allDone ? 'checkmark' : 'barbell-outline'}
                          size={18}
                          color={allDone ? '#000' : ORANGE}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sessionName}>{s.name}</Text>
                        <Text style={styles.sessionMeta}>
                          {total === 0 ? 'Inga övningar' : allDone ? 'Avslutat 💪' : `${doneCount} av ${total} klara`}
                        </Text>
                      </View>
                      {/* Percent badge */}
                      {total > 0 && !allDone && (
                        <View style={styles.pctBadge}>
                          <Text style={styles.pctText}>{Math.round(pct * 100)}%</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={() => openEditor(s)}
                        style={styles.editBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="ellipsis-horizontal" size={18} color={TEXT_SECONDARY} />
                      </TouchableOpacity>
                    </View>

                    {/* Progress bar */}
                    {total > 0 && (
                      <View style={styles.progressBarWrap}>
                        <View style={styles.progressBar}>
                          <View style={[
                            styles.progressFill,
                            { width: `${pct * 100}%` as any },
                            allDone && { backgroundColor: '#4CAF50' },
                          ]} />
                        </View>
                      </View>
                    )}

                    {/* Exercise checklist */}
                    {s.exercises.length === 0 ? (
                      <TouchableOpacity
                        style={styles.addExHint}
                        onPress={() => openEditor(s)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add-circle-outline" size={16} color={ORANGE} />
                        <Text style={styles.addExHintText}>Lägg till övningar</Text>
                      </TouchableOpacity>
                    ) : (
                      s.exercises.map((ex, idx) => {
                        const done = !!checked[ex.id]
                        return (
                          <TouchableOpacity
                            key={ex.id}
                            style={[
                              styles.checkRow,
                              idx === 0 && styles.checkRowFirst,
                              done && styles.checkRowDone,
                            ]}
                            onPress={() => toggleCheck(ex.id)}
                            activeOpacity={0.65}
                          >
                            <View style={[styles.checkbox, done && styles.checkboxDone]}>
                              {done && <Ionicons name="checkmark" size={12} color="#000" fontWeight="700" />}
                            </View>
                            <Text style={[styles.checkName, done && styles.checkNameDone]} numberOfLines={1}>
                              {ex.exercise_name}
                            </Text>
                            {(ex.sets || ex.reps) && (
                              <View style={[styles.setsBadge, done && { opacity: 0.35 }]}>
                                <Text style={styles.setsText}>
                                  {[ex.sets && `${ex.sets}×`, ex.reps].filter(Boolean).join('')}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        )
                      })
                    )}

                    {/* Done banner */}
                    {allDone && (
                      <View style={styles.doneBanner}>
                        <Text style={styles.doneBannerText}>Passet avslutat — bra jobbat!</Text>
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          ) : (
            <View style={styles.restDay}>
              <Text style={styles.restDayEmoji}>😴</Text>
              <Text style={styles.restDayTitle}>Vildag</Text>
              <Text style={styles.restDayText}>Inget pass schemalagt {WEEKDAYS[selectedDay - 1].toLowerCase()}</Text>
              <TouchableOpacity style={styles.addRestBtn} onPress={() => openEditor(null)} activeOpacity={0.8}>
                <Ionicons name="add" size={15} color={ORANGE} />
                <Text style={styles.addRestBtnText}>Lägg till pass</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Veckoöversikt ── */}
          {sessions.length > 0 && (
            <View style={styles.weekOverview}>
              <Text style={styles.weekOverviewTitle}>HELA VECKAN</Text>
              {WEEKDAYS.map((d, i) => {
                const num  = i + 1
                const daySessions = sessions.filter(s => s.weekdays.includes(num))
                const isToday = num === todayIso()
                const isSelected = num === selectedDay
                return (
                  <TouchableOpacity
                    key={num}
                    style={[styles.weekRow, isSelected && styles.weekRowSelected]}
                    onPress={() => setSelectedDay(num)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.weekRowDay, isToday && { color: ORANGE }, isSelected && { color: ORANGE, fontWeight: '700' }]}>
                      {d}
                      {isToday ? '  •' : ''}
                    </Text>
                    <View style={styles.weekRowSessions}>
                      {daySessions.length === 0 ? (
                        <Text style={styles.weekRowRest}>Vila</Text>
                      ) : (
                        daySessions.map(s => {
                          const done = s.exercises.length > 0 && s.exercises.every(e => checked[e.id])
                          return (
                            <View key={s.id} style={[styles.weekRowBadge, done && styles.weekRowBadgeDone]}>
                              <Text style={[styles.weekRowBadgeText, done && styles.weekRowBadgeTextDone]} numberOfLines={1}>
                                {s.name}
                              </Text>
                              {done && <Ionicons name="checkmark" size={11} color="#000" />}
                            </View>
                          )
                        })
                      )}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {sessions.length === 0 && (
            <View style={styles.restDay}>
              <Text style={styles.restDayEmoji}>🏋️</Text>
              <Text style={styles.restDayTitle}>Bygg ditt schema</Text>
              <Text style={styles.restDayText}>Skapa ditt första träningspass</Text>
              <TouchableOpacity style={styles.addRestBtn} onPress={() => openEditor(null)} activeOpacity={0.8}>
                <Ionicons name="add" size={15} color={ORANGE} />
                <Text style={styles.addRestBtnText}>Nytt pass</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      )}

      {/* ── Övningar tab ── */}
      {activeTab === 'exercises' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[0]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Sticky filter bar */}
          <View style={styles.stickyTop}>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={17} color={TEXT_SECONDARY} />
              <TextInput
                style={styles.searchInput}
                placeholder="Sök övning..."
                placeholderTextColor={TEXT_SECONDARY}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                clearButtonMode="while-editing"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={17} color={TEXT_SECONDARY} />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.filterTab, catFilter === cat.key && styles.filterTabActive]}
                  onPress={() => { setCatFilter(cat.key); setMuscleFilter('all') }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterTabText, catFilter === cat.key && styles.filterTabTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {catFilter === 'strength' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.muscleFilterRow}>
                {MUSCLE_GROUPS.map(mg => (
                  <TouchableOpacity
                    key={mg.key}
                    style={[styles.muscleTab, muscleFilter === mg.key && styles.muscleTabActive]}
                    onPress={() => setMuscleFilter(mg.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={mg.icon} size={14} color={muscleFilter === mg.key ? '#000' : TEXT_SECONDARY} />
                    <Text style={[styles.muscleTabText, muscleFilter === mg.key && styles.muscleTabTextActive]}>
                      {mg.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Exercise list */}
          <View style={styles.list}>
            <Text style={styles.listCount}>{filtered.length} övningar</Text>
            {filtered.length === 0 ? (
              <Text style={styles.empty}>
                {searchQuery ? `Inga övningar matchar "${searchQuery}"` : 'Inga övningar hittades.'}
              </Text>
            ) : (
              filtered.map(ex => <ExerciseCard key={ex.id} exercise={ex} query={searchQuery} />)
            )}
          </View>
        </ScrollView>
      )}

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

  // Top header
  topHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: BG,
    gap: 12,
  },
  title: { color: TEXT_PRIMARY, fontSize: 28, fontWeight: '700' },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 4,
    gap: 4,
  },
  screenTab: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10,
  },
  screenTabActive: { backgroundColor: ORANGE },
  screenTabText: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600' },
  screenTabTextActive: { color: '#000', fontWeight: '700' },

  // Schema tab
  schemaScroll: { paddingBottom: 60 },

  // Week strip (7 equal columns)
  weekStrip: {
    flexDirection: 'row', paddingHorizontal: 16,
    paddingTop: 8, paddingBottom: 4, gap: 6,
  },
  weekDay: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 14, gap: 6,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  weekDayActive:  { backgroundColor: ORANGE, borderColor: ORANGE },
  weekDayToday:   { borderColor: ORANGE },
  weekDayLabel:   { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  weekDayLabelActive: { color: '#000', fontWeight: '800' },
  weekDayLabelToday:  { color: ORANGE },
  weekDayDot:     { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  weekDayDotFull: { backgroundColor: ORANGE },
  weekDayDotDone: { backgroundColor: '#4CAF50' },
  weekDayDotActive: { backgroundColor: '#000' },

  // Day header
  dayHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  dayName:     { color: TEXT_PRIMARY, fontSize: 26, fontWeight: '800' },
  daySubtitle: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ORANGE, borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  addBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },

  sessionList: { paddingHorizontal: 16, gap: 14 },

  // Workout card
  workoutCard: {
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
  },
  workoutCardDone: { borderColor: '#4CAF50' + '50' },
  workoutCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  sessionIcon: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: ORANGE + '20', alignItems: 'center', justifyContent: 'center',
  },
  sessionIconDone: { backgroundColor: '#4CAF50' },
  sessionName:   { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  sessionMeta:   { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  pctBadge:      { backgroundColor: ORANGE + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  pctText:       { color: ORANGE, fontSize: 13, fontWeight: '700' },
  editBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: BG, alignItems: 'center', justifyContent: 'center',
  },

  progressBarWrap: { paddingHorizontal: 16, paddingBottom: 4 },
  progressBar: { height: 4, backgroundColor: BORDER, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: ORANGE, borderRadius: 2 },

  addExHint: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  addExHintText: { color: ORANGE, fontSize: 14, fontWeight: '500' },

  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  checkRowFirst: {},
  checkRowDone:  { backgroundColor: 'rgba(255,255,255,0.02)' },
  checkbox: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone:    { backgroundColor: ORANGE, borderColor: ORANGE },
  checkName:       { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontWeight: '500' },
  checkNameDone:   { color: TEXT_SECONDARY, textDecorationLine: 'line-through', opacity: 0.6 },
  setsBadge: {
    backgroundColor: BG, borderRadius: 8, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  setsText: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  doneBanner: {
    backgroundColor: '#4CAF50' + '18',
    paddingVertical: 12, paddingHorizontal: 16,
    alignItems: 'center', borderTopWidth: 1, borderTopColor: '#4CAF50' + '30',
  },
  doneBannerText: { color: '#4CAF50', fontSize: 14, fontWeight: '600' },

  // Rest day
  restDay: { alignItems: 'center', paddingVertical: 44, gap: 6 },
  restDayEmoji:  { fontSize: 44, marginBottom: 4 },
  restDayTitle:  { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '700' },
  restDayText:   { color: TEXT_SECONDARY, fontSize: 14 },
  addRestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, borderWidth: 1, borderColor: ORANGE,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9,
  },
  addRestBtnText: { color: ORANGE, fontSize: 14, fontWeight: '600' },

  // Week overview
  weekOverview: { marginTop: 28, paddingHorizontal: 16 },
  weekOverviewTitle: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 10,
  },
  weekRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  weekRowSelected: {},
  weekRowDay: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600', width: 32 },
  weekRowSessions: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  weekRowRest: { color: BORDER, fontSize: 13, fontStyle: 'italic' },
  weekRowBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: CARD, borderRadius: 10, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  weekRowBadgeDone:     { backgroundColor: '#4CAF50' + '20', borderColor: '#4CAF50' + '40' },
  weekRowBadgeText:     { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '500' },
  weekRowBadgeTextDone: { color: '#4CAF50' },

  // Övningar tab
  stickyTop: { backgroundColor: BG, paddingTop: 8 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 10,
    paddingHorizontal: 14, height: 44,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER, gap: 8,
  },
  searchInput: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, padding: 0 },
  highlight:   { color: ORANGE, fontWeight: '700' },
  filterRow:   { paddingHorizontal: 20, paddingBottom: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
  filterTab: {
    height: 36, paddingHorizontal: 16, borderRadius: 18,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, justifyContent: 'center',
  },
  filterTabActive:     { backgroundColor: ORANGE, borderColor: ORANGE },
  filterTabText:       { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500' },
  filterTabTextActive: { color: '#000000', fontWeight: '700' },
  muscleFilterRow: { paddingHorizontal: 20, paddingBottom: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
  muscleTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 32, paddingHorizontal: 12, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: BORDER,
  },
  muscleTabActive:     { backgroundColor: ORANGE, borderColor: ORANGE },
  muscleTabText:       { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '500' },
  muscleTabTextActive: { color: '#000', fontWeight: '700' },

  list:      { paddingHorizontal: 20, paddingBottom: 32, gap: 10, paddingTop: 4 },
  listCount: { color: TEXT_SECONDARY, fontSize: 13, marginBottom: 4 },
  empty:     { color: TEXT_SECONDARY, textAlign: 'center', marginTop: 40, fontSize: 15 },

  card: {
    backgroundColor: CARD, borderRadius: 14, padding: 16,
    flexDirection: 'row', gap: 14, borderWidth: 1, borderColor: BORDER,
  },
  cardLeft: { paddingTop: 2 },
  cardIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: BG, alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 6 },
  cardName: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  cardDescription: { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  categoryText: { color: TEXT_SECONDARY, fontSize: 12 },
})

// ─── Session editor styles ────────────────────────────────────────────────────

const ed = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    height: '88%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 20 },

  field: { gap: 10 },
  label: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, paddingHorizontal: 4 },
  input: {
    backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    color: TEXT_PRIMARY, fontSize: 16,
    paddingHorizontal: 14, paddingVertical: 14,
  },

  dayRow: { flexDirection: 'row', gap: 6 },
  dayBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  dayBtnActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  dayText:      { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  dayTextActive: { color: '#000', fontWeight: '700' },

  exRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: CARD, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER, padding: 10,
  },
  exName: { flex: 1, color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
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

  // Fullscreen picker
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
  pickerSearchInput: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, padding: 0 },
  pickerFilterStrip: { height: 52, flexGrow: 0 },
  pickerFilters: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  pickerPill: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  pickerPillActive:     { backgroundColor: ORANGE, borderColor: ORANGE },
  pickerPillText:       { color: TEXT_SECONDARY, fontSize: 15, fontWeight: '500' },
  pickerPillTextActive: { color: '#000', fontWeight: '700' },
  pickerCount: {
    color: TEXT_SECONDARY, fontSize: 12, paddingHorizontal: 20,
    paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: BORDER,
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
})
