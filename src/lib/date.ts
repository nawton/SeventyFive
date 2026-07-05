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
