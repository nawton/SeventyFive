import { toDisplayDistance, distanceUnitLabel, type UnitSystem } from './units'
import { paceToSec, paceRangeForUnit, RUN_RECIPE, type RunTarget } from './runProgression'

// =============================================================================
// PASSUPPLÄGG FÖR GENERERADE LÖPPASS — bygger detaljvyns delar (värm upp /
// pass / varva ner) och tidsuppskattning ur veckans mål. Utbrutet ur
// app/run-workout.tsx för att kunna enhetstestas.
// =============================================================================

export interface Part {
  tag:  'VÄRM UPP' | 'PASS' | 'VARVA NER'
  text: string
  sub?: string
}

export const fmtNum = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

/** Passets delar utifrån typnamn + veckans mål — vår egen struktur, inte en mall.
    Distanser lagras i km men visas i vald enhet. */
export function buildParts(baseName: string, t: RunTarget, unit: UnitSystem): Part[] {
  const u = distanceUnitLabel(unit)
  const dist = (km: number) => `${fmtNum(toDisplayDistance(km, unit))} ${u}`
  const pace = t.pace ? `ca ${paceRangeForUnit(t.pace, unit)}` : undefined
  // Nycklas på målets sort, inte passnamnet — omdöpta pass behåller strukturen
  if (t.kind === 'interval') {
    return [
      { tag: 'VÄRM UPP',  text: `${dist(RUN_RECIPE.warmupM / 1000)} lugn jogg` },
      {
        tag: 'PASS',
        text: `${t.reps}×${t.intervalM} m i hög fart`,
        sub: [pace, `${RUN_RECIPE.restS} s gång- eller joggvila mellan varje`].filter(Boolean).join(' · '),
      },
      { tag: 'VARVA NER', text: `${dist(RUN_RECIPE.cooldownIntervalM / 1000)} lugn jogg` },
    ]
  }
  if (t.kind === 'distance' && t.km != null) {
    const km = dist(t.km)
    if (baseName === 'Tempopass') {
      return [
        { tag: 'VÄRM UPP',  text: `${dist(RUN_RECIPE.warmupM / 1000)} lugn jogg` },
        { tag: 'PASS',      text: `${km} i tempofart`, sub: pace ?? 'Jämn, ansträngande fart, strax under tävlingstempo' },
        { tag: 'VARVA NER', text: `${dist(RUN_RECIPE.cooldownTempoM / 1000)} lugn jogg` },
      ]
    }
    if (baseName === 'Maratonfart') {
      return [
        { tag: 'VÄRM UPP',  text: `${dist(RUN_RECIPE.warmupM / 1000)} lugn jogg` },
        { tag: 'PASS',      text: `${km} i maratonfart`, sub: pace ?? 'Din tänkta tävlingsfart' },
        { tag: 'VARVA NER', text: `${dist(RUN_RECIPE.cooldownTempoM / 1000)} lugn jogg` },
      ]
    }
    if (baseName === 'Fartlek') {
      return [
        { tag: 'VÄRM UPP',  text: `${Math.round(RUN_RECIPE.fartlekWarmupS / 60)} min lugn jogg` },
        { tag: 'PASS',      text: `${km} fartlek`, sub: 'Växla fritt mellan snabbt och lugnt, lek med farten' },
        { tag: 'VARVA NER', text: `${Math.round(RUN_RECIPE.fartlekCooldownS / 60)} min lugn jogg` },
      ]
    }
    if (baseName === 'Distanspass') {
      return [{ tag: 'PASS', text: `${km} i jämn, behaglig fart`, sub: pace }]
    }
    // Långpass och övriga distanspass
    return [{ tag: 'PASS', text: `${km} i lugn, pratvänlig fart`, sub: pace }]
  }
  // Återhämtning m.fl. — beskrivningen bor i anteckningen
  return [{ tag: 'PASS', text: t.label || 'Lugnt pass', sub: pace }]
}

/** Ungefärlig passtid i minuter, [låg, hög] — null när det inte går att veta */
export function estimateMinutes(baseName: string, t: RunTarget): [number, number] | null {
  // Återhämtning: "30–40 min …" står redan i texten
  const mins = t.label.match(/(\d+)–(\d+)\s*min/)
  if (mins) return [parseInt(mins[1], 10), parseInt(mins[2], 10)]
  if (!t.pace) return null
  const [loStr, hiStr] = t.pace.includes('–') ? t.pace.split('–') : [t.pace, t.pace]
  const lo = paceToSec(loStr)
  const hi = paceToSec(hiStr)
  if (lo === 0) return null
  // Uppvärmning + nedvarvning ingår för kvalitetspassen
  const extras = ['Tempopass', 'Maratonfart', 'Intervaller', 'Fartlek'].includes(baseName) ? 15 : 0
  let dLo = 0, dHi = 0
  if (t.kind === 'distance' && t.km != null) {
    dLo = (t.km * lo) / 60; dHi = (t.km * hi) / 60
  } else if (t.kind === 'interval' && t.reps != null && t.intervalM != null) {
    const work = (t.reps * t.intervalM / 1000) * lo / 60
    const rest = ((t.reps - 1) * RUN_RECIPE.restS) / 60
    dLo = work + rest; dHi = work + rest
  } else {
    return null
  }
  const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5)
  return [round5(dLo + extras), round5(dHi + extras)]
}
