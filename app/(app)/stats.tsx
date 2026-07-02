import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import Body from 'react-native-body-highlighter'
import { supabase } from '@/lib/supabase'
import { getActiveChallenge, calculateCurrentDay } from '@/services/challenge'
import { getAllDays, type DaySummary } from '@/services/dailyLog'
import { getMusclesForName, type Slug } from '@/lib/muscles'
import { getCardioWorkouts, getStrengthWorkouts, type CardioWorkout, type StrengthWorkout } from '@/services/workouts'
import { getCompletedExerciseNamesForWeek } from '@/services/workoutSchedule'
import { CalendarView } from '@/components/stats/CalendarView'
import { DayWorkoutsModal } from '@/components/stats/DayWorkoutsModal'
import { WorkoutDetail, WorkoutRow } from '@/components/stats/WorkoutDetail'
import { WeeklyGraph } from '@/components/stats/WeeklyGraph'
import { ORANGE, GREEN, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

const GRID_PADDING = 20

function getWeekBounds(offset: number): { start: string; end: string; label: string } {
  const today = new Date()
  const dow   = today.getDay() || 7                      // 1=Mån … 7=Sön
  const mon   = new Date(today)
  mon.setDate(today.getDate() - dow + 1 + offset * 7)
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
  return {
    start: mon.toISOString().split('T')[0],
    end:   sun.toISOString().split('T')[0],
    label: offset === 0 ? 'Denna vecka' : `${fmt(mon)} – ${fmt(sun)}`,
  }
}

type StatsTab = 'overview' | 'cardio' | 'styrka'
const TABS: Array<{ key: StatsTab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'overview', label: 'Översikt', icon: 'grid-outline' },
  { key: 'cardio',   label: 'Cardio',   icon: 'walk-outline' },
  { key: 'styrka',   label: 'Styrka',   icon: 'barbell-outline' },
]

