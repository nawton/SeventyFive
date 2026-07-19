import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity, Modal, Dimensions, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue, useAnimatedStyle, interpolate, runOnJS, Extrapolation,
  withTiming, Easing,
} from 'react-native-reanimated'
import { Gesture, GestureDetector, ScrollView as GHScrollView, type GestureType } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'
import Svg, { Circle, Text as SvgText, Polyline, Polygon, Line as SvgLine, Rect, G } from 'react-native-svg'
import { useFocusEffect, router } from 'expo-router'
import Body from 'react-native-body-highlighter'
import { supabase } from '@/lib/supabase'
import { getActiveChallenge, calculateCurrentDay } from '@/services/challenge'
import { getAllDays, getStreak, type DaySummary } from '@/services/dailyLog'
import { getMusclesForName, MUSCLE_GROUPS_6, type Slug } from '@/lib/muscles'
import { getCardioWorkouts, getStrengthWorkouts, type CardioWorkout, type StrengthWorkout } from '@/services/workouts'
import { getCompletedExerciseNamesForWeek, getCompletedExerciseNamesByDay, getCompletedSessionsHistory, type CompletedSessionItem } from '@/services/workoutSchedule'
import { CalendarView } from '@/components/stats/CalendarView'
import { DayWorkoutsModal } from '@/components/stats/DayWorkoutsModal'
import { CardioSummaryView } from '@/components/CardioSummaryView'
import { GlassSegment } from '@/components/GlassSegment'
import { DistanceDetailModal } from '@/components/stats/DistanceDetailModal'
import { MilestoneAnalysisModal } from '@/components/stats/MilestoneAnalysisModal'
import { GymSummaryView } from '@/components/stats/GymSummaryView'
import { MuscleDetailModal } from '@/components/stats/MuscleDetailModal'
import { GlassCircleButton } from '@/components/GlassButton'
import { VolumeDetailModal } from '@/components/stats/VolumeDetailModal'
import { effortColor } from '@/components/EffortRating'
import { getProfile } from '@/services/profile'
import { getUnitSystem, toDisplayDistance, distanceUnitLabel, paceForUnit, type UnitSystem } from '@/lib/units'
import { deleteCardioWorkout } from '@/services/workouts'
import { ORANGE, GREEN, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, NUM_FONT_SEMI } from '@/lib/theme'
import { toLocalDateString, parseLocalDate, weekdayOf, startOfWeek } from '@/lib/date'
import { TAB_CONTENT_PAD } from '@/lib/glass'
import { useTabBarShrinkOnScroll } from '@/lib/tabBar'

const GRID_PADDING = 20
const STATS_SCREEN_W = Dimensions.get('window').width
const TAB_BAR_W = STATS_SCREEN_W - GRID_PADDING * 2
const SEG_W     = TAB_BAR_W / 3      // en flik-kolumns bredd
// Klara Apple Fitness-färger för statistikvärden
const BLUE   = '#3FBBFF'
const RED    = '#FF3D73'
const YELLOW = '#FFE60A'
const PURPLE = '#D65CFF'
const TEAL   = '#40F5E9'
const LIME   = '#BDFF3B'

// ─── helpers ──────────────────────────────────────────────────────────────────

function getWeekBounds(offset: number): { start: string; end: string; label: string } {
  const mon = startOfWeek()
  mon.setDate(mon.getDate() + offset * 7)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
  return {
    start: toLocalDateString(mon),
    end:   toLocalDateString(sun),
    label: offset === 0 ? 'Denna vecka' : `${fmt(mon)} till ${fmt(sun)}`,
  }
}

/** Nästa milstolpe utifrån dagarna bakom en (dag 19 = 18 avklarade).
 *  Databasens logg-räknare funkar inte här: den som börjat mitt i utmaningen
 *  saknar loggar för dagarna innan appen. "Halvvägs" på riktiga mitten (38). */
function nextMilestone(completed: number): { day: number; label: string; daysLeft: number } | null {
  const stones = [
    { day: 7,  label: 'Första veckan klar!' },
    { day: 10, label: '10 dagar klara!' },
    { day: 19, label: 'En fjärdedel klar!' },
    { day: 25, label: 'En tredjedel klar!' },
    { day: 38, label: 'Halvvägs!' },
    { day: 50, label: 'Två tredjedelar klara!' },
    { day: 60, label: '60 dagar klara!' },
    { day: 68, label: 'Sista veckan!' },
    { day: 75, label: 'MÅLET: 75 dagar!' },
  ]
  const next = stones.find(s => s.day > completed)
  if (!next) return null
  return { ...next, daysLeft: next.day - completed }
}

function fmtPace(secsPerKm: number): string {
  const m = Math.floor(secsPerKm / 60)
  const s = Math.floor(secsPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtDuration(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600)
  const m = Math.round((totalSecs % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

// ─── weekly bar data ───────────────────────────────────────────────────────────

interface WeekBar {
  label:     string
  run:       number
  cycle:     number
  walk:      number
  total:     number
  isCurrent: boolean
  /** Snittempo (sek/km) för veckans pass med distans — 0 om inget */
  paceSec:   number
  pacedKm:   number
  pacedSecs: number
}

function isoWeekNum(mon: Date): number {
  const jan4 = new Date(mon.getFullYear(), 0, 4)
  return Math.ceil((((mon.getTime() - jan4.getTime()) / 86400000) + weekdayOf(jan4) - 1) / 7)
}

function buildWeeklyBars(workouts: CardioWorkout[]): WeekBar[] {
  const todayMon = toLocalDateString(startOfWeek())

  const byWeek = new Map<string, WeekBar>()

  for (const w of workouts) {
    const mon = startOfWeek(new Date(w.created_at))
    const key = toLocalDateString(mon)

    if (!byWeek.has(key)) {
      // ISO week number
      const jan4 = new Date(mon.getFullYear(), 0, 4)
      const wn = Math.ceil(
        (((mon.getTime() - jan4.getTime()) / 86400000) + weekdayOf(jan4) - 1) / 7,
      )
      byWeek.set(key, {
        label: `V${wn}`,
        run: 0, cycle: 0, walk: 0, total: 0,
        isCurrent: key === todayMon,
        paceSec: 0, pacedKm: 0, pacedSecs: 0,
      })
    }
    const entry = byWeek.get(key)!
    const km   = w.data.distance_km
    const type = w.data.type ?? 'running'
    if (type === 'cycling')       entry.cycle += km
    else if (type === 'walking')  entry.walk  += km
    else                          entry.run   += km
    entry.total += km
    if (km > 0.1) {
      entry.pacedKm   += km
      entry.pacedSecs += w.data.duration_seconds
    }
  }

  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([, v]) => ({ ...v, paceSec: v.pacedKm > 0 ? v.pacedSecs / v.pacedKm : 0 }))
}

// ─── Sessioner-listan ──────────────────────────────────────────────────────────

function monthLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
}

/** "idag", "igår", veckodag inom en vecka, annars datumet */
function sessDateLabel(dateStr: string): string {
  const today = toLocalDateString()
  if (dateStr === today) return 'idag'
  const diff = Math.round(
    (new Date(today + 'T12:00:00').getTime() - new Date(dateStr + 'T12:00:00').getTime()) / 86400000,
  )
  if (diff === 1) return 'igår'
  if (diff > 1 && diff < 7) return new Date(dateStr + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'long' })
  return dateStr
}

// ─── GymSession ────────────────────────────────────────────────────────────────

interface GymSession {
  id:            string
  completedDate: string
  sessionName:   string
  exercises:     string[]
}


// ─── RingChart ─────────────────────────────────────────────────────────────────

function RingChart({ currentDay, completedDays }: { currentDay: number; completedDays: number }) {
  const R = 48
  const C = 2 * Math.PI * R
  const completedArc = (completedDays / 75) * C
  const elapsedArc   = (currentDay / 75) * C
  const missedArc    = Math.max(0, elapsedArc - completedArc)

  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      <Circle cx={60} cy={60} r={R} fill="none" stroke={BORDER} strokeWidth={11} />
      {completedArc > 0 && (
        <Circle
          cx={60} cy={60} r={R}
          fill="none" stroke={ORANGE} strokeWidth={11}
          strokeDasharray={`${completedArc} ${C}`}
          strokeLinecap="round"
          rotation={-90} origin="60,60"
        />
      )}
      {missedArc > 0 && (
        <Circle
          cx={60} cy={60} r={R}
          fill="none" stroke={RED} strokeWidth={11}
          strokeDasharray={`${missedArc} ${C}`}
          strokeDashoffset={-completedArc}
          strokeLinecap="round"
          rotation={-90} origin="60,60"
          opacity={0.45}
        />
      )}
      <SvgText
        x={60} y={53}
        textAnchor="middle" fontSize={26} fontWeight="900"
        fill={TEXT_PRIMARY} fontFamily="-apple-system,sans-serif"
      >
        {currentDay}
      </SvgText>
      <SvgText
        x={60} y={73}
        textAnchor="middle" fontSize={11}
        fill={TEXT_SECONDARY} fontFamily="-apple-system,sans-serif"
      >
        av 75
      </SvgText>
    </Svg>
  )
}

// ─── StatsScreen ───────────────────────────────────────────────────────────────

type StatsTab = 'overview' | 'cardio' | 'gympass'
const TABS: Array<{ key: StatsTab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'overview', label: 'Översikt', icon: 'grid-outline' },
  { key: 'cardio',   label: 'Cardio',   icon: 'walk-outline' },
  { key: 'gympass',  label: 'Gympass',  icon: 'barbell-outline' },
]

