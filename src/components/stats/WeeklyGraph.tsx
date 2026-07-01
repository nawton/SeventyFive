import { View, Text, StyleSheet, Dimensions } from 'react-native'
import { ORANGE, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import type { CardioWorkout } from '@/services/workouts'

const SCREEN_WIDTH = Dimensions.get('window').width
const GRID_PADDING = 20
const CHART_H      = 80

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - y.getTime()) / 86400000) + 1) / 7)
}

function weeklyKmData(workouts: CardioWorkout[]): { label: string; km: number }[] {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const ref = new Date(now)
    ref.setDate(now.getDate() - (5 - i) * 7)
    const wn = isoWeek(ref)
    const yr = ref.getFullYear()
    const km = workouts
      .filter(w => { const d = new Date(w.created_at); return isoWeek(d) === wn && d.getFullYear() === yr })
      .reduce((sum, w) => sum + w.data.distance_km, 0)
    return { label: `V${wn}`, km }
  })
}

export function WeeklyGraph({ workouts }: { workouts: CardioWorkout[] }) {
  const data   = weeklyKmData(workouts)
  const maxKm  = Math.max(...data.map(d => d.km), 1)
  const CHART_W = SCREEN_WIDTH - GRID_PADDING * 2 - 40

  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * CHART_W,
    y: CHART_H - (d.km / maxKm) * CHART_H,
    ...d,
  }))

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Km per vecka</Text>
      <View style={{ height: CHART_H + 28 }}>
        {pts.slice(0, -1).map((p, i) => {
          const q   = pts[i + 1]
          const dx  = q.x - p.x
          const dy  = q.y - p.y
          const len = Math.sqrt(dx * dx + dy * dy)
          const deg = Math.atan2(dy, dx) * (180 / Math.PI)
          return (
            <View key={`l${i}`} style={{
              position: 'absolute',
              left: (p.x + q.x) / 2 - len / 2,
              top:  (p.y + q.y) / 2 - 1.5,
              width: len, height: 3, borderRadius: 2,
              backgroundColor: ORANGE,
              transform: [{ rotate: `${deg}deg` }],
            }} />
          )
        })}
        {pts.map((p, i) => p.km > 0 && (
          <Text key={`km${i}`} style={{
            position: 'absolute', left: p.x - 20, top: p.y - 18,
            width: 40, textAlign: 'center',
            color: TEXT_SECONDARY, fontSize: 9, fontWeight: '600',
          }}>
            {p.km.toFixed(1)}
          </Text>
        ))}
        {pts.map((p, i) => (
          <View key={`d${i}`} style={{
            position: 'absolute', left: p.x - 5, top: p.y - 5,
            width: 10, height: 10, borderRadius: 5,
            backgroundColor: p.km > 0 ? ORANGE : 'rgba(255,255,255,0.15)',
            borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
          }} />
        ))}
        {pts.map((p, i) => (
          <Text key={`w${i}`} style={{
            position: 'absolute', left: p.x - 15, top: CHART_H + 10,
            width: 30, textAlign: 'center',
            color: TEXT_SECONDARY, fontSize: 10, fontWeight: '500',
          }}>
            {data[i].label}
          </Text>
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card:      { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 20, gap: 16 },
  cardTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
})
