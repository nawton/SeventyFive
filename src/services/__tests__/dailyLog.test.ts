import {
  getOrCreateTodayLog, getOrCreateTaskCompletions, setTaskCompleted,
  setTaskProgress, markDayCompleted, markDayPending, markDayFailed,
  getMissedDayNumbers, acknowledgeMissedDays, countCompletedDays,
  countCompletedDaysAllTime, getBestStreakAllTime, updateDayTasks, missedWithinWeeklyMargin,
  getAllDays, getStreak, getWeekStatuses, getStreakOf, getDayDetail,
  getTasksForDay,
} from '../dailyLog'
import { toLocalDateString } from '@/lib/date'
import { supabase } from '@/lib/supabase'
import { installTables, argsOf } from '@/testUtils/supabaseChain'
import type { UserChallenge } from '@/types/database'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn(), auth: { getSession: jest.fn() } } }))

const fromMock = supabase.from as jest.Mock
const rpcMock = supabase.rpc as jest.Mock

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toLocalDateString(d)
}

const RAW_TASK = {
  id: 'c1', completed: true, task_template_id: 't1',
  details: { glasses: 3 },
  task_templates: { name: 'Vatten', description: null, type: 'water', target_value: 3, unit: 'liter', icon: null },
}

beforeEach(() => jest.clearAllMocks())

describe('getOrCreateTodayLog', () => {
  it('återanvänder dagens logg om den finns', async () => {
    installTables(fromMock, { daily_logs: { data: { id: 'dl1' } } })
    expect(await getOrCreateTodayLog('ch1', 'u1', 42)).toEqual({ id: 'dl1' })
  })

  it('skapar en pending-logg första gången', async () => {
    const calls = installTables(fromMock, {
      daily_logs: [{ data: null }, { data: { id: 'ny' }, error: null }],
    })
    expect(await getOrCreateTodayLog('ch1', 'u1', 42)).toEqual({ id: 'ny' })
    expect(argsOf(calls, 'daily_logs', 'insert', 1)[0][0]).toEqual({
      challenge_id: 'ch1', user_id: 'u1', day_number: 42,
      date: toLocalDateString(), status: 'pending',
    })
  })
})

describe('getOrCreateTaskCompletions', () => {
  it('befintliga bockar mappas till uppgifter', async () => {
    installTables(fromMock, { task_completions: { data: [RAW_TASK] } })
    const tasks = await getOrCreateTaskCompletions('dl1', 'lvl1')
    expect(tasks[0]).toEqual({
      completionId: 'c1', templateId: 't1', name: 'Vatten', description: null,
      type: 'water', completed: true, targetValue: 3, unit: 'liter',
      details: { glasses: 3 }, icon: null,
    })
  })

  it('ett läsfel får ALDRIG tolkas som första besöket', async () => {
    installTables(fromMock, { task_completions: { data: null, error: { message: 'nere' } } })
    await expect(getOrCreateTaskCompletions('dl1', 'lvl1')).rejects.toBeTruthy()
  })

  it('första besöket seedar nivåns mallar plus egna regler, utan dubbletter', async () => {
    const calls = installTables(fromMock, {
      task_completions: [{ data: [] }, { data: [RAW_TASK], error: null }],
      task_templates: [
        { data: [{ id: 't1' }, { id: 't2' }] },       // nivåns mallar
        { data: [{ id: 't2' }, { id: 't3' }] },       // egna regler, t2 är dubblett
      ],
    })
    await getOrCreateTaskCompletions('dl1', 'lvl1', 'u1', 'ch1')
    const rows = argsOf(calls, 'task_completions', 'insert', 1)[0][0] as Array<{ task_template_id: string }>
    expect(rows.map(r => r.task_template_id)).toEqual(['t1', 't2', 't3'])
    // Nivåmallarna filtreras på user_id null så andras regler inte läcker in
    expect(argsOf(calls, 'task_templates', 'is', 0)[0]).toEqual(['user_id', null])
  })

  it('krockar inserten (dubbelbesök) läses raderna om i stället', async () => {
    installTables(fromMock, {
      task_completions: [
        { data: [] },
        { data: null, error: { code: '23505' } },
        { data: [RAW_TASK] },
      ],
      task_templates: { data: [{ id: 't1' }] },
    })
    const tasks = await getOrCreateTaskCompletions('dl1', 'lvl1')
    expect(tasks).toHaveLength(1)
  })

  it('inga mallar ger tom dag', async () => {
    installTables(fromMock, {
      task_completions: { data: [] },
      task_templates: { data: [] },
    })
    expect(await getOrCreateTaskCompletions('dl1', 'lvl1')).toEqual([])
  })
})

