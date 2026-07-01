import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { getExercises, type Exercise } from '@/services/exercises'
import {
  getWorkoutSessions,
  updateSessionExercise,
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
import { SessionEditor, WEEKDAYS, todayIso } from '@/components/SessionEditor'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

const GPS_KEYWORDS = ['löpning', 'running', 'jogging', 'cykling', 'cycling', 'promenad', 'walking', 'spring', 'intervallspring', 'gång']

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

  const selectedDayRef = useRef(selectedDay)
  useEffect(() => { selectedDayRef.current = selectedDay }, [selectedDay])
  const userIdRef = useRef(userId)
  useEffect(() => { userIdRef.current = userId }, [userId])

  async function loadData(uid: string, dayOverride?: number) {
    const date = dateForWeekday(dayOverride ?? selectedDayRef.current)
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
    action.catch(() => setChecked(prev => ({ ...prev, [exId]: wasChecked })))
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
    deleteWorkout(id).catch(() => { if (userId) loadData(userId) })
  }

  function handleDeleteExercise(sessionId: string, exId: string) {
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, exercises: s.exercises.filter(e => e.id !== exId) } : s
    ))
    deleteSessionExercise(exId).catch(() => { if (userId) loadData(userId) })
  }

  function handleEditExercise(exId: string, sets: number | null, reps: string | null) {
    setSessions(prev => prev.map(s => ({
      ...s,
      exercises: s.exercises.map(e => e.id === exId ? { ...e, sets, reps } : e),
    })))
    updateSessionExercise(exId, sets, reps).catch(() => { if (userId) loadData(userId) })
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.topHeader}>
          <Text style={styles.title}>Mitt schema</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => openEditor(null)} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color="#000" />
            <Text style={styles.addBtnText}>Nytt pass</Text>
          </TouchableOpacity>
        </View>

        {/* Week strip */}
        <View style={styles.weekStrip}>
          {WEEKDAYS.map((d, i) => {
            const num         = i + 1
            const active      = selectedDay === num
            const isToday     = num === todayIso()
            const daySessions = sessions.filter(s => s.weekdays.includes(num))
            const totalEx     = daySessions.reduce((a, s) => a + s.exercises.length, 0)
            const doneEx      = daySessions.reduce((a, s) => a + s.exercises.filter(e => checked[e.id]).length, 0)
            const allDone     = totalEx > 0 && doneEx === totalEx
            const hasWorkout  = daySessions.length > 0
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
                  hasWorkout && styles.weekDayDotFull,
                  allDone && styles.weekDayDotDone,
                  active && hasWorkout && !allDone && styles.weekDayDotActive,
                ]} />
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Day header */}
        <View style={styles.dayHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dayName}>
              {selectedDay === todayIso() ? 'Idag' : WEEKDAYS[selectedDay - 1]}
            </Text>
            {sessionsForDay.length > 0 && (
              <Text style={styles.daySubtitle}>
                {sessionsForDay.length} pass · {sessionsForDay.reduce((a, s) => a + s.exercises.length, 0)} övningar
              </Text>
            )}
          </View>
        </View>

        {/* Sessions */}
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
                <Text style={styles.restText}>Inget pass schemalagt {WEEKDAYS[selectedDay - 1].toLowerCase()}</Text>
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
                        id:          exInfo.id,
                        name:        exInfo.name,
                        description: exInfo.description ?? '',
                        category:    exInfo.category,
                        difficulty:  exInfo.difficulty,
                        initialSets: sessionEx.sets != null ? String(sessionEx.sets) : '',
                        initialReps: sessionEx.reps ?? '',
                        sessionExId: sessionEx.id,
                        sessionDate: dateForWeekday(selectedDay),
                      },
                    })
                  }
                }}
                onComplete={() => handleComplete(s.id)}
                onUncomplete={() => handleUncomplete(s.id)}
                onEdit={() => openEditor(s)}
              />
            ))}

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

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  scroll:   { paddingBottom: 60 },

  topHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  title:      { color: TEXT_PRIMARY, fontSize: 28, fontWeight: '700' },
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
  weekDayActive:      { backgroundColor: ORANGE, borderColor: ORANGE },
  weekDayToday:       { borderColor: ORANGE },
  weekDayLabel:       { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  weekDayLabelActive: { color: '#000', fontWeight: '800' },
  weekDayLabelToday:  { color: ORANGE },
  weekDayDot:         { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  weekDayDotFull:     { backgroundColor: ORANGE },
  weekDayDotDone:     { backgroundColor: '#4CAF50' },
  weekDayDotActive:   { backgroundColor: '#000' },

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
  loggedSectionTitle: {
    color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600',
    paddingHorizontal: 4, paddingBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
})
