import { metFor, estimateCalories, DEFAULT_WEIGHT_KG } from '../calories'

describe('metFor', () => {
  it('löpning: snabbare fart ger högre MET', () => {
    expect(metFor('running', 8)).toBeCloseTo(8.3, 1)
    expect(metFor('running', 12)).toBeGreaterThan(metFor('running', 9))
    expect(metFor('running', 16.1)).toBeCloseTo(14.5, 1)
  })
  it('klampar i tabellens ändar — ingen extrapolation', () => {
    expect(metFor('running', 2)).toBeCloseTo(6.0, 1)     // gångfart räknas inte upp
    expect(metFor('running', 30)).toBeCloseTo(19.8, 1)   // världsrekordfart cappas
  })
  it('promenad och cykling har egna, lägre kurvor', () => {
    expect(metFor('walking', 5.6)).toBeCloseTo(4.3, 1)
    expect(metFor('cycling', 19)).toBeCloseTo(6.8, 1)
    expect(metFor('walking', 6)).toBeLessThan(metFor('running', 6))
  })
  it('intervaller använder löparkurvan', () => {
    expect(metFor('interval', 12)).toBe(metFor('running', 12))
  })
})

describe('estimateCalories', () => {
  it('aktivitet spelar roll: samma distans/tid ger olika kalorier', () => {
    // 5 km på 50 min (6 km/h): rask promenad vs långsam löpning
    const walk = estimateCalories('walking', 5, 3000, 75)
    const run  = estimateCalories('running', 5, 3000, 75)
    expect(run).toBeGreaterThan(walk)
  })
  it('räknar MET × vikt × timmar', () => {
    // 10 km/h löpning i exakt 1 h, 75 kg → ~9.9–10 MET·h ≈ 750 kcal-klassen
    const kcal = estimateCalories('running', 10, 3600, 75)
    expect(kcal).toBeGreaterThan(700)
    expect(kcal).toBeLessThan(800)
  })
  it('vikten skalar linjärt', () => {
    const light = estimateCalories('running', 5, 1500, 60)
    const heavy = estimateCalories('running', 5, 1500, 90)
    expect(heavy / light).toBeCloseTo(1.5, 1)
  })
  it('utan distans: låg grundnivå, ingen fantasi', () => {
    // 30 min utan GPS-distans → ~2 MET → 75 kcal, inte 0 och inte 400
    expect(estimateCalories('running', 0, 1800, 75)).toBe(75)
  })
  it('noll tid ger noll', () => {
    expect(estimateCalories('running', 0, 0, 75)).toBe(0)
  })
  it('default-vikten används när ingen angetts', () => {
    expect(estimateCalories('running', 10, 3600))
      .toBe(estimateCalories('running', 10, 3600, DEFAULT_WEIGHT_KG))
  })
})
