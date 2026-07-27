import {
  getWorkoutSessions, createWorkoutSession, updateWorkoutSession,
  completeCardioSession, deleteWorkoutSession, deleteSessionWithSkips,
  deleteRepeatingSessions, deleteFutureOnceSessions, skipExerciseForDay,
  reorderWorkoutSessions, addMissedExercise, addQuickExercise,
  addSingleExerciseToSession, deleteSessionExercise, updateSessionExercise,
  getCompletedExerciseNamesForWeek, getCompletedExerciseNamesByDay,
  getCompletedExerciseIds, getCompletedSessionsHistory,
  getExerciseCompletionCounts, completeExercise, uncompleteExercise,
  dateForWeekday, getCompletedSessionsByDate, getCompletedSessionIds,
  getCardioCompletions, completeSession, uncompleteSession,
  getCompletedExerciseNamesBetween, deleteCompletion,
  type WorkoutSession,
} from '../workoutSchedule'
import { toLocalDateString, weekdayOf } from '@/lib/date'
import { supabase } from '@/lib/supabase'
import { installTables, argsOf } from '@/testUtils/supabaseChain'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }))

const fromMock = supabase.from as jest.Mock

beforeEach(() => jest.clearAllMocks())

describe('getWorkoutSessions', () => {
  it('mappar rader med standardvärden och sorterar övningarna', async () => {
    installTables(fromMock, {
      workout_sessions: { data: [{
        id: 's1', user_id: 'u1', name: 'Överkropp', weekdays: null,
        sort_order: 0, created_at: 't', notes: undefined,
        session_type: null, cardio_type: undefined,
        session_exercises: [
          { id: 'e2', exercise_name: 'Rodd', sort_order: 1 },
          { id: 'e1', exercise_name: 'Bänkpress', sort_order: 0 },
        ],
      }] },
    })
    const sessions = await getWorkoutSessions('u1')
    expect(sessions[0]).toMatchObject({
      weekdays: [], notes: null, session_type: 'gym', cardio_type: null,
    })
    expect(sessions[0].exercises.map(e => e.id)).toEqual(['e1', 'e2'])
  })
})

describe('createWorkoutSession', () => {
  it('gympass: passet skapas och övningarna får sorteringsordning', async () => {
    const calls = installTables(fromMock, {
      workout_sessions: { data: { id: 's1', name: 'Ben' }, error: null },
      session_exercises: { error: null },
    })
    const created = await createWorkoutSession('u1', 'Ben', [3], [
      { exercise_name: 'Knäböj', sets: 3, reps: '6' },
      { exercise_name: 'Utfall', sets: 2, reps: '12' },
    ])
    expect(created.exercises).toEqual([])
    const rows = argsOf(calls, 'session_exercises', 'insert')[0][0] as Array<{ sort_order: number }>
    expect(rows.map(r => r.sort_order)).toEqual([0, 1])
  })

  it('cardiopass sparar typen och skapar inga övningsrader', async () => {
    const calls = installTables(fromMock, {
      workout_sessions: { data: { id: 's1' }, error: null },
    })
    await createWorkoutSession('u1', 'Löpning', [2], [], null, 'cardio', 'running')
    expect(argsOf(calls, 'workout_sessions', 'insert')[0][0]).toMatchObject({
      session_type: 'cardio', cardio_type: 'running',
    })
    expect(calls.session_exercises).toBeUndefined()
  })

  it('misslyckad övningsinsert kastas så passet inte blir tyst tomt', async () => {
    installTables(fromMock, {
      workout_sessions: { data: { id: 's1' }, error: null },
      session_exercises: { error: { message: 'nej' } },
    })
    await expect(createWorkoutSession('u1', 'Ben', [], [
      { exercise_name: 'Knäböj', sets: 3, reps: '6' },
    ])).rejects.toBeTruthy()
  })
})

describe('updateWorkoutSession', () => {
  it('uppdaterar passet och byter ut övningslistan', async () => {
    const calls = installTables(fromMock, {
      workout_sessions: { error: null },
      session_exercises: [{ error: null }, { error: null }],
    })
    await updateWorkoutSession('s1', 'Ben 2.0', [3, 5], [
      { exercise_name: 'Marklyft', sets: 2, reps: '5' },
    ])
    expect(argsOf(calls, 'session_exercises', 'delete', 0)).toHaveLength(1)
    const rows = argsOf(calls, 'session_exercises', 'insert', 1)[0][0] as Array<Record<string, unknown>>
    expect(rows[0]).toMatchObject({ session_id: 's1', exercise_name: 'Marklyft', sort_order: 0 })
  })
})

