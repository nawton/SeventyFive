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

// Tempoförslagen förbättras försiktigt under planens gång — ca 1,5 s/km per
// vecka, max 25 s totalt (≈ vad man realistiskt vinner under en plan).
// Bara själva "ca X:XX(–Y:YY) /km"-biten röres, aldrig övrig text.
const PACE_TOKEN_RE = /(ca\s+)([0-9]+:[0-9]{2}(?:–[0-9]+:[0-9]{2})?)(\s*\/km)/
function improvePaceIn(str: string, week: number): string {
  const gain = Math.min(25, Math.round(week * 1.5))
  if (gain <= 0) return str
  return str.replace(PACE_TOKEN_RE, (_, pre: string, range: string, post: string) => {
    const shifted = range.replace(/(\d+):(\d{2})/g, (__, m: string, s: string) => {
      const total = Math.max(180, parseInt(m, 10) * 60 + parseInt(s, 10) - gain)
      return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
    })
    return `${pre}${shifted}${post}`
  })
}

// ─── Strukturerad tolkning — pass-detaljskärmen bygger sitt upplägg av detta ──

export interface RunTarget {
  kind: 'distance' | 'interval' | 'plain'
  /** Veckans distansmål i km (kind 'distance') */
  km?: number
  reps?: number
  intervalM?: number
  /** Beskrivande svans utan tempoförslag, t.ex. "i tempofart" */
  label: string
  /** Tempoförslag från 5 km-testet, t.ex. "5:45–6:10 /km" */
  pace: string | null
  week: number
}

const PACE_RE = /·?\s*ca\s+([0-9]+:[0-9]{2}(?:–[0-9]+:[0-9]{2})?)\s*\/km/

export function parseRunTarget(notes: string | null, week: number): RunTarget {
  const w = Math.max(0, week)
  const improved = notes ? improvePaceIn(notes, w) : null
  const paceM = improved?.match(PACE_RE) ?? null
  const pace = paceM ? `${paceM[1]} /km` : null
  const strip = (s: string) => s.replace(PACE_RE, '').replace(/\s*·\s*$/, '').trim()

  if (notes) {
    const d = notes.match(DIST_RE)
    if (d) {
      return {
        kind: 'distance',
        km: Math.min(num(d[1]) + num(d[2]) * w, num(d[3])),
        label: strip(d[4].trim()), pace, week: w,
      }
    }
    const iv = notes.match(INT_RE)
    if (iv) {
      return {
        kind: 'interval',
        reps: Math.min(parseInt(iv[1], 10) + parseInt(iv[3], 10) * w, parseInt(iv[4], 10)),
        intervalM: parseInt(iv[2], 10),
        label: strip(iv[5].trim()), pace, week: w,
      }
    }
  }
  return { kind: 'plain', label: strip(notes ?? ''), pace, week: w }
}

/** "5:45" → sekunder */
export function paceToSec(p: string): number {
  const m = p.match(/(\d+):(\d{2})/)
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0
}

/** Målet för en given planvecka (0 = första veckan), t.ex. "14 km · vecka 3". */
export function resolveRunProgression(notes: string | null, week: number): string | null {
  if (!notes) return notes
  const w = Math.max(0, week)

  const d = notes.match(DIST_RE)
  if (d) {
    const val = Math.min(num(d[1]) + num(d[2]) * w, num(d[3]))
    const suffix = improvePaceIn(d[4].trim(), w)
    return `${fmt(val)} km${suffix ? ` ${suffix}` : ''} · vecka ${w + 1}`
  }

  const iv = notes.match(INT_RE)
  if (iv) {
    const count = Math.min(parseInt(iv[1], 10) + parseInt(iv[3], 10) * w, parseInt(iv[4], 10))
    const suffix = improvePaceIn(iv[5].trim(), w)
    return `${count}×${iv[2]} m${suffix ? ` ${suffix}` : ''} · vecka ${w + 1}`
  }

  // Icke-progressiva pass (återhämtning) — tempoförslaget förbättras ändå
  return improvePaceIn(notes, w)
}
