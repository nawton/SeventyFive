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

import { toDisplayDistance, distanceUnitLabel, paceForUnit, type UnitSystem } from '@/lib/units'

const DIST_RE = /^Start\s+(\d+(?:[.,]\d+)?)\s*km\s*·\s*\+(\d+(?:[.,]\d+)?)\s*km per vecka\s*·\s*max\s+(\d+(?:[.,]\d+)?)\s*km(.*)$/
const INT_RE  = /^Start\s+(\d+)×(\d+)\s*m\s*·\s*\+(\d+)\s*per vecka\s*·\s*max\s+(\d+)×\d+\s*m(.*)$/

const num = (s: string) => parseFloat(s.replace(',', '.'))
const fmt = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')

// Tempoförslagen förbättras försiktigt under planens gång — ca 1,5 s/km per
// vecka, max 25 s totalt (≈ vad man realistiskt vinner under en plan).
// Bara själva "ca X:XX(–Y:YY) /km"-biten röres, aldrig övrig text.
const PACE_TOKEN_RE = /(ca\s+)([0-9]+:[0-9]{2}(?:–[0-9]+:[0-9]{2})?)(\s*\/km)/
const fmtSec = (sec: number) => {
  const r = Math.round(sec)
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`
}
function improvePaceIn(str: string, week: number): string {
  const gain = Math.min(25, Math.round(week * 1.5))
  if (gain <= 0) return str
  return str.replace(PACE_TOKEN_RE, (_, pre: string, range: string, post: string) => {
    const shifted = range.replace(/(\d+):(\d{2})/g, (__, m: string, s: string) =>
      fmtSec(Math.max(180, parseInt(m, 10) * 60 + parseInt(s, 10) - gain)))
    return `${pre}${shifted}${post}`
  })
}

// Planerna är metriska i grunden — vid miles konverteras tempot vid visning
function convertPaceToken(str: string, unit: UnitSystem): string {
  if (unit !== 'imperial') return str
  return str.replace(PACE_TOKEN_RE, (_, pre: string, range: string) => {
    const shifted = range.replace(/(\d+):(\d{2})/g, (__, m: string, s: string) =>
      fmtSec(paceForUnit(parseInt(m, 10) * 60 + parseInt(s, 10), 'imperial')))
    return `${pre}${shifted} /mi`
  })
}

/** "5:45–6:10 /km" → miles-tempo när enheten kräver det (annars oförändrad) */
export function paceRangeForUnit(pace: string, unit: UnitSystem): string {
  if (unit !== 'imperial') return pace
  return pace
    .replace(/(\d+):(\d{2})/g, (_, m: string, s: string) =>
      fmtSec(paceForUnit(parseInt(m, 10) * 60 + parseInt(s, 10), 'imperial')))
    .replace('/km', '/mi')
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
  /** Lugnare vecka (cutback) — volymen är nerdragen ~25 % */
  cutback: boolean
}

const PACE_RE = /·?\s*ca\s+([0-9]+:[0-9]{2}(?:–[0-9]+:[0-9]{2})?)\s*\/km/

export function parseRunTarget(notes: string | null, week: number): RunTarget {
  const w = Math.max(0, week)
  const improved = notes ? improvePaceIn(notes, w) : null
  const paceM = improved?.match(PACE_RE) ?? null
  const pace = paceM ? `${paceM[1]} /km` : null
  const strip = (s: string) => s.replace(PACE_RE, '').replace(/\s*·\s*$/, '').trim()

  const cutback = isCutbackWeek(w)
  if (notes) {
    const d = notes.match(DIST_RE)
    if (d) {
      return {
        kind: 'distance',
        km: distTarget(num(d[1]), num(d[2]), num(d[3]), w),
        label: strip(d[4].trim()), pace, week: w, cutback,
      }
    }
    const iv = notes.match(INT_RE)
    if (iv) {
      return {
        kind: 'interval',
        reps: repsTarget(parseInt(iv[1], 10), parseInt(iv[3], 10), parseInt(iv[4], 10), w),
        intervalM: parseInt(iv[2], 10),
        label: strip(iv[5].trim()), pace, week: w, cutback,
      }
    }
  }
  return { kind: 'plain', label: strip(notes ?? ''), pace, week: w, cutback: false }
}

/** "5:45" → sekunder */
export function paceToSec(p: string): number {
  const m = p.match(/(\d+):(\d{2})/)
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0
}

// Var fjärde planvecka är en lugnare vecka (cutback): volymen dras ner ~25 %
// så kroppen hinner ta till sig träningen — som etablerade planer gör.
// Vecka 4, 8, 12, 16 räknat från planens start.
export function isCutbackWeek(week: number): boolean {
  return week > 0 && (week + 1) % 4 === 0
}

/** Distansmål för veckan inkl. cutback — aldrig under planens startnivå */
function distTarget(start: number, step: number, max: number, week: number): number {
  const val = Math.min(start + step * week, max)
  if (!isCutbackWeek(week)) return val
  return Math.max(start, Math.round(val * 0.75 * 2) / 2)
}

/** Antal intervaller för veckan inkl. cutback — aldrig under startantalet */
function repsTarget(start: number, step: number, max: number, week: number): number {
  const val = Math.min(start + step * week, max)
  if (!isCutbackWeek(week)) return val
  return Math.max(start, Math.round(val * 0.75))
}

/** Målet för en given planvecka (0 = första veckan), t.ex. "14 km · vecka 3". */
export function resolveRunProgression(
  notes: string | null,
  week: number,
  unit: UnitSystem = 'metric',
): string | null {
  if (!notes) return notes
  const w = Math.max(0, week)

  const cutTag = isCutbackWeek(w) ? ' · lugnare vecka' : ''

  const d = notes.match(DIST_RE)
  if (d) {
    const val = distTarget(num(d[1]), num(d[2]), num(d[3]), w)
    const suffix = convertPaceToken(improvePaceIn(d[4].trim(), w), unit)
    return `${fmt(toDisplayDistance(val, unit))} ${distanceUnitLabel(unit)}${suffix ? ` ${suffix}` : ''} · vecka ${w + 1}${cutTag}`
  }

  const iv = notes.match(INT_RE)
  if (iv) {
    const count = repsTarget(parseInt(iv[1], 10), parseInt(iv[3], 10), parseInt(iv[4], 10), w)
    const suffix = convertPaceToken(improvePaceIn(iv[5].trim(), w), unit)
    return `${count}×${iv[2]} m${suffix ? ` ${suffix}` : ''} · vecka ${w + 1}${cutTag}`
  }

  // Icke-progressiva pass (återhämtning) — tempoförslaget förbättras ändå
  return convertPaceToken(improvePaceIn(notes, w), unit)
}