describe('completeCardioSession', () => {
  const doIt = () => completeCardioSession('s1', 'u1', '2026-07-27', 5.2, 1800)

  it('sparar distans och tid med konfliktnyckel', async () => {
    const calls = installTables(fromMock, { workout_completions: { error: null } })
    await doIt()
    expect(argsOf(calls, 'workout_completions', 'upsert')[0]).toEqual([
      { session_id: 's1', user_id: 'u1', completed_date: '2026-07-27', distance_km: 5.2, duration_seconds: 1800 },
      { onConflict: 'session_id,completed_date' },
    ])
  })

  it('dubbelmarkering är ofarlig och saknade kolumner faller tillbaka utan detaljer', async () => {
    installTables(fromMock, { workout_completions: { error: { code: '23505' } } })
    await expect(doIt()).resolves.toBeUndefined()

    const calls = installTables(fromMock, {
      workout_completions: [{ error: { code: '42703' } }, { error: null }],
    })
    await doIt()
    const fallback = argsOf(calls, 'workout_completions', 'upsert', 1)[0][0] as Record<string, unknown>
    expect(fallback.distance_km).toBeUndefined()

    installTables(fromMock, { workout_completions: { error: { code: '500' } } })
    await expect(doIt()).rejects.toBeTruthy()
  })
})

describe('radering av pass', () => {
  it('deleteSessionWithSkips tar bort SKIP-poster som pekar på passet', async () => {
    const calls = installTables(fromMock, { workout_sessions: [{ error: null }, { error: null }] })
    await deleteSessionWithSkips('u1', 's1')
    expect(argsOf(calls, 'workout_sessions', 'like', 0)[0]).toEqual(['name', 'SKIP:%:s1'])
    expect(argsOf(calls, 'workout_sessions', 'eq', 1)[0]).toEqual(['id', 's1'])
  })

  it('deleteRepeatingSessions plockar upprepande pass och deras SKIP-rader', async () => {
    const calls = installTables(fromMock, {
      workout_sessions: [
        { data: [
          { id: 's1', name: 'Överkropp', weekdays: [1] },
          { id: 's2', name: 'SKIP:2026-07-20:s1', weekdays: [] },
          { id: 's3', name: 'ONCE:2026-07-21:Extra', weekdays: [] },
        ] },
        { error: null },
      ],
    })
    expect(await deleteRepeatingSessions('u1')).toBe(1)
    expect(argsOf(calls, 'workout_sessions', 'in', 1)[0]).toEqual(['id', ['s1', 's2']])
  })

  it('deleteRepeatingSessions gör inget utan upprepande pass', async () => {
    installTables(fromMock, { workout_sessions: { data: [{ id: 's3', name: 'ONCE:x', weekdays: [] }] } })
    expect(await deleteRepeatingSessions('u1')).toBe(0)
  })

  it('deleteFutureOnceSessions raderar bara framtida engångspass', async () => {
    const today = toLocalDateString()
    const calls = installTables(fromMock, {
      workout_sessions: [
        { data: [
          { id: 'a', name: `ONCE:2099-01-01:Fest`, weekdays: [] },   // framtid → bort
          { id: 'b', name: `ONCE:2020-01-01:Historia`, weekdays: [] },
          { id: 'c', name: '2099-01-01', weekdays: [] },             // daglogg framtid → bort
          { id: 'd', name: today, weekdays: [] },                    // idag → kvar
          { id: 'e', name: 'Överkropp', weekdays: [1] },             // upprepande → kvar
        ] },
        { error: null },
      ],
    })
    expect(await deleteFutureOnceSessions('u1')).toBe(2)
    expect(argsOf(calls, 'workout_sessions', 'in', 1)[0]).toEqual(['id', ['a', 'c']])
  })
})

describe('skipExerciseForDay', () => {
  it('skapar en dagskopia utan den överhoppade övningen plus en SKIP-rad', async () => {
    const calls = installTables(fromMock, {
      workout_sessions: [{ data: { id: 'kopia' }, error: null }, { error: null }],
      session_exercises: { error: null },
    })
    const session = {
      id: 's1', name: 'ONCE:2026-07-27:Överkropp', exercises: [
        { id: 'e1', exercise_name: 'Bänkpress', sets: 3, reps: '8' },
        { id: 'e2', exercise_name: 'Rodd', sets: 3, reps: '10' },
      ],
    } as unknown as WorkoutSession
    await skipExerciseForDay('u1', session, '2026-07-27', 'e1')

    // Basnamnet plockas ur ONCE-prefixet och kopian innehåller bara Rodd
    expect(argsOf(calls, 'workout_sessions', 'insert', 0)[0][0]).toMatchObject({
      name: 'ONCE:2026-07-27:Överkropp',
    })
    const rows = argsOf(calls, 'session_exercises', 'insert')[0][0] as Array<{ exercise_name: string }>
    expect(rows.map(r => r.exercise_name)).toEqual(['Rodd'])
    expect(argsOf(calls, 'workout_sessions', 'insert', 1)[0][0]).toEqual({
      user_id: 'u1', name: 'SKIP:2026-07-27:s1', weekdays: [],
    })
  })
})

