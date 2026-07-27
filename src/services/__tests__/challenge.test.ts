import {
  acceptChallenge, getActiveChallenge, calculateDaysSinceStart,
  calculateCurrentDay, restartChallenge, completeChallenge, levelDisplayName,
} from '../challenge'
import { supabase } from '@/lib/supabase'
import { toLocalDateString } from '@/lib/date'
import { installTables, argsOf } from '@/testUtils/supabaseChain'
import type { UserChallenge, UserChallengeWithLevel } from '@/types/database'

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

// Backfyllningens standardtabeller: skapade loggar + nivåns två uppgiftsmallar
function backfillTables() {
  return {
    quiz_results: { data: null },
    user_challenges: { data: { id: 'c1' } },
    daily_logs: { data: [{ id: 'l1' }, { id: 'l2' }] },
    task_templates: { data: [{ id: 't1' }, { id: 't2' }] },
    task_completions: { data: null },
  }
}

describe('acceptChallenge', () => {
  it('sparar quizsvaren och startar utmaningen på dag 1 idag, utan backfyllnad', async () => {
    const calls = installTables(fromMock, backfillTables())
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
    // Dag 1 = inga tidigare dagar att fylla i
    expect(calls.daily_logs).toBeUndefined()
  })

  it('startdag mitt i: tidigare dagar blir klarade loggar med ifyllda checkar', async () => {
    const calls = installTables(fromMock, backfillTables())
    await acceptChallenge('u1', 'normal', { ...ANSWERS, pressure: 'normal' }, 42)
    expect(argsOf(calls, 'user_challenges', 'insert')[0][0]).toMatchObject({
      start_date: daysAgo(41), current_day: 42,
    })

    // 41 klarade dagar: dag 1 för 41 dagar sedan … dag 41 igår
    const logs = argsOf(calls, 'daily_logs', 'insert')[0][0] as Array<Record<string, unknown>>
    expect(logs).toHaveLength(41)
    expect(logs[0]).toMatchObject({
      challenge_id: 'c1', user_id: 'u1', day_number: 1,
      date: daysAgo(41), status: 'completed',
    })
    expect(logs[40]).toMatchObject({ day_number: 41, date: daysAgo(1), status: 'completed' })
    expect(logs.every(l => typeof l.completed_at === 'string')).toBe(true)

    // Nivåmallarna hämtas utan egna regler, och alla checkar bockas i
    expect(argsOf(calls, 'task_templates', 'is')[0]).toEqual(['user_id', null])
    const completions = argsOf(calls, 'task_completions', 'insert')[0][0] as Array<Record<string, unknown>>
    expect(completions).toHaveLength(2 * 2)   // 2 skapade loggar × 2 mallar i mocken
    expect(completions[0]).toMatchObject({ daily_log_id: 'l1', task_template_id: 't1', completed: true })
  })

  it('klampar startdagen till 1–75 åt båda hållen', async () => {
    let calls = installTables(fromMock, backfillTables())
    await acceptChallenge('u1', 'normal', { ...ANSWERS, pressure: 'normal' }, 999)
    expect(argsOf(calls, 'user_challenges', 'insert')[0][0]).toMatchObject({
      start_date: daysAgo(74), current_day: 75,
    })
    expect(argsOf(calls, 'daily_logs', 'insert')[0][0]).toHaveLength(74)

    calls = installTables(fromMock, backfillTables())
    await acceptChallenge('u1', 'normal', { ...ANSWERS, pressure: 'normal' }, -3)
    expect(argsOf(calls, 'user_challenges', 'insert')[0][0]).toMatchObject({
      start_date: daysAgo(0), current_day: 1,
    })
    expect(calls.daily_logs).toBeUndefined()
  })

  it('okänd pressnivå faller tillbaka på 1', async () => {
    const calls = installTables(fromMock, backfillTables())
    await acceptChallenge('u1', 'extreme', { ...ANSWERS, pressure: 'mystisk' })
    expect(argsOf(calls, 'quiz_results', 'insert')[0][0]).toMatchObject({ pressure_level: 1 })
  })

  it('fel i backfyllnaden bubblar upp', async () => {
    installTables(fromMock, {
      ...backfillTables(),
      daily_logs: { data: null, error: { message: 'rls' } },
    })
    await expect(acceptChallenge('u1', 'hard', ANSWERS, 10)).rejects.toMatchObject({ message: 'rls' })
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

  it('en fail rör BARA utmaningstabellen: pass, rundor och loggar lämnas orörda', async () => {
    const calls = installTables(fromMock, { user_challenges: { data: null } })
    await restartChallenge(challenge)

    // Enda tabellen som anropas är user_challenges — ingen radering någonstans
    expect(new Set(fromMock.mock.calls.map(c => c[0]))).toEqual(new Set(['user_challenges']))
    expect(calls.user_workouts).toBeUndefined()
    expect(calls.daily_logs).toBeUndefined()
    expect(calls.workout_sessions).toBeUndefined()
    expect(calls.workout_completions).toBeUndefined()
    expect(calls.progress_photos).toBeUndefined()
    expect(argsOf(calls, 'user_challenges', 'delete')).toHaveLength(0)
    expect(argsOf(calls, 'user_challenges', 'delete', 1)).toHaveLength(0)
  })

  it('startar ingen ny utmaning om fail-uppdateringen felar', async () => {
    const calls = installTables(fromMock, {
      user_challenges: { data: null, error: { message: 'stopp' } },
    })
    await expect(restartChallenge(challenge)).rejects.toMatchObject({ message: 'stopp' })
    expect(calls.user_challenges).toHaveLength(1)
  })
})

describe('levelDisplayName', () => {
  const withLevel = (slug: string, display_name: string) =>
    ({ challenge_levels: { slug, display_name } } as unknown as UserChallengeWithLevel)

  it('visar rena nivånamn oavsett vad databasen råkar heta', () => {
    expect(levelDisplayName(withLevel('normal', 'Nawton Flow'))).toBe('Normal')
    expect(levelDisplayName(withLevel('hard', 'Nawton Hard'))).toBe('Hard')
    expect(levelDisplayName(withLevel('extreme', 'Nawton Extreme'))).toBe('Extreme')
  })

  it('okänd slug faller tillbaka på databasnamnet, rensat från Nawton', () => {
    expect(levelDisplayName(withLevel('custom', 'Nawton Special'))).toBe('Special')
    expect(levelDisplayName(withLevel('custom', 'Vinter 75'))).toBe('Vinter 75')
    expect(levelDisplayName(null)).toBe('')
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
