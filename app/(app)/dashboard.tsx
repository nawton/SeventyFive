import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useColorScheme,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SafeScreen } from '@/components/SafeScreen'
import { AppRefreshControl, useAppRefresh, SPINNER_GRAY } from '@/components/AppRefresh'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  Easing,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import {
  getActiveChallenge,
  calculateCurrentDay,
  calculateDaysSinceStart,
  restartChallenge,
  completeChallenge,
} from '@/services/challenge'
import { getProfile } from '@/services/profile'
import {
  getOrCreateTodayLog,
  getOrCreateTaskCompletions,
  setTaskProgress,
  setTaskCompleted,
  markDayCompleted,
  markDayPending,
  markDayFailed,
  getMissedDayNumbers,
  acknowledgeMissedDays,
  countCompletedDays,
  type TaskItem,
  type TaskDetails,
} from '@/services/dailyLog'
import { hasPhotoForDay } from '@/services/progressPhotos'
import { getWorkoutSessions, getCompletedSessionIds, sessionActiveOn, type WorkoutSession } from '@/services/workoutSchedule'
import { getStreak } from '@/services/dailyLog'
import { getSocialNotificationCount } from '@/services/social'
import { getIncomingRequestCount } from '@/services/follows'
import { getGroupNotificationCount } from '@/services/groups'
import { getNotifSeenAt, getRaceDate } from '@/lib/prefs'
import { isoDate, todayMidnight } from '@/lib/scheduleDates'
import { weekdayOf } from '@/lib/date'
import { ORANGE, TEXT_SECONDARY, CARDIO_BLUE, useCardChrome } from '@/lib/theme'
import { createCustomRule, deleteCustomRule } from '@/services/rules'
import { FailModal } from '@/components/FailModal'
import { ReadingLogModal } from '@/components/ReadingLogModal'
import { RestartPromptModal } from '@/components/RestartPromptModal'
import { VictoryModal } from '@/components/VictoryModal'
import { TaskGridCard, TASK_COLORS, TASK_COLORS_LIGHT, TASK_GAP } from '@/components/TaskGridCard'
import { AddRuleSheet } from '@/components/AddRuleSheet'
import type { UserChallengeWithLevel } from '@/types/database'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getGreetingSubtitle } from '@/lib/getGreetingSubtitle'
import { TAB_CONTENT_PAD } from '@/lib/glass'
import { useTabBarShrinkOnScroll } from '@/lib/tabBar'
import { BG, BORDER, CARD, TEXT_PRIMARY, useThemeStrings, ACCENT, accentAlpha, CARD_BORDER } from '@/lib/theme'
import { getWorkoutsForDate, getCardioWorkoutsForDate } from '@/services/workouts'

const NUM_FONT  = 'Nunito_700Bold'
const SCENE_BG  = BG
const CARD_BG   = CARD

// ── Ring constants ─────────────────────────────────────────────────────────────
const R_SIZE   = 118
const R_STROKE = 9
const R_RADIUS = (R_SIZE - R_STROKE) / 2
const R_CIRCUM = 2 * Math.PI * R_RADIUS

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const ICON_ALIAS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  dumbbell:  'barbell-outline',
  droplet:   'water-outline',
  snowflake: 'snow-outline',
  flame:     'flame-outline',
  book:      'book-outline',
  camera:    'camera-outline',
  utensils:  'restaurant-outline',
  run:       'walk-outline',
  bike:      'bicycle-outline',
  heart:     'heart-outline',
  star:      'star-outline',
  moon:      'moon-outline',
  sun:       'sunny-outline',
  check:     'checkmark-circle-outline',
  clock:     'time-outline',
  lightning: 'flash-outline',
}

function safeIcon(raw: string): React.ComponentProps<typeof Ionicons>['name'] {
  return ICON_ALIAS[raw] ?? (raw as React.ComponentProps<typeof Ionicons>['name'])
}

function levelRuleIcon(rule: string): React.ComponentProps<typeof Ionicons>['name'] {
  const r = rule.toLowerCase()
  if (r.includes('träning') || r.includes('workout') || r.includes('pass')) return 'barbell-outline'
  if (r.includes('vatten') || r.includes('water'))                           return 'water-outline'
  if (r.includes('kost') || r.includes('diet') || r.includes('mat'))        return 'nutrition-outline'
  if (r.includes('läs') || r.includes('sidor'))                             return 'book-outline'
  if (r.includes('foto') || r.includes('photo'))                            return 'camera-outline'
  if (r.includes('dusch') || r.includes('shower'))                          return 'snow-outline'
  return 'checkmark-circle-outline'
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 5)  return 'God natt'
  if (h < 12) return 'God morgon'
  if (h < 17) return 'God eftermiddag'
  if (h < 21) return 'God kväll'
  return 'God natt'
}


