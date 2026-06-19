import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { getActiveChallenge, calculateCurrentDay } from '@/services/challenge'
import { getAllDays, type DaySummary } from '@/services/dailyLog'

// ─── Constants ────────────────────────────────────────────────────────────────

const ORANGE  = '#FF8F00'
const GREEN   = '#4CAF50'
const RED     = '#E53935'
const BG      = '#111111'
const CARD    = '#1C1C1E'
const BORDER  = '#2C2C2E'
const TEXT_PRIMARY   = '#FFFFFF'
const TEXT_SECONDARY = '#888888'

const COLUMNS = 7
const SCREEN_WIDTH = Dimensions.get('window').width
const GRID_PADDING = 20
const GAP = 6
const SQUARE_SIZE = Math.floor((SCREEN_WIDTH - GRID_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS)

const DAY_COLORS: Record<DaySummary['status'], string> = {
  completed: GREEN,
  failed:    RED,
  pending:   ORANGE,
  future:    '#2C2C2E',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function DaySquare({ day, currentDay }: { day: DaySummary; currentDay: number }) {
  const isToday = day.dayNumber === currentDay
  const color = DAY_COLORS[day.status]

  return (
    <View
      style={[
        styles.square,
        { backgroundColor: color },
        isToday && styles.squareToday,
      ]}
    >
      <Text style={[
        styles.squareText,
        day.status === 'future' && styles.squareTextFuture,
      ]}>
        {day.dayNumber}
      </Text>
    </View>
  )
}

function Legend() {
  const items: { color: string; label: string }[] = [
    { color: GREEN,      label: 'Klar' },
    { color: RED,        label: 'Missad' },
    { color: ORANGE,     label: 'Pågående' },
    { color: '#2C2C2E',  label: 'Framtid' },
  ]
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text style={styles.legendLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const [days, setDays] = useState<DaySummary[]>([])
  const [currentDay, setCurrentDay] = useState(1)
  const [levelName, setLevelName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const challenge = await getActiveChallenge(session.user.id)
      if (!challenge) return

      const day = calculateCurrentDay(challenge.start_date)
      setCurrentDay(day)
      setLevelName((challenge as any).challenge_levels?.display_name ?? '')

      const allDays = await getAllDays(challenge.id, day)
      setDays(allDays)
    } finally {
      setLoading(false)
    }
  }

  const completedDays = days.filter((d) => d.status === 'completed').length
  const failedDays    = days.filter((d) => d.status === 'failed').length
  const streak        = calculateStreak(days, currentDay)

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Framsteg</Text>
          <Text style={styles.subtitle}>{levelName}</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard label="Dag" value={`${currentDay}/75`} />
          <StatCard label="Klarade" value={completedDays} />
          <StatCard label="Streak" value={`${streak}🔥`} />
        </View>

        {/* Calendar */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>75 dagar</Text>
          <Legend />
          <View style={styles.grid}>
            {days.map((day) => (
              <DaySquare key={day.dayNumber} day={day} currentDay={currentDay} />
            ))}
          </View>
        </View>

        {/* Completion bar */}
        <View style={styles.card}>
          <View style={styles.progressHeader}>
            <Text style={styles.cardTitle}>Total framgång</Text>
            <Text style={styles.progressPercent}>
              {currentDay > 1 ? Math.round((completedDays / (currentDay - 1)) * 100) : 0}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(completedDays / 75) * 100}%` }]} />
          </View>
          <Text style={styles.progressCaption}>
            {completedDays} av 75 dagar klarade
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateStreak(days: DaySummary[], currentDay: number): number {
  let streak = 0
  for (let i = currentDay - 1; i >= 1; i--) {
    const day = days[i - 1]
    if (day?.status === 'completed') streak++
    else break
  }
  return streak
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  centered: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 20,
  },
  header: {
    gap: 4,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    gap: 4,
  },
  statValue: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    color: TEXT_SECONDARY,
    fontSize: 12,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 16,
  },
  cardTitle: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    color: TEXT_SECONDARY,
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  square: {
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareToday: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  squareText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  squareTextFuture: {
    color: TEXT_SECONDARY,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPercent: {
    color: ORANGE,
    fontSize: 16,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    backgroundColor: BORDER,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: GREEN,
    borderRadius: 4,
  },
  progressCaption: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    textAlign: 'center',
  },
})
