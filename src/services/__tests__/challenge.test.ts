import {
  acceptChallenge, getActiveChallenge, calculateDaysSinceStart,
  calculateCurrentDay, restartChallenge, completeChallenge,
} from '../challenge'
import { supabase } from '@/lib/supabase'
import { toLocalDateString } from '@/lib/date'
import { installTables, argsOf } from '@/testUtils/supabaseChain'
import type { UserChallenge } from '@/types/database'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }))

const fromMock = supabase.from as jest.Mock

const HARD_LEVEL = 'a1b2c3d4-0002-0002-0002-000000000002'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toLocalDateString(d)
}

const ANSWERS = { why: 'Bli starkare', goal: 'Diamant', pressure: 'hard' }

beforeEach(() => jest.clearAllMocks())

describe('acceptChallenge', () => {
  it('sparar quizsvaren och startar utmaningen på dag 1 idag', async () => {
    const calls = installTables(fromMock, { quiz_results: { data: null }, user_challenges: { data: null } })
    await acceptChallenge('u1', 'hard', ANSWERS)

    expect(argsOf(calls, 'quiz_results', 'insert')[0][0]).toMatchObject({
      user_id: 'u1',
      why_answer: 'Bli starkare',
      pressure_level: 2,
      recommended_level_id: HARD_LEVEL,
    })
    expect(argsOf(calls, 'user_challenges', 'insert')[0][0]).toEqual({
      user_id: 'u1',
      level_id: HARD_LEVEL,
      start_date: daysAgo(0),
      current_day: 1,
      status: 'active',
    })
  })

  it('backdaterar startdatumet när man hoppar in mitt i, klampat till 1–75', async () => {
    let calls = installTables(fromMock, { quiz_results: { data: null }, user_challenges: { data: null } })
    await acceptChallenge('u1', 'normal', { ...ANSWERS, pressure: 'normal' }, 42)
    expect(argsOf(calls, 'user_challenges', 'insert')[0][0]).toMatchObject({
      start_date: daysAgo(41), current_day: 42,
    })

    calls = installTables(fromMock, { quiz_results: { data: null }, user_challenges: { data: null } })
    await acceptChallenge('u1', 'normal', { ...ANSWERS, pressure: 'normal' }, 999)
    expect(argsOf(calls, 'user_challenges', 'insert')[0][0]).toMatchObject({
      start_date: daysAgo(74), current_day: 75,
    })

    calls = installTables(fromMock, { quiz_results: { data: null }, user_challenges: { data: null } })
    await acceptChallenge('u1', 'normal', { ...ANSWERS, pressure: 'normal' }, -3)
    expect(argsOf(calls, 'user_challenges', 'insert')[0][0]).toMatchObject({
      start_date: daysAgo(0), current_day: 1,
    })
  })

  it('okänd pressnivå faller tillbaka på 1', async () => {
    const calls = installTables(fromMock, { quiz_results: { data: null }, user_challenges: { data: null } })
    await acceptChallenge('u1', 'extreme', { ...ANSWERS, pressure: 'mystisk' })
    expect(argsOf(calls, 'quiz_results', 'insert')[0][0]).toMatchObject({ pressure_level: 1 })
  })

  it('stannar före utmaningen om quizsparningen felar', async () => {
    const calls = installTables(fromMock, {
      quiz_results: { data: null, error: { message: 'stopp' } },
    })
    await expect(acceptChallenge('u1', 'hard', ANSWERS)).rejects.toMatchObject({ message: 'stopp' })
    expect(calls.user_challenges).toBeUndefined()
  })

  it('kastar vidare fel från utmaningsinserten', async () => {
    installTables(fromMock, {
      quiz_results: { data: null },
      user_challenges: { data: null, error: { message: 'dubblett' } },
    })
    await expect(acceptChallenge('u1', 'hard', ANSWERS)).rejects.toMatchObject({ message: 'dubblett' })
  })
})

describe('getActiveChallenge', () => {
  it('hämtar den aktiva utmaningen med nivå, annars null', async () => {
    const row = { id: 'c1', status: 'active', challenge_levels: { slug: 'hard' } }
    const calls = installTables(fromMock, { user_challenges: { data: row } })
    expect(await getActiveChallenge('u1')).toEqual(row)
    expect(argsOf(calls, 'user_challenges', 'eq')).toEqual([['user_id', 'u1'], ['status', 'active']])

    installTables(fromMock, { user_challenges: { data: null } })
    expect(await getActiveChallenge('u1')).toBeNull()
  })
})

describe('dagräkningen', () => {
  it('räknar dagar sedan start utan tak, current day toppas på 75', () => {
    expect(calculateDaysSinceStart(daysAgo(0))).toBe(1)
    expect(calculateDaysSinceStart(daysAgo(41))).toBe(42)
    expect(calculateDaysSinceStart(daysAgo(80))).toBe(81)

    expect(calculateCurrentDay(daysAgo(41))).toBe(42)
    expect(calculateCurrentDay(daysAgo(80))).toBe(75)
  })
})

describe('restartChallenge', () => {
  const challenge = {
    id: 'c1', user_id: 'u1', level_id: HARD_LEVEL, start_date: daysAgo(9),
  } as UserChallenge

  it('failar den gamla på rätt dag och startar en ny från dag 1 idag', async () => {
    const calls = installTables(fromMock, { user_challenges: { data: null } })
    await restartChallenge(challenge)

    expect(argsOf(calls, 'user_challenges', 'update')[0][0]).toEqual({
      status: 'failed', failed_on_day: 10,
    })
    expect(argsOf(calls, 'user_challenges', 'eq')[0]).toEqual(['id', 'c1'])
    expect(argsOf(calls, 'user_challenges', 'insert', 1)[0][0]).toEqual({
      user_id: 'u1', level_id: HARD_LEVEL,
      start_date: daysAgo(0), current_day: 1, status: 'active',
    })
  })

  it('faildagen toppas på 75 för utmaningar som runnit förbi slutet', async () => {
    const calls = installTables(fromMock, { user_challenges: { data: null } })
    await restartChallenge({ ...challenge, start_date: daysAgo(100) })
    expect(argsOf(calls, 'user_challenges', 'update')[0][0]).toMatchObject({ failed_on_day: 75 })
  })

  it('startar ingen ny utmaning om fail-uppdateringen felar', async () => {
    const calls = installTables(fromMock, {
      user_challenges: { data: null, error: { message: 'stopp' } },
    })
    await expect(restartChallenge(challenge)).rejects.toMatchObject({ message: 'stopp' })
    expect(calls.user_challenges).toHaveLength(1)
  })
})

describe('completeChallenge', () => {
  it('markerar utmaningen som klar på dag 75', async () => {
    const calls = installTables(fromMock, { user_challenges: { data: null } })
    await completeChallenge('c1')
    expect(argsOf(calls, 'user_challenges', 'update')[0][0]).toEqual({
      status: 'completed', current_day: 75,
    })
    expect(argsOf(calls, 'user_challenges', 'eq')[0]).toEqual(['id', 'c1'])
  })

  it('kastar vidare fel', async () => {
    installTables(fromMock, { user_challenges: { data: null, error: { message: 'nej' } } })
    await expect(completeChallenge('c1')).rejects.toMatchObject({ message: 'nej' })
  })
})
