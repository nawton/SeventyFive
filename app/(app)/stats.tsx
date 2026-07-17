import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity, Modal, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue, useAnimatedStyle, interpolate, runOnJS, Extrapolation,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'
import Svg, { Circle, Text as SvgText } from 'react-native-svg'
import { useFocusEffect } from 'expo-router'
import Body from 'react-native-body-highlighter'
import { supabase } from '@/lib/supabase'
import { getActiveChallenge, calculateCurrentDay } from '@/services/challenge'
import { getAllDays, getStreak, type DaySummary } from '@/services/dailyLog'
import { getMusclesForName, type Slug } from '@/lib/muscles'
import { getCardioWorkouts, getStrengthWorkouts, type CardioWorkout, type StrengthWorkout } from '@/services/workouts'
import { getCompletedExerciseNamesForWeek, getCompletedSessionsHistory, type CompletedSessionItem } from '@/services/workoutSchedule'
import { CalendarView } from '@/components/stats/CalendarView'
import { DayWorkoutsModal } from '@/components/stats/DayWorkoutsModal'
import { WorkoutDetail, WorkoutRow } from '@/components/stats/WorkoutDetail'
import { ORANGE, GREEN, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { toLocalDateString, weekdayOf, startOfWeek } from '@/lib/date'

const GRID_PADDING = 20
const STATS_SCREEN_W = Dimensions.get('window').width
const TAB_BAR_W = STATS_SCREEN_W - GRID_PADDING * 2
const SEG_W     = TAB_BAR_W / 3      // en flik-kolumns bredd
const BLUE   = '#4A90D9'
const RED    = '#FF453A'
const YELLOW = '#F5A623'
const PURPLE = '#9B6DFF'

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
    label: offset === 0 ? 'Denna vecka' : `${fmt(mon)} – ${fmt(sun)}`,
  }
}

function nextMilestone(day: number): { day: number; label: string; daysLeft: number } | null {
  const stones = [
    { day: 10, label: '10 dagar klara!' },
    { day: 25, label: 'En tredjedel klar!' },
    { day: 50, label: 'Halvvägs!' },
    { day: 75, label: 'MÅLET!' },
  ]
  const next = stones.find(s => s.day > day)
  if (!next) return null
  return { ...next, daysLeft: next.day - day }
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
      })
    }
    const entry = byWeek.get(key)!
    const km   = w.data.distance_km
    const type = w.data.type ?? 'running'
    if (type === 'cycling')       entry.cycle += km
    else if (type === 'walking')  entry.walk  += km
    else                          entry.run   += km
    entry.total += km
  }

  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([, v]) => v)
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

