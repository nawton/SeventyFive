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
  const [editorVisible, setEditorVisible] = useState(false)
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null)

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

  const sessionsForDay = sessions.filter(s => s.weekdays.includes(selectedDay))

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
          {/* Day selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
            {WEEKDAYS.map((d, i) => {
              const num = i + 1
              const active = selectedDay === num
              const hasSessions = sessions.some(s => s.weekdays.includes(num))
              return (
                <TouchableOpacity
                  key={num}
                  style={[styles.dayPill, active && styles.dayPillActive]}
                  onPress={() => setSelectedDay(num)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>{d}</Text>
                  {hasSessions && <View style={[styles.dayDot, active && { backgroundColor: '#000' }]} />}
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          {/* Day label */}
          <View style={styles.dayLabelRow}>
            <Text style={styles.dayLabel}>{WEEKDAYS[selectedDay - 1]}</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => openEditor(null)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#000" />
              <Text style={styles.addBtnText}>Nytt pass</Text>
            </TouchableOpacity>
          </View>

          {/* Sessions for this day */}
          {sessionsForDay.length === 0 ? (
            <View style={styles.emptyDay}>
              <Ionicons name="calendar-outline" size={40} color={BORDER} />
              <Text style={styles.emptyDayText}>Inget pass schemalagt</Text>
              <TouchableOpacity onPress={() => openEditor(null)} activeOpacity={0.8}>
                <Text style={styles.emptyDayLink}>+ Lägg till ett pass</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.sessionList}>
              {sessionsForDay.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.sessionCard}
                  onPress={() => openEditor(s)}
                  activeOpacity={0.75}
                >
                  <View style={styles.sessionCardLeft}>
                    <View style={styles.sessionIcon}>
                      <Ionicons name="barbell-outline" size={20} color={ORANGE} />
                    </View>
                    <View style={styles.sessionInfo}>
                      <Text style={styles.sessionName}>{s.name}</Text>
                      <Text style={styles.sessionMeta}>
                        {s.exercises.length > 0
                          ? `${s.exercises.length} övning${s.exercises.length !== 1 ? 'ar' : ''}`
                          : 'Inga övningar'}
                      </Text>
                      {s.exercises.length > 0 && (
                        <Text style={styles.sessionExNames} numberOfLines={1}>
                          {s.exercises.slice(0, 3).map(e => e.exercise_name).join(' · ')}
                          {s.exercises.length > 3 ? ' …' : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.sessionDays}>
                    {s.weekdays.sort().map(d => (
                      <View key={d} style={[styles.sessionDayDot, d === selectedDay && styles.sessionDayDotActive]}>
                        <Text style={[styles.sessionDayText, d === selectedDay && { color: '#000' }]}>
                          {WEEKDAYS[d - 1]}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* All sessions summary */}
          {sessions.length > 0 && (
            <View style={styles.allSessions}>
              <Text style={styles.allSessionsTitle}>ALLA PASS</Text>
              {sessions
                .filter(s => !s.weekdays.includes(selectedDay))
                .map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.allSessionRow}
                    onPress={() => openEditor(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.allSessionName}>{s.name}</Text>
                    <Text style={styles.allSessionDays}>
                      {s.weekdays.sort().map(d => WEEKDAYS[d - 1]).join(', ') || 'Ingen dag vald'}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={TEXT_SECONDARY} />
                  </TouchableOpacity>
                ))}
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
  schemaScroll: { paddingBottom: 40, gap: 0 },
  dayRow: { paddingHorizontal: 20, paddingVertical: 14, gap: 10 },
  dayPill: {
    alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 22, backgroundColor: CARD,
    borderWidth: 1, borderColor: BORDER, minWidth: 52,
  },
  dayPillActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  dayPillText: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  dayPillTextActive: { color: '#000', fontWeight: '700' },
  dayDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: ORANGE },

  dayLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 12,
  },
  dayLabel: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ORANGE, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },

  emptyDay: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyDayText: { color: TEXT_SECONDARY, fontSize: 16 },
  emptyDayLink: { color: ORANGE, fontSize: 15, fontWeight: '600', marginTop: 4 },

  sessionList: { paddingHorizontal: 20, gap: 10 },
  sessionCard: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  sessionCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sessionIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: ORANGE + '18', alignItems: 'center', justifyContent: 'center',
  },
  sessionInfo: { flex: 1, gap: 2 },
  sessionName: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  sessionMeta: { color: TEXT_SECONDARY, fontSize: 12 },
  sessionExNames: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  sessionDays: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', maxWidth: 100 },
  sessionDayDot: {
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: BORDER,
  },
  sessionDayDotActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  sessionDayText: { color: TEXT_SECONDARY, fontSize: 10, fontWeight: '600' },

  allSessions: { marginTop: 28, paddingHorizontal: 20, gap: 2 },
  allSessionsTitle: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  allSessionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  allSessionName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600', flex: 1 },
  allSessionDays: { color: TEXT_SECONDARY, fontSize: 13 },

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
  pickerFilters: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
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