// ── Progress Ring ──────────────────────────────────────────────────────────────
function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const progress   = useSharedValue(0)
  const isComplete = total > 0 && completed === total
  const T = useThemeStrings()
  const ringColor  = isComplete ? '#3BE862' : T.ACCENT
  // Glöden bakom ringen hör mörka läget till — i ljust blir den en smetig
  // gradientfläck på det vita kortet
  const ringGlowOff = T.TEXT_PRIMARY !== '#FFFFFF'

  useEffect(() => {
    progress.value = withTiming(
      total > 0 ? completed / total : 0,
      { duration: 1000, easing: Easing.out(Easing.cubic) }
    )
  }, [completed, total])

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: R_CIRCUM * (1 - progress.value),
  }))

  return (
    <View style={[s.ringWrap, { shadowColor: ringColor }, ringGlowOff && { shadowOpacity: 0 }]}>
      <Svg
        width={R_SIZE}
        height={R_SIZE}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={R_SIZE / 2} cy={R_SIZE / 2} r={R_RADIUS}
          stroke={T.BORDER} strokeWidth={R_STROKE} fill="none"
        />
        <AnimatedCircle
          cx={R_SIZE / 2} cy={R_SIZE / 2} r={R_RADIUS}
          stroke={ringColor} strokeWidth={R_STROKE} fill="none"
          strokeDasharray={`${R_CIRCUM}`}
          animatedProps={arcProps}
          strokeLinecap="round"
        />
      </Svg>
      <View style={s.ringCenter}>
        <Text style={[s.ringNum, { color: ringColor }]}>{completed}</Text>
        <Text style={s.ringDenom}>/{total}</Text>
        <Text style={s.ringLabel}>KLART</Text>
      </View>
    </View>
  )
}

