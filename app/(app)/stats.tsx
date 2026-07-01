import { useCallback, useState } from 'react'
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
import { CalendarView } from '@/components/stats/CalendarView'
import { DayWorkoutsModal } from '@/components/stats/DayWorkoutsModal'
import { WorkoutDetail, WorkoutRow } from '@/components/stats/WorkoutDetail'
import { WeeklyGraph } from '@/components/stats/WeeklyGraph'
import { ORANGE, GREEN, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

const GRID_PADDING = 20

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

  useFocusEffect(useCallback(() => { loadStats() }, []))

  async function loadStats() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const [challenge, cardioWorkouts, strengthWos] = await Promise.all([
        getActiveChallenge(session.user.id),
        getCardioWorkouts(session.user.id),
        getStrengthWorkouts(session.user.id),
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

  // Muscle frequency map for the body highlighter
  const muscleFreq = new Map<Slug, number>()
  for (const w of strengthWorkouts) {
    getMusclesForName(w.name).forEach(slug => {
      muscleFreq.set(slug, (muscleFreq.get(slug) || 0) + 1)
    })
  }
  const muscleData = Array.from(muscleFreq.entries()).map(([slug, count]) => ({
    slug, intensity: Math.min(count, 2) as 1 | 2,
  }))

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
            <View style={s.statsRow}>
              <View style={s.statCard}>
                <View style={[s.statIconBox, { backgroundColor: ORANGE + '22' }]}>
                  <Ionicons name="barbell-outline" size={18} color={ORANGE} />
                </View>
                <Text style={[s.statValue, { color: ORANGE }]}>{strengthWorkouts.length}</Text>
                <Text style={s.statLabel}>pass totalt</Text>
              </View>
              <View style={s.statCard}>
                <View style={[s.statIconBox, { backgroundColor: GREEN + '22' }]}>
                  <Ionicons name="trophy-outline" size={18} color={GREEN} />
                </View>
                <Text style={[s.statValue, { color: GREEN }]}>
                  {Array.from(new Set(strengthWorkouts.map(w => w.name))).length}
                </Text>
                <Text style={s.statLabel}>unika övningar</Text>
              </View>
              <View style={s.statCard}>
                <View style={[s.statIconBox, { backgroundColor: '#7C5CBF22' }]}>
                  <Ionicons name="body-outline" size={18} color="#7C5CBF" />
                </View>
                <Text style={[s.statValue, { color: '#7C5CBF' }]}>{muscleFreq.size}</Text>
                <Text style={s.statLabel}>muskelgrupper</Text>
              </View>
            </View>

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
              <View style={s.bodyWrap}>
                <Body
                  data={muscleData}
                  side={bodyView}
                  gender="male"
                  scale={1.6}
                  colors={[ORANGE + 'AA', ORANGE]}
                  defaultFill="#2A2A2C"
                  border="rgba(255,255,255,0.10)"
                />
              </View>
              {strengthWorkouts.length === 0 && (
                <Text style={s.muscleEmpty}>Logga styrketräning för att se vilka muskler du tränat</Text>
              )}
            </View>

            {strengthWorkouts.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Senaste pass</Text>
                {strengthWorkouts.slice(0, 8).map((w, i) => {
                  const totalReps = w.data.sets.reduce((sum, r) => sum + r.reps, 0)
                  const date      = new Date(w.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
                  const last      = i === Math.min(strengthWorkouts.length, 8) - 1
                  return (
                    <View key={w.id} style={[s.strengthRow, !last && s.strengthRowBorder]}>
                      <View style={s.strengthIcon}>
                        <Ionicons name="barbell-outline" size={18} color={ORANGE} />
                      </View>
                      <View style={s.strengthBody}>
                        <View style={s.strengthTop}>
                          <Text style={s.strengthName}>{w.name}</Text>
                          <Text style={s.strengthDate}>{date}</Text>
                        </View>
                        <View style={s.strengthMeta}>
                          <Text style={s.strengthStat}>{w.data.sets.length} set</Text>
                          <Text style={s.strengthDot}>·</Text>
                          <Text style={s.strengthStat}>{totalReps} reps</Text>
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
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

  strengthRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  strengthRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  strengthIcon:  { width: 38, height: 38, borderRadius: 10, backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center' },
  strengthBody:  { flex: 1, gap: 4 },
  strengthTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  strengthName:  { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  strengthDate:  { color: TEXT_SECONDARY, fontSize: 12 },
  strengthMeta:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  strengthStat:  { color: TEXT_SECONDARY, fontSize: 13 },
  strengthDot:   { color: 'rgba(255,255,255,0.15)', fontSize: 13 },
})
