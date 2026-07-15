import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Image,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  ActionSheetIOS,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnUI,
} from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { getExercises, type Exercise } from '@/services/exercises'
import { getProfile } from '@/services/profile'
import { getActiveChallenge, calculateCurrentDay } from '@/services/challenge'
import {
  getWorkoutSessions,
  updateSessionExercise,
  deleteSessionExercise,
  deleteWorkoutSession,
  skipExerciseForDay,
  addMissedExercise,
  addSingleExerciseToSession,
  getCompletedSessionIds,
  getCompletedExerciseIds,
  completeSession,
  uncompleteSession,
  completeExercise,
  uncompleteExercise,
  deleteRepeatingSessions,
  type WorkoutSession,
} from '@/services/workoutSchedule'
import { WorkoutSection } from '@/components/WorkoutSection'
import { SessionEditor, WEEKDAYS } from '@/components/SessionEditor'
import { ExercisePickerSheet } from '@/components/ExercisePickerSheet'
import { CollapsibleCalendar } from '@/components/CollapsibleCalendar'
import { ScheduleWizard } from '@/components/ScheduleWizard'
import { generateScheduleFromWizard } from '@/services/scheduleGenerator'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { toLocalDateString, weekdayOf } from '@/lib/date'

const GPS_KEYWORDS = ['löpning', 'running', 'jogging', 'cykling', 'cycling', 'promenad', 'walking', 'spring', 'intervallspring', 'gång']
const DAY_SHORT  = ['MÅN','TIS','ONS','TOR','FRE','LÖR','SÖN']
const SCREEN_W   = Dimensions.get('window').width
const TOTAL_DAYS = 365
const CENTER_IDX = 182
// Stable reference — recreating this array every render causes FlatList to remount pages
const PAGER_DATA = Array.from({ length: TOTAL_DAYS }, (_, i) => i)

