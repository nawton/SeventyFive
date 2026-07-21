import { buildParts, estimateMinutes, fmtNum } from '../runWorkoutParts'
import { parseRunTarget, RUN_RECIPE } from '../runProgression'

// Samma notes-format som schemageneratorn skriver (se runProgression.test.ts)
const LONG_NOTES   = 'Start 10 km · +2 km per vecka · max 30 km · ca 6:00–6:30 /km'
const INT_NOTES    = 'Start 5×1000 m · +1 per vecka · max 8×1000 m · ca 4:55 /km'
const TEMPO_NOTES  = 'Start 5 km · +1 km per vecka · max 10 km i tempofart · ca 5:15–5:25 /km'
const MARA_NOTES   = 'Start 4 km · +1 km per vecka · max 10 km i maratonfart · ca 5:45–6:00 /km'
const FARTLEK_NOTES = 'Start 3 km · +0,5 km per vecka · max 5 km fartlek'
const DIST_NOTES   = 'Start 6 km · +1 km per vecka · max 10 km i jämn, behaglig fart · ca 5:35–5:50 /km'
const PLAIN_NOTES  = '30–45 min i lugnt tempo · ca 6:00–6:30 /km'

describe('fmtNum', () => {
  it('rundar till en decimal och skriver med decimalkomma', () => {
    expect(fmtNum(6.21371)).toBe('6,2')
    expect(fmtNum(5)).toBe('5')
    expect(fmtNum(1.55)).toBe('1,6')
  })
})

describe('buildParts', () => {
  it('intervallpass: värmning, arbete med vila i sub, nedvarvning', () => {
    const parts = buildParts('Intervaller', parseRunTarget(INT_NOTES, 0), 'metric')
    expect(parts.map(p => p.tag)).toEqual(['VÄRM UPP', 'PASS', 'VARVA NER'])
    expect(parts[0].text).toBe('1,5 km lugn jogg')
    expect(parts[1].text).toBe('5×1000 m i hög fart')
    expect(parts[1].sub).toContain('ca 4:55 /km')
    expect(parts[1].sub).toContain(`${RUN_RECIPE.restS} s gång- eller joggvila`)
    expect(parts[2].text).toBe('1,5 km lugn jogg')
  })

  it('tempopass: kortare nedvarvning och tempofart i passdelen', () => {
    const parts = buildParts('Tempopass', parseRunTarget(TEMPO_NOTES, 0), 'metric')
    expect(parts[1].text).toBe('5 km i tempofart')
    expect(parts[1].sub).toBe('ca 5:15–5:25 /km')
    expect(parts[2].text).toBe('1 km lugn jogg')
  })

  it('maratonfart har egen passtext', () => {
    const parts = buildParts('Maratonfart', parseRunTarget(MARA_NOTES, 0), 'metric')
    expect(parts[1].text).toBe('4 km i maratonfart')
  })

  it('fartlek värmer upp och varvar ner på tid, inte distans', () => {
    const parts = buildParts('Fartlek', parseRunTarget(FARTLEK_NOTES, 0), 'metric')
    expect(parts[0].text).toBe(`${Math.round(RUN_RECIPE.fartlekWarmupS / 60)} min lugn jogg`)
    expect(parts[1].text).toBe('3 km fartlek')
    expect(parts[2].text).toBe(`${Math.round(RUN_RECIPE.fartlekCooldownS / 60)} min lugn jogg`)
  })

  it('distanspass och långpass är en enda del', () => {
    expect(buildParts('Distanspass', parseRunTarget(DIST_NOTES, 0), 'metric'))
      .toEqual([expect.objectContaining({ tag: 'PASS', text: '6 km i jämn, behaglig fart' })])
    expect(buildParts('Långpass', parseRunTarget(LONG_NOTES, 0), 'metric'))
      .toEqual([expect.objectContaining({ tag: 'PASS', text: '10 km i lugn, pratvänlig fart' })])
  })

  it('återhämtning (plain) visar anteckningen som passdel', () => {
    const parts = buildParts('Återhämtning', parseRunTarget(PLAIN_NOTES, 0), 'metric')
    expect(parts).toHaveLength(1)
    expect(parts[0].text).toContain('30–45 min')
  })

  it('miles-läget konverterar både distanser och tempo', () => {
    const parts = buildParts('Tempopass', parseRunTarget(TEMPO_NOTES, 0), 'imperial')
    expect(parts[0].text).toBe('0,9 mi lugn jogg')       // 1,5 km värmning
    expect(parts[1].text).toBe('3,1 mi i tempofart')      // 5 km
    expect(parts[1].sub).toContain('/mi')
    expect(parts[1].sub).not.toContain('/km')
  })

  it('progressionen följer med: vecka 3 ger längre tempopass', () => {
    const parts = buildParts('Tempopass', parseRunTarget(TEMPO_NOTES, 2), 'metric')
    expect(parts[1].text).toBe('7 km i tempofart')        // 5 + 2×1
  })
})

describe('estimateMinutes', () => {
  it('återhämtning läser minutspannet direkt ur texten', () => {
    expect(estimateMinutes('Återhämtning', parseRunTarget(PLAIN_NOTES, 0))).toEqual([30, 45])
  })

  it('långpass: distans × tempo, avrundat till 5 min', () => {
    // 10 km × 6:00–6:30 → 60–65 min, inga tillägg
    expect(estimateMinutes('Långpass', parseRunTarget(LONG_NOTES, 0))).toEqual([60, 65])
  })

  it('kvalitetspass får +15 min för värmning/nedvarvning', () => {
    // 5 km × 5:15–5:25 ≈ 26,3–27,1 + 15 → 41,3–42,1 → [40, 40]
    expect(estimateMinutes('Tempopass', parseRunTarget(TEMPO_NOTES, 0))).toEqual([40, 40])
  })

  it('intervaller räknar arbete + vilor', () => {
    // 5×1 km à 4:55 ≈ 24,6 min + 4×90 s vila = 6 min + 15 → 45,6 → [45, 45]
    expect(estimateMinutes('Intervaller', parseRunTarget(INT_NOTES, 0))).toEqual([45, 45])
  })

  it('utan tempo går det inte att veta', () => {
    expect(estimateMinutes('Fartlek', parseRunTarget(FARTLEK_NOTES, 0))).toBeNull()
    expect(estimateMinutes('Långpass', parseRunTarget('egna anteckningar', 0))).toBeNull()
  })
})
