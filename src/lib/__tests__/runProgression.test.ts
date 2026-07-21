import {
  resolveRunProgression,
  parseRunTarget,
  buildRunSegments,
  isCutbackWeek,
  paceRangeForUnit,
  paceToSec,
  RUN_RECIPE,
} from '../runProgression'

// Notes-strängarna nedan är exakt vad schemageneratorn skriver — ändras
// formatet där måste dessa uppdateras medvetet, inte råka glida isär.
const LONG_NOTES  = 'Start 10 km · +2 km per vecka · max 30 km · ca 6:00–6:30 /km'
const INT_NOTES   = 'Start 5×1000 m · +1 per vecka · max 8×1000 m · ca 4:55 /km'
const TEMPO_NOTES = 'Start 5 km · +1 km per vecka · max 10 km i tempofart · ca 5:15–5:25 /km'
const PLAIN_NOTES = '30–45 min i lugnt tempo · ca 6:00–6:30 /km'

describe('isCutbackWeek', () => {
  it('var fjärde vecka är lugnare (vecka 4, 8, 12, 16)', () => {
    const cutbacks = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(isCutbackWeek)
    expect(cutbacks).toEqual([3, 7]) // w=3 → vecka 4, w=7 → vecka 8
  })
  it('första veckan är aldrig cutback', () => {
    expect(isCutbackWeek(0)).toBe(false)
  })
})

describe('resolveRunProgression — distans', () => {
  it('vecka 1 visar startvärdet', () => {
    expect(resolveRunProgression(LONG_NOTES, 0)).toContain('10 km')
    expect(resolveRunProgression(LONG_NOTES, 0)).toContain('vecka 1')
  })
  it('växer med steget per vecka', () => {
    expect(resolveRunProgression(LONG_NOTES, 2)).toContain('14 km') // 10 + 2*2
  })
  it('stannar på taket', () => {
    expect(resolveRunProgression(LONG_NOTES, 30)).toContain('30 km')
  })
  it('cutback-vecka drar ner ~25 % och märker raden', () => {
    // w=3 → vecka 4: 10 + 6 = 16 → 0,75*16 = 12
    const res = resolveRunProgression(LONG_NOTES, 3)!
    expect(res).toContain('12 km')
    expect(res).toContain('lugnare vecka')
  })
  it('tempoförslaget förbättras ~1,5 s/km per vecka', () => {
    // w=4: gain = round(6) = 6 s → 6:00 → 5:54
    expect(resolveRunProgression(LONG_NOTES, 4)).toContain('5:54')
  })
  it('miles-läget konverterar distans och tempo', () => {
    const res = resolveRunProgression(LONG_NOTES, 0, 'imperial')!
    expect(res).toContain('6,2 mi')  // 10 km
    expect(res).toContain('/mi')
    expect(res).not.toContain('/km')
  })
})

describe('resolveRunProgression — intervaller och övrigt', () => {
  it('intervaller växer i antal och stannar på taket', () => {
    expect(resolveRunProgression(INT_NOTES, 1)).toContain('6×1000 m')
    expect(resolveRunProgression(INT_NOTES, 10)).toContain('8×1000 m')
  })
  it('meter konverteras aldrig till miles', () => {
    expect(resolveRunProgression(INT_NOTES, 0, 'imperial')).toContain('5×1000 m')
  })
  it('plain notes (återhämtning) får bara tempoförbättring', () => {
    const res = resolveRunProgression(PLAIN_NOTES, 4)!
    expect(res).toContain('30–45 min')
    expect(res).toContain('5:54') // 6:00 − 6 s
  })
  it('egna anteckningar utan planformat lämnas orörda', () => {
    expect(resolveRunProgression('möt Anna vid spåret', 5)).toBe('möt Anna vid spåret')
  })
})

describe('parseRunTarget', () => {
  it('ger strukturerad distansdata med cutback-flaggan', () => {
    const t = parseRunTarget(LONG_NOTES, 3)
    expect(t.kind).toBe('distance')
    expect(t.km).toBe(12)
    expect(t.cutback).toBe(true)
  })
  it('ger strukturerad intervalldata', () => {
    const t = parseRunTarget(INT_NOTES, 0)
    expect(t).toMatchObject({ kind: 'interval', reps: 5, intervalM: 1000 })
  })
  it('okänt format blir plain', () => {
    expect(parseRunTarget('vad som helst', 0).kind).toBe('plain')
  })
})

describe('paceToSec / paceRangeForUnit', () => {
  it('tolkar mm:ss', () => {
    expect(paceToSec('5:45')).toBe(345)
    expect(paceToSec('nonsens')).toBe(0)
  })
  it('konverterar tempospann till miles', () => {
    // 6:00 /km = 360 s × 1.60934 ≈ 579 s ≈ 9:39 /mi
    expect(paceRangeForUnit('6:00–6:30 /km', 'imperial')).toBe('9:39–10:28 /mi')
    expect(paceRangeForUnit('6:00–6:30 /km', 'metric')).toBe('6:00–6:30 /km')
  })
})

describe('buildRunSegments', () => {
  it('intervallpass: värmning → arbete/vila utan avslutande vila → nedvarvning', () => {
    const segs = buildRunSegments('Intervaller', parseRunTarget(INT_NOTES, 1)) // 6 reps
    expect(segs.map(s => s.kind)).toEqual([
      'warmup',
      'work', 'rest', 'work', 'rest', 'work', 'rest', 'work', 'rest', 'work', 'rest', 'work',
      'cooldown',
    ])
    expect(segs[0].distanceM).toBe(RUN_RECIPE.warmupM)
    expect(segs[2].durationS).toBe(RUN_RECIPE.restS)
    expect(segs[1].label).toBe('Intervall 1 av 6')
  })
  it('work-segment bär tempozonen från 5 km-testet', () => {
    const segs = buildRunSegments('Tempopass', parseRunTarget(TEMPO_NOTES, 0))
    const work = segs.find(s => s.kind === 'work')!
    expect(work.paceSecLo).toBeGreaterThan(0)
    expect(work.paceSecHi).toBeGreaterThanOrEqual(work.paceSecLo!)
    expect(segs[0].paceSecLo).toBeUndefined() // aldrig på uppvärmningen
  })
  it('fartlek får tidsbaserad värmning/nedvarvning', () => {
    const segs = buildRunSegments('Fartlek', parseRunTarget('Start 3 km · +0,5 km per vecka · max 5 km fartlek', 0))
    expect(segs[0]).toMatchObject({ kind: 'warmup', durationS: RUN_RECIPE.fartlekWarmupS })
    expect(segs[2]).toMatchObject({ kind: 'cooldown', durationS: RUN_RECIPE.fartlekCooldownS })
  })
  it('långpass och återhämtning guidas inte', () => {
    expect(buildRunSegments('Långpass', parseRunTarget(LONG_NOTES, 0))).toEqual([])
    expect(buildRunSegments('Återhämtning', parseRunTarget(PLAIN_NOTES, 0))).toEqual([])
  })
  it('cutback-vecka ger färre intervaller', () => {
    // w=3 → vecka 4: 5+3 = 8 (tak) → 0,75*8 = 6
    const segs = buildRunSegments('Intervaller', parseRunTarget(INT_NOTES, 3))
    expect(segs.filter(s => s.kind === 'work')).toHaveLength(6)
  })
})