// ── Dashboard Screen ───────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const onScrollShrink = useTabBarShrinkOnScroll()
  // Gradienter kräver strängfärger — välj par efter aktuellt tema
  const lightMode = useColorScheme() === 'light'
  const heroShadow = lightMode ? '#101425' : '#FFA817'
  // Ljust läge: platt vit yta utan gradient och ram — bara mjuk skugga
  const heroGradient: [string, string] = lightMode
    ? ['#FFFFFF', '#FFFFFF'] : ['#1C1915', '#0F0F11']
  const insets = useSafeAreaInsets()
  const [userName, setUserName]     = useState('')
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [currentDay, setCurrentDay] = useState(1)
  const [levelName, setLevelName]   = useState('')
  const [tasks, setTasks]           = useState<TaskItem[]>([])
  const [dailyLogId, setDailyLogId] = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [failVisible, setFailVisible] = useState(false)
  const [dayFailed, setDayFailed]   = useState(false)
  const [challenge, setChallenge]   = useState<UserChallengeWithLevel | null>(null)
  const [missedDays, setMissedDays] = useState<number[]>([])
  const [restartVisible, setRestartVisible] = useState(false)
  const [restartVariant, setRestartVariant] = useState<'missed' | 'today'>('missed')
  const [victoryVisible, setVictoryVisible] = useState(false)
  const [completedDaysCount, setCompletedDaysCount] = useState(0)
  const [readingTask, setReadingTask] = useState<TaskItem | null>(null)
  const [loadError, setLoadError]   = useState(false)
  const [userId, setUserId]         = useState<string | null>(null)
  // Dagens pass, streak och social puls — knyter hemskärmen till resten av appen
  const [todaySessions, setTodaySessions] = useState<WorkoutSession[]>([])
  const [todayDoneIds, setTodayDoneIds]   = useState<string[]>([])
  const [hasAnySchedule, setHasAnySchedule] = useState(false)
  const [hasActivityToday, setHasActivityToday] = useState(false)
  const [streak, setStreak]               = useState(0)
  const [pulseCount, setPulseCount]       = useState(0)
  const [pulseRequests, setPulseRequests] = useState(0)
  const [pulseGroups, setPulseGroups]     = useState(0)
  const chrome = useCardChrome()

  // Add-rule sheet (UI, animation och gest bor i AddRuleSheet-komponenten)
  const [addRuleOpen, setAddRuleOpen]   = useState(false)
  // Regellistan hopfälld som standard — man kan sina regler efter dag 2
  const [rulesOpen, setRulesOpen] = useState(false)
  useEffect(() => {
    AsyncStorage.getItem('rulesOpen').then(v => setRulesOpen(v === '1')).catch(() => {})
  }, [])
  function toggleRules() {
    Haptics.selectionAsync()
    setRulesOpen(v => {
      AsyncStorage.setItem('rulesOpen', v ? '0' : '1').catch(() => {})
      return !v
    })
  }

  // Guidat flöde från engångsmålen: scrolla till regelsektionen, öppna sedan sheeten
  const { action } = useLocalSearchParams<{ action?: string }>()
  const scrollRef  = useRef<ScrollView>(null)
  const handledActionRef = useRef<string | null>(null)
  useEffect(() => {
    if (loading || action !== 'addRule' || handledActionRef.current === action) return
    handledActionRef.current = action
    const scrollTimer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 450)
    const openTimer   = setTimeout(() => {
      setAddRuleOpen(true)
      // Rensas EFTER att flödet öppnats — setParams ändrar action-dep:en och
      // triggar effektens cleanup, vilket annars dödar timrarna i förtid
      router.setParams({ action: undefined })
    }, 1300)
    return () => { clearTimeout(scrollTimer); clearTimeout(openTimer) }
  }, [action, loading])

  // ── 3D floating hero animation ──
  const tiltX = useSharedValue(0)
  const tiltY = useSharedValue(0)

  useEffect(() => {
    tiltY.value = withRepeat(
      withSequence(
        withTiming(-2.2, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
        withTiming(2.2,  { duration: 4200, easing: Easing.inOut(Easing.sin) })
      ), -1, true
    )
    tiltX.value = withRepeat(
      withSequence(
        withTiming(-1.2, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.2,  { duration: 6000, easing: Easing.inOut(Easing.sin) })
      ), -1, true
    )
  }, [])

  const heroAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateX: `${tiltX.value}deg` },
      { rotateY: `${tiltY.value}deg` },
    ],
  }))

  useEffect(() => { loadDashboard() }, [])

  // Appens gemensamma dra-för-att-uppdatera
  const { refreshing, onRefresh } = useAppRefresh(async () => { await loadDashboard() })

  // Tyst omhämtning när fliken får fokus — plockar upp ändringar gjorda på
  // andra skärmar (nytt/borttaget foto, redigerad profil) utan laddsnurra
  useFocusEffect(useCallback(() => {
    if (loading) return
    loadDashboard()
  }, [loading]))

  async function loadDashboard() {
    try {
      setLoadError(false)
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.replace('/(auth)/welcome'); return }

      setUserId(user.id)

      const profile = await getProfile(user.id)
      setUserName(profile?.name || user.email?.split('@')[0] || 'Nawton')
      if (profile?.avatar_url) setUserAvatar(profile.avatar_url)

      const active = await getActiveChallenge(user.id)
      if (!active) { router.replace('/(auth)/quiz'); return }
      setChallenge(active)
      setLevelName(active.challenge_levels?.display_name ?? '')

      // Utmaningen är slut — markera som klarad och fira
      if (calculateDaysSinceStart(active.start_date) > 75) {
        await completeChallenge(active.id)
        setCompletedDaysCount(await countCompletedDays(active.id))
        setVictoryVisible(true)
        return
      }

      const day = calculateCurrentDay(active.start_date)
      setCurrentDay(day)

      // Dagens pass + streak + social puls — fel här får inte fälla hemskärmen
      getWorkoutsForDate(user.id, isoDate(todayMidnight()))
        .then(ws => { if (ws.length > 0) setHasActivityToday(true) })
        .catch(() => {})
      getCardioWorkoutsForDate(user.id, isoDate(todayMidnight()))
        .then(ws => { if (ws.length > 0) setHasActivityToday(true) })
        .catch(() => {})
      Promise.allSettled([
        getWorkoutSessions(user.id),
        getCompletedSessionIds(user.id, isoDate(todayMidnight())),
        getRaceDate(),
        getStreak(active.id),
        getNotifSeenAt().then(seen => getSocialNotificationCount(seen)),
        getIncomingRequestCount(),
        getGroupNotificationCount(user.id),
      ]).then(([sess, done, race, st, social, reqs, grp]) => {
        if (st.status === 'fulfilled') setStreak(st.value)
        if (social.status === 'fulfilled') setPulseCount(social.value)
        if (reqs.status === 'fulfilled') setPulseRequests(reqs.value)
        if (grp.status === 'fulfilled') setPulseGroups(grp.value)
        if (sess.status !== 'fulfilled') return
        const all = sess.value
        setHasAnySchedule(all.some(x => x.weekdays.length > 0 && !x.name.startsWith('SKIP:')))
        const today = todayMidnight()
        const dateStr = isoDate(today)
        const wd = weekdayOf(today)
        const raceDate = race.status === 'fulfilled' ? race.value : null
        const skipPrefix = `SKIP:${dateStr}:`
        const skips = all.filter(x => x.name.startsWith(skipPrefix)).map(x => x.name.slice(skipPrefix.length))
        // Samma dagfilter som schemats dagsidor
        setTodaySessions(all.filter(x => {
          if (x.name.startsWith('SKIP:')) return false
          if (skips.includes(x.id)) return false
          return (
            (x.weekdays.includes(wd) && sessionActiveOn(x, dateStr, raceDate)) ||
            (x.weekdays.length === 0 && x.name.startsWith(`ONCE:${dateStr}:`))
          )
        }))
        setTodayDoneIds(done.status === 'fulfilled' ? done.value : [])
        if (done.status === 'fulfilled' && done.value.length > 0) setHasActivityToday(true)
      })

      const log = await getOrCreateTodayLog(active.id, user.id, day)
      setDailyLogId(log.id)
      if (log.status === 'failed') setDayFailed(true)

      let completions = await getOrCreateTaskCompletions(log.id, active.level_id, user.id, active.id)

      // Fotouppgiften kräver ett faktiskt foto — är den ibockad utan bild
      // (t.ex. borttagen från profilen) bockas den ur igen
      const photoTask = completions.find(t => t.type === 'photo' && t.completed)
      // Medvetet skippade foton bockas inte ur — dagen är godkänd ändå
      if (photoTask && !photoTask.details?.skipped) {
        try {
          if (!(await hasPhotoForDay(user.id, active.id, day))) {
            await setTaskCompleted(photoTask.completionId, false)
            if (log.status === 'completed') await markDayPending(log.id)
            completions = completions.map(t =>
              t.completionId === photoTask.completionId ? { ...t, completed: false } : t
            )
          }
        } catch { /* verifieringen är bäst-effort */ }
      }

      setTasks(completions)

      // Rollover-check: tidigare dagar som varken är klara eller kvitterade
      const missed = await getMissedDayNumbers(active, day)
      if (missed.length > 0) {
        setMissedDays(missed)
        setRestartVariant('missed')
        setRestartVisible(true)
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  async function applyTaskUpdate(task: TaskItem, completed: boolean, details: TaskDetails | null) {
    setTasks(prev =>
      prev.map(t => t.completionId === task.completionId ? { ...t, completed, details } : t)
    )
    try {
      await setTaskProgress(task.completionId, details, completed)
      // Bara nivåreglerna avgör om utmaningsdagen är klar — egna regler är
      // personliga extramål och ska inte kunna blockera (eller fälla) en dag
      const allDone = tasks
        .filter(t => t.type !== 'custom')
        .every(t => (t.completionId === task.completionId ? completed : t.completed))
      if (allDone && completed && dailyLogId) {
        await markDayCompleted(dailyLogId)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        // Sista dagen klar — hela utmaningen är i mål
        if (currentDay >= 75 && challenge) {
          await completeChallenge(challenge.id)
          setCompletedDaysCount(await countCompletedDays(challenge.id))
          setVictoryVisible(true)
        }
      } else if (!completed && task.completed && task.type !== 'custom' && dailyLogId && !dayFailed) {
        // En nivåuppgift gick från klar till ej klar — dagen är inte längre klar
        await markDayPending(dailyLogId)
      }
    } catch {
      setTasks(prev =>
        prev.map(t => t.completionId === task.completionId
          ? { ...t, completed: task.completed, details: task.details }
          : t)
      )
    }
  }

  function toggleTask(task: TaskItem) {
    // Träningen bockas inte i på ren vilja — minst en aktivitet idag krävs
    // (avbockat schemapass, GPS-runda eller loggad övning)
    if (task.type === 'workout' && !task.completed && !hasActivityToday) {
      Alert.alert(
        'Inget pass loggat idag',
        'Kör ett pass först, allt räknas! Inget gym? Ta ett hemmapass: armhävningar, situps och utfall, eller en rask promenad med GPS:en igång.',
        [
          { text: 'Senare', style: 'cancel' },
          { text: 'Logga pass', onPress: () => router.push('/(app)/add') },
        ],
      )
      return
    }
    applyTaskUpdate(task, !task.completed, task.details)
  }

  // ── Framstegsfoto: ta bild eller skippa medvetet — dagen godkänns ändå ──
  function handlePhotoPress(task: TaskItem) {
    if (task.completed) {
      router.push('/(app)/profile')
      return
    }
    Alert.alert(
      'Dagens framstegsfoto',
      'Vill du ta ett foto nu eller hoppa över idag? Dagen godkänns även utan foto.',
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Hoppa över idag', onPress: () => applyTaskUpdate(task, true, { ...task.details, skipped: true }) },
        { text: 'Ta foto', onPress: () => router.push({ pathname: '/(app)/profile', params: { action: 'addPhoto' } }) },
      ],
    )
  }

  // ── Vatten: glas à 250 ml mot nivåns litermål ──
  function waterGoal(task: TaskItem): number {
    return task.unit === 'liter' && task.targetValue
      ? Math.round(task.targetValue * 4)
      : 8
  }

  function handleWater(task: TaskItem, delta: number) {
    const glasses = Math.max(0, (task.details?.glasses ?? 0) + delta)
    applyTaskUpdate(task, glasses >= waterGoal(task), { ...task.details, glasses })
  }

  // ── Läsning: logga bok + sidor innan uppgiften bockas i ──
  function handleReadingPress(task: TaskItem) {
    if (task.completed) {
      Alert.alert('Ta bort läsloggen?', 'Uppgiften markeras som ej klar.', [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Ta bort', style: 'destructive', onPress: () => applyTaskUpdate(task, false, null) },
      ])
    } else {
      setReadingTask(task)
    }
  }

  async function handleReadingSave(book: string, pages: number) {
    if (!readingTask) return
    await applyTaskUpdate(readingTask, true, { book: book || undefined, pages })
    setReadingTask(null)
  }

  async function handleFail(reason: string) {
    if (!dailyLogId) return
    // Kastar vidare vid fel — FailModal stannar då på input-steget.
    // Modalen stängs av användaren efter coach-svaret (onClose).
    await markDayFailed(dailyLogId, reason)
    setDayFailed(true)
  }

  function handleFailModalClose() {
    setFailVisible(false)
    // Dagen rapporterades missad — fråga vad användaren vill göra med utmaningen
    if (dayFailed) {
      setRestartVariant('today')
      setRestartVisible(true)
    }
  }

  async function handleRestart() {
    if (!challenge) return
    try {
      await restartChallenge(challenge)
      setRestartVisible(false)
      setDayFailed(false)
      setLoading(true)
      await loadDashboard()
    } catch { /* behåll modalen så användaren kan försöka igen */ }
  }

  async function handleContinueAnyway() {
    try {
      if (challenge && restartVariant === 'missed') {
        await acknowledgeMissedDays(challenge, missedDays)
      }
      setRestartVisible(false)
    } catch { /* behåll modalen så användaren kan försöka igen */ }
  }

  function handleNewChallenge() {
    setVictoryVisible(false)
    router.replace('/(auth)/quiz')
  }

  function openAddRule() {
    setAddRuleOpen(true)
  }

  async function handleCreateRule(ruleName: string, ruleIcon: string) {
    if (!userId || !challenge || !dailyLogId) return
    try {
      await createCustomRule(userId, challenge.id, challenge.level_id, ruleName, ruleIcon, dailyLogId)
      const updated = await getOrCreateTaskCompletions(dailyLogId, challenge.level_id, userId, challenge.id)
      setTasks(updated)
    } catch (e) {
      Alert.alert('Fel', 'Kunde inte spara regeln.')
      throw e // håll sheeten öppen så användaren kan försöka igen
    }
  }

  function handleDeleteRule(task: TaskItem) {
    Alert.alert(
      'Ta bort regel',
      `Vill du ta bort "${task.name}"? Regeln och dess historik försvinner.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Ta bort',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomRule(task.templateId)
              setTasks(prev => prev.filter(t => t.completionId !== task.completionId))
            } catch {
              Alert.alert('Fel', 'Kunde inte ta bort regeln.')
            }
          },
        },
      ]
    )
  }

  const standardTasks = tasks.filter(t => t.type !== 'custom')
  const customTasks   = tasks.filter(t => t.type === 'custom')
  const levelRules    = (challenge?.challenge_levels?.rules ?? []) as any[]

  // Ringen och "dagen klar" räknar bara nivåuppgifterna — egna regler är extramål
  const completedCount = standardTasks.filter(t => t.completed).length
  const allDone = standardTasks.length > 0 && completedCount === standardTasks.length
  const challengePct = Math.round((currentDay / 75) * 100)

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={SPINNER_GRAY} size="large" />
      </View>
    )
  }

  if (loadError) {
    return (
      <View style={s.centered}>
        <Ionicons name="cloud-offline-outline" size={36} color="#4A4A50" />
        <Text style={s.errorText}>Kunde inte ladda dagens uppgifter</Text>
        <TouchableOpacity
          style={s.retryBtn}
          onPress={() => { setLoading(true); loadDashboard() }}
          activeOpacity={0.8}
        >
          <Text style={s.retryBtnText}>Försök igen</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeScreen style={s.screen} edges={['top']}>

      {/* Atmospheric background glow */}
      <LinearGradient
        colors={['rgba(255,143,0,0.08)', 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
        pointerEvents="none"
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onScroll={onScrollShrink}
        scrollEventThrottle={16}
      >

        {/* ── Header ── */}
        <View style={s.header}>
          {/* flex: 1 — långa namn krymper istället för att trycka ut avataren */}
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={s.greeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {getGreeting()}, {userName}
            </Text>
            <Text style={s.subtitle}>{getGreetingSubtitle(new Date().getHours(), completedCount, tasks.length, currentDay)}</Text>
          </View>
          <TouchableOpacity
            style={s.streakChip}
            onPress={() => router.push('/(app)/streak')}
            activeOpacity={0.8}
          >
            <Ionicons name="flame" size={15} color={ORANGE} />
            <Text style={s.streakChipText}>{streak}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.avatar}
            onPress={() => router.push('/(app)/profile')}
            activeOpacity={0.8}
          >
            {userAvatar?.startsWith('http') ? (
              <Image source={{ uri: userAvatar }} style={s.avatarImg} />
            ) : userAvatar ? (
              <Text style={s.avatarEmoji}>{userAvatar}</Text>
            ) : (
              <Text style={[s.avatarText, lightMode && { color: '#fff' }]}>{userName[0]?.toUpperCase()}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Hero Card — 3D floating ── */}
        <Animated.View style={[s.heroOuter, { shadowColor: heroShadow }, lightMode && { shadowOpacity: 0.10, shadowRadius: 14 }, heroAnimStyle]}>
          <LinearGradient
            colors={heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.heroCard, lightMode && { borderWidth: 0 }]}
          >
            <View style={s.heroLeft}>
              {levelName ? (
                <View style={s.levelBadge}>
                  <Text style={s.levelBadgeText}>{levelName.toUpperCase()}</Text>
                </View>
              ) : null}
              <Text style={s.dayLabel}>DAG</Text>
              <View style={s.dayRow}>
                <Text style={s.dayNum}>{currentDay}</Text>
                <Text style={s.dayOf}>/75</Text>
              </View>
              <View style={s.heroPctRow}>
                <Text style={s.heroPct}>{challengePct}%</Text>
                <Text style={s.heroPctSuffix}> av utmaningen</Text>
              </View>
              <View style={s.heroBar}>
                <View style={[s.heroBarFill, { width: `${challengePct}%` as any }]} />
              </View>
            </View>

            <View style={s.heroRight}>
              <ProgressRing completed={completedCount} total={standardTasks.length} />
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── Social puls — visas bara när något faktiskt hänt ── */}
        {(pulseCount > 0 || pulseRequests > 0 || pulseGroups > 0) && (
          <TouchableOpacity style={s.pulseRow} onPress={() => router.push('/(app)/notifications')} activeOpacity={0.8}>
            <Ionicons name="notifications" size={16} color={ACCENT} />
            <Text style={s.pulseText} numberOfLines={1}>
              {[
                pulseCount > 0 ? `${pulseCount} ${pulseCount === 1 ? 'ny händelse' : 'nya händelser'}` : '',
                pulseRequests > 0 ? `${pulseRequests} ${pulseRequests === 1 ? 'vänförfrågan' : 'vänförfrågningar'}` : '',
                pulseGroups > 0 ? `${pulseGroups} ${pulseGroups === 1 ? 'gruppnotis' : 'gruppnotiser'}` : '',
              ].filter(Boolean).join(' · ')}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={TEXT_SECONDARY} />
          </TouchableOpacity>
        )}

        {/* ── Dagens pass — schemats innehåll rakt på hemskärmen ── */}
        {hasAnySchedule && (
          <>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>DAGENS PASS</Text>
            </View>
            <View style={[s.todayCard, chrome]}>
              {todaySessions.length === 0 ? (
                <View style={s.todayRow}>
                  <View style={s.todayIcon}>
                    <Ionicons name="moon-outline" size={19} color={TEXT_SECONDARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.todayName}>Vilodag</Text>
                    <Text style={s.todaySub}>Inga pass planerade idag</Text>
                  </View>
                </View>
              ) : todaySessions.map((sess, i) => {
                const done = todayDoneIds.includes(sess.id)
                const isCardio = sess.session_type === 'cardio'
                const name = sess.name.startsWith('ONCE:') ? sess.name.split(':').slice(2).join(':') : sess.name
                return (
                  <TouchableOpacity
                    key={sess.id}
                    style={[s.todayRow, i > 0 && s.todayRowBorder]}
                    onPress={() => router.push('/(app)/add')}
                    activeOpacity={0.75}
                  >
                    <View style={[s.todayIcon, isCardio && { backgroundColor: 'rgba(63,167,255,0.14)' }]}>
                      <Ionicons name={isCardio ? 'fitness-outline' : 'barbell-outline'} size={19} color={isCardio ? CARDIO_BLUE : ACCENT} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.todayName, done && s.todayNameDone]} numberOfLines={1}>{name}</Text>
                      <Text style={s.todaySub}>
                        {isCardio ? 'Cardiopass' : `${sess.exercises.length} övningar`}
                      </Text>
                    </View>
                    {done
                      ? <Ionicons name="checkmark-circle" size={22} color={GREEN_DONE} />
                      : <Ionicons name="chevron-forward" size={17} color={TEXT_SECONDARY} />}
                  </TouchableOpacity>
                )
              })}
            </View>
          </>
        )}

        {/* ── Tasks section header ── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>DAGENS UPPGIFTER</Text>
          <View style={[s.countBadge, { borderColor: lightMode ? 'transparent' : '#1E1E21' }, allDone && s.countBadgeDone]}>
            <Text style={[s.countText, allDone && s.countTextDone]}>
              {completedCount}/{standardTasks.length}
            </Text>
          </View>
        </View>

        {/* ── Task grid (2-kolumner, ej foto) ── */}
        <View style={s.taskGrid}>
          {standardTasks.filter(t => t.type !== 'photo').map(task => {
            if (task.type === 'water') {
              const goal = waterGoal(task)
              const glasses = task.details?.glasses ?? 0
              return (
                <TaskGridCard
                  key={task.completionId}
                  task={task}
                  onPress={() => handleWater(task, +1)}
                  counter={{
                    value: glasses,
                    goal,
                    unit: 'glas',
                    onPlus: () => handleWater(task, +1),
                    onMinus: () => handleWater(task, -1),
                  }}
                />
              )
            }
            if (task.type === 'reading') {
              const d = task.details
              return (
                <TaskGridCard
                  key={task.completionId}
                  task={task}
                  onPress={() => handleReadingPress(task)}
                  metaLabel={
                    task.completed && d?.pages
                      ? `${d.pages} sidor${d.book ? ` · ${d.book}` : ''}`
                      : undefined
                  }
                />
              )
            }
            return (
              <TaskGridCard
                key={task.completionId}
                task={task}
                onPress={() => toggleTask(task)}
              />
            )
          })}
        </View>

        {/* ── Foto — full bredd under griden ── */}
        {standardTasks.filter(t => t.type === 'photo').map(task => (
          <TaskGridCard
            key={task.completionId}
            task={task}
            onPress={() => handlePhotoPress(task)}
            metaLabel={task.completed ? (task.details?.skipped ? 'Överhoppat idag' : undefined) : 'Läggs till i profilen'}
            fullWidth
          />
        ))}

        {/* ── Regler ── */}
        <View style={s.sectionRow}>
          <TouchableOpacity style={s.rulesToggle} onPress={toggleRules} activeOpacity={0.7} hitSlop={8}>
            <Text style={s.sectionTitle}>REGLER</Text>
            <Ionicons name={rulesOpen ? 'chevron-up' : 'chevron-down'} size={15} color={TEXT_SECONDARY} />
          </TouchableOpacity>
          <TouchableOpacity style={s.addRuleChip} onPress={openAddRule} activeOpacity={0.8}>
            <Ionicons name="add" size={13} color={ACCENT} />
            <Text style={s.addRuleChipText}>Lägg till</Text>
          </TouchableOpacity>
        </View>

        {rulesOpen && (levelRules.length > 0 || customTasks.length > 0) && (
          <View style={[s.rulesCard, lightMode ? [{ borderWidth: 0 }, chrome] : null]}>
            {levelRules.map((r: any, i: number) => {
              const ruleText: string = typeof r === 'string' ? r : (r.rule ?? '')
              const icon = typeof r === 'object' && r.icon ? safeIcon(r.icon) : levelRuleIcon(ruleText)
              const isLast = i === levelRules.length - 1 && customTasks.length === 0
              return (
                <View key={i} style={[s.ruleItem, !isLast && s.ruleItemBorder]}>
                  <View style={[s.ruleIconBox, { backgroundColor: accentAlpha('1C') }]}>
                    <Ionicons name={icon} size={16} color={ACCENT} />
                  </View>
                  <Text style={s.ruleItemText}>{ruleText}</Text>
                  <Ionicons name="lock-closed-outline" size={12} color="#2A2A30" />
                </View>
              )
            })}
            {customTasks.map((task, i) => {
              const color  = lightMode ? TASK_COLORS_LIGHT.custom : TASK_COLORS.custom
              const isLast = i === customTasks.length - 1
              return (
                <TouchableOpacity
                  key={task.completionId}
                  style={[
                    s.ruleItem,
                    !isLast && s.ruleItemBorder,
                    task.completed && { backgroundColor: color + '0E' },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    toggleTask(task)
                  }}
                  onLongPress={() => handleDeleteRule(task)}
                  activeOpacity={0.8}
                >
                  {task.completed && <View style={[s.ruleSidebar, { backgroundColor: color }]} />}
                  <View style={[s.ruleIconBox, { backgroundColor: color + '1C' }]}>
                    <Ionicons
                      name={task.icon ? safeIcon(task.icon) : 'checkmark-circle-outline'}
                      size={16}
                      color={color}
                    />
                  </View>
                  <Text style={[s.ruleItemText, task.completed && s.ruleItemTextDone]}>
                    {task.name}
                  </Text>
                  <View style={[s.ruleCheckBox, task.completed && { backgroundColor: color, borderColor: color }]}>
                    {task.completed && <Ionicons name="checkmark" size={12} color="#000" />}
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        {levelRules.length === 0 && customTasks.length === 0 && (
          <TouchableOpacity style={[s.rulesEmptyCard, lightMode && { borderColor: 'rgba(0,0,0,0.18)' }]} onPress={openAddRule} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={20} color="#3A3A40" />
            <Text style={s.rulesEmptyText}>Lägg till en egen daglig regel</Text>
          </TouchableOpacity>
        )}

        {/* ── Fail / done ── */}
        {!dayFailed && !allDone && (
          <TouchableOpacity
            style={s.failBtn}
            onPress={() => setFailVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={s.failBtnText}>Rapportera dag missad</Text>
          </TouchableOpacity>
        )}
        {dayFailed && (
          <Text style={s.dayFailedText}>Dagen är rapporterad som missad.</Text>
        )}

      </ScrollView>

      <FailModal
        visible={failVisible}
        onClose={handleFailModalClose}
        onConfirm={handleFail}
      />
      <RestartPromptModal
        visible={restartVisible}
        variant={restartVariant}
        missedDays={missedDays}
        onRestart={handleRestart}
        onContinue={handleContinueAnyway}
      />
      <VictoryModal
        visible={victoryVisible}
        completedDays={completedDaysCount}
        levelName={levelName}
        onNewChallenge={handleNewChallenge}
      />
      <ReadingLogModal
        visible={readingTask !== null}
        targetPages={readingTask?.targetValue ?? null}
        onClose={() => setReadingTask(null)}
        onSave={handleReadingSave}
      />

      {/* ── Add rule sheet ── */}
      <AddRuleSheet
        visible={addRuleOpen}
        onClose={() => setAddRuleOpen(false)}
        onCreate={handleCreateRule}
      />
    </SafeScreen>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const GREEN_DONE = '#2EAF62'

const s = StyleSheet.create({
  rulesToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  streakChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: accentAlpha('12'),
    borderRadius: 15, paddingHorizontal: 10, paddingVertical: 6,
    marginRight: 10,
  },
  streakChipText: { color: TEXT_PRIMARY, fontSize: 14, fontFamily: NUM_FONT },

  pulseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: accentAlpha('12'),
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
    marginTop: 14,
  },
  pulseText: { flex: 1, color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' },

  todayCard: {
    backgroundColor: CARD_BG, borderRadius: 18,
    paddingHorizontal: 14,
  },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  todayRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.25)' },
  todayIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: accentAlpha('14'),
    alignItems: 'center', justifyContent: 'center',
  },
  todayName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },
  todayNameDone: { color: TEXT_SECONDARY, textDecorationLine: 'line-through' },
  todaySub: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },

  screen:   { flex: 1, backgroundColor: SCENE_BG },
  centered: { flex: 1, backgroundColor: SCENE_BG, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: '#4A4A50', fontSize: 14 },
  retryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  retryBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
  scroll:   { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 56 + TAB_CONTENT_PAD, gap: 20 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { color: TEXT_PRIMARY, fontSize: 23, fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { color: '#4A4A50', fontSize: 13, marginTop: 3 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg:   { width: 44, height: 44, borderRadius: 22 },
  avatarText:  { color: '#000', fontSize: 18, fontWeight: '700' },
  avatarEmoji: { fontSize: 22 },

  // Hero outer wrapper (for shadow + tilt)
  heroOuter: {
    borderRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 12,
  },
  heroCard: {
    borderRadius: 22,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2720',
    overflow: 'hidden',
  },

  // Hero left
  heroLeft: { flex: 1, gap: 4 },
  levelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: accentAlpha('1F'),
    borderRadius: 7,
    borderWidth: 1,
    borderColor: accentAlpha('3C'),
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  levelBadgeText: { color: ACCENT, fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
  dayLabel: { color: '#3A3A40', fontSize: 10, fontWeight: '700', letterSpacing: 3 },
  dayRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  dayNum:   { color: TEXT_PRIMARY, fontSize: 60, fontFamily: NUM_FONT, lineHeight: 70, letterSpacing: -2 },
  dayOf:    { color: '#3A3A40', fontSize: 22, fontWeight: '600', paddingBottom: 11 },
  heroPctRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  heroPct:      { color: ACCENT, fontSize: 13, fontWeight: '700' },
  heroPctSuffix: { color: '#3A3A40', fontSize: 12 },
  heroBar: {
    height: 3, backgroundColor: BORDER,
    borderRadius: 2, overflow: 'hidden', marginTop: 6,
  },
  heroBarFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 2 },

  // Hero right
  heroRight: { paddingLeft: 10 },

  // Ring
  ringWrap: {
    width: R_SIZE, height: R_SIZE,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
  },
  ringNum:   { fontSize: 26, fontFamily: NUM_FONT, lineHeight: 30 },
  ringDenom: { color: '#3A3A40', fontSize: 12, fontWeight: '600' },
  ringLabel: { color: '#2E2E34', fontSize: 8, fontWeight: '700', letterSpacing: 1.5, marginTop: 2 },

  // Section row
  sectionRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: -4,
  },
  sectionTitle: { color: '#383840', fontSize: 11, fontWeight: '700', letterSpacing: 1.8 },
  countBadge: {
    backgroundColor: CARD,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1,
  },
  countBadgeDone: { backgroundColor: '#3BE8621A', borderColor: '#3BE86235' },
  countText:     { color: '#444', fontSize: 12, fontWeight: '700' },
  countTextDone: { color: '#3BE862' },

  // Task grid
  taskGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: TASK_GAP },

  // Rules section
  addRuleChip: {
    // Accenttonad platta istället för ramen — ramfärger fryser fel och
    // Anton vill inte ha den orange konturen
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: accentAlpha('14'),
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  addRuleChipText: { color: ACCENT, fontSize: 12, fontWeight: '700' },

  rulesCard: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1, borderColor: CARD_BORDER,
    overflow: 'hidden',
  },
  ruleItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  ruleItemBorder: {
    borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.18)',
  },
  // Samma markering som taskSidebar på uppgiftskorten
  ruleSidebar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
  },
  ruleIconBox: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  ruleItemText: {
    flex: 1, color: '#BBBBBB', fontSize: 13, fontWeight: '600', lineHeight: 18,
  },
  ruleItemTextDone: { color: '#3A3A40', textDecorationLine: 'line-through' },
  ruleCheckBox: {
    width: 21, height: 21, borderRadius: 11,
    borderWidth: 1.5, borderColor: 'rgba(128,128,128,0.45)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  rulesEmptyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD_BG,
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14,
    borderWidth: 1, borderStyle: 'dashed', borderColor: '#2A2A2E',
  },
  rulesEmptyText: { color: '#3A3A40', fontSize: 13, fontWeight: '500' },

  // Fail
  failBtn: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#FF3B4A20', marginTop: 4,
  },
  failBtnText:   { color: '#FF3B4A', fontSize: 14, fontWeight: '600' },
  dayFailedText: { color: '#3A3A40', fontSize: 13, textAlign: 'center', paddingVertical: 8 },
})
