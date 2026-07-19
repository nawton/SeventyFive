import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity, Modal, Dimensions, Alert,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue, useAnimatedStyle, interpolate, runOnJS, Extrapolation,
  withTiming, withSpring, Easing, LinearTransition, FadeOut,
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
import { getCompletedExerciseNamesForWeek, getCompletedExerciseNamesByDay, getCompletedSessionsHistory, deleteCompletion, type CompletedSessionItem } from '@/services/workoutSchedule'
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
import {
  GRID_PADDING, STATS_SCREEN_W, BLUE, RED, YELLOW, PURPLE, TEAL, LIME,
  getWeekBounds, monthLabel, sessDateLabel, s, type GymSession,
} from '@/components/stats/statsShared'
import { SwipeRow } from '@/components/stats/SwipeRow'
import { GymTab } from '@/components/stats/GymTab'
import { CardioTab } from '@/components/stats/CardioTab'
import { getProfile } from '@/services/profile'
import { getUnitSystem, toDisplayDistance, distanceUnitLabel, paceForUnit, type UnitSystem } from '@/lib/units'
import { deleteCardioWorkout } from '@/services/workouts'
import { ORANGE, GREEN, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, NUM_FONT_SEMI } from '@/lib/theme'
import { toLocalDateString, parseLocalDate, weekdayOf, startOfWeek, isoWeekNum } from '@/lib/date'
import { fmtPace, fmtDuration } from '@/lib/format'
import { TAB_CONTENT_PAD } from '@/lib/glass'
import { useTabBarShrinkOnScroll } from '@/lib/tabBar'

const TAB_BAR_W = STATS_SCREEN_W - GRID_PADDING * 2
const SEG_W     = TAB_BAR_W / 3      // en flik-kolumns bredd

// ─── helpers ──────────────────────────────────────────────────────────────────

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

// ─── weekly bar data ───────────────────────────────────────────────────────────


// ─── Sessioner-listan ──────────────────────────────────────────────────────────

// ─── GymSession ────────────────────────────────────────────────────────────────


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
  // SafeAreaView rapporterar noll-insets inne i RN-modaler — använd explicit padding
  const insets = useSafeAreaInsets()

  // Dra ner för att uppdatera — samma overscroll-mönster som profilen
  const [statsRefreshing, setStatsRefreshing] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
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
    setReloadToken(t => t + 1)
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
  const [selectedWorkout, setSelectedWorkout]   = useState<CardioWorkout | null>(null)
  const [selectedDay, setSelectedDay]           = useState<DaySummary | null>(null)
  const [activeTab, setActiveTab]               = useState<StatsTab>('overview')
  const [unit, setUnit]                         = useState<UnitSystem>('metric')
  const [milestoneOpen, setMilestoneOpen]       = useState(false)
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
        setWorkouts(prev => prev.filter(x => x.id !== w.id))
        setSelectedWorkout(null)
        const ok = await deleteCardioWorkout(w.id).catch(() => false)
        if (!ok) {
          Alert.alert('Kunde inte radera', 'Kontrollera din uppkoppling och försök igen.')
          loadStats()
        }
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

  const bodyFlipRef = useRef<GestureType | undefined>(undefined)
  const calSwipeRef = useRef<GestureType | undefined>(undefined)

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



  // Cardioflikens passraderingar — optimistiskt med återställning vid fel
  function handleDeleteWorkout(id: string) {
    setWorkouts(prev => prev.filter(w => w.id !== id))
    const restore = () => {
      Alert.alert('Kunde inte radera', 'Kontrollera din uppkoppling och försök igen.')
      loadStats()
    }
    deleteCardioWorkout(id).then(ok => { if (!ok) restore() }).catch(restore)
  }

  // Avbockningsraderingar (gym + cardio-schemapass) — skalet äger listan + db
  async function handleDeleteCompletion(id: string): Promise<boolean> {
    setCompletedSessions(prev => prev.filter(c => c.id !== id))
    try {
      await deleteCompletion(id)
      return true
    } catch {
      Alert.alert('Kunde inte radera', 'Kontrollera din uppkoppling och försök igen.')
      loadStats()
      return false
    }
  }

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
        // Rekord och detaljvyer räknar på hela historiken — snåla inte här
        getCardioWorkouts(uid, 1000),
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




  // ── derived ────────────────────────────────────────────────────────────────


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



  const milestone   = nextMilestone(Math.max(0, currentDay - 1))
  const isEarlyDays = currentDay <= 7






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
              <View style={s.dtlSep} />
              <View style={[s.dtlRow, { paddingBottom: 0 }]}>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Dagar i streak</Text>
                  <Text style={[s.dtlVal, { color: '#FF6B35' }]}>{streak}</Text>
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
        <CardioTab
          workouts={workouts}
          completedSessions={completedSessions}
          unit={unit}
          pagerRef={pagerRef}
          onTabScroll={onTabScroll}
          onTabScrollEnd={onTabScrollEnd}
          onOpenWorkout={setSelectedWorkout}
          onDeleteWorkout={handleDeleteWorkout}
          onDeleteCompletion={handleDeleteCompletion}
        />

        {/* ── GYMPASS ── */}
        <GymTab
          userId={userId}
          strengthWorkouts={strengthWorkouts}
          completedSessions={completedSessions}
          reloadToken={reloadToken}
          bodyFlipRef={bodyFlipRef}
          onTabScroll={onTabScroll}
          onTabScrollEnd={onTabScrollEnd}
          onDeleteCompletion={handleDeleteCompletion}
        />
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