// ─── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: {
  label: string; value: string | number
  icon: React.ComponentProps<typeof Ionicons>['name']; color: string
}) {
  return (
    <View style={s.statCard}>
      <View style={[s.statIconBox, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
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
  const [days, setDays]                         = useState<DaySummary[]>([])
  const [currentDay, setCurrentDay]             = useState(1)
  const [startDate, setStartDate]               = useState<string | null>(null)
  const [levelName, setLevelName]               = useState('')
  const [workouts, setWorkouts]                 = useState<CardioWorkout[]>([])
  const [strengthWorkouts, setStrengthWorkouts] = useState<StrengthWorkout[]>([])
  const [bodyView, setBodyView]                 = useState<'front' | 'back'>('front')
  const [selectedWorkout, setSelectedWorkout]   = useState<CardioWorkout | null>(null)
  const [selectedDay, setSelectedDay]           = useState<DaySummary | null>(null)
  const [activeTab, setActiveTab]               = useState<StatsTab>('overview')
  const pagerRef = useRef<ScrollView>(null)

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

  // Svep på kroppsfiguren växlar fram/bak — gesten vinner över sid-pagern
  // inom figurens yta, resten av sidan sveper mellan flikar som vanligt
  function toggleBodyView() {
    Haptics.selectionAsync()
    setBodyView(v => (v === 'front' ? 'back' : 'front'))
  }
  const bodyFlip = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onEnd(e => {
      if (Math.abs(e.translationX) > 40 || Math.abs(e.velocityX) > 500) {
        runOnJS(toggleBodyView)()
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
  const [weekLoading, setWeekLoading]           = useState(false)
  const [weekGymSessions, setWeekGymSessions]   = useState<GymSession[]>([])

  useFocusEffect(useCallback(() => { loadStats() }, []))

  async function loadStats() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const uid = session.user.id
      setUserId(uid)
      const [challenge, cardioWos, strengthWos, sessionHistory] = await Promise.all([
        getActiveChallenge(uid),
        getCardioWorkouts(uid, 60),
        getStrengthWorkouts(uid),
        getCompletedSessionsHistory(uid).catch(() => [] as CompletedSessionItem[]),
      ])
      setWorkouts(cardioWos)
      setStrengthWorkouts(strengthWos)
      setCompletedSessions(sessionHistory)
      setLoadError(false)
      if (!challenge) return
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
    const { start, end } = getWeekBounds(weekOffset)
    Promise.all([
      getCompletedExerciseNamesForWeek(userId, start, end),
      fetchGymSessions(userId, start, end),
    ])
      .then(([names]) => setWeekExNames(names))
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

  const weekMuscleFreq = new Map<Slug, number>()
  weekExNames.forEach(name => {
    getMusclesForName(name).forEach(slug => {
      weekMuscleFreq.set(slug, (weekMuscleFreq.get(slug) || 0) + 1)
    })
  })
  const weekMuscleData = Array.from(weekMuscleFreq.entries()).map(([slug, count]) => ({
    slug,
    intensity: (count >= 4 ? 3 : count >= 2 ? 2 : 1) as 1 | 2 | 3,
  }))
  const weekBounds   = getWeekBounds(weekOffset)

  const completedDays = days.filter(d => d.status === 'completed').length
  const missedDays    = days.filter(d => d.status === 'failed').length

  const totalKm    = workouts.reduce((sum, w) => sum + w.data.distance_km, 0)
  const totalSecs  = workouts.reduce((sum, w) => sum + w.data.duration_seconds, 0)
  const totalCals  = workouts.reduce((sum, w) => sum + w.data.calories, 0)
  const pacedW     = workouts.filter(w => w.data.distance_km > 0.1)
  const bestPaceSec = pacedW
    .map(w => w.data.duration_seconds / w.data.distance_km)
    .reduce((b, p) => p < b ? p : b, Infinity)
  const pacedKm    = pacedW.reduce((s, w) => s + w.data.distance_km, 0)
  const pacedSecs  = pacedW.reduce((s, w) => s + w.data.duration_seconds, 0)
  const avgPace    = pacedKm > 0 ? fmtPace(pacedSecs / pacedKm) : '--:--'
  const bestPace   = bestPaceSec === Infinity ? '--:--' : fmtPace(bestPaceSec)

  const milestone   = nextMilestone(currentDay)
  const isEarlyDays = currentDay <= 7
  const weeklyBars  = buildWeeklyBars(workouts)
  const maxBarKm   = Math.max(...weeklyBars.map(b => b.total), 0.1)

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
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <Text style={s.title}>Framsteg</Text>
        <Text style={s.subtitle}>{levelName}</Text>
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

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
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
        >
          <>
            {/* Ring chart */}
            <View style={s.card}>
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
              <View style={s.milestone}>
                <View style={s.msIcon}><Text style={s.msEmoji}>🏔</Text></View>
                <View style={s.msBody}>
                  <Text style={s.msEyebrow}>NÄSTA MILSTOLPE</Text>
                  <Text style={s.msTitle}>Dag {milestone.day} — {milestone.label}</Text>
                  <Text style={s.msSub}>{milestone.daysLeft} dagar kvar · Du är på väg!</Text>
                </View>
              </View>
            )}

            {/* Stat row */}
            <View style={s.statsRow}>
              <StatCard label="dagar streak" value={streak}       icon="flame-outline"            color={ORANGE} />
              <StatCard label="klarade"      value={completedDays} icon="checkmark-circle-outline" color={GREEN} />
              {isEarlyDays
                ? <StatCard label="till dag 10"  value={Math.max(0, 10 - currentDay)} icon="flag-outline" color={PURPLE} />
                : <StatCard label="kvar till mål" value={Math.max(0, 75 - currentDay)} icon="flag-outline" color={PURPLE} />
              }
            </View>

            {/* Milestone — normal position dag 8+ */}
            {!isEarlyDays && milestone && (
              <View style={s.milestone}>
                <View style={s.msIcon}><Text style={s.msEmoji}>🏔</Text></View>
                <View style={s.msBody}>
                  <Text style={s.msEyebrow}>NÄSTA MILSTOLPE</Text>
                  <Text style={s.msTitle}>Dag {milestone.day} — {milestone.label}</Text>
                  <Text style={s.msSub}>{milestone.daysLeft} dagar kvar · Håll ut</Text>
                </View>
              </View>
            )}

            {/* Calendar */}
            <CalendarView
              days={days}
              startDate={startDate}
              currentDay={currentDay}
              onPressDay={setSelectedDay}
            />
          </>
        </ScrollView>

        {/* ── CARDIO ── */}
        <ScrollView
          style={{ width: STATS_SCREEN_W }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          <>
            <View style={s.statsGrid}>
              <View style={s.statsRow}>
                <StatCard label="km totalt"  value={totalKm.toFixed(1)}       icon="map-outline"   color={ORANGE} />
                <StatCard label="total tid"  value={fmtDuration(totalSecs)}    icon="time-outline"  color={BLUE} />
                <StatCard label="pass"       value={workouts.length}           icon="walk-outline"  color={GREEN} />
              </View>
              <View style={s.statsRow}>
                <StatCard label="snittempo"   value={avgPace}                          icon="speedometer-outline" color={YELLOW} />
                <StatCard label="bästa tempo" value={bestPace}                         icon="stopwatch-outline"   color={RED} />
                <StatCard label="kcal"        value={totalCals.toLocaleString('sv-SE')} icon="flash-outline"      color={PURPLE} />
              </View>
            </View>

            {/* Stacked bar chart */}
            {weeklyBars.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Km per vecka</Text>
                <View style={s.barChart}>
                  {weeklyBars.map((bar, i) => (
                    <View key={i} style={s.barRow}>
                      <Text style={[s.barWkLbl, bar.isCurrent && { color: ORANGE }]}>{bar.label}</Text>
                      <View style={s.barTrack}>
                        {bar.run > 0 && (
                          <View style={[s.barSeg, {
                            width: `${(bar.run / maxBarKm) * 100}%` as any,
                            backgroundColor: ORANGE,
                            opacity: bar.isCurrent ? 0.5 : 1,
                          }]} />
                        )}
                        {bar.cycle > 0 && (
                          <View style={[s.barSeg, {
                            width: `${(bar.cycle / maxBarKm) * 100}%` as any,
                            backgroundColor: BLUE,
                            opacity: bar.isCurrent ? 0.5 : 1,
                          }]} />
                        )}
                        {bar.walk > 0 && (
                          <View style={[s.barSeg, {
                            width: `${(bar.walk / maxBarKm) * 100}%` as any,
                            backgroundColor: GREEN,
                            opacity: bar.isCurrent ? 0.5 : 1,
                          }]} />
                        )}
                      </View>
                      <Text style={[s.barKmLbl, bar.isCurrent && { color: ORANGE }]}>
                        {bar.total.toFixed(1)}
                      </Text>
                    </View>
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
              </View>
            )}

            {/* Recent workouts */}
            {workouts.length > 0 ? (
              <View style={s.card}>
                <Text style={s.cardTitle}>Senaste pass</Text>
                {workouts.slice(0, 10).map((w, i) => (
                  <WorkoutRow
                    key={w.id}
                    workout={w}
                    last={i === Math.min(workouts.length, 10) - 1}
                    onPress={() => setSelectedWorkout(w)}
                  />
                ))}
              </View>
            ) : (
              <View style={s.empty}>
                <Ionicons name="walk-outline" size={40} color="rgba(255,255,255,0.12)" />
                <Text style={s.emptyText}>Inga cardio-pass sparade ännu</Text>
              </View>
            )}
          </>
        </ScrollView>

        {/* ── GYMPASS ── */}
        <ScrollView
          style={{ width: STATS_SCREEN_W }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          <>
            <View style={s.statsRow}>
              <StatCard label="pass denna vecka"   value={weekGymSessions.length} icon="barbell-outline"          color={ORANGE} />
              <StatCard label="muskelgrupper"       value={weekMuscleFreq.size}    icon="body-outline"             color={PURPLE} />
              <StatCard label="övningar totalt"     value={weekExNames.length}     icon="checkmark-circle-outline" color={GREEN} />
            </View>

            {/* Week nav */}
            <View style={s.weekNav}>
              <TouchableOpacity style={s.weekNavBtn} onPress={() => setWeekOffset(o => o - 1)} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={22} color={TEXT_PRIMARY} />
              </TouchableOpacity>
              <Text style={s.weekNavLabel}>{weekBounds.label}</Text>
              <TouchableOpacity
                style={[s.weekNavBtn, weekOffset >= 0 && s.weekNavBtnDisabled]}
                onPress={() => setWeekOffset(o => o + 1)}
                disabled={weekOffset >= 0}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={22} color={weekOffset >= 0 ? 'rgba(255,255,255,0.18)' : TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>

            {/* Body map */}
            <View style={s.card}>
              <View style={s.muscleHeader}>
                <View>
                  <Text style={s.cardTitle}>Tränade muskler</Text>
                  <Text style={s.muscleAuto}>Automatisk från schema</Text>
                </View>
                <View style={s.bodyToggle}>
                  {(['front', 'back'] as const).map(side => (
                    <TouchableOpacity
                      key={side}
                      style={[s.bodyToggleBtn, bodyView === side && s.bodyToggleBtnActive]}
                      onPress={() => setBodyView(side)}
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
                    <View style={s.bodyWrap}>
                      <Body
                        data={weekMuscleData}
                        side={bodyView}
                        gender="male"
                        scale={1.6}
                        colors={[BLUE, YELLOW, ORANGE]}
                        defaultFill="#2A2A2C"
                        border="rgba(255,255,255,0.10)"
                      />
                    </View>
                  </GestureDetector>
                  {weekMuscleData.length > 0 && (
                    <View style={s.legend}>
                      {([
                        { color: BLUE,   label: 'Lite (1×)' },
                        { color: YELLOW, label: 'Medel (2–3×)' },
                        { color: ORANGE, label: 'Mycket (4×+)' },
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

              {!weekLoading && weekExNames.length === 0 && (
                <Text style={s.muscleEmpty}>
                  {weekOffset === 0 ? 'Inga avklarade övningar denna vecka' : 'Inga avklarade övningar vald vecka'}
                </Text>
              )}

            </View>

            {/* Completed gym sessions */}
            {weekLoading ? (
              <ActivityIndicator color={ORANGE} style={{ marginVertical: 16 }} />
            ) : weekGymSessions.length > 0 ? (
              <View style={s.card}>
                <Text style={s.cardTitle}>Genomförda pass</Text>
                <View style={s.gymList}>
                  {weekGymSessions.map(gs => {
                    const gymDay    = new Date(gs.completedDate + 'T12:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
                    const exPreview = gs.exercises.slice(0, 3).join(' · ')
                      + (gs.exercises.length > 3 ? ` · +${gs.exercises.length - 3}` : '')
                    return (
                      <View key={gs.id} style={s.gymRow}>
                        <View style={s.gymCheck}>
                          <Ionicons name="checkmark" size={14} color={GREEN} />
                        </View>
                        <View style={s.gymInfo}>
                          <Text style={s.gymName}>{gs.sessionName}</Text>
                          {!!exPreview && <Text style={s.gymExs}>{exPreview}</Text>}
                        </View>
                        <Text style={s.gymDay}>{gymDay}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            ) : (
              <View style={s.empty}>
                <Ionicons name="barbell-outline" size={40} color="rgba(255,255,255,0.12)" />
                <Text style={s.emptyText}>Inga gympass klarade denna vecka</Text>
              </View>
            )}

          </>
        </ScrollView>
      </ScrollView>

      <Modal visible={!!selectedDay} animationType="none" transparent onRequestClose={() => setSelectedDay(null)}>
        {selectedDay && startDate && (
          <DayWorkoutsModal
            day={selectedDay}
            startDate={startDate}
            workouts={workouts}
            strengthWorkouts={strengthWorkouts}
            completedSessions={completedSessions}
            onClose={() => setSelectedDay(null)}
            onSelectWorkout={setSelectedWorkout}
          />
        )}
      </Modal>

      <Modal visible={!!selectedWorkout} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedWorkout(null)}>
        {selectedWorkout && (
          <WorkoutDetail
            workout={selectedWorkout}
            allWorkouts={workouts}
            onClose={() => setSelectedWorkout(null)}
            onDeleted={id => setWorkouts(prev => prev.filter(w => w.id !== id))}
          />
        )}
      </Modal>
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
  scroll:   { paddingHorizontal: GRID_PADDING, paddingTop: 16, paddingBottom: 40, gap: 16 },
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
  statsRow:  { flexDirection: 'row', gap: 10 },
  statCard:  { flex: 1, backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 14, alignItems: 'center', gap: 6 },
  statIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800' },
  statLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '500', textAlign: 'center' },

  card:      { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 20, gap: 14 },
  cardTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },

  // Ring chart
  ringWrap: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 4 },
  ringInfo: { flex: 1, gap: 12 },
  ringDay:  { color: TEXT_PRIMARY, fontSize: 30, fontWeight: '900' },
  ringOfN:  { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
  ringRows: { gap: 8 },
  ringRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ringRowLabel: { color: TEXT_SECONDARY, fontSize: 12 },
  ringRowVal:   { fontSize: 13, fontWeight: '700' },

  // Milestone
  milestone: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: ORANGE + '12',
    borderWidth: 1, borderColor: ORANGE + '35',
    borderRadius: 18, padding: 16,
  },
  msIcon:    { width: 40, height: 40, borderRadius: 12, backgroundColor: ORANGE + '20', alignItems: 'center', justifyContent: 'center' },
  msEmoji:   { fontSize: 20 },
  msBody:    { flex: 1 },
  msEyebrow: { color: ORANGE, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  msTitle:   { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '800', marginTop: 2 },
  msSub:     { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },

  // Bar chart
  barChart:  { gap: 8 },
  barRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barWkLbl:  { width: 26, fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', fontVariant: ['tabular-nums'] as any },
  barTrack:  { flex: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden', flexDirection: 'row' },
  barSeg:    { height: '100%' },
  barKmLbl:  { width: 34, fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right', fontVariant: ['tabular-nums'] as any },
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

  // Week nav
  weekNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 8, paddingVertical: 6,
  },
  weekNavBtn:         { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  weekNavBtnDisabled: { opacity: 0.35 },
  weekNavLabel:       { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },

  legend:     { flexDirection: 'row', justifyContent: 'center', gap: 18 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: TEXT_SECONDARY, fontSize: 12 },
})
