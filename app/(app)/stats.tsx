import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity, Modal, Dimensions, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SafeScreen } from '@/components/SafeScreen'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue, useAnimatedStyle, interpolate, runOnJS, Extrapolation,
  withTiming, withSpring, Easing, LinearTransition, FadeOut,
} from 'react-native-reanimated'
import { Gesture, GestureDetector, ScrollView as GHScrollView, type GestureType } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'
import { useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { getActiveChallenge, calculateCurrentDay } from '@/services/challenge'
import { getAllDays, getStreak, type DaySummary } from '@/services/dailyLog'
import { getCardioWorkouts, getStrengthWorkouts, type CardioWorkout, type StrengthWorkout } from '@/services/workouts'
import { getCompletedSessionsHistory, deleteCompletion, type CompletedSessionItem } from '@/services/workoutSchedule'
import { CardioSummaryView } from '@/components/CardioSummaryView'
import {
  GRID_PADDING, STATS_SCREEN_W, BLUE, RED, YELLOW, PURPLE, TEAL, LIME,
  getWeekBounds, monthLabel, sessDateLabel, s, type GymSession,
  useStatsColors,
} from '@/components/stats/statsShared'
import { AppRefreshControl, useAppRefresh } from '@/components/AppRefresh'
import { GymTab } from '@/components/stats/GymTab'
import { CardioTab } from '@/components/stats/CardioTab'
import { OverviewTab } from '@/components/stats/OverviewTab'
import { getProfile } from '@/services/profile'
import { getUnitSystem, distanceUnitLabel, type UnitSystem } from '@/lib/units'
import { deleteCardioWorkout } from '@/services/workouts'
import { BG, ACCENT, useThemeStrings } from '@/lib/theme'
import { toLocalDateString } from '@/lib/date'
import { useTabBarShrinkOnScroll } from '@/lib/tabBar'

const TAB_BAR_W = STATS_SCREEN_W - GRID_PADDING * 2
const SEG_W     = TAB_BAR_W / 3      // en flik-kolumns bredd



// ─── StatsScreen ───────────────────────────────────────────────────────────────

type StatsTab = 'overview' | 'cardio' | 'gympass'
const TABS: Array<{ key: StatsTab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'overview', label: 'Översikt', icon: 'grid-outline' },
  { key: 'cardio',   label: 'Cardio',   icon: 'walk-outline' },
  { key: 'gympass',  label: 'Gympass',  icon: 'barbell-outline' },
]

export default function StatsScreen() {
  const P = useStatsColors()
  const T = useThemeStrings()
  const onScrollShrink = useTabBarShrinkOnScroll()
  // SafeAreaView rapporterar noll-insets inne i RN-modaler — använd explicit padding
  const insets = useSafeAreaInsets()

  // Dra ner för att uppdatera — appens gemensamma spinner, samma i alla flikar
  const [reloadToken, setReloadToken] = useState(0)
  const { refreshing: statsRefreshing, onRefresh: refreshStats } = useAppRefresh(async () => {
    setReloadToken(t => t + 1)
    await Promise.resolve(loadStats())
  })
  function onTabScroll(e: { nativeEvent: { contentOffset: { y: number } } }) {
    onScrollShrink(e as never)
  }
  const [days, setDays]                         = useState<DaySummary[]>([])
  const [currentDay, setCurrentDay]             = useState(1)
  const [startDate, setStartDate]               = useState<string | null>(null)
  const [challengeId, setChallengeId]           = useState<string | null>(null)
  const [levelName, setLevelName]               = useState('')
  const [workouts, setWorkouts]                 = useState<CardioWorkout[]>([])
  const [strengthWorkouts, setStrengthWorkouts] = useState<StrengthWorkout[]>([])
  const [selectedWorkout, setSelectedWorkout]   = useState<CardioWorkout | null>(null)
  const [activeTab, setActiveTab]               = useState<StatsTab>('overview')
  const [unit, setUnit]                         = useState<UnitSystem>('metric')
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




  const unitLabel  = distanceUnitLabel(unit)









  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: BG }]}>
        <ActivityIndicator color={ACCENT} size="large" />
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
    <SafeScreen style={s.screen} edges={['top']}>
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
            <Animated.View style={[s.compactIndicator, { backgroundColor: T.ACCENT }, indicatorStyle]} />
          </View>
        </View>
      </GestureDetector>

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
        <OverviewTab
          days={days}
          startDate={startDate}
          challengeId={challengeId}
          currentDay={currentDay}
          streak={streak}
          workouts={workouts}
          strengthWorkouts={strengthWorkouts}
          completedSessions={completedSessions}
          unit={unit}
          avatarUrl={avatarUrl}
          calSwipeRef={calSwipeRef}
          onTabScroll={onTabScroll}
          refreshControl={<AppRefreshControl refreshing={statsRefreshing} onRefresh={refreshStats} />}
          onOpenWorkout={setSelectedWorkout}
          onRemoveWorkoutLocal={id => setWorkouts(prev => prev.filter(w => w.id !== id))}
        />

        {/* ── CARDIO ── */}
        <CardioTab
          workouts={workouts}
          completedSessions={completedSessions}
          unit={unit}
          pagerRef={pagerRef}
          onTabScroll={onTabScroll}
          refreshControl={<AppRefreshControl refreshing={statsRefreshing} onRefresh={refreshStats} />}
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
          refreshControl={<AppRefreshControl refreshing={statsRefreshing} onRefresh={refreshStats} />}
          onDeleteCompletion={handleDeleteCompletion}
        />
      </GHScrollView>


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







    </SafeScreen>
  )
}

// ─── styles ────────────────────────────────────────────────────────────────────