describe('avbockning och dagstatus', () => {
  it('setTaskCompleted stämplar tiden vid klar och nollar vid ånger', async () => {
    let calls = installTables(fromMock, { task_completions: { error: null } })
    await setTaskCompleted('c1', true)
    let patch = argsOf(calls, 'task_completions', 'update')[0][0] as { completed_at: string | null }
    expect(patch.completed_at).toEqual(expect.any(String))

    calls = installTables(fromMock, { task_completions: { error: null } })
    await setTaskCompleted('c1', false)
    patch = argsOf(calls, 'task_completions', 'update')[0][0] as { completed_at: string | null }
    expect(patch.completed_at).toBeNull()
  })

  it('setTaskProgress sparar detaljerna ihop med status', async () => {
    const calls = installTables(fromMock, { task_completions: { error: null } })
    await setTaskProgress('c1', { glasses: 2 }, false)
    expect(argsOf(calls, 'task_completions', 'update')[0][0]).toMatchObject({
      details: { glasses: 2 }, completed: false, completed_at: null,
    })
  })

  it('markDayFailed sparar ursäkten på de oavklarade uppgifterna', async () => {
    const calls = installTables(fromMock, {
      daily_logs: { error: null },
      task_completions: { error: null },
    })
    await markDayFailed('dl1', 'Somnade i soffan')
    expect(argsOf(calls, 'daily_logs', 'update')[0][0]).toEqual({ status: 'failed' })
    expect(argsOf(calls, 'task_completions', 'update')[0][0]).toEqual({ failed_reason: 'Somnade i soffan' })
    expect(argsOf(calls, 'task_completions', 'eq')).toEqual([
      ['daily_log_id', 'dl1'], ['completed', false],
    ])
  })

  it('markDayCompleted och markDayPending växlar status', async () => {
    let calls = installTables(fromMock, { daily_logs: { error: null } })
    await markDayCompleted('dl1')
    expect(argsOf(calls, 'daily_logs', 'update')[0][0]).toMatchObject({ status: 'completed' })

    calls = installTables(fromMock, { daily_logs: { error: null } })
    await markDayPending('dl1')
    expect(argsOf(calls, 'daily_logs', 'update')[0][0]).toEqual({ status: 'pending', completed_at: null })
  })
})

