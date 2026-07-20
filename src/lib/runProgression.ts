// =============================================================================
// LÖPPROGRESSION — Runna-stil: passen börjar lågt och växer vecka för vecka.
// Schemageneratorn skriver progressionen i cardiopassens notes på ett
// människoläsbart format, och nivån styrs av kalendern: vilken planvecka
// den visade dagen ligger i. Bläddrar man framåt i schemat ser man alltså
// hur passen växer — vecka 5 visar vecka 5:s distans.
//
//   "Start 10 km · +2 km per vecka · max 30 km"
//   "Start 5×1000 m · +1 per vecka · max 10×1000 m"
//
// Valfri svans efter max-värdet ("i tempofart") följer med i visningen.
// Notes som inte matchar formatet visas orörda.
// =============================================================================

const DIST_RE = /^Start\s+(\d+(?:[.,]\d+)?)\s*km\s*·\s*\+(\d+(?:[.,]\d+)?)\s*km per vecka\s*·\s*max\s+(\d+(?:[.,]\d+)?)\s*km(.*)$/
const INT_RE  = /^Start\s+(\d+)×(\d+)\s*m\s*·\s*\+(\d+)\s*per vecka\s*·\s*max\s+(\d+)×\d+\s*m(.*)$/

const num = (s: string) => parseFloat(s.replace(',', '.'))
const fmt = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')

/** Målet för en given planvecka (0 = första veckan), t.ex. "14 km · vecka 3". */
export function resolveRunProgression(notes: string | null, week: number): string | null {
  if (!notes) return notes
  const w = Math.max(0, week)

  const d = notes.match(DIST_RE)
  if (d) {
    const val = Math.min(num(d[1]) + num(d[2]) * w, num(d[3]))
    const suffix = d[4].trim()
    return `${fmt(val)} km${suffix ? ` ${suffix}` : ''} · vecka ${w + 1}`
  }

  const iv = notes.match(INT_RE)
  if (iv) {
    const count = Math.min(parseInt(iv[1], 10) + parseInt(iv[3], 10) * w, parseInt(iv[4], 10))
    const suffix = iv[5].trim()
    return `${count}×${iv[2]} m${suffix ? ` ${suffix}` : ''} · vecka ${w + 1}`
  }

  return notes
}
