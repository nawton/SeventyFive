import {
  computePoints, levelFor, LEVEL_TIERS, POINT_RULES, ONE_TIME_RULES,
  type PointsEvents, type OneTimeInput,
} from '../levels'

const NO_EVENTS: PointsEvents = {
  completedDays: 0, sessionDates: [], cardioDates: [], strengthDates: [],
  prDates: [], medalsUnlocked: 0,
}
const NO_ONETIME: OneTimeInput = {
  hasAvatar: false, hasProgressPhoto: false, hasSchedule: false, hasCustomRule: false,
}

describe('computePoints', () => {
  it('noll händelser ger noll poäng och inga källrader', () => {
    expect(computePoints(NO_EVENTS, NO_ONETIME)).toEqual({ total: 0, sources: [] })
  })

  it('grundpoängen summeras per regel', () => {
    const { total, sources } = computePoints({
      ...NO_EVENTS,
      completedDays: 2,                       // 2 × 50
      sessionDates: ['2026-07-20'],           // 1 × 20
      cardioDates: ['2026-07-20'],            // 1 × 30
      medalsUnlocked: 1,                      // 1 × 100
    }, NO_ONETIME)
    expect(total).toBe(100 + 20 + 30 + 100)
    expect(sources.map(s => s.label)).toEqual(['Klarade dagar', 'Schemapass', 'Cardiopass', 'Medaljer'])
  })

  it('dagstaket stoppar poängfarmning: max 2 schemapass och 1 cardiopass per dag', () => {
    const { total } = computePoints({
      ...NO_EVENTS,
      sessionDates: ['2026-07-20', '2026-07-20', '2026-07-20', '2026-07-21'],  // 2+1 räknas
      cardioDates: ['2026-07-20', '2026-07-20'],                               // 1 räknas
    }, NO_ONETIME)
    expect(total).toBe(3 * 20 + 1 * 30)
  })

  it('veckotaket gäller styrkepass och rekord (mån till sön)', () => {
    const { total } = computePoints({
      ...NO_EVENTS,
      // Fem styrkepass samma vecka (mån 20 juli–sön 26 juli 2026) → 3 räknas
      strengthDates: ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24'],
      // Två rekord i en vecka + två i nästa → alla 4 under taket
      prDates: ['2026-07-21', '2026-07-22', '2026-07-27', '2026-07-28'],
    }, NO_ONETIME)
    expect(total).toBe(3 * 20 + 4 * 40)
  })

  it('engångsmålen ger sina fasta poäng', () => {
    const { total, sources } = computePoints(NO_EVENTS, {
      hasAvatar: true, hasProgressPhoto: false, hasSchedule: true, hasCustomRule: false,
    })
    expect(total).toBe(50 + 100)
    expect(sources[0]).toMatchObject({ label: 'Engångsmål', detail: '2 av 4' })
  })
})

describe('levelFor', () => {
  it('nivån följer trösklarna och progressen mäter mot nästa', () => {
    expect(levelFor(0).current.id).toBe('bronze')
    expect(levelFor(749).current.id).toBe('bronze')
    expect(levelFor(750).current.id).toBe('silver')
    expect(levelFor(2000).current.id).toBe('gold')
    expect(levelFor(4500).current.id).toBe('platinum')

    const mid = levelFor(375)   // halvvägs mellan brons 0 och silver 750
    expect(mid.next?.id).toBe('silver')
    expect(mid.progress).toBeCloseTo(0.5)
  })

  it('högsta nivån har ingen nästa och full progress', () => {
    const top = levelFor(99999)
    expect(top.current.id).toBe('diamond')
    expect(top.next).toBeNull()
    expect(top.progress).toBe(1)
  })

  it('en fullbordad 75-dagarsutmaning når Diamant', () => {
    // 75 dagar à 50 p + medaljer och pass i rimlig mängd
    const days = Array.from({ length: 75 }, (_, i) => `2026-0${1 + Math.floor(i / 28)}-${String((i % 28) + 1).padStart(2, '0')}`)
    const { total } = computePoints({
      completedDays: 75,
      sessionDates: days,
      cardioDates: days,
      strengthDates: days,
      prDates: [],
      medalsUnlocked: 15,
    }, { hasAvatar: true, hasProgressPhoto: true, hasSchedule: true, hasCustomRule: true })
    expect(levelFor(total).current.id).toBe('diamond')
  })
})

describe('reglernas presentation', () => {
  it('poängreglerna och engångsmålen har etiketter och ikoner', () => {
    for (const rule of [...POINT_RULES, ...ONE_TIME_RULES]) {
      expect(rule.label.length).toBeGreaterThan(3)
      expect(rule.pts).toBeGreaterThan(0)
      expect(rule.icon).toBeTruthy()
    }
    // Trösklarna är strikt stigande
    for (let i = 1; i < LEVEL_TIERS.length; i++) {
      expect(LEVEL_TIERS[i].threshold).toBeGreaterThan(LEVEL_TIERS[i - 1].threshold)
    }
  })
})
