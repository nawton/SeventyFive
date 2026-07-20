import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import Animated, {
  useAnimatedStyle,
  type AnimatedStyle,
} from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { getExercises, type Exercise } from '@/services/exercises'
import { getProfile } from '@/services/profile'
import { getActiveChallenge, calculateCurrentDay } from '@/services/challenge'
import {
  getWorkoutSessions,
  createWorkoutSession,
  deleteSessionExercise,
  deleteWorkoutSession,
  skipExerciseForDay,
  addMissedExercise,
  addSingleExerciseToSession,
  getCompletedSessionIds,
  getCompletedSessionsByDate,
  getCardioCompletions,
  getCompletedExerciseIds,
  getExerciseCompletionCounts,
  completeSession,
  uncompleteSession,
  completeExercise,
  uncompleteExercise,
  deleteRepeatingSessions,
  PLAN_WEEKS,
  type WorkoutSession,
} from '@/services/workoutSchedule'
import { SessionEditor } from '@/components/SessionEditor'
import { ExercisePickerSheet } from '@/components/ExercisePickerSheet'
import { LogWorkoutSheet } from '@/components/LogWorkoutSheet'
import { SessionFullscreen } from '@/components/SessionFullscreen'
import { getCardioWorkoutsForDate, getWorkoutsForDate, getStrengthWorkouts, type CardioWorkout, type StrengthWorkout } from '@/services/workouts'
import { CollapsibleCalendar } from '@/components/CollapsibleCalendar'
import { ScheduleWizard } from '@/components/ScheduleWizard'
import { generateScheduleFromWizard } from '@/services/scheduleGenerator'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, NUM_FONT_SEMI, CARDIO_BLUE } from '@/lib/theme'
import { getUnitSystem, type UnitSystem } from '@/lib/units'
import { TAB_CONTENT_PAD } from '@/lib/glass'
import { DayPage, EMPTY_CHECKED, EMPTY_COMPLETED, EMPTY_CARDIO_STATS, EMPTY_CARDIO_LOGS, EMPTY_LOGGED, type DayPageApi } from '@/components/schedule/DayPage'
import { PAGER_DATA, CENTER_IDX, isoDate, todayMidnight, indexToDate, dateToIndex } from '@/lib/scheduleDates'

