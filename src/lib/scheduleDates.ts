import { toLocalDateString } from './date'

// =============================================================================
// SCHEMATS DAGPAGER
// Pagern spänner över TOTAL_DAYS dagar med dagens datum i mitten (CENTER_IDX).
// Helpers för att översätta mellan pager-index och lokala kalenderdatum.
// =============================================================================

export const DAY_SHORT  = ['MÅN', 'TIS', 'ONS', 'TOR', 'FRE', 'LÖR', 'SÖN']
export const TOTAL_DAYS = 365
export const CENTER_IDX = 182
// Stabil referens — en ny array varje render får FlatList att montera om sidorna
export const PAGER_DATA = Array.from({ length: TOTAL_DAYS }, (_, i) => i)

export function isoDate(d: Date): string {
  return toLocalDateString(d)
}

export function todayMidnight(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function indexToDate(i: number): Date {
  const d = todayMidnight()
  d.setDate(d.getDate() + i - CENTER_IDX)
  return d
}

export function dateToIndex(d: Date): number {
  const now = todayMidnight()
  return CENTER_IDX + Math.round((d.getTime() - now.getTime()) / 86400000)
}
