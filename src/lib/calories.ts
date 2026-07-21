// =============================================================================
// KALORIER — MET-baserad uppskattning (Compendium of Physical Activities).
// kcal = MET × kroppsvikt (kg) × timmar. MET beror på aktivitet och fart,
// så en promenad och ett intervallpass ger äntligen olika siffror.
// Farten räknas på aktiv tid (pauser är redan borträknade ur klockan).
// =============================================================================

export type CardioActivity = 'running' | 'cycling' | 'interval' | 'walking'

// [fart km/h, MET] — linjärt interpolerat, klampat i ändarna
const RUN_METS: Array<[number, number]> = [
  [6, 6.0], [8, 8.3], [9.7, 9.8], [11.3, 11.0], [12.9, 11.8],
  [14.5, 12.8], [16.1, 14.5], [17.7, 16.8], [19.3, 19.8],
]
const WALK_METS: Array<[number, number]> = [
  [3.2, 2.8], [4.0, 3.0], [4.8, 3.5], [5.6, 4.3], [6.4, 5.0], [7.2, 6.3], [8.0, 8.3],
]
const BIKE_METS: Array<[number, number]> = [
  [12, 4.8], [16, 5.8], [19, 6.8], [22, 8.0], [25, 10.0], [30, 12.0],
]

function interp(table: Array<[number, number]>, x: number): number {
  if (x <= table[0][0]) return table[0][1]
  const last = table[table.length - 1]
  if (x >= last[0]) return last[1]
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i - 1]
    const [x2, y2] = table[i]
    if (x <= x2) return y1 + ((x - x1) / (x2 - x1)) * (y2 - y1)
  }
  return last[1]
}

/** MET för aktivitet + fart. Intervaller använder löparkurvan på snittfarten —
    vilorna sänker snittet, precis som de sänker den verkliga förbränningen. */
export function metFor(type: string, speedKmh: number): number {
  switch (type) {
    case 'walking': return interp(WALK_METS, speedKmh)
    case 'cycling': return interp(BIKE_METS, speedKmh)
    default:        return interp(RUN_METS, speedKmh)   // running + interval
  }
}

export const DEFAULT_WEIGHT_KG = 75

/** Uppskattade kalorier för ett pass. Utan distans (GPS-tapp, precis startat)
    används en låg grundnivå så siffran inte fantiserar. */
export function estimateCalories(
  type: string,
  distanceKm: number,
  seconds: number,
  weightKg: number = DEFAULT_WEIGHT_KG,
): number {
  if (seconds <= 0) return 0
  const hours = seconds / 3600
  const met = distanceKm < 0.05 ? 2.0 : metFor(type, distanceKm / hours)
  return Math.round(met * weightKg * hours)
}