describe('missade dagar', () => {
  const challenge = (createdDaysAfterStart: number): UserChallenge => ({
    id: 'ch1', user_id: 'u1',
    start_date: daysAgo(10),
    created_at: `${daysAgo(10 - createdDaysAfterStart)}T08:00:00Z`,
  } as UserChallenge)

  it('flaggar bara okvitterade dagar före idag', async () => {
    installTables(fromMock, { daily_logs: { data: [
      { day_number: 1, status: 'completed' },
      { day_number: 2, status: 'failed' },
      { day_number: 3, status: 'pending' },
    ] } })
    // Dag 11 idag: dag 3 (pending) och 4–10 (helt utan logg) är missade
    expect(await getMissedDayNumbers(challenge(0), 11)).toEqual([3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('bakdaterad start flaggar inget före appens första dag', async () => {
    installTables(fromMock, { daily_logs: { data: [] } })
    // Skapad 5 dagar efter startdatumet → dag 1–5 var "före appen"
    expect(await getMissedDayNumbers(challenge(5), 11)).toEqual([6, 7, 8, 9, 10])
  })

  it('acknowledgeMissedDays kvitterar med rätt datum per dag', async () => {
    const calls = installTables(fromMock, { daily_logs: { error: null } })
    await acknowledgeMissedDays(challenge(0), [3, 4])
    const [rows, opts] = argsOf(calls, 'daily_logs', 'upsert')[0] as [Array<{ day_number: number; date: string; status: string }>, unknown]
    expect(rows.map(r => r.day_number)).toEqual([3, 4])
    expect(rows[0].date).toBe(daysAgo(8))   // start för 10 dagar sedan + dag 3
    expect(rows[0].status).toBe('failed')
    expect(opts).toEqual({ onConflict: 'challenge_id,day_number' })

    jest.clearAllMocks()
    await acknowledgeMissedDays(challenge(0), [])
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('översikter', () => {
  it('countCompletedDays räknar klara dagar', async () => {
    installTables(fromMock, { daily_logs: { count: 41 } })
    expect(await countCompletedDays('ch1')).toBe(41)
  })

  it('getAllDays klassar historik, idag och framtid', async () => {
    installTables(fromMock, { daily_logs: { data: [
      { day_number: 1, status: 'completed' },
      { day_number: 2, status: 'failed' },
    ] } })
    const days = await getAllDays('ch1', 4)
    expect(days[0].status).toBe('completed')
    expect(days[1].status).toBe('failed')
    expect(days[2].status).toBe('failed')     // dag 3 utan logg före idag = missad
    expect(days[3].status).toBe('pending')    // dag 4 är idag
    expect(days[4].status).toBe('future')
    expect(days).toHaveLength(75)
  })

  it('getWeekStatuses mappar datum till status', async () => {
    installTables(fromMock, { daily_logs: { data: [
      { date: '2026-07-21', status: 'completed' },
      { date: '2026-07-22', status: 'failed' },
    ] } })
    expect(await getWeekStatuses('ch1')).toEqual({
      '2026-07-21': 'completed', '2026-07-22': 'failed',
    })
  })
})

describe('streak', () => {
  it('räknar bakåt från idag när dagen är klar', async () => {
    installTables(fromMock, { daily_logs: { data: [
      { date: daysAgo(0), status: 'completed' },
      { date: daysAgo(1), status: 'completed' },
      { date: daysAgo(2), status: 'completed' },
      { date: daysAgo(3), status: 'failed' },
    ] } })
    expect(await getStreak('ch1')).toBe(3)
  })

  it('opåbörjad dag räknas från igår, och luckor bryter', async () => {
    installTables(fromMock, { daily_logs: { data: [
      { date: daysAgo(0), status: 'pending' },
      { date: daysAgo(1), status: 'completed' },
      { date: daysAgo(3), status: 'completed' },   // hål på dag 2 → bryter
    ] } })
    expect(await getStreak('ch1')).toBe(1)

    installTables(fromMock, { daily_logs: { data: [] } })
    expect(await getStreak('ch1')).toBe(0)
  })

  it('getStreakOf litar bara på numeriska RPC-svar', async () => {
    rpcMock.mockResolvedValue({ data: 17 })
    expect(await getStreakOf('u2')).toBe(17)
    rpcMock.mockResolvedValue({ data: null })
    expect(await getStreakOf('u2')).toBe(0)
    rpcMock.mockResolvedValue({ data: 5, error: { message: 'nej' } })
    expect(await getStreakOf('u2')).toBe(0)
  })
})

// Normals marginal: en missad dag per utmaningsvecka är förlåten
describe('missedWithinWeeklyMargin', () => {
  it('en miss per vecka ryms i marginalen, även i olika veckor', () => {
    expect(missedWithinWeeklyMargin([])).toBe(true)
    expect(missedWithinWeeklyMargin([3])).toBe(true)
    expect(missedWithinWeeklyMargin([3, 9, 16])).toBe(true)   // vecka 1, 2 och 3
  })

  it('två missar i samma utmaningsvecka spränger marginalen', () => {
    expect(missedWithinWeeklyMargin([3, 5])).toBe(false)      // båda i vecka 1
    expect(missedWithinWeeklyMargin([8, 14])).toBe(false)     // båda i vecka 2 (dag 8–14)
    expect(missedWithinWeeklyMargin([7, 8])).toBe(true)       // veckogränsen: dag 7 v1, dag 8 v2
  })
})

// Efterhandsredigeringen från kalendern: bockar skrivs, status följer med
describe('updateDayTasks', () => {
  const signIn = (uid: string | null) => {
    ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: uid ? { user: { id: uid } } : null },
    })
  }

  it('befintlig dag: upsertar bockarna och blir klarad när allt är i', async () => {
    const calls = installTables(fromMock, {
      daily_logs: [{ data: { id: 'log1' } }, { data: null }],
      task_completions: [{ data: null }, { data: [{ completed: true }, { completed: true }] }],
    })
    const status = await updateDayTasks('ch1', 5, daysAgo(3), [
      { completionId: 'a', templateId: 't1', completed: true },
      { completionId: 'b', templateId: 't2', completed: true },
    ])
    expect(status).toBe('completed')

    const [rows, options] = argsOf(calls, 'task_completions', 'upsert')[0]
    expect(options).toEqual({ onConflict: 'daily_log_id,task_template_id' })
    expect(rows).toEqual([
      expect.objectContaining({ daily_log_id: 'log1', task_template_id: 't1', completed: true, failed_reason: null }),
      expect.objectContaining({ daily_log_id: 'log1', task_template_id: 't2', completed: true, failed_reason: null }),
    ])
    const statusUpdate = argsOf(calls, 'daily_logs', 'update', 1)[0][0] as Record<string, unknown>
    expect(statusUpdate.status).toBe('completed')
    expect(typeof statusUpdate.completed_at).toBe('string')
  })

  it('glömd dag utan logg: loggen skapas först, ofullständig dag bakåt blir failed', async () => {
    signIn('u1')
    const calls = installTables(fromMock, {
      daily_logs: [{ data: null }, { data: { id: 'log9' } }, { data: null }],
      task_completions: [{ data: null }, { data: [{ completed: true }, { completed: false }] }],
    })
    const status = await updateDayTasks('ch1', 3, daysAgo(7), [
      { completionId: 'tpl:t1', templateId: 't1', completed: true },
      { completionId: 'tpl:t2', templateId: 't2', completed: false },
    ])
    expect(status).toBe('failed')

    expect(argsOf(calls, 'daily_logs', 'insert', 1)[0][0]).toEqual({
      challenge_id: 'ch1', user_id: 'u1', day_number: 3,
      date: daysAgo(7), status: 'pending',
    })
    expect(argsOf(calls, 'daily_logs', 'update', 2)[0][0]).toMatchObject({
      status: 'failed', completed_at: null,
    })
  })

  it('på Normal räknas dagen som klarad utan valfria foto, läsning och egna regler', async () => {
    const calls = installTables(fromMock, {
      user_challenges: { data: { challenge_levels: { slug: 'normal' } } },
      daily_logs: [{ data: { id: 'log1' } }, { data: null }],
      task_completions: [{ data: null }, { data: [
        { completed: true,  task_templates: { type: 'workout' } },
        { completed: true,  task_templates: { type: 'diet' } },
        { completed: true,  task_templates: { type: 'water' } },
        { completed: false, task_templates: { type: 'photo' } },
        { completed: false, task_templates: { type: 'reading' } },
        { completed: false, task_templates: { type: 'custom' } },
      ] }],
    })
    expect(await updateDayTasks('ch1', 5, daysAgo(3), [
      { completionId: 'a', templateId: 't1', completed: true },
    ])).toBe('completed')
    expect(argsOf(calls, 'daily_logs', 'update', 1)[0][0]).toMatchObject({ status: 'completed' })
  })

  it('på Hard är fotot ett krav även vid efterhandsredigering', async () => {
    installTables(fromMock, {
      user_challenges: { data: { challenge_levels: { slug: 'hard' } } },
      daily_logs: [{ data: { id: 'log1' } }, { data: null }],
      task_completions: [{ data: null }, { data: [
        { completed: true,  task_templates: { type: 'workout' } },
        { completed: false, task_templates: { type: 'photo' } },
      ] }],
    })
    expect(await updateDayTasks('ch1', 5, daysAgo(3), [
      { completionId: 'a', templateId: 't1', completed: true },
    ])).toBe('failed')
  })

  it('dagens datum med luckor förblir pågående, inte failad', async () => {
    installTables(fromMock, {
      daily_logs: [{ data: { id: 'log1' } }, { data: null }],
      task_completions: [{ data: null }, { data: [{ completed: false }] }],
    })
    expect(await updateDayTasks('ch1', 10, daysAgo(0), [
      { completionId: 'a', templateId: 't1', completed: false },
    ])).toBe('pending')
  })

  it('tomma uppdateringar rör ingenting, läsfel bubblar upp', async () => {
    expect(await updateDayTasks('ch1', 5, daysAgo(1), [])).toBe('pending')
    expect(fromMock).not.toHaveBeenCalled()

    installTables(fromMock, { daily_logs: { data: null, error: { message: 'rls' } } })
    await expect(updateDayTasks('ch1', 5, daysAgo(1), [
      { completionId: 'a', templateId: 't1', completed: true },
    ])).rejects.toMatchObject({ message: 'rls' })
  })
})

// Statistiken överlever en fail: all-time-funktionerna räknar över ALLA
// utmaningar, så en omstart bara nollar streaken — aldrig medaljunderlaget
describe('all-time-statistik över utmaningsgränser', () => {
  it('countCompletedDaysAllTime räknar på användaren, inte utmaningen', async () => {
    const calls = installTables(fromMock, { daily_logs: { data: null, count: 53 } })
    expect(await countCompletedDaysAllTime('u1')).toBe(53)
    // Filtrerar på user_id + completed — utmaningens id är medvetet inte med
    expect(argsOf(calls, 'daily_logs', 'eq')).toEqual([
      ['user_id', 'u1'], ['status', 'completed'],
    ])
  })

  it('getBestStreakAllTime hittar längsta sviten även när den slutar i en fail', async () => {
    installTables(fromMock, { daily_logs: { data: [
      { date: '2026-07-01', status: 'completed' },
      { date: '2026-07-02', status: 'completed' },
      { date: '2026-07-03', status: 'completed' },
      { date: '2026-07-04', status: 'failed' },      // utmaningen failade här
      { date: '2026-07-05', status: 'completed' },   // ny utmaning, ny svit
      { date: '2026-07-06', status: 'completed' },
    ] } })
    expect(await getBestStreakAllTime('u1')).toBe(3)
  })

  it('dubbelloggar på samma datum (failad gammal + ny utmaning) bryter inte sviten', async () => {
    installTables(fromMock, { daily_logs: { data: [
      { date: '2026-07-01', status: 'completed' },
      { date: '2026-07-02', status: 'failed' },      // gamla utmaningens sista dag
      { date: '2026-07-02', status: 'completed' },   // nya utmaningens dag 1, samma datum
      { date: '2026-07-03', status: 'completed' },
    ] } })
    expect(await getBestStreakAllTime('u1')).toBe(3)
  })

  it('luckor i kalendern nollar sviten, tomt ger noll', async () => {
    installTables(fromMock, { daily_logs: { data: [
      { date: '2026-07-01', status: 'completed' },
      { date: '2026-07-02', status: 'completed' },
      { date: '2026-07-10', status: 'completed' },
      { date: '2026-07-11', status: 'completed' },
      { date: '2026-07-12', status: 'completed' },
    ] } })
    expect(await getBestStreakAllTime('u1')).toBe(3)

    installTables(fromMock, { daily_logs: { data: [] } })
    expect(await getBestStreakAllTime('u1')).toBe(0)
  })
})

describe('dagvyer utan bieffekter', () => {
  it('getDayDetail: ingen logg ger null-status och inga uppgifter', async () => {
    installTables(fromMock, { daily_logs: { data: null } })
    expect(await getDayDetail('ch1', '2026-07-01')).toEqual({ status: null, tasks: [] })
  })

  it('getDayDetail: logg med uppgifter mappas', async () => {
    installTables(fromMock, {
      daily_logs: { data: { id: 'dl1', status: 'completed' } },
      task_completions: { data: [RAW_TASK] },
    })
    const detail = await getDayDetail('ch1', '2026-07-01')
    expect(detail.status).toBe('completed')
    expect(detail.tasks[0].name).toBe('Vatten')
  })

  it('getTasksForDay: dag utan logg visar mallarna som ogjorda', async () => {
    installTables(fromMock, {
      daily_logs: { data: null },
      user_challenges: { data: { level_id: 'lvl1', user_id: 'u1' } },
      task_templates: [
        { data: [{ id: 't1', name: 'Träning', type: 'workout' }] },
        { data: [{ id: 't9', name: 'Kall dusch', type: 'workout', icon: 'snow' }] },
      ],
    })
    const tasks = await getTasksForDay('ch1', 5)
    expect(tasks).toHaveLength(2)
    expect(tasks![0]).toMatchObject({ completionId: 'tpl:t1', completed: false })
    expect(tasks![1]).toMatchObject({ name: 'Kall dusch', icon: 'snow' })
  })

  it('getTasksForDay: null när varken logg eller utmaning finns', async () => {
    installTables(fromMock, {
      daily_logs: { data: null },
      user_challenges: { data: null },
    })
    expect(await getTasksForDay('ch1', 5)).toBeNull()
  })
})
