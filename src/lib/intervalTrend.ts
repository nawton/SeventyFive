import type { CardioWorkout } from '@/services/cardioWorkouts'

// =============================================================================
// INTERVALLTREND — "dina 1000 m-intervaller: 5:10 → 4:52". Guidade pass sparar
// per-intervall-resultat; här kokas de ner till en punkt per pass (snittempo
// för passets vanligaste intervalldistans) så statistiken kan rita trenden.
// =============================================================================

export interface TrendPoint {
  /** Passets datum (ISO-timestamp från created_at) */
  date: string
  /** Snittempo (sek/km) över passets intervaller på trenddistansen */
  paceSec: number
}

export interface IntervalTrend {
  /** Intervalldistansen trenden gäller (m) — den vanligaste i historiken */
  distanceM: number
  /** Kronologiskt stigande — äldst först */
  points: TrendPoint[]
  first: number
  last: number
  /** Positivt = snabbare nu (sekunder per km) */
  improvementSec: number
}

/** En punkt per pass: snittempot för passets vanligaste intervalldistans */
function workoutPoint(w: CardioWorkout): { distanceM: number; paceSec: number } | null {
  const ivs = (w.data.intervals ?? []).filter(iv => iv.paceSec > 0 && iv.distanceM > 0)
  if (ivs.length === 0) return null
  // Vanligaste distansen i passet (tempo-pass har 1×4000, intervaller N×1000)
  const byDist = new Map<number, number[]>()
  for (const iv of ivs) {
    if (!byDist.has(iv.distanceM)) byDist.set(iv.distanceM, [])
    byDist.get(iv.distanceM)!.push(iv.paceSec)
  }
  let best: [number, number[]] | null = null
  for (const e of byDist.entries()) {
    if (!best || e[1].length > best[1].length) best = e
  }
  if (!best) return null
  const [distanceM, paces] = best
  return { distanceM, paceSec: Math.round(paces.reduce((a, b) => a + b, 0) / paces.length) }
}

/**
 * Trenden för den intervalldistans användaren kört flest pass på.
 * Kräver minst två pass — en punkt är ingen trend. `workouts` antas komma
 * nyast först (som getCardioWorkouts levererar).
 */
export function buildIntervalTrend(workouts: CardioWorkout[], maxPoints = 8): IntervalTrend | null {
  const perWorkout = workouts
    .map(w => ({ date: w.created_at, pt: workoutPoint(w) }))
    .filter((x): x is { date: string; pt: { distanceM: number; paceSec: number } } => x.pt !== null)

  if (perWorkout.length < 2) return null

  // Trenddistans = den distans flest pass körts på
  const counts = new Map<number, number>()
  for (const x of perWorkout) counts.set(x.pt.distanceM, (counts.get(x.pt.distanceM) ?? 0) + 1)
  let distanceM = 0, bestCount = 0
  for (const [d, c] of counts.entries()) {
    if (c > bestCount) { distanceM = d; bestCount = c }
  }
  if (bestCount < 2) return null

  const points = perWorkout
    .filter(x => x.pt.distanceM === distanceM)
    .slice(0, maxPoints)                       // nyast först → ta de senaste
    .reverse()                                 // …och vänd till kronologisk ordning
    .map(x => ({ date: x.date, paceSec: x.pt.paceSec }))

  const first = points[0].paceSec
  const last = points[points.length - 1].paceSec
  return { distanceM, points, first, last, improvementSec: first - last }
}