export default function StatsScreen() {
  const onScrollShrink = useTabBarShrinkOnScroll()

  // Dra ner för att uppdatera — samma overscroll-mönster som profilen
  const [statsRefreshing, setStatsRefreshing] = useState(false)
  const pullArmed = useRef(false)
  function onTabScroll(e: { nativeEvent: { contentOffset: { y: number } } }) {
    onScrollShrink(e as never)
    if (e.nativeEvent.contentOffset.y < -70) pullArmed.current = true
  }
  function onTabScrollEnd() {
    if (!pullArmed.current || statsRefreshing) return
    pullArmed.current = false
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setStatsRefreshing(true)
    const started = Date.now()
    Promise.resolve(loadStats()).finally(() => {
      const wait = Math.max(0, 1000 - (Date.now() - started))
      setTimeout(() => setStatsRefreshing(false), wait)
    })
  }
  const [days, setDays]                         = useState<DaySummary[]>([])
  const [currentDay, setCurrentDay]             = useState(1)
  const [startDate, setStartDate]               = useState<string | null>(null)
  const [challengeId, setChallengeId]           = useState<string | null>(null)
  const [levelName, setLevelName]               = useState('')
  const [workouts, setWorkouts]                 = useState<CardioWorkout[]>([])
  const [strengthWorkouts, setStrengthWorkouts] = useState<StrengthWorkout[]>([])
  const [bodyView, setBodyView]                 = useState<'front' | 'back'>('front')
  const [selectedWorkout, setSelectedWorkout]   = useState<CardioWorkout | null>(null)
  const [selectedDay, setSelectedDay]           = useState<DaySummary | null>(null)
  const [activeTab, setActiveTab]               = useState<StatsTab>('overview')
  const [unit, setUnit]                         = useState<UnitSystem>('metric')
  const [cardioRange, setCardioRange]           = useState<'week' | 'month' | 'all'>('all')
  const [cardioOffset, setCardioOffset]         = useState(0)
  const [cardioDetailsOpen, setCardioDetailsOpen] = useState(false)
  const [distDetailOpen, setDistDetailOpen]     = useState(false)
  const [milestoneOpen, setMilestoneOpen]       = useState(false)
  const [gymDetail, setGymDetail] = useState<{ name: string; dateLabel: string; planned: string[]; logged: StrengthWorkout[] } | null>(null)
  const [muscleOpen, setMuscleOpen] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [volumeOpen, setVolumeOpen] = useState(false)
  const [avatarUrl, setAvatarUrl]               = useState<string | null>(null)
  const pagerRef = useRef<ScrollView>(null)

  useEffect(() => {
    getUnitSystem().then(setUnit)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) getProfile(session.user.id).then(p => setAvatarUrl(p?.avatar_url ?? null)).catch(() => {})
    })
  }, [])

  function deleteSelectedWorkout() {
    const w = selectedWorkout
    if (!w) return
    Alert.alert('Radera träning', 'Det här går inte att ångra.', [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Radera', style: 'destructive', onPress: async () => {
        await deleteCardioWorkout(w.id).catch(() => {})
        setWorkouts(prev => prev.filter(x => x.id !== w.id))
        setSelectedWorkout(null)
      } },
    ])
  }

  function switchTab(key: StatsTab) {
    setActiveTab(key)
    const idx = TABS.findIndex(t => t.key === key)
    pagerRef.current?.scrollTo({ x: idx * STATS_SCREEN_W, animated: true })
  }

  // ── Flikrad: text + glidande underline, dragbar ──────────────────────────────
  const pagerX = useSharedValue(0)   // horisontell offset — driver indikatorn
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (pagerX.value / STATS_SCREEN_W) * SEG_W }],
  }))

  function dragPagerTo(ratio: number) {
    pagerRef.current?.scrollTo({ x: ratio * STATS_SCREEN_W, animated: false })
  }
  function snapToTab(idx: number) {
    const key = TABS[Math.min(2, Math.max(0, idx))]?.key
    if (key) switchTab(key)
  }

  // Svep på kroppsfiguren växlar fram/bak. Pagern får waitFor=denna gest så
  // horisontella svep som startar på figuren flippar den istället för att byta
  // flik; vertikala drag faller igenom till sidscrollen (failOffsetY).
  // Bytet animeras som en 3D-flip: rotera ut till 90°, byt sida, rotera in.
  const bodyRot = useSharedValue(0)
  const bodyAnimStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${bodyRot.value}deg` }],
    opacity: interpolate(Math.abs(bodyRot.value), [0, 90], [1, 0.25], Extrapolation.CLAMP),
  }))

  function swapSide() {
    setBodyView(v => (v === 'front' ? 'back' : 'front'))
  }

  function animateFlip(dir: number = 1) {
    Haptics.selectionAsync()
    bodyRot.value = withTiming(90 * dir, { duration: 150, easing: Easing.in(Easing.quad) }, finished => {
      if (finished) {
        runOnJS(swapSide)()
        bodyRot.value = -90 * dir
        bodyRot.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.quad) })
      }
    })
  }

  const bodyFlipRef = useRef<GestureType | undefined>(undefined)
  const calSwipeRef = useRef<GestureType | undefined>(undefined)
  const bodyFlip = Gesture.Pan()
    .withRef(bodyFlipRef)
    .activeOffsetX([-12, 12])
    .failOffsetY([-15, 15])
    .onEnd(e => {
      if (Math.abs(e.translationX) > 40 || Math.abs(e.velocityX) > 500) {
        runOnJS(animateFlip)(e.translationX < 0 ? 1 : -1)
      }
    })

  // Håll och dra i flikraden — pagern följer fingret, släpp snäpper till närmsta flik
  const tabPan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate(e => {
      const ratio = Math.min(2, Math.max(0, (e.x - SEG_W / 2) / SEG_W))
      runOnJS(dragPagerTo)(ratio)
    })
    .onEnd(e => {
      const idx = Math.round(Math.min(2, Math.max(0, (e.x - SEG_W / 2) / SEG_W)))
      runOnJS(snapToTab)(idx)
    })
  const [loading, setLoading]                   = useState(true)
  const [loadError, setLoadError]               = useState(false)
  const [streak, setStreak]                     = useState(0)
  const [completedSessions, setCompletedSessions] = useState<CompletedSessionItem[]>([])
  const [userId, setUserId]                     = useState<string | null>(null)
  const [weekOffset, setWeekOffset]             = useState(0)
  const [weekExNames, setWeekExNames]           = useState<string[]>([])
  const [weekExByDay, setWeekExByDay]           = useState<Record<string, string[]>>({})
  const [prevWeekExNames, setPrevWeekExNames]   = useState<string[]>([])
  // null = hela veckan, 0–6 = vald veckodag (Mån–Sön)
  const [dayIdx, setDayIdx]                     = useState<number | null>(null)
  const [weekLoading, setWeekLoading]           = useState(false)
  const [weekGymSessions, setWeekGymSessions]   = useState<GymSession[]>([])

  useFocusEffect(useCallback(() => {
    loadStats()
    // Enhetsvalet kan ha ändrats i Inställningar sedan sist
    getUnitSystem().then(setUnit)
  }, []))

  async function loadStats() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const uid = session.user.id
      setUserId(uid)
      const [challenge, cardioWos, strengthWos, sessionHistory] = await Promise.all([
        getActiveChallenge(uid),
        getCardioWorkouts(uid, 60),
        getStrengthWorkouts(uid, 1000),
        getCompletedSessionsHistory(uid).catch(() => [] as CompletedSessionItem[]),
      ])
      setWorkouts(cardioWos)
      setStrengthWorkouts(strengthWos)
      setCompletedSessions(sessionHistory)
      setLoadError(false)
      if (!challenge) return
      setChallengeId(challenge.id)
      setStartDate(challenge.start_date)
      const day = calculateCurrentDay(challenge.start_date)
      setCurrentDay(day)
      setLevelName(challenge.challenge_levels?.display_name ?? '')
      const [allDays, streakVal] = await Promise.all([
        getAllDays(challenge.id, day),
        getStreak(challenge.id),
      ])
      setDays(allDays)
      setStreak(streakVal)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!userId) return
    setWeekLoading(true)
    setDayIdx(null)
    const { start, end } = getWeekBounds(weekOffset)
    const prev = getWeekBounds(weekOffset - 1)
    Promise.all([
      getCompletedExerciseNamesByDay(userId, start, end).catch(() => ({} as Record<string, string[]>)),
      fetchGymSessions(userId, start, end),
      getCompletedExerciseNamesForWeek(userId, prev.start, prev.end).catch(() => [] as string[]),
    ])
      .then(([byDay, , prevNames]) => {
        setWeekExByDay(byDay)
        setWeekExNames(Object.values(byDay).flat())
        setPrevWeekExNames(prevNames)
      })
      .finally(() => setWeekLoading(false))
  }, [userId, weekOffset])

  async function fetchGymSessions(uid: string, start: string, end: string) {
    const { data } = await supabase
      .from('workout_completions')
      .select(`id, completed_date, workout_sessions(id, name, session_type, session_exercises(exercise_name, sort_order))`)
      .eq('user_id', uid)
      .gte('completed_date', start)
      .lte('completed_date', end)
      .order('completed_date', { ascending: true })

    const sessions: GymSession[] = (data ?? [])
      .filter((c: any) => (c.workout_sessions as any)?.session_type !== 'cardio')
      .map((c: any) => {
        const rawName: string = (c.workout_sessions as any)?.name ?? 'Pass'
        const sessionName = rawName.startsWith('ONCE:')
          ? rawName.split(':').slice(2).join(':')
          : rawName
        return {
          id:            c.id as string,
          completedDate: c.completed_date as string,
          sessionName,
          exercises:     [...((c.workout_sessions as any)?.session_exercises ?? [])]
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((e: any) => e.exercise_name as string),
        }
      })
    setWeekGymSessions(sessions)
  }

  // ── derived ────────────────────────────────────────────────────────────────

  const weekBounds   = getWeekBounds(weekOffset)
  const prevBounds   = getWeekBounds(weekOffset - 1)

  // ── Gym-fördjupning: set/reps/volym + muskelgrupper, vald vecka vs förra ──
  const inWeek = (w: StrengthWorkout, b: { start: string; end: string }) => {
    const d = w.data.workout_date ?? toLocalDateString(new Date(w.created_at))
    return d >= b.start && d <= b.end
  }
  const weekStrength = strengthWorkouts.filter(w => inWeek(w, weekBounds))
  const prevStrength = strengthWorkouts.filter(w => inWeek(w, prevBounds))
  const strengthSums = (list: StrengthWorkout[]) => ({
    sets:   list.reduce((s, w) => s + w.data.sets.length, 0),
    reps:   list.reduce((s, w) => s + w.data.sets.reduce((x, r) => x + r.reps, 0), 0),
    volume: list.reduce((s, w) => s + w.data.sets.reduce((x, r) => x + r.reps * (r.weight_kg || 0), 0), 0),
  })
  const prevSums = strengthSums(prevStrength)
  const gymPassCount = (b: { start: string; end: string }) =>
    completedSessions.filter(c => c.sessionType === 'gym' && c.completedDate >= b.start && c.completedDate <= b.end).length
  const prevPassCount = gymPassCount(prevBounds)

  // ── Dagval: V-knappen visar hela veckan, dagrutorna zoomar in på en dag ──
  const selDayDate = (() => {
    if (dayIdx === null) return null
    const d = parseLocalDate(weekBounds.start)
    d.setDate(d.getDate() + dayIdx)
    return toLocalDateString(d)
  })()
  const scopedExNames  = selDayDate ? (weekExByDay[selDayDate] ?? []) : weekExNames
  const scopedStrength = selDayDate
    ? weekStrength.filter(w => (w.data.workout_date ?? toLocalDateString(new Date(w.created_at))) === selDayDate)
    : weekStrength
  const weekSums = strengthSums(scopedStrength)
  const scopedPassCount = selDayDate
    ? weekGymSessions.filter(gs => gs.completedDate === selDayDate).length
    : weekGymSessions.length

  const weekMuscleFreq = new Map<Slug, number>()
  scopedExNames.forEach(name => {
    getMusclesForName(name).forEach(slug => {
      weekMuscleFreq.set(slug, (weekMuscleFreq.get(slug) || 0) + 1)
    })
  })
  const weekMuscleData = Array.from(weekMuscleFreq.entries()).map(([slug, count]) => ({
    slug,
    intensity: (count >= 4 ? 3 : count >= 2 ? 2 : 1) as 1 | 2 | 3,
  }))

  // Muskelgrupper (av de 6) som tränats — samma taxonomi som radarn använder
  const groupCount = (names: string[]) => MUSCLE_GROUPS_6.filter(g =>
    names.some(n => getMusclesForName(n).some(sl => g.slugs.includes(sl)))).length
  const scopedGroupCount = groupCount(scopedExNames)
  const prevGroupCount   = groupCount(prevWeekExNames)

  const completedDays = days.filter(d => d.status === 'completed').length

  // ── Din vecka: tvärsummering över cardio + gym, innevarande kalendervecka ──
  const nowWeekStart = toLocalDateString(startOfWeek())
  const nowWeekEnd = (() => { const d = startOfWeek(); d.setDate(d.getDate() + 7); return toLocalDateString(d) })()
  const inNowWeek = (iso: string) => iso >= nowWeekStart && iso < nowWeekEnd
  const reportCardio = workouts.filter(w => inNowWeek(toLocalDateString(new Date(w.created_at))))
  const weekReport = {
    passes: reportCardio.length
      + completedSessions.filter(c => c.sessionType === 'gym' && inNowWeek(c.completedDate)).length,
    km: reportCardio.reduce((s, w) => s + w.data.distance_km, 0),
    volume: strengthWorkouts
      .filter(w => inNowWeek(w.data.workout_date ?? toLocalDateString(new Date(w.created_at))))
      .reduce((s, w) => s + w.data.sets.reduce((x, r) => x + r.reps * (r.weight_kg || 0), 0), 0),
    daysCleared: startDate
      ? days.filter(d => {
          if (d.status !== 'completed') return false
          const dt = parseLocalDate(startDate)
          dt.setDate(dt.getDate() + d.dayNumber - 1)
          return inNowWeek(toLocalDateString(dt))
        }).length
      : 0,
  }
  const missedDays    = days.filter(d => d.status === 'failed').length

  const unitLabel  = distanceUnitLabel(unit)

  // Periodfilter för cardio-fliken: kalendervecka / kalendermånad / totalt,
  // med pilbläddring bakåt precis som på gympass-fliken
  const cardioBounds = (() => {
    if (cardioRange === 'week') {
      const mon = startOfWeek()
      mon.setDate(mon.getDate() + cardioOffset * 7)
      const end = new Date(mon); end.setDate(end.getDate() + 7)
      const sun = new Date(mon); sun.setDate(sun.getDate() + 6)
      const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '')
      return {
        start: toLocalDateString(mon) as string | null,
        end: toLocalDateString(end) as string | null,
        label: cardioOffset === 0 ? 'Denna vecka' : `${fmt(mon)} till ${fmt(sun)}`,
      }
    }
    if (cardioRange === 'month') {
      const now = new Date()
      const first = new Date(now.getFullYear(), now.getMonth() + cardioOffset, 1)
      const next  = new Date(first.getFullYear(), first.getMonth() + 1, 1)
      return {
        start: toLocalDateString(first) as string | null,
        end: toLocalDateString(next) as string | null,
        label: cardioOffset === 0
          ? 'Denna månad'
          : first.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' }),
      }
    }
    return { start: null as string | null, end: null as string | null, label: 'Hela historiken' }
  })()
  const cardioW = workouts.filter(w => {
    const d = toLocalDateString(new Date(w.created_at))
    return (cardioBounds.start === null || d >= cardioBounds.start)
      && (cardioBounds.end === null || d < cardioBounds.end)
  })

  // Snittansträngning (RPE) och aktiva dagar för perioden
  const effortVals = cardioW
    .map(w => w.data.effort)
    .filter((e): e is number => typeof e === 'number' && e >= 1)
  const avgEffort = effortVals.length ? effortVals.reduce((a, b) => a + b, 0) / effortVals.length : 0
  const activeCardioDays = new Set(cardioW.map(w => toLocalDateString(new Date(w.created_at)))).size

  const totalKm    = cardioW.reduce((sum, w) => sum + w.data.distance_km, 0)
  const totalSecs  = cardioW.reduce((sum, w) => sum + w.data.duration_seconds, 0)
  const totalCals  = cardioW.reduce((sum, w) => sum + w.data.calories, 0)
  const pacedW     = cardioW.filter(w => w.data.distance_km > 0.1)
  const bestPaceSec = pacedW
    .map(w => w.data.duration_seconds / w.data.distance_km)
    .reduce((b, p) => p < b ? p : b, Infinity)
  const pacedKm    = pacedW.reduce((s, w) => s + w.data.distance_km, 0)
  const pacedSecs  = pacedW.reduce((s, w) => s + w.data.duration_seconds, 0)
  // Tempo per vald enhet (sek/km → sek/mi vid imperial)
  const avgPace    = pacedKm > 0 ? fmtPace(paceForUnit(pacedSecs / pacedKm, unit)) : '--:--'
  const bestPace   = bestPaceSec === Infinity ? '--:--' : fmtPace(paceForUnit(bestPaceSec, unit))

  const milestone   = nextMilestone(Math.max(0, currentDay - 1))
  const isEarlyDays = currentDay <= 7
  // Tempoutvecklingen räknas alltid på ALLA pass, oavsett periodfilter
  const weeklyBars  = buildWeeklyBars(workouts)

  // Extra periodstatistik till Träningsdetaljer
  const avgDistKm      = cardioW.length ? totalKm / cardioW.length : 0
  const longestPassKm  = cardioW.reduce((b, w) => Math.max(b, w.data.distance_km), 0)

  // ── Distansgraf: staplar per dag/vecka/månad beroende på periodfiltret ──
  type DistBucket = { key: string; label: string; run: number; cycle: number; walk: number; total: number; isCurrent: boolean }
  const distBuckets: DistBucket[] = (() => {
    const catOf = (t: string) => t === 'cycling' ? 'cycle' as const : t === 'walking' ? 'walk' as const : 'run' as const
    const add = (buckets: DistBucket[], key: string, w: CardioWorkout) => {
      const b = buckets.find(x => x.key === key)
      if (!b) return
      b[catOf(w.data.type ?? 'running')] += w.data.distance_km
      b.total += w.data.distance_km
    }
    if (cardioRange === 'week') {
      // Den valda kalenderveckans sju dagar
      const start = parseLocalDate(cardioBounds.start!)
      const today = toLocalDateString(new Date())
      const buckets = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start); d.setDate(d.getDate() + i)
        const key = toLocalDateString(d)
        return { key, label: ['M', 'T', 'O', 'T', 'F', 'L', 'S'][i], run: 0, cycle: 0, walk: 0, total: 0, isCurrent: key === today }
      })
      workouts.forEach(w => add(buckets, toLocalDateString(new Date(w.created_at)), w))
      return buckets
    }
    if (cardioRange === 'month') {
      // Den valda kalendermånadens veckor
      const thisMon = toLocalDateString(startOfWeek())
      const buckets: DistBucket[] = []
      const mon = startOfWeek(parseLocalDate(cardioBounds.start!))
      while (toLocalDateString(mon) < cardioBounds.end!) {
        const key = toLocalDateString(mon)
        buckets.push({ key, label: `V${isoWeekNum(mon)}`, run: 0, cycle: 0, walk: 0, total: 0, isCurrent: key === thisMon })
        mon.setDate(mon.getDate() + 7)
      }
      workouts.forEach(w => add(buckets, toLocalDateString(startOfWeek(new Date(w.created_at))), w))
      return buckets
    }
    const now = new Date()
    const buckets = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', ''),
        run: 0, cycle: 0, walk: 0, total: 0, isCurrent: i === 5,
      }
    })
    workouts.forEach(w => {
      const d = new Date(w.created_at)
      add(buckets, `${d.getFullYear()}-${d.getMonth()}`, w)
    })
    return buckets
  })()

  // ── Cardiorekord (all-time) — vi sparar även PASSET bakom varje rekord så
  // korten kan öppna det direkt ──
  const allPaced = workouts.filter(w => w.data.distance_km > 0.1)
  const recLongestW = workouts.reduce<CardioWorkout | null>(
    (b, w) => w.data.distance_km > (b?.data.distance_km ?? 0) ? w : b, null)
  const recLongestKm = recLongestW?.data.distance_km ?? 0
  const recBestPaceW = allPaced.reduce<CardioWorkout | null>((b, w) => {
    const p  = w.data.duration_seconds / w.data.distance_km
    const bp = b ? b.data.duration_seconds / b.data.distance_km : Infinity
    return p < bp ? w : b
  }, null)
  const recBestPaceSec = recBestPaceW
    ? recBestPaceW.data.duration_seconds / recBestPaceW.data.distance_km
    : Infinity
  // Snabbaste hela km från sparade splits ("1 km", "2 km" …)
  let recFastestSplitSec = Infinity
  let recFastestSplitW: CardioWorkout | null = null
  for (const w of workouts) {
    for (const sp of w.data.splits ?? []) {
      if (/^\d+\s*(km|mi)$/.test(sp.label) && sp.paceSec > 0 && sp.paceSec < recFastestSplitSec) {
        recFastestSplitSec = sp.paceSec
        recFastestSplitW = w
      }
    }
  }
  const { recBiggestWeek, recBiggestWeekW } = (() => {
    const byWeek = new Map<string, number>()
    for (const w of workouts) {
      const key = toLocalDateString(startOfWeek(new Date(w.created_at)))
      byWeek.set(key, (byWeek.get(key) ?? 0) + w.data.distance_km)
    }
    let max = 0, maxKey = ''
    byWeek.forEach((v, k) => { if (v > max) { max = v; maxKey = k } })
    // Längsta passet under rekordveckan blir kortets mål
    const inWeek = workouts.filter(w => toLocalDateString(startOfWeek(new Date(w.created_at))) === maxKey)
    const best = inWeek.reduce<CardioWorkout | null>(
      (b, w) => w.data.distance_km > (b?.data.distance_km ?? 0) ? w : b, null)
    return { recBiggestWeek: max, recBiggestWeekW: best }
  })()
  const hasRecords = workouts.length > 0

  // ── Styrkerekord (all-time) — från loggade set, klickbara till passet ──
  type LiftRec = { name: string; kg: number; date: string }
  let recTopLift: LiftRec | null = null
  let recOneRm: LiftRec | null = null
  const volByDate = new Map<string, number>()
  const setsByWeekMap = new Map<string, number>()
  for (const w of strengthWorkouts) {
    const d = w.data.workout_date ?? toLocalDateString(new Date(w.created_at))
    let vol = 0
    for (const st of w.data.sets) {
      vol += st.reps * (st.weight_kg || 0)
      if (st.weight_kg > 0 && (!recTopLift || st.weight_kg > recTopLift.kg)) {
        recTopLift = { name: w.data.exercise_name, kg: st.weight_kg, date: d }
      }
      // Epley: vikt × (1 + reps/30)
      const orm = st.weight_kg > 0 && st.reps > 0 ? st.weight_kg * (1 + st.reps / 30) : 0
      if (orm > 0 && (!recOneRm || orm > recOneRm.kg)) {
        recOneRm = { name: w.data.exercise_name, kg: orm, date: d }
      }
    }
    volByDate.set(d, (volByDate.get(d) ?? 0) + vol)
    const wk = toLocalDateString(startOfWeek(parseLocalDate(d)))
    setsByWeekMap.set(wk, (setsByWeekMap.get(wk) ?? 0) + w.data.sets.length)
  }
  let recBigDay: { date: string; vol: number } | null = null
  for (const [d, v] of volByDate) {
    if (v > 0 && (!recBigDay || v > recBigDay.vol)) recBigDay = { date: d, vol: v }
  }
  let recWeekSets = 0
  for (const v of setsByWeekMap.values()) recWeekSets = Math.max(recWeekSets, v)
  const hasGymRecords = recTopLift !== null || recWeekSets > 0

  // Öppnar gympassdetaljen för alla loggade övningar ett visst datum
  function openGymDay(date: string, title: string) {
    const logged = strengthWorkouts.filter(w =>
      (w.data.workout_date ?? toLocalDateString(new Date(w.created_at))) === date)
    setGymDetail({
      name: title,
      dateLabel: parseLocalDate(date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }),
      planned: [],
      logged,
    })
  }

  // ── Tempoutveckling: veckosnitt (endast veckor med distanspass) ──
  const paceWeeks = weeklyBars.filter(b => b.paceSec > 0)
  const paceVals  = paceWeeks.map(b => paceForUnit(b.paceSec, unit))

  // ── Sessioner: blandad lista av cardio-pass + avklarade schemapass ──
  const CARDIO_META: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
    running:  { icon: 'fitness',  color: ORANGE },
    cycling:  { icon: 'bicycle',  color: BLUE },
    walking:  { icon: 'walk',     color: GREEN },
    interval: { icon: 'flash',    color: YELLOW },
  }
  type SessRow = {
    key: string
    name: string
    value: string
    icon: React.ComponentProps<typeof Ionicons>['name']
    color: string
    sortKey: number
    dateStr: string
    workout?: CardioWorkout
  }
  const sessionRows: SessRow[] = [
    ...cardioW.map((w): SessRow => {
      const meta = CARDIO_META[w.data.type] ?? { icon: 'fitness' as const, color: ORANGE }
      return {
        key: `c:${w.id}`,
        name: w.name,
        // Alltid distans — aldrig tid — som stort värde
        value: `${toDisplayDistance(w.data.distance_km, unit).toFixed(2).replace('.', ',')} ${unitLabel.toUpperCase()}`,
        icon: meta.icon,
        color: meta.color,
        sortKey: new Date(w.created_at).getTime(),
        dateStr: toLocalDateString(new Date(w.created_at)),
        workout: w,
      }
    }),
    // GPS-loggade cardiopass ligger redan i user_workouts — här tar vi bara
    // manuellt avbockade cardiopass (utan sparad distans) från schemat
    ...completedSessions
      .filter(c =>
        c.sessionType === 'cardio' && c.distanceKm == null &&
        (cardioBounds.start === null || c.completedDate >= cardioBounds.start) &&
        (cardioBounds.end === null || c.completedDate < cardioBounds.end))
      .map((c): SessRow => {
        const meta = CARDIO_META[c.cardioType ?? ''] ?? { icon: 'fitness' as const, color: BLUE }
        return {
          key: `g:${c.id}`,
          name: c.name,
          value: 'Klart',
          icon: meta.icon,
          color: meta.color,
          sortKey: new Date(`${c.completedDate}T12:00:00`).getTime(),
          dateStr: c.completedDate,
        }
      }),
  ].sort((a, b) => b.sortKey - a.sortKey).slice(0, 30)

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: BG }]}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  if (loadError) {
    return (
      <View style={[s.centered, { backgroundColor: BG }]}>
        <Ionicons name="cloud-offline-outline" size={36} color="#4A4A50" />
        <Text style={s.errorText}>Kunde inte ladda din statistik</Text>
        <TouchableOpacity
          style={s.retryBtn}
          onPress={() => { setLoading(true); loadStats() }}
          activeOpacity={0.8}
        >
          <Text style={s.retryBtnText}>Försök igen</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Framsteg</Text>
        <Text style={s.subtitle}>
          {currentDay > 0 ? `Dag ${currentDay} av 75${levelName ? ` · ${levelName}` : ''}` : levelName}
        </Text>
      </View>

      <GestureDetector gesture={tabPan}>
        <View style={s.tabWrap}>
          <View style={s.compactRow}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={s.compactTab}
                onPress={() => switchTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[s.compactLabel, activeTab === tab.key && s.compactLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.compactTrack}>
            <Animated.View style={[s.compactIndicator, indicatorStyle]} />
          </View>
        </View>
      </GestureDetector>

      {statsRefreshing && <ActivityIndicator color={ORANGE} style={{ marginBottom: 8 }} />}

      <GHScrollView
        ref={pagerRef as never}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        waitFor={[bodyFlipRef, calSwipeRef]}
        onScroll={e => { pagerX.value = e.nativeEvent.contentOffset.x }}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / STATS_SCREEN_W)
          const key = TABS[idx]?.key
          if (key && key !== activeTab) setActiveTab(key)
        }}
      >

        {/* ── ÖVERSIKT ── */}
        <ScrollView
          style={{ width: STATS_SCREEN_W }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          onScroll={onTabScroll}
          onScrollEndDrag={onTabScrollEnd}
          scrollEventThrottle={16}
        >
          <>
            {/* Ring chart */}
            <Text style={s.sectionHead}>Utmaningen</Text>
            <View style={[s.card, s.cardPlain]}>
              <View style={s.ringWrap}>
                <RingChart currentDay={currentDay} completedDays={completedDays} />
                <View style={s.ringInfo}>
                  <View>
                    <Text style={s.ringDay}>Dag {currentDay}</Text>
                    <Text style={s.ringOfN}>
                      {currentDay > 0 ? Math.round((currentDay / 75) * 100) : 0}% av utmaningen
                    </Text>
                  </View>
                  <View style={s.ringRows}>
                    <View style={s.ringRow}>
                      <Text style={s.ringRowLabel}>Klarade dagar</Text>
                      <Text style={[s.ringRowVal, { color: GREEN }]}>{completedDays} ✓</Text>
                    </View>
                    {!isEarlyDays && (
                      <>
                        <View style={s.ringRow}>
                          <Text style={s.ringRowLabel}>Missade dagar</Text>
                          <Text style={[s.ringRowVal, { color: RED }]}>{missedDays}</Text>
                        </View>
                        <View style={s.ringRow}>
                          <Text style={s.ringRowLabel}>Framgång</Text>
                          <Text style={[s.ringRowVal, { color: ORANGE }]}>
                            {currentDay > 1 ? Math.round((completedDays / (currentDay - 1)) * 100) : 0}%
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* Milestone — framträdande dag 1–7 */}
            {isEarlyDays && milestone && (
              <TouchableOpacity style={s.milestone} activeOpacity={0.8} onPress={() => setMilestoneOpen(true)}>
                <View style={s.msIcon}><Text style={s.msEmoji}>🏔</Text></View>
                <View style={s.msBody}>
                  <Text style={s.msEyebrow}>NÄSTA MILSTOLPE</Text>
                  <Text style={s.msTitle}>{milestone.label}</Text>
                  <Text style={s.msSub}>
                    {milestone.daysLeft === 1 ? '1 dag kvar' : `${milestone.daysLeft} dagar kvar`} · Du är på väg!
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={ORANGE} />
              </TouchableOpacity>
            )}

            {/* Din vecka — tvärsummering över cardio och gym */}
            <Text style={s.sectionHead}>Din vecka</Text>
            <View style={[s.card, s.cardPlain]}>
              <View style={[s.dtlRow, { paddingTop: 0 }]}>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Träningspass</Text>
                  <Text style={[s.dtlVal, { color: ORANGE }]}>{weekReport.passes}</Text>
                </View>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Distans</Text>
                  <Text style={[s.dtlVal, { color: BLUE }]}>
                    {toDisplayDistance(weekReport.km, unit).toFixed(1).replace('.', ',')}
                    <Text style={s.dtlUnit}> {unitLabel.toUpperCase()}</Text>
                  </Text>
                </View>
              </View>
              <View style={s.dtlSep} />
              <View style={[s.dtlRow, { paddingBottom: 0 }]}>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Volym</Text>
                  <Text style={[s.dtlVal, { color: YELLOW }]} numberOfLines={1} adjustsFontSizeToFit>
                    {Math.round(weekReport.volume).toLocaleString('sv-SE')}
                    <Text style={s.dtlUnit}> KG</Text>
                  </Text>
                </View>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Klarade dagar</Text>
                  <Text style={[s.dtlVal, { color: GREEN }]}>{weekReport.daysCleared}</Text>
                </View>
              </View>
            </View>

            {/* Statistik — bara det ringen inte redan visar */}
            <Text style={s.sectionHead}>Statistik</Text>
            <View style={[s.card, s.cardPlain]}>
              <View style={[s.dtlRow, { paddingVertical: 0 }]}>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Dagar i streak</Text>
                  <Text style={[s.dtlVal, { color: ORANGE }]}>{streak}</Text>
                </View>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>{isEarlyDays ? 'Till dag 10' : 'Kvar till mål'}</Text>
                  <Text style={[s.dtlVal, { color: PURPLE }]}>
                    {isEarlyDays ? Math.max(0, 10 - currentDay) : Math.max(0, 75 - currentDay)}
                    <Text style={s.dtlUnit}> DAGAR</Text>
                  </Text>
                </View>
              </View>
            </View>

            {/* Milestone — normal position dag 8+ */}
            {!isEarlyDays && milestone && (
              <TouchableOpacity style={s.milestone} activeOpacity={0.8} onPress={() => setMilestoneOpen(true)}>
                <View style={s.msIcon}><Text style={s.msEmoji}>🏔</Text></View>
                <View style={s.msBody}>
                  <Text style={s.msEyebrow}>NÄSTA MILSTOLPE</Text>
                  <Text style={s.msTitle}>{milestone.label}</Text>
                  <Text style={s.msSub}>
                    {milestone.daysLeft === 1 ? '1 dag kvar' : `${milestone.daysLeft} dagar kvar`} · Håll ut
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={ORANGE} />
              </TouchableOpacity>
            )}

            {/* Calendar */}
            <Text style={s.sectionHead}>Kalender</Text>
            <CalendarView
              days={days}
              startDate={startDate}
              currentDay={currentDay}
              challengeId={challengeId}
              onPressDay={setSelectedDay}
              gestureRef={calSwipeRef}
              workouts={workouts}
              strengthWorkouts={strengthWorkouts}
              completedSessions={completedSessions}
              unit={unit}
              avatarUrl={avatarUrl}
              onDeleteWorkout={id => setWorkouts(prev => prev.filter(w => w.id !== id))}
            />
          </>
        </ScrollView>

        {/* ── CARDIO ── */}
        <ScrollView
          style={{ width: STATS_SCREEN_W }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          onScroll={onTabScroll}
          onScrollEndDrag={onTabScrollEnd}
          scrollEventThrottle={16}
        >
          {workouts.length === 0 ? (
            <View style={s.tabEmpty}>
              <View style={s.tabEmptyIcon}><Ionicons name="walk-outline" size={30} color={ORANGE} /></View>
              <Text style={s.tabEmptyTitle}>Inget cardio ännu</Text>
              <Text style={s.tabEmptyText}>
                Starta ett GPS-pass från schemat så vaknar statistiken: distans, tempo, grafer och rekord.
              </Text>
              <TouchableOpacity style={s.tabEmptyBtn} activeOpacity={0.85} onPress={() => router.push('/(app)/add')}>
                <Text style={s.tabEmptyBtnText}>Till schemat</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <>
            {/* Periodfilter — dragbar glasslider som i Anpassning */}
            <GlassSegment
              value={cardioRange}
              options={[
                { key: 'week',  label: 'Vecka' },
                { key: 'month', label: 'Månad' },
                { key: 'all',   label: 'Totalt' },
              ]}
              onChange={k => { setCardioRange(k); setCardioOffset(0) }}
            />

            {/* Bläddra bakåt i tiden — samma pilar som på gympass-fliken */}
            {cardioRange !== 'all' && (
              <View style={s.weekNav}>
                <TouchableOpacity style={s.weekNavBtn} onPress={() => setCardioOffset(o => o - 1)} activeOpacity={0.7}>
                  <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
                </TouchableOpacity>
                <Text style={s.weekNavLabel}>{cardioBounds.label}</Text>
                <TouchableOpacity
                  style={s.weekNavBtn}
                  onPress={() => setCardioOffset(o => o + 1)}
                  disabled={cardioOffset >= 0}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-forward" size={20} color={cardioOffset >= 0 ? 'rgba(255,255,255,0.18)' : TEXT_PRIMARY} />
                </TouchableOpacity>
              </View>
            )}

            {/* Träningsdetaljer — kompakt på fliken, tryck för alla detaljer */}
            <View style={s.sectionHeadRow}>
              <Text style={[s.sectionHead, s.sectionHeadInline]}>Träningsdetaljer</Text>
              <Ionicons name="chevron-forward" size={19} color={TEXT_SECONDARY} />
            </View>
            <TouchableOpacity
              style={[s.card, s.cardPlain]}
              activeOpacity={0.85}
              onPress={() => setCardioDetailsOpen(true)}
            >
              <View style={[s.dtlRow, { paddingTop: 0 }]}>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Träningstid</Text>
                  <Text style={[s.dtlVal, { color: YELLOW }]}>{fmtDuration(totalSecs)}</Text>
                </View>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Distans</Text>
                  <Text style={[s.dtlVal, { color: BLUE }]}>
                    {toDisplayDistance(totalKm, unit).toFixed(2).replace('.', ',')}
                    <Text style={s.dtlUnit}> {unitLabel.toUpperCase()}</Text>
                  </Text>
                </View>
              </View>
              <View style={s.dtlSep} />
              <View style={[s.dtlRow, { paddingBottom: 0 }]}>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Antal pass</Text>
                  <Text style={[s.dtlVal, { color: GREEN }]}>{cardioW.length}</Text>
                </View>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Snittempo</Text>
                  <Text style={[s.dtlVal, { color: TEAL }]}>
                    {avgPace}
                    <Text style={s.dtlUnit}> /{unitLabel}</Text>
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Tempoutveckling */}
            {paceWeeks.length >= 2 && (() => {
              const CH_W = STATS_SCREEN_W - 84
              const CH_H = 120
              const minV = Math.min(...paceVals)
              const maxV = Math.max(...paceVals)
              const span = Math.max(maxV - minV, 1)
              const px = (i: number) =>
                paceWeeks.length === 1 ? CH_W / 2 : (i / (paceWeeks.length - 1)) * (CH_W - 16) + 8
              // Lägre tempo = bättre → snabbast överst
              const py = (v: number) => 12 + ((v - minV) / span) * (CH_H - 24)
              const pts = paceVals.map((v, i) => `${px(i)},${py(v)}`).join(' ')
              return (
                <>
                <Text style={s.sectionHead}>Tempoutveckling</Text>
                <View style={[s.card, s.cardPlain]}>
                  <Text style={[s.cardSub, { marginTop: 0 }]}>snitt min/{unitLabel} per vecka · snabbare är högre upp</Text>
                  <View style={s.paceChartRow}>
                    <View style={s.paceAxis}>
                      <Text style={s.paceAxisLbl}>{fmtPace(minV)}</Text>
                      <Text style={s.paceAxisLbl}>{fmtPace(maxV)}</Text>
                    </View>
                    <Svg width={CH_W} height={CH_H}>
                      {[0.25, 0.5, 0.75].map(f => (
                        <SvgLine
                          key={f}
                          x1={0} x2={CH_W}
                          y1={12 + f * (CH_H - 24)} y2={12 + f * (CH_H - 24)}
                          stroke="rgba(255,255,255,0.06)" strokeWidth={1}
                        />
                      ))}
                      <Polyline points={pts} fill="none" stroke={BLUE} strokeWidth={2.5} strokeLinejoin="round" />
                      {paceVals.map((v, i) => (
                        <Circle key={i} cx={px(i)} cy={py(v)} r={4} fill={BLUE} stroke={CARD} strokeWidth={2} />
                      ))}
                    </Svg>
                  </View>
                  <View style={s.paceWeekRow}>
                    {paceWeeks.map((b, i) => (
                      <Text key={i} style={[s.paceWeekLbl, b.isCurrent && { color: BLUE }]}>{b.label}</Text>
                    ))}
                  </View>
                </View>
                </>
              )
            })()}

            {/* Distansgraf — vertikala staplar som följer periodfiltret; tryck för detaljvyn */}
            {distBuckets.some(b => b.total > 0) && (
              <>
              <View style={s.sectionHeadRow}>
                <Text style={[s.sectionHead, s.sectionHeadInline]}>Distans</Text>
                <Ionicons name="chevron-forward" size={19} color={TEXT_SECONDARY} />
              </View>
              <TouchableOpacity
                style={[s.card, s.cardPlain]}
                activeOpacity={0.85}
                onPress={() => setDistDetailOpen(true)}
              >
                <Text style={[s.cardSub, { marginTop: 0 }]}>
                  {unitLabel} {cardioRange === 'week' ? 'per dag, vald vecka' : cardioRange === 'month' ? 'per vecka, vald månad' : 'per månad, senaste 6 månaderna'}
                </Text>
                {(() => {
                  const CH_W = STATS_SCREEN_W - 80
                  const CH_H = 150
                  const n = distBuckets.length
                  const slot = CH_W / n
                  const barW = Math.min(30, Math.round(slot * 0.5))
                  const maxV = Math.max(...distBuckets.map(b => b.total), 0.1)
                  const scale = (CH_H - 30) / maxV
                  return (
                    <Svg width={CH_W} height={CH_H}>
                      {[0.25, 0.5, 0.75, 1].map(f => (
                        <SvgLine
                          key={f}
                          x1={0} x2={CH_W}
                          y1={CH_H - 4 - f * (CH_H - 30)} y2={CH_H - 4 - f * (CH_H - 30)}
                          stroke="rgba(255,255,255,0.06)" strokeWidth={1}
                        />
                      ))}
                      {distBuckets.map((b, i) => {
                        const x = i * slot + (slot - barW) / 2
                        if (b.total <= 0) {
                          return <Rect key={b.key} x={x} y={CH_H - 7} width={barW} height={3} rx={1.5} fill="rgba(255,255,255,0.10)" />
                        }
                        // Staplas nedifrån: löpning, cykling, promenad
                        const segs = ([
                          [b.run, ORANGE], [b.cycle, BLUE], [b.walk, GREEN],
                        ] as const).filter(sg => sg[0] > 0)
                        let y = CH_H - 4
                        const rects = segs.map(([v, color], j) => {
                          const h = Math.max(3, v * scale)
                          y -= h
                          return (
                            <Rect
                              key={j}
                              x={x} y={y + (j > 0 ? 0.75 : 0)}
                              width={barW} height={h - (j > 0 ? 1.5 : 0)} rx={3}
                              fill={color} opacity={b.isCurrent ? 1 : 0.8}
                            />
                          )
                        })
                        return (
                          <G key={b.key}>
                            {rects}
                            <SvgText
                              x={x + barW / 2} y={y - 6}
                              fontSize={10} fontWeight="700" textAnchor="middle"
                              fill={b.isCurrent ? '#fff' : 'rgba(255,255,255,0.45)'}
                            >
                              {toDisplayDistance(b.total, unit).toFixed(1)}
                            </SvgText>
                          </G>
                        )
                      })}
                    </Svg>
                  )
                })()}
                <View style={s.distLblRow}>
                  {distBuckets.map(b => (
                    <Text key={b.key} style={[s.distLbl, b.isCurrent && { color: ORANGE }]}>{b.label}</Text>
                  ))}
                </View>
                <View style={s.barLegend}>
                  {([
                    { color: ORANGE, label: 'Löpning' },
                    { color: BLUE,   label: 'Cykling' },
                    { color: GREEN,  label: 'Promenad' },
                  ] as const).map(({ color, label }) => (
                    <View key={label} style={s.legItem}>
                      <View style={[s.legDot, { backgroundColor: color }]} />
                      <Text style={s.legText}>{label}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
              </>
            )}

            {/* Cardiorekord (all-time) — lista med ikon, etikett och färgat värde */}
            {hasRecords && (
              <>
              <Text style={s.sectionHead}>Cardiorekord</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -GRID_PADDING }}
                contentContainerStyle={s.recScroll}
              >
                {([
                  {
                    icon: 'map-outline' as const, color: ORANGE, label: 'Längsta pass',
                    value: recLongestKm > 0 ? `${toDisplayDistance(recLongestKm, unit).toFixed(2)} ${unitLabel}` : '–',
                    workout: recLongestW,
                  },
                  {
                    icon: 'flash-outline' as const, color: YELLOW, label: 'Snabbaste km',
                    value: recFastestSplitSec === Infinity ? '–' : fmtPace(recFastestSplitSec),
                    workout: recFastestSplitW,
                  },
                  {
                    icon: 'stopwatch-outline' as const, color: RED, label: `Bästa tempo /${unitLabel}`,
                    value: recBestPaceSec === Infinity ? '–' : fmtPace(paceForUnit(recBestPaceSec, unit)),
                    workout: recBestPaceW,
                  },
                  {
                    icon: 'trending-up-outline' as const, color: GREEN, label: 'Längsta vecka',
                    value: recBiggestWeek > 0 ? `${toDisplayDistance(recBiggestWeek, unit).toFixed(1)} ${unitLabel}` : '–',
                    workout: recBiggestWeekW,
                  },
                ]).map(r => (
                  <TouchableOpacity
                    key={r.label}
                    style={s.recCard}
                    activeOpacity={0.75}
                    disabled={!r.workout}
                    onPress={() => r.workout && setSelectedWorkout(r.workout)}
                  >
                    <View style={s.recCardTop}>
                      <View style={[s.recIconWrap, { backgroundColor: r.color + '1A' }]}>
                        <Ionicons name={r.icon} size={16} color={r.color} />
                      </View>
                      {r.workout && <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.28)" />}
                    </View>
                    <Text style={[s.recCardVal, { color: r.color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {r.value}
                    </Text>
                    <Text style={s.recCardLbl} numberOfLines={2}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              </>
            )}

            {/* Sessioner — blandad lista i Apple Fitness-stil */}
            {sessionRows.length > 0 ? (
              <View style={{ gap: 10 }}>
                <Text style={[s.sectionHead, { marginBottom: -14 }]}>Sessioner</Text>
                {sessionRows.map((r, i) => {
                  const m = monthLabel(r.dateStr)
                  const showMonth = i === 0 || monthLabel(sessionRows[i - 1].dateStr) !== m
                  return (
                    <View key={r.key} style={{ gap: 10 }}>
                      {showMonth && <Text style={s.sessMonth}>{m}</Text>}
                      <TouchableOpacity
                        style={s.sessRow}
                        activeOpacity={0.7}
                        onPress={r.workout ? () => setSelectedWorkout(r.workout!) : undefined}
                        disabled={!r.workout}
                      >
                        <View style={[s.sessIcon, { backgroundColor: r.color + '1E' }]}>
                          <Ionicons name={r.icon} size={20} color={r.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.sessName} numberOfLines={1}>{r.name}</Text>
                          <Text style={s.sessValue}>{r.value}</Text>
                        </View>
                        <Text style={s.sessDate}>{sessDateLabel(r.dateStr)}</Text>
                      </TouchableOpacity>
                    </View>
                  )
                })}
              </View>
            ) : (
              <View style={s.empty}>
                <Ionicons name="walk-outline" size={40} color="rgba(255,255,255,0.12)" />
                <Text style={s.emptyText}>
                  {workouts.length === 0 ? 'Inga pass sparade ännu' : 'Inga pass under vald period'}
                </Text>
              </View>
            )}
          </>
          )}
        </ScrollView>

        {/* ── GYMPASS ── */}
        <ScrollView
          style={{ width: STATS_SCREEN_W }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          onScroll={onTabScroll}
          onScrollEndDrag={onTabScrollEnd}
          scrollEventThrottle={16}
        >
          {strengthWorkouts.length === 0 && completedSessions.every(c => c.sessionType !== 'gym') ? (
            <View style={s.tabEmpty}>
              <View style={s.tabEmptyIcon}><Ionicons name="barbell-outline" size={30} color={ORANGE} /></View>
              <Text style={s.tabEmptyTitle}>Inga gympass ännu</Text>
              <Text style={s.tabEmptyText}>
                Bocka av övningar i schemat och logga reps och vikt i passen — då fylls muskelkartan, volymen och rekorden på här.
              </Text>
              <TouchableOpacity style={s.tabEmptyBtn} activeOpacity={0.85} onPress={() => router.push('/(app)/add')}>
                <Text style={s.tabEmptyBtnText}>Till schemat</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <>
            {/* Veckobläddring — samma pilnavigering som i Distans-detaljvyn */}
            <View style={s.weekNav}>
              <TouchableOpacity style={s.weekNavBtn} onPress={() => setWeekOffset(o => o - 1)} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
              </TouchableOpacity>
              <Text style={s.weekNavLabel}>{weekBounds.label}</Text>
              <TouchableOpacity
                style={s.weekNavBtn}
                onPress={() => setWeekOffset(o => o + 1)}
                disabled={weekOffset >= 0}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={20} color={weekOffset >= 0 ? 'rgba(255,255,255,0.18)' : TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>

            {/* Dagremsa — V = veckosammanfattning, dagrutor zoomar in på en dag */}
            <View style={s.dayStrip}>
              <TouchableOpacity
                style={[s.dayBox, s.dayBoxWeek, dayIdx === null && s.dayBoxActive]}
                activeOpacity={0.8}
                onPress={() => setDayIdx(null)}
              >
                <Ionicons name="calendar-clear-outline" size={14} color={dayIdx === null ? '#000' : TEXT_SECONDARY} />
                <Text style={[s.dayBoxLetter, dayIdx === null && s.dayBoxTextActive]}>Vecka</Text>
              </TouchableOpacity>
              {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((l, i) => {
                const d = parseLocalDate(weekBounds.start)
                d.setDate(d.getDate() + i)
                const iso = toLocalDateString(d)
                const future = iso > toLocalDateString(new Date())
                const active = dayIdx === i
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.dayBox, active && s.dayBoxActive, future && { opacity: 0.3 }]}
                    activeOpacity={0.8}
                    disabled={future}
                    onPress={() => setDayIdx(active ? null : i)}
                  >
                    <Text style={[s.dayBoxLetter, active && s.dayBoxTextActive]}>{l}</Text>
                    <Text style={[s.dayBoxNum, active && s.dayBoxTextActive]}>{d.getDate()}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Veckostatistik — samma Apple-rutnät, med förra veckan som jämförelse */}
            <Text style={s.sectionHead}>{dayIdx === null ? 'Veckans träning' : 'Dagens träning'}</Text>
            <View style={[s.card, s.cardPlain]}>
              <View style={[s.dtlRow, { paddingTop: 0 }]}>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Pass</Text>
                  <Text style={[s.dtlVal, { color: ORANGE }]}>{scopedPassCount}</Text>
                  {dayIdx === null && <Text style={s.dtlPrev} numberOfLines={1} adjustsFontSizeToFit>förra veckan {prevPassCount}</Text>}
                </View>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl} numberOfLines={1} adjustsFontSizeToFit>Muskelgrupper</Text>
                  <Text style={[s.dtlVal, { color: PURPLE }]}>
                    {scopedGroupCount}
                    <Text style={s.dtlUnit}> AV 6</Text>
                  </Text>
                  {dayIdx === null && <Text style={s.dtlPrev} numberOfLines={1} adjustsFontSizeToFit>förra veckan {prevGroupCount}</Text>}
                </View>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Övningar</Text>
                  <Text style={[s.dtlVal, { color: GREEN }]}>{scopedExNames.length}</Text>
                  {dayIdx === null && <Text style={s.dtlPrev} numberOfLines={1} adjustsFontSizeToFit>förra veckan {prevWeekExNames.length}</Text>}
                </View>
              </View>
              <View style={s.dtlSep} />
              <View style={[s.dtlRow, { paddingBottom: 0 }]}>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Set</Text>
                  <Text style={[s.dtlVal, { color: BLUE }]}>{weekSums.sets}</Text>
                  {dayIdx === null && <Text style={s.dtlPrev} numberOfLines={1} adjustsFontSizeToFit>förra veckan {prevSums.sets}</Text>}
                </View>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Reps</Text>
                  <Text style={[s.dtlVal, { color: TEAL }]}>{weekSums.reps}</Text>
                  {dayIdx === null && <Text style={s.dtlPrev} numberOfLines={1} adjustsFontSizeToFit>förra veckan {prevSums.reps}</Text>}
                </View>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Volym</Text>
                  <Text style={[s.dtlVal, { color: YELLOW }]} numberOfLines={1} adjustsFontSizeToFit>
                    {Math.round(weekSums.volume).toLocaleString('sv-SE')}
                    <Text style={s.dtlUnit}> KG</Text>
                  </Text>
                  {dayIdx === null && <Text style={s.dtlPrev} numberOfLines={1} adjustsFontSizeToFit>förra veckan {Math.round(prevSums.volume).toLocaleString('sv-SE')}</Text>}
                </View>
              </View>
            </View>

            {/* Volym per dag i vald vecka — tryck för fullständig historik */}
            {weekStrength.some(w => w.data.sets.some(st => st.weight_kg > 0)) && (
              <>
              <View style={s.sectionHeadRow}>
                <Text style={[s.sectionHead, s.sectionHeadInline]}>Volym</Text>
                <Ionicons name="chevron-forward" size={19} color={TEXT_SECONDARY} />
              </View>
              <TouchableOpacity
                style={[s.card, s.cardPlain]}
                activeOpacity={0.85}
                onPress={() => setVolumeOpen(true)}
              >
                <Text style={[s.cardSub, { marginTop: 0 }]}>kg lyft per dag, vald vecka</Text>
                {(() => {
                  const CH_W = STATS_SCREEN_W - 80
                  const CH_H = 130
                  const slot = CH_W / 7
                  const barW = Math.min(30, Math.round(slot * 0.5))
                  const dayVols = Array.from({ length: 7 }, (_, i) => {
                    const d = parseLocalDate(weekBounds.start)
                    d.setDate(d.getDate() + i)
                    const iso = toLocalDateString(d)
                    return weekStrength
                      .filter(w => (w.data.workout_date ?? toLocalDateString(new Date(w.created_at))) === iso)
                      .reduce((sum, w) => sum + w.data.sets.reduce((x, r) => x + r.reps * (r.weight_kg || 0), 0), 0)
                  })
                  const maxV = Math.max(...dayVols, 1)
                  const scale = (CH_H - 28) / maxV
                  return (
                    <>
                      <Svg width={CH_W} height={CH_H}>
                        {[0.5, 1].map(f => (
                          <SvgLine
                            key={f}
                            x1={0} x2={CH_W}
                            y1={CH_H - 4 - f * (CH_H - 28)} y2={CH_H - 4 - f * (CH_H - 28)}
                            stroke="rgba(255,255,255,0.06)" strokeWidth={1}
                          />
                        ))}
                        {dayVols.map((v, i) => {
                          const x = i * slot + (slot - barW) / 2
                          if (v <= 0) {
                            return <Rect key={i} x={x} y={CH_H - 7} width={barW} height={3} rx={1.5} fill="rgba(255,255,255,0.10)" />
                          }
                          const h = Math.max(3, v * scale)
                          return (
                            <G key={i}>
                              <Rect x={x} y={CH_H - 4 - h} width={barW} height={h} rx={3} fill={ORANGE} opacity={dayIdx === null || dayIdx === i ? 1 : 0.35} />
                              <SvgText
                                x={x + barW / 2} y={CH_H - 8 - h}
                                fontSize={9} fontWeight="700" textAnchor="middle"
                                fill="rgba(255,255,255,0.55)"
                              >
                                {Math.round(v).toLocaleString('sv-SE')}
                              </SvgText>
                            </G>
                          )
                        })}
                      </Svg>
                      <View style={s.distLblRow}>
                        {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((l, i) => (
                          <Text key={i} style={[s.distLbl, dayIdx === i && { color: ORANGE }]}>{l}</Text>
                        ))}
                      </View>
                    </>
                  )
                })()}
              </TouchableOpacity>
              </>
            )}

            {/* Body map — rubriken öppnar muskeldetaljen (radar + set per grupp) */}
            <TouchableOpacity style={s.sectionHeadRow} activeOpacity={0.7} onPress={() => setMuscleOpen(true)}>
              <Text style={[s.sectionHead, s.sectionHeadInline]}>Tränade muskler</Text>
              <Ionicons name="chevron-forward" size={19} color={TEXT_SECONDARY} />
            </TouchableOpacity>
            <View style={[s.card, s.cardPlain]}>
              <View style={s.muscleHeader}>
                <Text style={s.muscleAuto}>Från dina avbockade övningar</Text>
                <View style={s.bodyToggle}>
                  {(['front', 'back'] as const).map(side => (
                    <TouchableOpacity
                      key={side}
                      style={[s.bodyToggleBtn, bodyView === side && s.bodyToggleBtnActive]}
                      onPress={() => bodyView !== side && animateFlip(side === 'back' ? 1 : -1)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.bodyToggleText, bodyView === side && s.bodyToggleTextActive]}>
                        {side === 'front' ? 'Fram' : 'Bak'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {weekLoading ? (
                <View style={s.bodyWrap}><ActivityIndicator color={ORANGE} /></View>
              ) : (
                <>
                  <GestureDetector gesture={bodyFlip}>
                    {/* Tryck på gubben öppnar muskeldetaljen — svep i sidled vänder honom */}
                    <TouchableOpacity
                      style={s.bodyWrap}
                      activeOpacity={0.85}
                      onPress={() => setMuscleOpen(true)}
                    >
                      <Animated.View style={bodyAnimStyle} pointerEvents="none">
                        <Body
                          data={weekMuscleData}
                          side={bodyView}
                          gender="male"
                          scale={1.6}
                          colors={[BLUE, YELLOW, ORANGE]}
                          defaultFill="#2A2A2C"
                          border="rgba(255,255,255,0.10)"
                        />
                      </Animated.View>
                    </TouchableOpacity>
                  </GestureDetector>
                  {weekMuscleData.length > 0 && (
                    <View style={s.legend}>
                      {([
                        { color: BLUE,   label: '1 övning' },
                        { color: YELLOW, label: '2–3 övningar' },
                        { color: ORANGE, label: '4+ övningar' },
                      ] as const).map(({ color, label }) => (
                        <View key={label} style={s.legendItem}>
                          <View style={[s.legendDot, { backgroundColor: color }]} />
                          <Text style={s.legendText}>{label}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}

              {!weekLoading && scopedExNames.length === 0 && (
                <Text style={s.muscleEmpty}>
                  {dayIdx !== null
                    ? 'Inga avklarade övningar vald dag'
                    : weekOffset === 0 ? 'Inga avklarade övningar denna vecka' : 'Inga avklarade övningar vald vecka'}
                </Text>
              )}

            </View>

            {/* Genomförda pass — arkivet bakom en enkel rad */}
            <TouchableOpacity
              style={[s.card, s.cardPlain, s.muscleLinkRow]}
              activeOpacity={0.7}
              onPress={() => setSessionsOpen(true)}
            >
              <View style={[s.muscleLinkIcon, { backgroundColor: GREEN + '18' }]}>
                <Ionicons name="checkmark-done-outline" size={17} color={GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.muscleLinkTitle}>Genomförda pass</Text>
                <Text style={s.muscleLinkSub}>
                  {weekGymSessions.length} pass {weekOffset === 0 ? 'denna vecka' : 'vald vecka'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={TEXT_SECONDARY} />
            </TouchableOpacity>

            {/* Styrkerekord — all-time, klickbara till passet där rekordet sattes */}
            {hasGymRecords && (
              <>
              <Text style={s.sectionHead}>Styrkerekord</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -GRID_PADDING }}
                contentContainerStyle={s.recScroll}
              >
                {([
                  recTopLift && {
                    icon: 'barbell-outline' as const, color: ORANGE,
                    label: `Tyngsta lyft · ${recTopLift.name}`,
                    value: `${recTopLift.kg} kg`,
                    onPress: () => openGymDay(recTopLift!.date, recTopLift!.name),
                  },
                  recOneRm && {
                    icon: 'speedometer-outline' as const, color: PURPLE,
                    label: `Bästa 1RM · ${recOneRm.name}`,
                    value: `${Math.round(recOneRm.kg)} kg`,
                    onPress: () => openGymDay(recOneRm!.date, recOneRm!.name),
                  },
                  recBigDay && {
                    icon: 'trophy-outline' as const, color: YELLOW,
                    label: 'Största passet (volym)',
                    value: `${Math.round(recBigDay.vol).toLocaleString('sv-SE')} kg`,
                    onPress: () => openGymDay(recBigDay!.date, 'Största passet'),
                  },
                  recWeekSets > 0 && {
                    icon: 'layers-outline' as const, color: BLUE,
                    label: 'Flest set en vecka',
                    value: `${recWeekSets} set`,
                    onPress: undefined,
                  },
                ].filter(Boolean) as Array<{
                  icon: React.ComponentProps<typeof Ionicons>['name']
                  color: string; label: string; value: string; onPress?: () => void
                }>).map(r => (
                  <TouchableOpacity
                    key={r.label}
                    style={s.recCard}
                    activeOpacity={0.75}
                    disabled={!r.onPress}
                    onPress={r.onPress}
                  >
                    <View style={s.recCardTop}>
                      <View style={[s.recIconWrap, { backgroundColor: r.color + '1A' }]}>
                        <Ionicons name={r.icon} size={16} color={r.color} />
                      </View>
                      {r.onPress && <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.28)" />}
                    </View>
                    <Text style={[s.recCardVal, { color: r.color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {r.value}
                    </Text>
                    <Text style={s.recCardLbl} numberOfLines={2}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              </>
            )}

          </>
          )}
        </ScrollView>
      </GHScrollView>

      <Modal visible={!!selectedDay} animationType="none" transparent onRequestClose={() => setSelectedDay(null)}>
        {selectedDay && startDate && (
          <DayWorkoutsModal
            day={selectedDay}
            startDate={startDate}
            challengeId={challengeId}
            workouts={workouts}
            strengthWorkouts={strengthWorkouts}
            completedSessions={completedSessions}
            unit={unit}
            onClose={() => setSelectedDay(null)}
            onSelectWorkout={setSelectedWorkout}
          />
        )}
      </Modal>

      <Modal visible={!!selectedWorkout} animationType="slide" onRequestClose={() => setSelectedWorkout(null)}>
        {selectedWorkout && (
          <CardioSummaryView
            workout={selectedWorkout}
            title={selectedWorkout.name}
            dateLabel={new Date(selectedWorkout.created_at).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
            avatarUrl={avatarUrl}
            unit={unit}
            onClose={() => setSelectedWorkout(null)}
            onDelete={deleteSelectedWorkout}
          />
        )}
      </Modal>

      <DistanceDetailModal
        visible={distDetailOpen}
        onClose={() => setDistDetailOpen(false)}
        workouts={workouts}
        unit={unit}
      />

      {/* Genomförda pass — egen vy i stället för att listan ligger på fliken */}
      <Modal visible={sessionsOpen} animationType="slide" onRequestClose={() => setSessionsOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['top']}>
          <View style={s.modalTopBar}>
            <GlassCircleButton icon="chevron-back" onPress={() => setSessionsOpen(false)} />
            <Text style={s.modalTopTitle}>Genomförda pass</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <Text style={s.sessionsWeekLabel}>
              {weekBounds.label} · {weekGymSessions.length} pass
            </Text>
            {weekGymSessions.length > 0 ? (
              <View style={[s.card, s.cardPlain, { marginTop: 12 }]}>
                <View style={s.gymList}>
                  {weekGymSessions.map(gs => {
                    const gymDay    = new Date(gs.completedDate + 'T12:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
                    const exPreview = gs.exercises.slice(0, 3).join(' · ')
                      + (gs.exercises.length > 3 ? ` · +${gs.exercises.length - 3}` : '')
                    return (
                      <TouchableOpacity
                        key={gs.id}
                        style={s.gymRow}
                        activeOpacity={0.7}
                        onPress={() => {
                          const logged = strengthWorkouts.filter(w => {
                            const wDate = w.data.workout_date ?? toLocalDateString(new Date(w.created_at))
                            return wDate === gs.completedDate && gs.exercises.includes(w.data.exercise_name)
                          })
                          setGymDetail({
                            name: gs.sessionName,
                            dateLabel: new Date(gs.completedDate + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }),
                            planned: gs.exercises,
                            logged,
                          })
                        }}
                      >
                        <View style={s.gymCheck}>
                          <Ionicons name="checkmark" size={14} color={GREEN} />
                        </View>
                        <View style={s.gymInfo}>
                          <Text style={s.gymName}>{gs.sessionName}</Text>
                          {!!exPreview && <Text style={s.gymExs}>{exPreview}</Text>}
                        </View>
                        <Text style={s.gymDay}>{gymDay}</Text>
                        <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.25)" />
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            ) : (
              <View style={s.empty}>
                <Ionicons name="barbell-outline" size={40} color="rgba(255,255,255,0.12)" />
                <Text style={s.emptyText}>Inga gympass klarade vald vecka</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>

        <Modal visible={!!gymDetail} animationType="slide" onRequestClose={() => setGymDetail(null)}>
          {gymDetail && (
            <GymSummaryView
              name={gymDetail.name}
              dateLabel={gymDetail.dateLabel}
              logged={gymDetail.logged}
              plannedNames={gymDetail.planned}
              allWorkouts={strengthWorkouts}
              onClose={() => setGymDetail(null)}
            />
          )}
        </Modal>
      </Modal>

      {/* Gympassdetalj öppnad utanför Genomförda pass (t.ex. från Styrkerekord) */}
      <Modal visible={!!gymDetail && !sessionsOpen} animationType="slide" onRequestClose={() => setGymDetail(null)}>
        {gymDetail && (
          <GymSummaryView
            name={gymDetail.name}
            dateLabel={gymDetail.dateLabel}
            logged={gymDetail.logged}
            plannedNames={gymDetail.planned}
            allWorkouts={strengthWorkouts}
            onClose={() => setGymDetail(null)}
          />
        )}
      </Modal>

      {/* Alla cardiodetaljer för vald period */}
      <Modal visible={cardioDetailsOpen} animationType="slide" onRequestClose={() => setCardioDetailsOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['top']}>
          <View style={s.modalTopBar}>
            <GlassCircleButton icon="chevron-back" onPress={() => setCardioDetailsOpen(false)} />
            <Text style={s.modalTopTitle}>Träningsdetaljer</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <Text style={s.sessionsWeekLabel}>{cardioBounds.label}</Text>
            <View style={[s.card, s.cardPlain, { marginTop: 12, paddingVertical: 4 }]}>
              {([
                { label: 'Träningstid', value: fmtDuration(totalSecs), color: YELLOW },
                { label: 'Distans', value: `${toDisplayDistance(totalKm, unit).toFixed(2).replace('.', ',')} ${unitLabel}`, color: BLUE },
                { label: 'Kilokalorier', value: `${totalCals.toLocaleString('sv-SE')} kcal`, color: RED },
                { label: 'Antal pass', value: String(cardioW.length), color: GREEN },
                { label: 'Aktiva dagar', value: String(activeCardioDays), color: TEXT_PRIMARY },
                { label: 'Snittempo', value: `${avgPace} /${unitLabel}`, color: TEAL },
                { label: 'Bästa tempo', value: `${bestPace} /${unitLabel}`, color: PURPLE },
                { label: 'Snittdistans', value: `${toDisplayDistance(avgDistKm, unit).toFixed(2).replace('.', ',')} ${unitLabel}`, color: LIME },
                { label: 'Längsta pass', value: `${toDisplayDistance(longestPassKm, unit).toFixed(2).replace('.', ',')} ${unitLabel}`, color: ORANGE },
                {
                  label: 'Snittansträngning',
                  value: avgEffort > 0 ? `${avgEffort.toFixed(1).replace('.', ',')} / 10` : '–',
                  color: avgEffort > 0 ? effortColor(Math.round(avgEffort)) : TEXT_SECONDARY,
                },
              ]).map((r, i) => (
                <View key={r.label} style={[s.cdRow, i > 0 && s.cdRowBorder]}>
                  <Text style={s.cdLbl}>{r.label}</Text>
                  <Text style={[s.cdVal, { color: r.color }]}>{r.value}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <VolumeDetailModal
        visible={volumeOpen}
        onClose={() => setVolumeOpen(false)}
        workouts={strengthWorkouts}
      />

      <MuscleDetailModal
        visible={muscleOpen}
        onClose={() => setMuscleOpen(false)}
        userId={userId}
        workouts={strengthWorkouts}
        weekStart={weekBounds.start}
        weekLabel={weekBounds.label}
        day={selDayDate}
        dayLabel={selDayDate
          ? parseLocalDate(selDayDate).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
          : null}
      />

      <MilestoneAnalysisModal
        visible={milestoneOpen}
        onClose={() => setMilestoneOpen(false)}
        days={days}
        currentDay={currentDay}
        streak={streak}
        milestone={milestone}
        startDate={startDate}
        workouts={workouts}
        completedSessions={completedSessions}
        unit={unit}
      />
    </SafeAreaView>
  )
}

// ─── styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: '#4A4A50', fontSize: 14 },
  retryBtn: {
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  retryBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
  scroll:   { paddingHorizontal: GRID_PADDING, paddingTop: 16, paddingBottom: 40 + TAB_CONTENT_PAD, gap: 16 },
  header:   { paddingHorizontal: GRID_PADDING, paddingTop: 16, paddingBottom: 12 },
  title:    { color: TEXT_PRIMARY, fontSize: 28, fontWeight: '700' },
  subtitle: { color: TEXT_SECONDARY, fontSize: 14 },

  // Flikrad: text + glidande underline
  tabWrap: { marginHorizontal: GRID_PADDING, marginBottom: 6 },
  compactRow: { flexDirection: 'row' },
  compactTab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  compactLabel: {
    color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600',
  },
  compactLabelActive: { color: ORANGE, fontWeight: '700' },
  compactTrack: {
    height: 3, borderRadius: 2, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  compactIndicator: {
    width: SEG_W, height: '100%',
    backgroundColor: ORANGE, borderRadius: 2,
  },

  statsGrid: { gap: 10 },

  card:      { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 20, gap: 14 },
  // Cardio-fliken: rubriken utanför kortet (Apple Fitness) och kortet utan ram
  cardPlain: { borderWidth: 0 },
  sectionHead: {
    color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', letterSpacing: -0.4,
    marginTop: 6, marginBottom: -6,
  },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, marginBottom: -6 },
  sectionHeadInline: { marginTop: 0, marginBottom: 0 },
  cardTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  cardSub:   { color: TEXT_SECONDARY, fontSize: 12, marginTop: -8 },

  // Träningsdetaljer (Apple-stil)
  dtlRow:  { flexDirection: 'row', paddingVertical: 13 },
  dtlCell: { flex: 1, gap: 3 },
  dtlLbl:  { color: TEXT_SECONDARY, fontSize: 14 },
  dtlVal:  { fontSize: 26, fontFamily: 'Nunito_700Bold' },
  dtlUnit: { fontSize: 14, fontFamily: 'Nunito_600SemiBold' },
  dtlSep:  { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)' },
  dtlPrev: { color: TEXT_SECONDARY, fontSize: 11, fontFamily: NUM_FONT_SEMI, marginTop: 1 },

  // Set per muskelgrupp
  grpRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  grpRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  grpLbl: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '500', width: 62 },
  grpTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  grpFill: { height: '100%', borderRadius: 5, backgroundColor: ORANGE },
  grpVal: { color: TEXT_PRIMARY, fontSize: 15, fontFamily: 'Nunito_700Bold', width: 34, textAlign: 'right', fontVariant: ['tabular-nums'] as any },

  // Periodfilter (cardio-fliken)
  // Tempoutveckling
  paceChartRow: { flexDirection: 'row', alignItems: 'stretch', gap: 6 },
  paceAxis:     { justifyContent: 'space-between', paddingVertical: 6 },
  paceAxisLbl:  { color: TEXT_SECONDARY, fontSize: 10, fontFamily: NUM_FONT_SEMI, fontVariant: ['tabular-nums'] },
  paceWeekRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 36 },
  paceWeekLbl:  { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600' },

  // Sessioner-listan (Apple Fitness-stil)
  sessMonth: { color: TEXT_PRIMARY, fontSize: 20, fontFamily: 'Nunito_800ExtraBold', marginTop: 8 },
  sessRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER,
    paddingVertical: 13, paddingHorizontal: 14,
  },
  sessIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  sessName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  sessValue: { color: LIME, fontSize: 23, fontFamily: 'Nunito_700Bold', marginTop: 1 },
  sessDate: { color: TEXT_SECONDARY, fontSize: 13, alignSelf: 'flex-end', marginBottom: 4 },

  // Cardiorekord
  recScroll: { paddingHorizontal: GRID_PADDING, gap: 10, flexDirection: 'row' },
  recCard: {
    width: 130, backgroundColor: CARD, borderRadius: 18,
    padding: 14, gap: 8,
  },
  recCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recCardVal: { fontSize: 19, fontFamily: 'Nunito_700Bold', fontVariant: ['tabular-nums'] as any },
  recCardLbl: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600', lineHeight: 14 },
  recIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // Ring chart
  ringWrap: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 4 },
  ringInfo: { flex: 1, gap: 12 },
  ringDay:  { color: TEXT_PRIMARY, fontSize: 30, fontFamily: NUM_FONT },
  ringOfN:  { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
  ringRows: { gap: 8 },
  ringRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ringRowLabel: { color: TEXT_SECONDARY, fontSize: 12 },
  ringRowVal:   { fontSize: 13, fontWeight: '700' },

  // Milestone
  milestone: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: ORANGE + '14',
    borderRadius: 18, padding: 16,
  },
  msIcon:    { width: 40, height: 40, borderRadius: 12, backgroundColor: ORANGE + '20', alignItems: 'center', justifyContent: 'center' },
  msEmoji:   { fontSize: 20 },
  msBody:    { flex: 1 },
  msEyebrow: { color: ORANGE, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  msTitle:   { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '800', marginTop: 2 },
  msSub:     { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },

  // Bar chart
  distLblRow: { flexDirection: 'row', marginTop: -6 },
  distLbl: { flex: 1, textAlign: 'center', color: TEXT_SECONDARY, fontSize: 11, fontFamily: NUM_FONT_SEMI },
  barLegend: { flexDirection: 'row', gap: 16 },
  legItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legDot:    { width: 8, height: 8, borderRadius: 2 },
  legText:   { color: TEXT_SECONDARY, fontSize: 11 },

  empty:     { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 14 },

  // Gym sessions
  gymList: { gap: 0 },
  gymRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  gymCheck: {
    width: 30, height: 30,
    backgroundColor: GREEN + '18',
    borderWidth: 1, borderColor: GREEN + '35',
    borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  gymInfo: { flex: 1 },
  gymName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
  gymExs:  { color: TEXT_SECONDARY, fontSize: 11, marginTop: 2 },
  gymDay:  { color: TEXT_SECONDARY, fontSize: 12 },

  // Body map
  muscleHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  muscleAuto:          { color: TEXT_SECONDARY, fontSize: 11, marginTop: 2 },
  bodyToggle:          { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 3, gap: 2 },
  bodyToggleBtn:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  bodyToggleBtnActive: { backgroundColor: ORANGE },
  bodyToggleText:      { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  bodyToggleTextActive:{ color: '#000' },
  bodyWrap:            { alignItems: 'center', paddingVertical: 8 },
  muscleEmpty:         { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', paddingBottom: 8 },
  muscleLinkRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  muscleLinkIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: ORANGE + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  muscleLinkTitle: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  muscleLinkSub:   { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  modalTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
  },
  modalTopTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  // Tomlägen för nya användare
  tabEmpty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 12 },
  tabEmptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: ORANGE + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  tabEmptyTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '800' },
  tabEmptyText: { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  tabEmptyBtn: {
    backgroundColor: ORANGE, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 11, marginTop: 4,
  },
  tabEmptyBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
  sessionsWeekLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600', marginTop: 8 },
  cdRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 13 },
  cdRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  cdLbl: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500' },
  cdVal: { fontSize: 17, fontFamily: 'Nunito_700Bold', fontVariant: ['tabular-nums'] as any },

  // Week nav
  // Dagremsa: V-knapp + Mån–Sön
  dayStrip: { flexDirection: 'row', gap: 6 },
  dayBox: {
    flex: 1, alignItems: 'center', gap: 2,
    backgroundColor: CARD, borderRadius: 12, paddingVertical: 8,
  },
  dayBoxWeek: { flexBasis: 54, flexGrow: 0, justifyContent: 'center' },
  dayBoxActive: { backgroundColor: ORANGE },
  dayBoxLetter: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600' },
  dayBoxNum: { color: TEXT_PRIMARY, fontSize: 14, fontFamily: 'Nunito_700Bold', fontVariant: ['tabular-nums'] as any },
  dayBoxTextActive: { color: '#000' },

  // Samma pilnavigering som i Distans-detaljvyn
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekNavBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: CARD,
    alignItems: 'center', justifyContent: 'center',
  },
  weekNavLabel: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },

  legend:     { flexDirection: 'row', justifyContent: 'center', gap: 18 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: TEXT_SECONDARY, fontSize: 12 },
})