function isoDate(d: Date): string { return toLocalDateString(d) }
function todayMidnight(): Date { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
function indexToDate(i: number): Date {
  const d = todayMidnight(); d.setDate(d.getDate() + i - CENTER_IDX); return d
}
function dateToIndex(d: Date): number {
  const now = todayMidnight()
  return CENTER_IDX + Math.round((d.getTime() - now.getTime()) / 86400000)
}

export default function SchemaScreen() {
  const [exercises, setExercises]           = useState<Exercise[]>([])
  const [sessions, setSessions]             = useState<WorkoutSession[]>([])
  const [userId, setUserId]                 = useState<string | null>(null)
  const [selectedDate, setSelectedDate]     = useState<Date>(todayMidnight)
  const [loading, setLoading]               = useState(true)
  const [editorVisible, setEditorVisible]   = useState(false)
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null)
  // Keyed by ISO date string so each day's completion state is isolated
  const [checkedByDate, setCheckedByDate]       = useState<Record<string, Record<string, boolean>>>({})
  const [completedByDate, setCompletedByDate]   = useState<Record<string, Set<string>>>({})
  const [pickerSession, setPickerSession]   = useState<WorkoutSession | null>(null)
  const [wizardVisible, setWizardVisible]   = useState(false)
  const [avatarUrl, setAvatarUrl]           = useState<string | null>(null)
  const [profileName, setProfileName]       = useState('')
  const [challengeDay, setChallengeDay]     = useState<number | null>(null)
  const pagerRef    = useRef<FlatList<number>>(null)
  const isSwiping   = useRef(false)

  const selectedDateRef = useRef(selectedDate)
  useEffect(() => { selectedDateRef.current = selectedDate }, [selectedDate])
  const userIdRef = useRef(userId)
  useEffect(() => { userIdRef.current = userId }, [userId])

  async function loadData(uid: string) {
    const date = isoDate(selectedDateRef.current)
    const [exs, sess, sessionIds, exerciseIds] = await Promise.all([
      getExercises().catch(() => [] as Exercise[]),
      getWorkoutSessions(uid).catch(() => [] as WorkoutSession[]),
      getCompletedSessionIds(uid, date).catch(() => [] as string[]),
      getCompletedExerciseIds(uid, date).catch(() => [] as string[]),
    ])
    setExercises(exs)
    setSessions(sess)
    const exChecked: Record<string, boolean> = {}
    exerciseIds.forEach(id => { exChecked[id] = true })
    setCompletedByDate(prev => ({ ...prev, [date]: new Set(sessionIds) }))
    setCheckedByDate(prev => ({ ...prev, [date]: exChecked }))
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null
      setUserId(uid)
      if (uid) {
        loadData(uid).finally(() => setLoading(false))
        getProfile(uid).then(p => {
          setAvatarUrl(p?.avatar_url ?? null)
          setProfileName(p?.name ?? '')
        }).catch(() => {})
        getActiveChallenge(uid).then(c => {
          if (c) setChallengeDay(calculateCurrentDay(c.start_date))
        }).catch(() => {})
      } else {
        setLoading(false)
      }
    })
  }, [])

  useFocusEffect(useCallback(() => {
    const uid = userIdRef.current
    if (uid) loadData(uid)
  }, []))

  useEffect(() => {
    if (!userId) return
    const date = isoDate(selectedDate)
    // Debounce: vid snabb swipe genom flera dagar hämtar vi bara den dag
    // användaren landar på, inte varje dag som passerar
    const timer = setTimeout(() => {
      Promise.all([
        getCompletedSessionIds(userId, date).catch(() => [] as string[]),
        getCompletedExerciseIds(userId, date).catch(() => [] as string[]),
      ]).then(([sessionIds, exerciseIds]) => {
        const exChecked: Record<string, boolean> = {}
        exerciseIds.forEach(id => { exChecked[id] = true })
        setCompletedByDate(prev => ({ ...prev, [date]: new Set(sessionIds) }))
        setCheckedByDate(prev => ({ ...prev, [date]: exChecked }))
      })
    }, 250)
    return () => clearTimeout(timer)
  }, [selectedDate, userId])

  function openEditor(session: WorkoutSession | null) {
    setEditingSession(session)
    setEditorVisible(true)
  }

  function toggleCheck(exId: string, date: string) {
    if (!userId) return
    const wasChecked = !!(checkedByDate[date]?.[exId])
    setCheckedByDate(prev => ({ ...prev, [date]: { ...(prev[date] ?? {}), [exId]: !wasChecked } }))
    const action = wasChecked
      ? uncompleteExercise(exId, userId, date)
      : completeExercise(exId, userId, date)
    action.catch(() => setCheckedByDate(prev => ({ ...prev, [date]: { ...(prev[date] ?? {}), [exId]: wasChecked } })))
  }

  function handleComplete(sessionId: string, date: string) {
    if (!userId) return
    setCompletedByDate(prev => ({ ...prev, [date]: new Set([...(prev[date] ?? []), sessionId]) }))
    completeSession(sessionId, userId, date).catch(() => {
      setCompletedByDate(prev => { const s = new Set(prev[date] ?? []); s.delete(sessionId); return { ...prev, [date]: s } })
    })
  }

  function handleUncomplete(sessionId: string, date: string) {
    setCompletedByDate(prev => { const s = new Set(prev[date] ?? []); s.delete(sessionId); return { ...prev, [date]: s } })
    uncompleteSession(sessionId, date).catch(() => {
      setCompletedByDate(prev => ({ ...prev, [date]: new Set([...(prev[date] ?? []), sessionId]) }))
    })
  }

  function handleDeleteExercise(sessionId: string, exId: string, dateStr: string) {
    const session = sessions.find(s => s.id === sessionId)
    if (!session || !userId) return

    const deleteFromTemplate = () => {
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, exercises: s.exercises.filter(e => e.id !== exId) } : s
      ))
      deleteSessionExercise(exId).catch(() => loadData(userId!))
    }

    if (session.weekdays.length === 0) {
      // ONCE or quick-log session — delete directly
      deleteFromTemplate()
      return
    }

    // Repeating session — ask if today only or always
    const deleteJustToday = () => {
      skipExerciseForDay(userId!, session, dateStr, exId)
        .then(() => loadData(userId!))
        .catch(() => loadData(userId!))
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Ta bort övning',
          options: ['Avbryt', 'Bara idag', 'Alltid (alla kommande)'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        i => { if (i === 1) deleteJustToday(); if (i === 2) deleteFromTemplate() },
      )
    } else {
      Alert.alert('Ta bort övning', 'Ta bort bara idag eller från alla kommande pass?', [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Bara idag', onPress: deleteJustToday },
        { text: 'Alltid', style: 'destructive', onPress: deleteFromTemplate },
      ])
    }
  }

  function handleSessionLongPress(session: WorkoutSession, displayedName: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const isRepeating = session.weekdays.length > 0

    if (isRepeating) {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { title: displayedName, options: ['Avbryt', 'Inställningar'], cancelButtonIndex: 0 },
          i => { if (i === 1) router.push('/manage-sessions') },
        )
      } else {
        Alert.alert(displayedName, undefined, [
          { text: 'Inställningar', onPress: () => router.push('/manage-sessions') },
          { text: 'Avbryt', style: 'cancel' },
        ])
      }
    } else {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title: displayedName,
            options: ['Avbryt', 'Ta bort pass'],
            destructiveButtonIndex: 1,
            cancelButtonIndex: 0,
          },
          i => {
            if (i === 1) deleteWorkoutSession(session.id)
              .then(() => { if (userId) loadData(userId) })
              .catch(() => { if (userId) loadData(userId) })
          },
        )
      } else {
        Alert.alert(displayedName, 'Ta bort detta pass?', [
          { text: 'Avbryt', style: 'cancel' },
          {
            text: 'Ta bort', style: 'destructive',
            onPress: () => deleteWorkoutSession(session.id)
              .then(() => { if (userId) loadData(userId) })
              .catch(() => { if (userId) loadData(userId) }),
          },
        ])
      }
    }
  }

  function handleEditExercise(exId: string, sets: number | null, reps: string | null) {
    setSessions(prev => prev.map(s => ({
      ...s,
      exercises: s.exercises.map(e => e.id === exId ? { ...e, sets, reps } : e),
    })))
    updateSessionExercise(exId, sets, reps).catch(() => { if (userId) loadData(userId) })
  }

  // Scroll pager when calendar tap changes date
  useEffect(() => {
    if (isSwiping.current) return
    const idx = dateToIndex(selectedDate)
    pagerRef.current?.scrollToIndex({ index: idx, animated: true })
  }, [selectedDate])

  // Day header fade+slide animation on date change
  const dayFade  = useSharedValue(1)
  const daySlide = useSharedValue(0)
  useEffect(() => {
    runOnUI(() => {
      'worklet'
      dayFade.value  = 0
      daySlide.value = -10
      dayFade.value  = withTiming(1, { duration: 220 })
      daySlide.value = withSpring(0, { damping: 18, stiffness: 240 })
    })()
  }, [selectedDate])
  const dayAnimStyle = useAnimatedStyle(() => ({
    opacity:   dayFade.value,
    transform: [{ translateY: daySlide.value }],
  }))

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>

      {/* Sticky top bar */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => router.push('/(app)/settings')} activeOpacity={0.8}>
          <View style={styles.avatar}>
            {avatarUrl?.startsWith('http') ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : avatarUrl ? (
              <Text style={styles.avatarEmoji}>{avatarUrl}</Text>
            ) : (
              <Text style={styles.avatarInitial}>
                {profileName ? profileName[0].toUpperCase() : '?'}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Absolutely centered so it's always in the middle regardless of side widths */}
        <View style={styles.dayCounterWrap} pointerEvents="none">
          <View style={styles.dayCounter}>
            <Text style={styles.dayCounterNum}>{challengeDay ?? '–'}</Text>
            <Text style={styles.dayCounterSlash}>/75</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => openEditor(null)} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color="#000" />
          <Text style={styles.addBtnText}>Nytt pass</Text>
        </TouchableOpacity>
      </View>

      {/* "Skapa ditt schema" banner */}
      <TouchableOpacity
        style={styles.wizardBanner}
        onPress={() => setWizardVisible(true)}
        activeOpacity={0.85}
      >
        <View style={styles.wizardBannerIcon}>
          <Ionicons name="calendar" size={22} color="#000" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.wizardBannerTitle}>Skapa ditt schema</Text>
          <Text style={styles.wizardBannerSub}>Kom igång med ett anpassat träningsprogram</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#000" />
      </TouchableOpacity>

      {/* Collapsible calendar */}
      <CollapsibleCalendar
        sessions={sessions}
        completedByDate={completedByDate}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      {/* Manage sessions link */}
      <TouchableOpacity
        style={styles.manageLink}
        onPress={() => router.push('/(app)/manage-sessions')}
        activeOpacity={0.7}
      >
        <Ionicons name="list-outline" size={14} color={TEXT_SECONDARY} />
        <Text style={styles.manageLinkText}>Hantera schemalagda pass</Text>
        <Ionicons name="chevron-forward" size={13} color={TEXT_SECONDARY} />
      </TouchableOpacity>

      {/* Horizontal day pager — one page per calendar date */}
      <FlatList
        ref={pagerRef}
        data={PAGER_DATA}
        horizontal
        pagingEnabled
        keyExtractor={item => String(item)}
        initialScrollIndex={CENTER_IDX}
        getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => { isSwiping.current = true }}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)
          // Keep isSwiping = true until after the selectedDate useEffect runs,
          // so it skips the redundant scrollToIndex on swipe end.
          setSelectedDate(indexToDate(idx))
          requestAnimationFrame(() => { isSwiping.current = false })
        }}
        scrollEventThrottle={16}
        windowSize={5}
        maxToRenderPerBatch={3}
        renderItem={({ item: idx }) => {
          const date       = indexToDate(idx)
          const weekday    = weekdayOf(date)
          const dateStr    = isoDate(date)
          const todayMs    = todayMidnight().getTime()
          const isToday    = date.getTime() === todayMs
          const isPastOrToday = date.getTime() <= todayMs
          const isPast        = date.getTime() < todayMs
          const skipPrefix = `SKIP:${dateStr}:`
          const skipIds    = sessions
            .filter(s => s.name.startsWith(skipPrefix))
            .map(s => s.name.slice(skipPrefix.length))
          const daySessions = sessions.filter(s => {
            if (s.name.startsWith('SKIP:')) return false
            if (skipIds.includes(s.id))     return false
            return (
              s.weekdays.includes(weekday) ||
              (s.weekdays.length === 0 && s.name === dateStr) ||
              (s.weekdays.length === 0 && s.name.startsWith(`ONCE:${dateStr}:`))
            )
          })
          function sessionDisplayName(s: WorkoutSession): string {
            if (s.name.startsWith('ONCE:')) return s.name.split(':').slice(2).join(':')
            if (s.name === dateStr) return 'Loggat idag'
            return s.name
          }
          const scheduledSessions = daySessions.filter(s => s.weekdays.length > 0 || s.name.startsWith(`ONCE:${dateStr}:`))
          const quickLogSession   = daySessions.find(s => s.weekdays.length === 0 && s.name === dateStr)
          const dateChecked       = checkedByDate[dateStr] ?? {}
          const dateCompleted     = completedByDate[dateStr] ?? new Set<string>()
          const dayLabel          = isToday ? 'IDAG' : DAY_SHORT[weekday - 1]
          return (
            <ScrollView
              style={{ width: SCREEN_W }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scroll}
            >
              {/* Day header */}
              <Animated.View style={[styles.dayHeader, dayAnimStyle]}>
                <Text style={styles.dayName}>{dayLabel}</Text>
                {daySessions.length > 0 && (
                  <Text style={styles.daySubtitle}>
                    {daySessions.length} pass · {daySessions.reduce((a, s) => a + s.exercises.length, 0)} övningar
                  </Text>
                )}
              </Animated.View>

              {/* Sessions */}
              {sessions.filter(s => !s.name.startsWith('SKIP:')).length === 0 ? (
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
                  {scheduledSessions.length === 0 ? (
                    <View style={styles.restState}>
                      <Ionicons name="moon-outline" size={40} color={BORDER} />
                      <Text style={styles.restTitle}>Vildag</Text>
                      <Text style={styles.restText}>Inget pass schemalagt {isToday ? 'idag' : WEEKDAYS[weekday - 1].toLowerCase()}</Text>
                      <TouchableOpacity style={styles.restAddBtn} onPress={() => openEditor(null)} activeOpacity={0.8}>
                        <Ionicons name="add" size={14} color={ORANGE} />
                        <Text style={styles.restAddText}>Lägg till pass</Text>
                      </TouchableOpacity>
                    </View>
                  ) : scheduledSessions.map(s => {
                    const isCompleted = dateCompleted.has(s.id)
                    return (
                    <WorkoutSection
                      key={s.id}
                      session={{ ...s, name: sessionDisplayName(s) }}
                      checked={dateChecked}
                      isCompleted={isCompleted}
                      onToggleExercise={(exId) => toggleCheck(exId, dateStr)}
                      onDeleteExercise={(exId) => handleDeleteExercise(s.id, exId, dateStr)}
                      onEditExercise={(exId, sets, reps) => handleEditExercise(exId, sets, reps)}
                      onLongPress={() => handleSessionLongPress(s, sessionDisplayName(s))}
                      onAddExercise={!isPast ? () => setPickerSession(s) : undefined}
                      onStartCardio={(name) => router.push({ pathname: '/cardio', params: { name } })}
                      onStartCardioSession={s.session_type === 'cardio'
                        ? () => router.push({ pathname: '/cardio', params: { name: s.cardio_type ?? 'running', sessionId: s.id, sessionDate: dateStr } })
                        : undefined}
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
                              sessionDate: dateStr,
                            },
                          })
                        }
                      }}
                      onComplete={() => handleComplete(s.id, dateStr)}
                      onUncomplete={() => handleUncomplete(s.id, dateStr)}
                      onEdit={() => openEditor(s)}
                    />
                  )})}


                  {/* Quick-log section */}
                  {quickLogSession && (
                    <WorkoutSection
                      key={quickLogSession.id}
                      session={{ ...quickLogSession, name: 'Loggat idag' }}
                      checked={dateChecked}
                      isCompleted={false}
                      isQuickLog
                      onToggleExercise={(exId) => toggleCheck(exId, dateStr)}
                      onDeleteExercise={(exId) => handleDeleteExercise(quickLogSession.id, exId, dateStr)}
                      onEditExercise={(exId, sets, reps) => handleEditExercise(exId, sets, reps)}
                      onStartCardio={(name) => router.push({ pathname: '/cardio', params: { name } })}
                      onCardPress={(sessionEx) => {
                        const name   = sessionEx.exercise_name
                        const exInfo = exercises.find(e => e.name === name)
                        if (!exInfo) return
                        router.push({
                          pathname: '/exercise/[id]',
                          params: {
                            id: exInfo.id, name: exInfo.name,
                            description: exInfo.description ?? '',
                            category: exInfo.category, difficulty: exInfo.difficulty,
                            initialSets: sessionEx.sets != null ? String(sessionEx.sets) : '',
                            initialReps: sessionEx.reps ?? '',
                            sessionExId: sessionEx.id, sessionDate: dateStr,
                          },
                        })
                      }}
                      onComplete={() => {}}
                      onUncomplete={() => {}}
                      onEdit={() => Alert.alert('Snabb-logg', 'Redigera eller ta bort enskilda övningar via ··· bredvid övningen.')}
                      onLongPress={() => handleSessionLongPress(quickLogSession, 'Loggat idag')}
                    />
                  )}

                  {isPast && (
                    <TouchableOpacity
                      style={styles.quickAddBtn}
                      onPress={() => setPickerSession({ id: dateStr, user_id: userId ?? '', name: dateStr, weekdays: [], sort_order: 0, created_at: '', notes: null, session_type: 'gym', cardio_type: null, exercises: [] })}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add-circle-outline" size={18} color={ORANGE} />
                      <Text style={styles.quickAddText}>Logga missad övning</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </ScrollView>
          )
        }}
      />

      {userId && (
        <SessionEditor
          visible={editorVisible}
          session={editingSession}
          exercises={exercises}
          userId={userId}
          initialDate={selectedDate}
          allowDelete={false}
          onClose={() => setEditorVisible(false)}
          onSaved={() => loadData(userId)}
        />
      )}

      <ExercisePickerSheet
        visible={pickerSession !== null}
        exercises={exercises}
        onClose={() => setPickerSession(null)}
        onSelect={async (ex, sets, reps) => {
          if (!pickerSession || !userId) return
          setPickerSession(null)
          if (/^\d{4}-\d{2}-\d{2}$/.test(pickerSession.id)) {
            await addMissedExercise(userId, pickerSession.id, ex.name, sets, reps).catch(() => null)
          } else {
            await addSingleExerciseToSession(pickerSession.id, ex.name, pickerSession.exercises.length, sets, reps).catch(() => null)
          }
          loadData(userId)
        }}
      />

      <ScheduleWizard
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        onFinish={async (result) => {
          setWizardVisible(false)
          if (!userId) return
          const generate = async (replaceExisting: boolean) => {
            try {
              if (replaceExisting) await deleteRepeatingSessions(userId)
              const count = await generateScheduleFromWizard(userId, result)
              await loadData(userId)
              Alert.alert('Schema skapat', `${count} pass har lagts till i ditt veckoschema.`)
            } catch (e: any) {
              Alert.alert('Kunde inte skapa schemat', e.message)
            }
          }
          const hasRepeating = sessions.some(s => s.weekdays.length > 0 && !s.name.startsWith('SKIP:'))
          if (hasRepeating) {
            Alert.alert(
              'Du har redan ett schema',
              'Vill du ersätta dina nuvarande upprepande pass med det nya schemat, eller behålla båda?',
              [
                { text: 'Avbryt', style: 'cancel' },
                { text: 'Behåll båda', onPress: () => generate(false) },
                { text: 'Ersätt', style: 'destructive', onPress: () => generate(true) },
              ]
            )
          } else {
            generate(false)
          }
        }}
      />

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  scroll:   { paddingBottom: 80 },

  wizardBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: ORANGE, borderRadius: 16, padding: 14,
  },
  wizardBannerIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  wizardBannerTitle: { color: '#000', fontSize: 15, fontWeight: '800' },
  wizardBannerSub:   { color: 'rgba(0,0,0,0.6)', fontSize: 12, marginTop: 1 },

  topHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10,
    height: 62,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: ORANGE + '30',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg:     { width: 40, height: 40, borderRadius: 20 },
  avatarEmoji:   { fontSize: 22 },
  avatarInitial: { color: ORANGE, fontSize: 18, fontWeight: '700' },
  dayCounterWrap: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
    height: 62,
  },
  dayCounter: {
    flexDirection: 'row', alignItems: 'baseline', gap: 1,
  },
  dayCounterNum:   { color: TEXT_PRIMARY, fontSize: 26, fontWeight: '800' },
  dayCounterSlash: { color: TEXT_SECONDARY, fontSize: 16, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ORANGE, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },

  dayHeader: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  dayName:     { color: TEXT_PRIMARY, fontSize: 26, fontWeight: '800' },
  daySubtitle: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 4 },

  manageLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  manageLinkText: { flex: 1, color: TEXT_SECONDARY, fontSize: 12 },
  sectionList: { paddingHorizontal: 16 },
  quickAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 16,
    marginTop: 4, marginBottom: 24,
    borderRadius: 14, borderWidth: 1,
    borderColor: ORANGE + '40', borderStyle: 'dashed',
  },
  quickAddText: { color: ORANGE, fontSize: 15, fontWeight: '600' },

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

})