function fmtPace(secsPerKm: number): string {
  const m = Math.floor(secsPerKm / 60)
  const s = Math.floor(secsPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function calculateStreak(days: DaySummary[], currentDay: number): number {
  let streak = 0
  for (let i = currentDay - 1; i >= 1; i--) {
    if (days[i - 1]?.status === 'completed') streak++
    else break
  }
  return streak
}

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
  const [loading, setLoading]                   = useState(true)
  const [userId, setUserId]                     = useState<string | null>(null)
  const [weekOffset, setWeekOffset]             = useState(0)
  const [weekExNames, setWeekExNames]           = useState<string[]>([])
  const [weekLoading, setWeekLoading]           = useState(false)
  const [viewMode, setViewMode]                 = useState<'week' | '4weeks'>('week')

  useFocusEffect(useCallback(() => { loadStats() }, []))

  async function loadStats() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const uid = session.user.id
      setUserId(uid)
      const [challenge, cardioWorkouts, strengthWos] = await Promise.all([
        getActiveChallenge(uid),
        getCardioWorkouts(uid),
        getStrengthWorkouts(uid),
      ])
      setWorkouts(cardioWorkouts)
      setStrengthWorkouts(strengthWos)
      if (!challenge) return
      setStartDate(challenge.start_date)
      const day = calculateCurrentDay(challenge.start_date)
      setCurrentDay(day)
      setLevelName(challenge.challenge_levels?.display_name ?? '')
      const allDays = await getAllDays(challenge.id, day)
      setDays(allDays)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!userId) return
    setWeekLoading(true)
    let start: string, end: string
    if (viewMode === '4weeks') {
      const today = new Date()
      const from  = new Date(today)
      from.setDate(today.getDate() - 27)
      end   = today.toISOString().split('T')[0]
      start = from.toISOString().split('T')[0]
    } else {
      ;({ start, end } = getWeekBounds(weekOffset))
    }
    getCompletedExerciseNamesForWeek(userId, start, end)
      .then(setWeekExNames)
      .finally(() => setWeekLoading(false))
  }, [userId, weekOffset, viewMode])

  // Muscle frequency for selected week (based on completed scheduled exercises)
  const weekMuscleFreq = new Map<Slug, number>()
  weekExNames.forEach(name => {
    getMusclesForName(name).forEach(slug => {
      weekMuscleFreq.set(slug, (weekMuscleFreq.get(slug) || 0) + 1)
    })
  })
  const maxMuscleCount = Math.max(0, ...weekMuscleFreq.values())
  const weekMuscleData = Array.from(weekMuscleFreq.entries()).map(([slug, count]) => {
    const ratio = maxMuscleCount > 0 ? count / maxMuscleCount : 0
    const intensity = (ratio >= 0.66 ? 3 : ratio >= 0.33 ? 2 : 1) as 1 | 2 | 3
    return { slug, intensity }
  })
  const weekBounds = getWeekBounds(weekOffset)
  const weekUniqueEx = Array.from(new Set(weekExNames))

  const completedDays = days.filter(d => d.status === 'completed').length
  const streak        = calculateStreak(days, currentDay)
  const totalKm       = workouts.reduce((sum, w) => sum + w.data.distance_km, 0)
  const totalCals     = workouts.reduce((sum, w) => sum + w.data.calories, 0)
  const bestPaceSec   = workouts
    .filter(w => w.data.distance_km > 0.1)
    .map(w => w.data.duration_seconds / w.data.distance_km)
    .reduce((best, p) => (p < best ? p : best), Infinity)
  const bestPace = bestPaceSec === Infinity ? '--:--' : fmtPace(bestPaceSec)

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: BG }]}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <Text style={s.title}>Framsteg</Text>
        <Text style={s.subtitle}>{levelName}</Text>
      </View>

      <View style={s.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? '#000' : TEXT_SECONDARY} />
            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── ÖVERSIKT ── */}
        {activeTab === 'overview' && (
          <>
            <View style={s.statsRow}>
              <StatCard label="Dag"     value={`${currentDay}/75`} icon="calendar-outline"        color={ORANGE} />
              <StatCard label="Klarade" value={completedDays}       icon="checkmark-circle-outline" color={GREEN} />
              <StatCard label="Streak"  value={`${streak}`}         icon="flame-outline"            color="#FF6B35" />
            </View>

            <CalendarView
              days={days}
              startDate={startDate}
              currentDay={currentDay}
              onPressDay={setSelectedDay}
            />

            <View style={s.card}>
              <View style={s.progressHeader}>
                <Text style={s.cardTitle}>Total framgång</Text>
                <Text style={s.progressPercent}>
                  {currentDay > 1 ? Math.round((completedDays / (currentDay - 1)) * 100) : 0}%
                </Text>
              </View>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${(completedDays / 75) * 100}%` }]} />
              </View>
              <Text style={s.progressCaption}>{completedDays} av 75 dagar klarade</Text>
            </View>
          </>
        )}

        {/* ── CARDIO ── */}
        {activeTab === 'cardio' && (
          <>
            <View style={s.statsRow}>
              {[
                { icon: 'map-outline' as const,      value: totalKm.toFixed(1),               label: 'km totalt',   color: ORANGE },
                { icon: 'flash-outline' as const,     value: totalCals.toLocaleString('sv-SE'), label: 'kcal',        color: '#7C5CBF' },
                { icon: 'stopwatch-outline' as const, value: bestPace,                          label: 'bästa tempo', color: GREEN },
              ].map(stat => (
                <View key={stat.label} style={s.statCard}>
                  <View style={[s.statIconBox, { backgroundColor: stat.color + '22' }]}>
                    <Ionicons name={stat.icon} size={18} color={stat.color} />
                  </View>
                  <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={s.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {workouts.length > 0 ? (
              <>
                <WeeklyGraph workouts={workouts} />
                <View style={s.card}>
                  <Text style={s.cardTitle}>Senaste träningar</Text>
                  {workouts.slice(0, 10).map((w, i) => (
                    <WorkoutRow
                      key={w.id}
                      workout={w}
                      last={i === Math.min(workouts.length, 10) - 1}
                      onPress={() => setSelectedWorkout(w)}
                    />
                  ))}
                </View>
              </>
            ) : (
              <View style={s.empty}>
                <Ionicons name="walk-outline" size={40} color="rgba(255,255,255,0.12)" />
                <Text style={s.emptyText}>Inga cardio-pass sparade ännu</Text>
              </View>
            )}
          </>
        )}

        {/* ── STYRKA ── */}
        {activeTab === 'styrka' && (
          <>
            {/* Mode selector */}
            <View style={s.modeBar}>
              {(['week', '4weeks'] as const).map(mode => (
                <TouchableOpacity
                  key={mode}
                  style={[s.modeBtn, viewMode === mode && s.modeBtnActive]}
                  onPress={() => { setViewMode(mode); setWeekOffset(0) }}
                  activeOpacity={0.75}
                >
                  <Text style={[s.modeBtnText, viewMode === mode && s.modeBtnTextActive]}>
                    {mode === 'week' ? 'Vecka' : '4 veckor'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Week navigator — only in 'week' mode */}
            {viewMode === 'week' && (
              <View style={s.weekNav}>
                <TouchableOpacity
                  style={s.weekNavBtn}
                  onPress={() => setWeekOffset(o => o - 1)}
                  activeOpacity={0.7}
                >
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
            )}

            {/* Week stats */}
            <View style={s.statsRow}>
              <View style={s.statCard}>
                <View style={[s.statIconBox, { backgroundColor: ORANGE + '22' }]}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={ORANGE} />
                </View>
                <Text style={[s.statValue, { color: ORANGE }]}>{weekExNames.length}</Text>
                <Text style={s.statLabel}>avklarade</Text>
              </View>
              <View style={s.statCard}>
                <View style={[s.statIconBox, { backgroundColor: GREEN + '22' }]}>
                  <Ionicons name="barbell-outline" size={18} color={GREEN} />
                </View>
                <Text style={[s.statValue, { color: GREEN }]}>{weekUniqueEx.length}</Text>
                <Text style={s.statLabel}>unika övningar</Text>
              </View>
              <View style={s.statCard}>
                <View style={[s.statIconBox, { backgroundColor: '#7C5CBF22' }]}>
                  <Ionicons name="body-outline" size={18} color="#7C5CBF" />
                </View>
                <Text style={[s.statValue, { color: '#7C5CBF' }]}>{weekMuscleFreq.size}</Text>
                <Text style={s.statLabel}>muskelgrupper</Text>
              </View>
            </View>

            {/* Muscle map */}
            <View style={s.card}>
              <View style={s.muscleHeader}>
                <Text style={s.cardTitle}>Tränade muskler</Text>
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
                <View style={s.bodyWrap}>
                  <ActivityIndicator color={ORANGE} />
                </View>
              ) : (
                <>
                  <View style={s.bodyWrap}>
                    <Body
                      data={weekMuscleData}
                      side={bodyView}
                      gender="male"
                      scale={1.6}
                      colors={['#4A90D9', '#F5A623', ORANGE]}
                      defaultFill="#2A2A2C"
                      border="rgba(255,255,255,0.10)"
                    />
                  </View>
                  {weekMuscleData.length > 0 && (
                    <View style={s.legend}>
                      {([
                        { color: '#4A90D9', label: 'Lite (1×)' },
                        { color: '#F5A623', label: 'Medel (2–3×)' },
                        { color: ORANGE,    label: 'Mycket (4×+)' },
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
                  {viewMode === '4weeks'
                    ? 'Inga avklarade övningar de senaste 4 veckorna'
                    : weekOffset === 0 ? 'Inga avklarade övningar denna vecka' : 'Inga avklarade övningar vald vecka'}
                </Text>
              )}

              {/* Exercise chips */}
              {weekUniqueEx.length > 0 && (
                <View style={s.exChips}>
                  {weekUniqueEx.map(name => (
                    <View key={name} style={s.exChip}>
                      <Text style={s.exChipText} numberOfLines={1}>{name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Day workouts modal */}
      <Modal visible={!!selectedDay} animationType="none" transparent onRequestClose={() => setSelectedDay(null)}>
        {selectedDay && startDate && (
          <DayWorkoutsModal
            day={selectedDay}
            startDate={startDate}
            workouts={workouts}
            strengthWorkouts={strengthWorkouts}
            onClose={() => setSelectedDay(null)}
            onSelectWorkout={setSelectedWorkout}
          />
        )}
      </Modal>

      {/* Cardio workout detail */}
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

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:   { paddingHorizontal: GRID_PADDING, paddingTop: 16, paddingBottom: 40, gap: 20 },
  header:   { paddingHorizontal: GRID_PADDING, paddingTop: 16, paddingBottom: 12 },
  title:    { color: TEXT_PRIMARY, fontSize: 28, fontWeight: '700' },
  subtitle: { color: TEXT_SECONDARY, fontSize: 14 },

  tabBar: {
    flexDirection: 'row', marginHorizontal: GRID_PADDING, marginBottom: 4,
    backgroundColor: CARD, borderRadius: 16, padding: 4,
    borderWidth: 1, borderColor: BORDER, gap: 4,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12,
  },
  tabActive:     { backgroundColor: ORANGE },
  tabText:       { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#000', fontWeight: '700' },

  statsRow:  { flexDirection: 'row', gap: 10 },
  statCard:  { flex: 1, backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 14, alignItems: 'center', gap: 6 },
  statIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800' },
  statLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '500', textAlign: 'center' },

  card:      { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 20, gap: 16 },
  cardTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },

  progressHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressPercent: { color: ORANGE, fontSize: 16, fontWeight: '700' },
  progressTrack:   { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  progressFill:    { height: '100%', backgroundColor: GREEN, borderRadius: 4 },
  progressCaption: { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center' },

  empty:     { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 14 },

  muscleHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bodyToggle:          { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 3, gap: 2 },
  bodyToggleBtn:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  bodyToggleBtnActive: { backgroundColor: ORANGE },
  bodyToggleText:      { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  bodyToggleTextActive:{ color: '#000' },
  bodyWrap:            { alignItems: 'center', paddingVertical: 8 },
  muscleEmpty:         { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', paddingBottom: 8 },

  modeBar: {
    flexDirection: 'row',
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    padding: 4, gap: 4,
  },
  modeBtn:         { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  modeBtnActive:   { backgroundColor: ORANGE },
  modeBtnText:     { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600' },
  modeBtnTextActive: { color: '#000', fontWeight: '700' },

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

  exChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exChip:  {
    backgroundColor: ORANGE + '18', borderRadius: 20,
    borderWidth: 1, borderColor: ORANGE + '44',
    paddingHorizontal: 10, paddingVertical: 5,
    maxWidth: 160,
  },
  exChipText: { color: ORANGE, fontSize: 12, fontWeight: '600' },
})
