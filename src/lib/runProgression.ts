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
  /** Nedtrappning inför loppet — volymen är nerdragen 30–50 % */
  taper: boolean
}

const PACE_RE = /·?\s*ca\s+([0-9]+:[0-9]{2}(?:–[0-9]+:[0-9]{2})?)\s*\/km/

export function parseRunTarget(notes: string | null, week: number, weeksToRace?: number | null): RunTarget {
  const w = Math.max(0, week)
  const improved = notes ? improvePaceIn(notes, w) : null
  const paceM = improved?.match(PACE_RE) ?? null
  const pace = paceM ? `${paceM[1]} /km` : null
  const strip = (s: string) => s.replace(PACE_RE, '').replace(/\s*·\s*$/, '').trim()

  const taper = taperFactor(weeksToRace) !== null
  const cutback = !taper && isCutbackWeek(w)
  if (notes) {
    const d = notes.match(DIST_RE)
    if (d) {
      return {
        kind: 'distance',
        km: distTarget(num(d[1]), num(d[2]), num(d[3]), w, weeksToRace),
        label: strip(d[4].trim()), pace, week: w, cutback, taper,
      }
    }
    const iv = notes.match(INT_RE)
    if (iv) {
      return {
        kind: 'interval',
        reps: repsTarget(parseInt(iv[1], 10), parseInt(iv[3], 10), parseInt(iv[4], 10), w, weeksToRace),
        intervalM: parseInt(iv[2], 10),
        label: strip(iv[5].trim()), pace, week: w, cutback, taper,
      }
    }
  }
  return { kind: 'plain', label: strip(notes ?? ''), pace, week: w, cutback: false, taper: false }
}

/** "5:45" → sekunder */
export function paceToSec(p: string): number {
  const m = p.match(/(\d+):(\d{2})/)
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0
}

// ─── Segmentbygge — GPS-vyns intervallguidning ───────────────────────────────
// Översätter veckans mål till en körbar segmentlista (uppvärmning → arbete/vila
// → nedvarvning) som run-workout skickar till GPS-skärmen. Långpass och andra
// enkla pass returnerar [] — de guidas av det vanliga distansmålet istället.

// EN sanningskälla för passrecepten — används av både segmentbygget (motorn)
// och run-workouts visningstext, så skärm och röst aldrig kan säga olika
export const RUN_RECIPE = {
  /** Uppvärmning/nedvarvning för intervallpass (m) */
  warmupM: 1500,
  cooldownIntervalM: 1500,
  /** Nedvarvning för tempo/maratonfart (m) */
  cooldownTempoM: 1000,
  /** Vila mellan intervaller (s) */
  restS: 90,
  /** Fartlek: tidsbaserad värmning/nedvarvning (s) */
  fartlekWarmupS: 600,
  fartlekCooldownS: 300,
} as const

export interface RunSegment {
  kind: 'warmup' | 'work' | 'rest' | 'cooldown'
  /** Exakt en av distanceM/durationS per segment */
  distanceM?: number
  durationS?: number
  /** T.ex. "Intervall 3 av 6", "Vila", "Uppvärmning" — visas i UI + läses upp */
  label: string
  /** Tempoförslag i sek/km — bara på work-segment, bara när 5 km-test angetts */
  paceSecLo?: number
  paceSecHi?: number
}