describe('övningsrader', () => {
  it('reorderWorkoutSessions skriver ny ordning per pass', async () => {
    const calls = installTables(fromMock, { workout_sessions: { error: null } })
    await reorderWorkoutSessions(['b', 'a'])
    expect(argsOf(calls, 'workout_sessions', 'update', 0)[0]).toEqual([{ sort_order: 0 }])
    expect(argsOf(calls, 'workout_sessions', 'update', 1)[0]).toEqual([{ sort_order: 1 }])
  })

  it('addQuickExercise återanvänder dagens session och räknar sorteringen', async () => {
    const calls = installTables(fromMock, {
      workout_sessions: { data: { id: 'dag', session_exercises: [{ id: 'x' }, { id: 'y' }] } },
      session_exercises: { data: { id: 'ny', exercise_name: 'Plankan' }, error: null },
    })
    const created = await addQuickExercise('u1', '2026-07-27', 'Plankan', 2, '60 sek')
    expect(created.id).toBe('ny')
    expect(argsOf(calls, 'session_exercises', 'insert')[0][0]).toMatchObject({
      session_id: 'dag', sort_order: 2,
    })
  })

  it('addMissedExercise skapar ONCE-sessionen när den saknas', async () => {
    const calls = installTables(fromMock, {
      workout_sessions: [
        { data: null },                                   // finns inte
        { data: { id: 'skapad' }, error: null },
      ],
      session_exercises: { data: { id: 'ny' }, error: null },
    })
    await addMissedExercise('u1', '2026-07-27', 'Rodd', 3, '10')
    expect(argsOf(calls, 'workout_sessions', 'insert', 1)[0][0]).toMatchObject({
      name: 'ONCE:2026-07-27:Träningspass', weekdays: [],
    })
    expect(argsOf(calls, 'session_exercises', 'insert')[0][0]).toMatchObject({ sort_order: 0 })
  })

  it('uppdatering och radering av en övningsrad', async () => {
    let calls = installTables(fromMock, { session_exercises: { error: null } })
    await updateSessionExercise('e1', 4, '8')
    expect(argsOf(calls, 'session_exercises', 'update')[0][0]).toEqual({ sets: 4, reps: '8' })

    calls = installTables(fromMock, { session_exercises: { error: null } })
    await deleteSessionExercise('e1')
    expect(argsOf(calls, 'session_exercises', 'eq')[0]).toEqual(['id', 'e1'])

    installTables(fromMock, { session_exercises: { data: null, error: { message: 'nej' } } })
    await expect(addSingleExerciseToSession('s1', 'Rodd', 0, 3, '10')).rejects.toBeTruthy()
  })
})

describe('avbockade övningar', () => {
  it('veckans namn slås upp via completions → session_exercises', async () => {
    installTables(fromMock, {
      exercise_completions: { data: [{ exercise_id: 'e1' }, { exercise_id: 'e2' }] },
      session_exercises: { data: [{ exercise_name: 'Bänkpress' }, { exercise_name: 'Rodd' }] },
    })
    expect(await getCompletedExerciseNamesForWeek('u1', '2026-07-21', '2026-07-27'))
      .toEqual(['Bänkpress', 'Rodd'])

    installTables(fromMock, { exercise_completions: { data: [] } })
    expect(await getCompletedExerciseNamesForWeek('u1', 'a', 'b')).toEqual([])
  })

  it('per dag-grupperingen kopplar namn till datum och hoppar okända id:n', async () => {
    installTables(fromMock, {
      exercise_completions: { data: [
        { exercise_id: 'e1', completed_date: '2026-07-21' },
        { exercise_id: 'e1', completed_date: '2026-07-23' },
        { exercise_id: 'raderad', completed_date: '2026-07-23' },
      ] },
      session_exercises: { data: [{ id: 'e1', exercise_name: 'Knäböj' }] },
    })
    expect(await getCompletedExerciseNamesByDay('u1', 'a', 'b')).toEqual({
      '2026-07-21': ['Knäböj'],
      '2026-07-23': ['Knäböj'],
    })
  })

  it('intervalluppslag med öppna gränser och räknare per övning', async () => {
    const calls = installTables(fromMock, {
      exercise_completions: { data: [{ exercise_id: 'e1' }, { exercise_id: 'e1' }, { exercise_id: 'e2' }] },
      session_exercises: { data: [{ id: 'e1', exercise_name: 'Knäböj' }, { id: 'e2', exercise_name: 'Rodd' }] },
    })
    expect(await getCompletedExerciseNamesBetween('u1', '2026-07-01', null))
      .toEqual(['Knäböj', 'Knäböj', 'Rodd'])
    expect(argsOf(calls, 'exercise_completions', 'gte')[0]).toEqual(['completed_date', '2026-07-01'])
    expect(argsOf(calls, 'exercise_completions', 'lt')).toEqual([])

    installTables(fromMock, {
      exercise_completions: { data: [{ exercise_id: 'e1' }, { exercise_id: 'e1' }] },
    })
    expect(await getExerciseCompletionCounts('u1')).toEqual({ e1: 2 })
  })

  it('bocka av och ångra: dubblett sväljs, andra fel kastas', async () => {
    installTables(fromMock, { exercise_completions: { error: { code: '23505' } } })
    await expect(completeExercise('e1', 'u1', '2026-07-27')).resolves.toBeUndefined()

    installTables(fromMock, { exercise_completions: { error: { code: '500' } } })
    await expect(completeExercise('e1', 'u1', '2026-07-27')).rejects.toBeTruthy()

    const calls = installTables(fromMock, { exercise_completions: { error: null } })
    await uncompleteExercise('e1', 'u1', '2026-07-27')
    expect(argsOf(calls, 'exercise_completions', 'eq')).toEqual([
      ['exercise_id', 'e1'], ['user_id', 'u1'], ['completed_date', '2026-07-27'],
    ])
    expect(await getCompletedExerciseIds('u1', '2026-07-27')).toEqual([])
  })
})

