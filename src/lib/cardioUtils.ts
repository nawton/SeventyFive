// =============================================================================
// CARDIO-HELPERS — rena funktioner för GPS-skärmen (app/cardio.tsx).
// Utbrutna hit för att kunna enhetstestas utan React Native-miljön.
// =============================================================================

export type Coord = { latitude: number; longitude: number }
export type ExerciseType = 'running' | 'cycling' | 'interval' | 'walking'

export function nameToType(name: string): ExerciseType {
  const s = name.toLowerCase()
  if (s.includes('cykling') || s.includes('cycling') || s.includes('cykel')) return 'cycling'
  if (s.includes('intervall') || s.includes('interval')) return 'interval'
  if (s.includes('promenad') || s.includes('walk')) return 'walking'
  return 'running'
}

export function cardinalLabel(deg: number): string {
  const dirs = ['N', 'NÖ', 'Ö', 'SÖ', 'S', 'SV', 'V', 'NV']
  return dirs[Math.round(deg / 45) % 8]
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Tid i talad form, t.ex. "25 minuter och 30 sekunder" */
export function spokenTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const parts: string[] = []
  if (h > 0) parts.push(`${h} ${h === 1 ? 'timme' : 'timmar'}`)
  if (m > 0) parts.push(`${m} ${m === 1 ? 'minut' : 'minuter'}`)
  if (s > 0 || parts.length === 0) parts.push(`${s} sekunder`)
  return parts.join(' och ')
}

export function formatPace(distanceKm: number, seconds: number): string {
  if (distanceKm < 0.01) return '--:--'
  const paceSeconds = seconds / distanceKm
  const m = Math.floor(paceSeconds / 60)
  const s = Math.floor(paceSeconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function haversineDistance(a: Coord, b: Coord): number {
  const R = 6371
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180
  const lat1 = (a.latitude * Math.PI) / 180
  const lat2 = (b.latitude * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

/** Kartintegritet: klipper bort punkter inom skyddszonen (i meter) från
    ruttens början och slut, körs INNAN passet sparas, så start- och
    slutpunkterna lagras aldrig. Returnerar tom rutt om allt låg i zonen. */
export function trimRouteEnds(
  route: Array<[number, number]>, meters = 200,
): Array<[number, number]> {
  if (route.length < 2) return route
  const km = meters / 1000
  const dist = (a: [number, number], b: [number, number]) =>
    haversineDistance(
      { latitude: a[0], longitude: a[1] },
      { latitude: b[0], longitude: b[1] },
    )
  let start = 0
  let acc = 0
  while (start < route.length - 1 && acc < km) {
    acc += dist(route[start], route[start + 1])
    start++
  }
  let end = route.length - 1
  acc = 0
  while (end > 0 && acc < km) {
    acc += dist(route[end - 1], route[end])
    end--
  }
  if (start >= end) return []
  return route.slice(start, end + 1)
}
