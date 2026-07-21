import { planEndDateStr, sessionActiveOn, PLAN_WEEKS, type WorkoutSession } from '../workoutSchedule'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }))

function session(over: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 's1', user_id: 'u1', name: 'Långpass',
    created_at: '2026-07-01T08:00:00',
    weekdays: [1], notes: null,
    session_type: 'cardio', cardio_type: 'running',
    exercises: [],
    ...over,
  } as WorkoutSession
}

describe('planEndDateStr', () => {
  it('utan tävlingsdatum: 16 veckor från planstarten', () => {
    expect(planEndDateStr('2026-07-01T08:00:00', null)).toBe('2026-10-21')
  })
  it('med tävlingsdatum: planen slutar PÅ loppet — race day är löpardagen', () => {
    expect(planEndDateStr('2026-07-01T08:00:00', '2026-09-13')).toBe('2026-09-13')
  })
  it('loppet kan också förlänga planen förbi 16 veckor', () => {
    expect(planEndDateStr('2026-07-01T08:00:00', '2026-12-06')).toBe('2026-12-06')
  })
  it('tävlingsdatum före planstarten ignoreras', () => {
    expect(planEndDateStr('2026-07-01T08:00:00', '2026-06-01')).toBe('2026-10-21')
  })
})

describe('sessionActiveOn', () => {
  it('cardio-pass lever fram till planens slut', () => {
    const s = session()
    expect(sessionActiveOn(s, '2026-07-01')).toBe(true)
    expect(sessionActiveOn(s, '2026-10-20')).toBe(true)   // sista plandagen
    expect(sessionActiveOn(s, '2026-10-21')).toBe(false)  // 16 veckor passerade
    expect(sessionActiveOn(s, '2026-06-30')).toBe(false)  // före planen fanns
  })

  it('med tävlingsdatum: inga vanliga pass på eller efter race day', () => {
    const s = session()
    expect(sessionActiveOn(s, '2026-09-12', '2026-09-13')).toBe(true)   // dagen före
    expect(sessionActiveOn(s, '2026-09-13', '2026-09-13')).toBe(false)  // race day: bara loppet
    expect(sessionActiveOn(s, '2026-09-14', '2026-09-13')).toBe(false)  // efteråt: tyst
    // Och långt race förlänger horisonten förbi 16-veckorsgränsen
    expect(sessionActiveOn(s, '2026-11-15', '2026-12-06')).toBe(true)
  })

  it('gympass fortsätter för alltid — styrka har inget slutdatum', () => {
    const s = session({ session_type: 'gym', cardio_type: null })
    const farAway = new Date(2026, 6, 1)
    farAway.setDate(farAway.getDate() + PLAN_WEEKS * 7 * 3)
    expect(sessionActiveOn(s, '2030-01-01')).toBe(true)
    expect(sessionActiveOn(s, '2030-01-01', '2026-09-13')).toBe(true)   // race rör inte gym
  })

  it('engångspass (ONCE:) styrs av sitt datum, inte av horisonten', () => {
    const s = session({ name: 'ONCE:2027-01-01:Tävlingsdag 🏁', weekdays: [] })
    expect(sessionActiveOn(s, '2027-01-01')).toBe(true)
  })
})