describe('passhistorik och kalenderdata', () => {
  it('historiken städar ONCE-namn, sorterar övningar och normaliserar siffror', async () => {
    installTables(fromMock, {
      workout_completions: { data: [{
        id: 'c1', completed_date: '2026-07-26', distance_km: '5.2', duration_seconds: 1800,
        workout_sessions: {
          name: 'ONCE:2026-07-26:Extra pass', session_type: 'cardio', cardio_type: 'running',
          session_exercises: [
            { exercise_name: 'B', sort_order: 1 },
            { exercise_name: 'A', sort_order: 0 },
          ],
        },
      }, {
        id: 'c2', completed_date: '2026-07-25', distance_km: null, duration_seconds: null,
        workout_sessions: null,
      }] },
    })
    const rows = await getCompletedSessionsHistory('u1')
    expect(rows[0]).toMatchObject({
      name: 'Extra pass', sessionType: 'cardio', distanceKm: 5.2, exerciseNames: ['A', 'B'],
    })
    expect(rows[1]).toMatchObject({ name: 'Pass', sessionType: 'gym', distanceKm: null })
  })

  it('avklarade pass grupperas per datum och cardiodetaljer filtreras', async () => {
    installTables(fromMock, {
      workout_completions: { data: [
        { session_id: 's1', completed_date: '2026-07-26' },
        { session_id: 's2', completed_date: '2026-07-26' },
        { session_id: 's1', completed_date: '2026-07-25' },
      ] },
    })
    expect(await getCompletedSessionsByDate('u1')).toEqual({
      '2026-07-26': ['s1', 's2'],
      '2026-07-25': ['s1'],
    })

    installTables(fromMock, {
      workout_completions: { data: [
        { session_id: 's1', distance_km: 5.2, duration_seconds: 1800 },
        { session_id: 's2', distance_km: null, duration_seconds: null },   // gympass → utan detaljer
      ] },
    })
    const cardio = await getCardioCompletions('u1', '2026-07-26')
    expect(cardio).toEqual({ s1: { distanceKm: 5.2, durationSeconds: 1800 } })
  })

  it('complete/uncomplete/deleteCompletion träffar rätt rader', async () => {
    installTables(fromMock, { workout_completions: { error: { code: '23505' } } })
    await expect(completeSession('s1', 'u1', '2026-07-27')).resolves.toBeUndefined()

    let calls = installTables(fromMock, { workout_completions: { error: null } })
    await uncompleteSession('s1', '2026-07-27')
    expect(argsOf(calls, 'workout_completions', 'eq')).toEqual([
      ['session_id', 's1'], ['completed_date', '2026-07-27'],
    ])

    calls = installTables(fromMock, { workout_completions: { error: null } })
    await deleteCompletion('c1')
    expect(argsOf(calls, 'workout_completions', 'eq')[0]).toEqual(['id', 'c1'])

    installTables(fromMock, { workout_completions: { data: [{ session_id: 's1' }] } })
    expect(await getCompletedSessionIds('u1', '2026-07-27')).toEqual(['s1'])
  })
})

describe('dateForWeekday', () => {
  it('ger ett datum i den innevarande veckan med rätt veckodag', () => {
    for (const wd of [1, 4, 7]) {
      const dateStr = dateForWeekday(wd)
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      const [y, m, d] = dateStr.split('-').map(Number)
      expect(weekdayOf(new Date(y, m - 1, d))).toBe(wd)
    }
  })
})