export function buildRunSegments(baseName: string, t: RunTarget): RunSegment[] {
  // Tempozon från "5:45–6:10 /km" (eller enkel "4:55 /km" → samma lo/hi)
  let paceSecLo: number | undefined
  let paceSecHi: number | undefined
  if (t.pace) {
    const [lo, hi] = t.pace.includes('–') ? t.pace.split('–') : [t.pace, t.pace]
    const loSec = paceToSec(lo)
    const hiSec = paceToSec(hi)
    if (loSec > 0) { paceSecLo = loSec; paceSecHi = hiSec > 0 ? hiSec : loSec }
  }
  const work = (distanceM: number, label: string): RunSegment =>
    ({ kind: 'work', distanceM, label, ...(paceSecLo ? { paceSecLo, paceSecHi } : {}) })

  if (t.kind === 'interval' && t.reps && t.intervalM) {
    const segs: RunSegment[] = [{ kind: 'warmup', distanceM: RUN_RECIPE.warmupM, label: 'Uppvärmning' }]
    for (let i = 1; i <= t.reps; i++) {
      segs.push(work(t.intervalM, `Intervall ${i} av ${t.reps}`))
      if (i < t.reps) segs.push({ kind: 'rest', durationS: RUN_RECIPE.restS, label: 'Vila' })
    }
    segs.push({ kind: 'cooldown', distanceM: RUN_RECIPE.cooldownIntervalM, label: 'Nedvarvning' })
    return segs
  }

  if (t.kind === 'distance' && t.km) {
    const workM = Math.round(t.km * 1000)
    if (baseName === 'Tempopass' || baseName === 'Maratonfart') {
      return [
        { kind: 'warmup', distanceM: RUN_RECIPE.warmupM, label: 'Uppvärmning' },
        work(workM, baseName === 'Tempopass' ? 'Tempo' : 'Maratonfart'),
        { kind: 'cooldown', distanceM: RUN_RECIPE.cooldownTempoM, label: 'Nedvarvning' },
      ]
    }
    if (baseName === 'Fartlek') {
      return [
        { kind: 'warmup', durationS: RUN_RECIPE.fartlekWarmupS, label: 'Uppvärmning' },
        work(workM, 'Fartlek'),
        { kind: 'cooldown', durationS: RUN_RECIPE.fartlekCooldownS, label: 'Nedvarvning' },
      ]
    }
  }

  // Långpass, Distanspass, Återhämtning m.fl. — inget guidat upplägg
  return []
}

// Var fjärde planvecka är en lugnare vecka (cutback): volymen dras ner ~25 %
// så kroppen hinner ta till sig träningen — som etablerade planer gör.
// Vecka 4, 8, 12, 16 räknat från planens start.
export function isCutbackWeek(week: number): boolean {
  return week > 0 && (week + 1) % 4 === 0
}

/** Nedtrappning (taper) inför loppet: veckan före → 70 % volym,
    tävlingsveckan → 50 %. Trumfar cutback, och får, till skillnad från
    cutback, gå under planens startnivå: färska ben är hela poängen. */
export function taperFactor(weeksToRace: number | null | undefined): number | null {
  if (weeksToRace == null || weeksToRace < 0 || weeksToRace > 1) return null
  return weeksToRace === 0 ? 0.5 : 0.7
}

/** Distansmål för veckan inkl. taper/cutback */
function distTarget(start: number, step: number, max: number, week: number, weeksToRace?: number | null): number {
  const val = Math.min(start + step * week, max)
  const tf = taperFactor(weeksToRace)
  if (tf) return Math.max(2, Math.round(val * tf * 2) / 2)
  if (!isCutbackWeek(week)) return val
  return Math.max(start, Math.round(val * 0.75 * 2) / 2)
}

/** Antal intervaller för veckan inkl. taper/cutback */
function repsTarget(start: number, step: number, max: number, week: number, weeksToRace?: number | null): number {
  const val = Math.min(start + step * week, max)
  const tf = taperFactor(weeksToRace)
  if (tf) return Math.max(2, Math.round(val * tf))
  if (!isCutbackWeek(week)) return val
  return Math.max(start, Math.round(val * 0.75))
}

/** Målet för en given planvecka (0 = första veckan), t.ex. "14 km · vecka 3". */
export function resolveRunProgression(
  notes: string | null,
  week: number,
  unit: UnitSystem = 'metric',
  weeksToRace?: number | null,
): string | null {
  if (!notes) return notes
  const w = Math.max(0, week)

  const taper = taperFactor(weeksToRace) !== null
  const cutTag = taper
    ? ' · nedtrappning inför loppet'
    : isCutbackWeek(w) ? ' · lugnare vecka' : ''

  const d = notes.match(DIST_RE)
  if (d) {
    const val = distTarget(num(d[1]), num(d[2]), num(d[3]), w, weeksToRace)
    const suffix = convertPaceToken(improvePaceIn(d[4].trim(), w), unit)
    return `${fmt(toDisplayDistance(val, unit))} ${distanceUnitLabel(unit)}${suffix ? ` ${suffix}` : ''} · vecka ${w + 1}${cutTag}`
  }

  const iv = notes.match(INT_RE)
  if (iv) {
    const count = repsTarget(parseInt(iv[1], 10), parseInt(iv[3], 10), parseInt(iv[4], 10), w, weeksToRace)
    const suffix = convertPaceToken(improvePaceIn(iv[5].trim(), w), unit)
    return `${count}×${iv[2]} m${suffix ? ` ${suffix}` : ''} · vecka ${w + 1}${cutTag}`
  }

  // Icke-progressiva pass (återhämtning) — tempoförslaget förbättras ändå
  return convertPaceToken(improvePaceIn(notes, w), unit)
}