const SCREEN_W = Dimensions.get('window').width

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
  // Distans/tid per avklarat cardio-pass, nycklat på datum → session-id
  const [cardioStatsByDate, setCardioStatsByDate] = useState<Record<string, Record<string, { distanceKm: number; durationSeconds: number }>>>({})
  // Loggade cardio-pass per datum
  const [cardioLogsByDate, setCardioLogsByDate] = useState<Record<string, CardioWorkout[]>>({})
  // Loggade styrkepass per datum — statraden på avklarade gympass
  const [loggedByDate, setLoggedByDate] = useState<Record<string, StrengthWorkout[]>>({})
  // Senast loggade vikt per övning — visas på övningsraderna i schemakorten
  const [lastWeights, setLastWeights] = useState<Record<string, number>>({})
  const [pickerSession, setPickerSession]   = useState<WorkoutSession | null>(null)
  const [logSheetOpen, setLogSheetOpen]     = useState(false)
  const [fullscreenTarget, setFullscreenTarget] = useState<{ session: WorkoutSession; date: string } | null>(null)
  const [wizardVisible, setWizardVisible]   = useState(false)
  // null = inte inläst än (rendera inte bannern förrän vi vet, undviker blink)
  const [wizardBannerDismissed, setWizardBannerDismissed] = useState<boolean | null>(null)
  // Vilket plan-slut användaren klickat bort — ny plan nollställer skylten
  const [planEndDismissedKey, setPlanEndDismissedKey] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl]           = useState<string | null>(null)
  const [profileName, setProfileName]       = useState('')
  const [challengeDay, setChallengeDay]     = useState<number | null>(null)
  // Genomföranden per övning — underlag för progressionsskalning av reps
  const [exerciseProgress, setExerciseProgress] = useState<Record<string, number>>({})
  // km/miles — löpplanernas mål visas i vald enhet
  const [unit, setUnit] = useState<UnitSystem>('metric')
  const pagerRef    = useRef<FlatList<number>>(null)
  const [refreshing, setRefreshing] = useState(false)
  const refreshingRef = useRef(false)
  const isSwiping   = useRef(false)

  const selectedDateRef = useRef(selectedDate)
  useEffect(() => { selectedDateRef.current = selectedDate }, [selectedDate])
  const userIdRef = useRef(userId)
  useEffect(() => { userIdRef.current = userId }, [userId])

  useEffect(() => {
    AsyncStorage.getItem('wizardBannerDismissed')
      .then(v => setWizardBannerDismissed(v === '1'))
      .catch(() => setWizardBannerDismissed(false))
    AsyncStorage.getItem('planEndDismissed')
      .then(setPlanEndDismissedKey)
      .catch(() => {})
  }, [])

  // Löpplanens sista vecka (eller slut): knuffa mot nästa plan så passen inte
  // bara försvinner tyst när 16-veckorshorisonten tar slut
  const planEnd = (() => {
    const cardio = sessions.filter(s => s.weekdays.length > 0 && s.session_type === 'cardio')
    if (cardio.length === 0) return null
    const newest = cardio.reduce((a, b) => (a.created_at > b.created_at ? a : b))
    const end = new Date(newest.created_at)
    end.setHours(0, 0, 0, 0)
    end.setDate(end.getDate() + PLAN_WEEKS * 7)
    const daysLeft = Math.round((end.getTime() - todayMidnight().getTime()) / 86400000)
    if (daysLeft > 7) return null
    return { ended: daysLeft <= 0, key: isoDate(end) }
  })()
  const showPlanEndBanner = planEnd !== null && planEndDismissedKey !== planEnd.key

  function dismissPlanEndBanner() {
    if (!planEnd) return
    setPlanEndDismissedKey(planEnd.key)
    AsyncStorage.setItem('planEndDismissed', planEnd.key).catch(() => {})
  }

  // Guidat flöde från engångsmålen: landa på sidan, öppna sedan schemaguiden
  const { action } = useLocalSearchParams<{ action?: string }>()
  const handledActionRef = useRef<string | null>(null)
  useEffect(() => {
    if (loading || action !== 'wizard' || handledActionRef.current === action) return
    handledActionRef.current = action
    const timer = setTimeout(() => {
      setWizardVisible(true)
      // Rensas efter öppning — setParams triggar annars cleanupen som dödar timern
      router.setParams({ action: undefined })
    }, 600)
    return () => clearTimeout(timer)
  }, [action, loading])

  async function loadData(uid: string) {
    const date = isoDate(selectedDateRef.current)
    const [exs, sess, completedAll, cardioStats, exerciseIds, progressCounts] = await Promise.all([
      getExercises().catch(() => [] as Exercise[]),
      getWorkoutSessions(uid).catch(() => [] as WorkoutSession[]),
      getCompletedSessionsByDate(uid).catch(() => ({} as Record<string, string[]>)),
      getCardioCompletions(uid, date).catch(() => ({})),
      getCompletedExerciseIds(uid, date).catch(() => [] as string[]),
      getExerciseCompletionCounts(uid).catch(() => ({} as Record<string, number>)),
    ])
    getCardioWorkoutsForDate(uid, date).then(cl => setCardioLogsByDate(prev => ({ ...prev, [date]: cl }))).catch(() => {})
    getWorkoutsForDate(uid, date).then(lw => setLoggedByDate(prev => ({ ...prev, [date]: lw }))).catch(() => {})
    getStrengthWorkouts(uid, 300).then(ws => {
      const map: Record<string, number> = {}
      // Nyast först — första viktade träffen per övning vinner
      for (const w of ws) {
        const name = w.data.exercise_name
        if (map[name] !== undefined) continue
        const top = w.data.sets.reduce((m, st) => Math.max(m, st.weight_kg || 0), 0)
        if (top > 0) map[name] = top
      }
      setLastWeights(map)
    }).catch(() => {})
    setExercises(exs)
    setSessions(sess)
    setExerciseProgress(progressCounts)
    const exChecked: Record<string, boolean> = {}
    exerciseIds.forEach(id => { exChecked[id] = true })
    // ALLA dagars avklarningar på en gång — kalenderns gröna ringar stämmer
    // direkt utan att varje dag måste besökas
    setCompletedByDate(() => {
      const out: Record<string, Set<string>> = {}
      for (const [d, ids] of Object.entries(completedAll)) out[d] = new Set(ids)
      return out
    })
    setCardioStatsByDate(prev => ({ ...prev, [date]: cardioStats }))
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
    getUnitSystem().then(setUnit).catch(() => {})
  }, []))

  useEffect(() => {
    if (!userId) return
    const date = isoDate(selectedDate)
    // Debounce: vid snabb swipe genom flera dagar hämtar vi bara den dag
    // användaren landar på, inte varje dag som passerar
    const timer = setTimeout(() => {
      Promise.all([
        getCompletedSessionIds(userId, date).catch(() => [] as string[]),
        getCardioCompletions(userId, date).catch(() => ({})),
        getCompletedExerciseIds(userId, date).catch(() => [] as string[]),
      ]).then(([sessionIds, cardioStats, exerciseIds]) => {
        const exChecked: Record<string, boolean> = {}
        exerciseIds.forEach(id => { exChecked[id] = true })
        setCompletedByDate(prev => ({ ...prev, [date]: new Set(sessionIds) }))
        setCardioStatsByDate(prev => ({ ...prev, [date]: cardioStats }))
        setCheckedByDate(prev => ({ ...prev, [date]: exChecked }))
      })
      getCardioWorkoutsForDate(userId, date).then(cl => setCardioLogsByDate(prev => ({ ...prev, [date]: cl }))).catch(() => {})
      getWorkoutsForDate(userId, date).then(lw => setLoggedByDate(prev => ({ ...prev, [date]: lw }))).catch(() => {})
    }, 250)
    return () => clearTimeout(timer)
  }, [selectedDate, userId])

  function openEditor(session: WorkoutSession | null) {
    setEditingSession(session)
    setEditorVisible(true)
  }

  function handleRecordWorkout() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setLogSheetOpen(true)
  }

  function toggleCheck(exId: string, date: string) {
    if (!userId) return
    const wasChecked = !!(checkedByDate[date]?.[exId])
    setCheckedByDate(prev => ({ ...prev, [date]: { ...(prev[date] ?? {}), [exId]: !wasChecked } }))
    const action = wasChecked
      ? uncompleteExercise(exId, userId, date)
      : completeExercise(exId, userId, date)
    action.catch((e: Error) => {
      setCheckedByDate(prev => ({ ...prev, [date]: { ...(prev[date] ?? {}), [exId]: wasChecked } }))
      Alert.alert('Kunde inte spara avbockningen', e.message)
    })
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
    // Inställningar öppnar passredigeraren (dit de gamla tre prickarna ledde)
    const deletePass = () => deleteWorkoutSession(session.id)
      .then(() => { if (userId) loadData(userId) })
      .catch(() => { if (userId) loadData(userId) })

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: displayedName,
          options: ['Avbryt', 'Inställningar', 'Ta bort pass'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        i => {
          if (i === 1) openEditor(session)
          if (i === 2) deletePass()
        },
      )
    } else {
      Alert.alert(displayedName, undefined, [
        { text: 'Inställningar', onPress: () => openEditor(session) },
        { text: 'Ta bort pass', style: 'destructive', onPress: deletePass },
        { text: 'Avbryt', style: 'cancel' },
      ])
    }
  }

  // Scroll pager when calendar tap changes date.
  // Hopp längre än en dag (veckosvep, månadsval) sker DIREKT utan animation —
  // annars scrollar pagern igenom och renderar varje mellanliggande dag
  const lastPagerIdx = useRef(dateToIndex(todayMidnight()))
  useEffect(() => {
    if (isSwiping.current) return
    const idx = dateToIndex(selectedDate)
    const animate = Math.abs(idx - lastPagerIdx.current) <= 1
    lastPagerIdx.current = idx
    pagerRef.current?.scrollToIndex({ index: idx, animated: animate })
  }, [selectedDate])

  // Ingen animation på dagrubriken — den hoppade till vid varje dagbyte
  const dayAnimStyle = useAnimatedStyle(() => ({}))

  // Dra-ner på en dagsida → hämta om hela schemat; spinnern ligger mellan
  // kalendern och veckodagen och står kvar minst 1,2 s så den hinner uppfattas
  function handlePullRefresh() {
    const uid = userIdRef.current
    if (refreshingRef.current || !uid) return
    refreshingRef.current = true
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setRefreshing(true)
    const started = Date.now()
    loadData(uid).catch(() => {}).finally(() => {
      const wait = Math.max(0, 1200 - (Date.now() - started))
      setTimeout(() => {
        setRefreshing(false)
        refreshingRef.current = false
      }, wait)
    })
  }

  // Stabilt API-objekt till de memoiserade dagsidorna: identiteten ändras aldrig,
  // men anropen delegeras alltid till senaste renderns handlers via ref:en
  const apiFnsRef = useRef<DayPageApi>(null as unknown as DayPageApi)
  apiFnsRef.current = {
    pullRefresh: handlePullRefresh,
    toggleCheck,
    deleteExercise: handleDeleteExercise,
    sessionLongPress: handleSessionLongPress,
    setPickerSession,
    complete: handleComplete,
    uncomplete: handleUncomplete,
    openEditor,
    openFullscreen: (s, date) => setFullscreenTarget({ session: s, date }),
  }
  const api = useMemo<DayPageApi>(() => ({
    pullRefresh:      () => apiFnsRef.current.pullRefresh(),
    toggleCheck:      (...a) => apiFnsRef.current.toggleCheck(...a),
    deleteExercise:   (...a) => apiFnsRef.current.deleteExercise(...a),
    sessionLongPress: (...a) => apiFnsRef.current.sessionLongPress(...a),
    setPickerSession: (...a) => apiFnsRef.current.setPickerSession(...a),
    complete:         (...a) => apiFnsRef.current.complete(...a),
    uncomplete:       (...a) => apiFnsRef.current.uncomplete(...a),
    openEditor:       (...a) => apiFnsRef.current.openEditor(...a),
    openFullscreen:   (...a) => apiFnsRef.current.openFullscreen(...a),
  }), [])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>

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
          <Text style={styles.addBtnText}>Planera</Text>
        </TouchableOpacity>
      </View>

      {/* "Skapa ditt schema" banner — visas bara om man varken har ett schema
          eller klickat bort den (wizarden nås alltid via inställningarna) */}
      {wizardBannerDismissed === false && !sessions.some(s => s.weekdays.length > 0 && !s.name.startsWith('SKIP:')) && (
        <TouchableOpacity
          style={styles.wizardBanner}
          onPress={() => {
            setWizardBannerDismissed(true)
            AsyncStorage.setItem('wizardBannerDismissed', '1').catch(() => {})
            setWizardVisible(true)
          }}
          activeOpacity={0.85}
        >
          <View style={styles.wizardBannerIcon}>
            <Ionicons name="calendar" size={22} color="#000" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.wizardBannerTitle}>Skapa ditt schema</Text>
            <Text style={styles.wizardBannerSub}>Kom igång med ett anpassat träningsprogram</Text>
          </View>
          <TouchableOpacity
            style={styles.wizardBannerClose}
            onPress={() => {
              setWizardBannerDismissed(true)
              AsyncStorage.setItem('wizardBannerDismissed', '1').catch(() => {})
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={16} color="#000" />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Löpplanen är klar/snart klar — skapa nästa utifrån var man är nu */}
      {showPlanEndBanner && (
        <TouchableOpacity
          style={styles.planEndBanner}
          onPress={() => setWizardVisible(true)}
          activeOpacity={0.85}
        >
          <View style={styles.planEndIcon}>
            <Ionicons name="flag" size={20} color="#000" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.planEndTitle}>
              {planEnd?.ended ? 'Din löpplan är klar!' : 'Sista veckan på din löpplan'}
            </Text>
            <Text style={styles.planEndSub}>
              {planEnd?.ended
                ? 'Skapa nästa plan utifrån var du är nu'
                : 'Dags att planera nästa — utgå från din nya nivå'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.planEndClose}
            onPress={dismissPlanEndBanner}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={16} color="#000" />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

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

      {/* Uppdaterings-snurra: under kalendern, ovanför veckodagen */}
      {refreshing && <ActivityIndicator color={ORANGE} style={styles.refreshSpinner} />}

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
        // Litet fönster: bara föregående/nuvarande/nästa dag hålls monterade,
        // och en sida i taget per batch — fjärrhopp fryser annars UI:t
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        updateCellsBatchingPeriod={40}
        renderItem={({ item: idx }) => {
          const dateStr = isoDate(indexToDate(idx))
          return (
            <DayPage
              idx={idx}
              sessions={sessions}
              exercises={exercises}
              checked={checkedByDate[dateStr] ?? EMPTY_CHECKED}
              progress={exerciseProgress}
              completed={completedByDate[dateStr] ?? EMPTY_COMPLETED}
              cardioStats={cardioStatsByDate[dateStr] ?? EMPTY_CARDIO_STATS}
              cardioLogs={cardioLogsByDate[dateStr] ?? EMPTY_CARDIO_LOGS}
              logged={loggedByDate[dateStr] ?? EMPTY_LOGGED}
              lastWeights={lastWeights}
              unit={unit}
              userId={userId}
              dayAnimStyle={dayAnimStyle}
              api={api}
            />
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
        gymOnly={pickerSession?.session_type !== 'cardio'}
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

      <SessionFullscreen
        visible={fullscreenTarget !== null}
        session={fullscreenTarget
          ? {
              ...fullscreenTarget.session,
              // Färska övningar från senaste laddningen (snapshotet blir annars inaktuellt
              // när man ändrar set/reps i övningsloggen)
              exercises: sessions.find(x => x.id === fullscreenTarget.session.id)?.exercises ?? fullscreenTarget.session.exercises,
            }
          : null}
        isCompleted={!!fullscreenTarget && (completedByDate[fullscreenTarget.date]?.has(fullscreenTarget.session.id) ?? false)}
        exercisesList={exercises}
        date={fullscreenTarget?.date ?? ''}
        userId={userId}
        onComplete={() => { if (fullscreenTarget) handleComplete(fullscreenTarget.session.id, fullscreenTarget.date) }}
        onUncomplete={() => { if (fullscreenTarget) handleUncomplete(fullscreenTarget.session.id, fullscreenTarget.date) }}
        onSaved={() => { if (userId) loadData(userId) }}
        onClose={() => setFullscreenTarget(null)}
      />

      <LogWorkoutSheet
        visible={logSheetOpen}
        exercises={exercises}
        // GPS-löpning kan inte köras i efterhand — tidigare dagar loggar bara gym
        allowCardio={isoDate(selectedDate) === isoDate(todayMidnight())}
        onClose={() => setLogSheetOpen(false)}
        onPickCardio={(type, label) => {
          // Stäng modalen FÖRST, navigera sen — annars krockar dismiss + push
          setLogSheetOpen(false)
          setTimeout(() => router.push({ pathname: '/cardio-session', params: { name: label, cardioType: type } }), 350)
        }}
        onSaveGym={async (name, items) => {
          if (!userId) { setLogSheetOpen(false); return }
          const date = isoDate(selectedDate)
          try {
            // Skapa ETT pass (ONCE för idag) → renderas som ett vanligt pass-kort
            // (inte avklarat — användaren bockar av övningarna själv)
            await createWorkoutSession(
              userId,
              `ONCE:${date}:${name}`,
              [],
              items.map(it => ({ exercise_name: it.exerciseName, sets: it.sets, reps: it.reps })),
              null,
              'gym',
              null,
            )
          } catch { /* ignoreras — laddas om nedan */ }
          setLogSheetOpen(false)
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

      {/* ── Logga pass — idag och bakåt (missade pass), inte framtida dagar ── */}
      {selectedDate.getTime() <= todayMidnight().getTime() && (
        <View style={styles.recordWrap} pointerEvents="box-none">
          <TouchableOpacity style={styles.recordBtn} onPress={handleRecordWorkout} activeOpacity={0.9}>
            <Ionicons name="play" size={16} color="#000" />
            <Text style={styles.recordBtnText}>Logga pass</Text>
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },

  // Spela in pass-knappen — ovanför den flytande tabbar-pillen
  recordWrap: {
    position: 'absolute', left: 0, right: 0, bottom: TAB_CONTENT_PAD,
    paddingHorizontal: 16,
  },
  recordBtn: {
    alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: '#F2F2F5', borderRadius: 24, paddingVertical: 12, paddingHorizontal: 26,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  recordBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },

  wizardBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: ORANGE, borderRadius: 16, padding: 14,
  },
  wizardBannerClose: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  wizardBannerIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  wizardBannerTitle: { color: '#000', fontSize: 15, fontWeight: '800' },
  wizardBannerSub:   { color: 'rgba(0,0,0,0.6)', fontSize: 12, marginTop: 1 },

  // Plan-slut — samma bannerform som schemaguiden men i cardio-blått
  planEndBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: CARDIO_BLUE, borderRadius: 16, padding: 14,
  },
  planEndIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  planEndTitle: { color: '#000', fontSize: 15, fontWeight: '800' },
  planEndSub:   { color: 'rgba(0,0,0,0.6)', fontSize: 12, marginTop: 1 },
  planEndClose: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

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
  dayCounterNum:   { color: TEXT_PRIMARY, fontSize: 26, fontFamily: NUM_FONT },
  dayCounterSlash: { color: TEXT_SECONDARY, fontSize: 16, fontFamily: NUM_FONT_SEMI },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ORANGE, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },


  manageLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  manageLinkText: { flex: 1, color: TEXT_SECONDARY, fontSize: 12 },
  refreshSpinner: { marginTop: 10, marginBottom: 2 },



})
