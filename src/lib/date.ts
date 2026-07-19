// =============================================================================
// LOKALA DATUM — SEVENTYFIVE BY NAWTON
// =============================================================================
// Alla datumsträngar i appen (daily_logs.date, workout_date, ONCE:/SKIP:-namn)
// avser användarens LOKALA kalenderdag. Date.toISOString() ger UTC-datum och
// new Date('YYYY-MM-DD') parsas som UTC-midnatt — båda hamnar på fel dag
// nära midnatt i svenska tidszoner. Använd därför alltid dessa helpers.
// =============================================================================

/** Formaterar ett Date-objekt som YYYY-MM-DD i lokal tid. */
export function toLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parsar YYYY-MM-DD som lokal midnatt (inte UTC). */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** ISO-veckodag: 1=Mån … 7=Sön (Date.getDay() ger 0=Sön). */
export function weekdayOf(d: Date = new Date()): number {
  return d.getDay() || 7
}

/** Måndagen i veckan som innehåller d, som lokal midnatt. */
export function startOfWeek(d: Date = new Date()): Date {
  const mon = new Date(d)
  mon.setDate(d.getDate() - weekdayOf(d) + 1)
  mon.setHours(0, 0, 0, 0)
  return mon
}

/** ISO-veckonummer för en måndag (veckans start) */
export function isoWeekNum(mon: Date): number {
  const jan4 = new Date(mon.getFullYear(), 0, 4)
  return Math.ceil((((mon.getTime() - jan4.getTime()) / 86400000) + weekdayOf(jan4) - 1) / 7)
}
