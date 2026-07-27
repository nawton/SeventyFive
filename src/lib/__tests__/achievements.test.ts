import { computeAchievements, type AchievementInput } from '../achievements'

const ZERO: AchievementInput = {
  completedDays: 0, streak: 0, totalWorkouts: 0, totalCardio: 0, totalKm: 0,
  prCount: 0, longestRunKm: 0, bestPace3kSec: Infinity, biggestWeekKm: 0,
}

const byId = (input: AchievementInput) => {
  const map = new Map(computeAchievements(input).map(a => [a.id, a]))
  return (id: string) => map.get(id)!
}

describe('computeAchievements', () => {
  it('nybörjaren har allt låst, med mätbara mål som progress', () => {
    const medals = computeAchievements(ZERO)
    expect(medals.every(m => !m.unlocked)).toBe(true)
    const get = byId(ZERO)
    expect(get('day10').progress).toBe('0/10')
    expect(get('km25').progress).toBe('0/25 km')
    expect(get('halfmara').progress).toBe('0.0/21,1 km')
  })

  it('trösklarna låser upp exakt på gränsen', () => {
    const get = byId({ ...ZERO, completedDays: 25, streak: 7, totalWorkouts: 25, totalKm: 100 })
    expect(get('day25').unlocked).toBe(true)
    expect(get('day50').unlocked).toBe(false)
    expect(get('day50').progress).toBe('25/50')
    expect(get('streak7').unlocked).toBe(true)
    expect(get('streak30').progress).toBe('7/30')
    expect(get('workout25').unlocked).toBe(true)
    expect(get('km100').unlocked).toBe(true)
    // Upplåsta medaljer visar ingen progress
    expect(get('km100').progress).toBeUndefined()
  })

  it('tempomedaljen kräver 5:00/km eller bättre på minst 3 km', () => {
    expect(byId({ ...ZERO, bestPace3kSec: 300 })('pace5').unlocked).toBe(true)
    expect(byId({ ...ZERO, bestPace3kSec: 301 })('pace5').unlocked).toBe(false)
    expect(byId(ZERO)('pace5').unlocked).toBe(false)   // Infinity = inget pass
  })

  it('distansmedaljerna golvar progressen till hela kilometer', () => {
    const get = byId({ ...ZERO, totalKm: 24.9, longestRunKm: 9.96, biggestWeekKm: 29.5 })
    expect(get('km25').progress).toBe('24/25 km')
    expect(get('mil10').progress).toBe('10.0/10 km')   // avrundas i text men inte upplåst
    expect(get('mil10').unlocked).toBe(false)
    expect(get('week30').progress).toBe('29/30 km')
  })

  it('fullbordad utmaning låser upp hela dagsserien', () => {
    const get = byId({ ...ZERO, completedDays: 75, streak: 75 })
    for (const id of ['day1', 'day10', 'day25', 'day50', 'day75', 'streak3', 'streak7', 'streak30']) {
      expect(get(id).unlocked).toBe(true)
    }
  })

  it('listan är stabil: 26 medaljer med unika id:n', () => {
    const medals = computeAchievements(ZERO)
    expect(medals).toHaveLength(26)
    expect(new Set(medals.map(m => m.id)).size).toBe(26)
  })
})
