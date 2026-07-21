import { buildIntervalTrend } from '../intervalTrend'
import type { CardioWorkout, CardioInterval } from '@/services/cardioWorkouts'

function workout(created: string, intervals: CardioInterval[]): CardioWorkout {
  return {
    id: created, name: 'Intervaller', created_at: created,
    data: { category: 'cardio', type: 'interval', distance_km: 6, duration_seconds: 1800, calories: 400, intervals },
  }
}
const iv = (distanceM: number, paceSec: number): CardioInterval =>
  ({ label: 'Intervall', distanceM, durationS: Math.round(paceSec * distanceM / 1000), paceSec })

// getCardioWorkouts levererar nyast först — fixturerna likaså
const HISTORY = [
  workout('2026-07-18T08:00:00Z', [iv(1000, 292), iv(1000, 290), iv(1000, 294)]),  // snitt 292
  workout('2026-07-11T08:00:00Z', [iv(1000, 300), iv(1000, 304)]),                 // snitt 302
  workout('2026-07-04T08:00:00Z', [iv(400, 280), iv(400, 282)]),                   // annan distans
  workout('2026-06-27T08:00:00Z', [iv(1000, 310), iv(1000, 310)]),                 // snitt 310
]

describe('buildIntervalTrend', () => {
  it('bygger trenden för den vanligaste intervalldistansen, kronologiskt', () => {
    const t = buildIntervalTrend(HISTORY)!
    expect(t.distanceM).toBe(1000)
    expect(t.points.map(p => p.paceSec)).toEqual([310, 302, 292])  // äldst → nyast
    expect(t.first).toBe(310)
    expect(t.last).toBe(292)
    expect(t.improvementSec).toBe(18)                              // 18 s/km snabbare
  })

  it('passets vanligaste distans vinner — enstaka avvikare stör inte', () => {
    const mixed = workout('2026-07-20T08:00:00Z', [iv(1000, 290), iv(1000, 288), iv(400, 250)])
    const t = buildIntervalTrend([mixed, ...HISTORY])!
    expect(t.distanceM).toBe(1000)
    expect(t.points[t.points.length - 1].paceSec).toBe(289)        // snitt av 1000-orna
  })

  it('kräver minst två pass på samma distans', () => {
    expect(buildIntervalTrend([HISTORY[0]])).toBeNull()
    expect(buildIntervalTrend([HISTORY[0], HISTORY[2]])).toBeNull() // 1000 m + 400 m = ingen trend
    expect(buildIntervalTrend([])).toBeNull()
  })

  it('pass utan intervaller eller med nolltempo ignoreras', () => {
    const empty = workout('2026-07-19T08:00:00Z', [])
    const broken = workout('2026-07-19T09:00:00Z', [iv(1000, 0)])
    const t = buildIntervalTrend([empty, broken, ...HISTORY])!
    expect(t.points).toHaveLength(3)
  })

  it('begränsar till de senaste maxPoints passen', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      workout(`2026-07-${String(18 - i).padStart(2, '0')}T08:00:00Z`, [iv(1000, 300 + i)]))
    const t = buildIntervalTrend(many, 8)!
    expect(t.points).toHaveLength(8)
    expect(t.points[t.points.length - 1].paceSec).toBe(300)        // nyaste passet sist
  })

  it('försämring redovisas ärligt', () => {
    const t = buildIntervalTrend([
      workout('2026-07-18T08:00:00Z', [iv(1000, 320)]),
      workout('2026-07-11T08:00:00Z', [iv(1000, 300)]),
    ])!
    expect(t.improvementSec).toBe(-20)
  })
})
