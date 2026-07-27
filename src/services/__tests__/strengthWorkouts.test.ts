import {
  saveStrengthWorkout, deleteWorkout, getWorkoutsForDate, getStrengthWorkouts,
} from '../strengthWorkouts'
import * as workoutsBarrel from '../workouts'
import { toLocalDateString } from '@/lib/date'
import { supabase } from '@/lib/supabase'
import { installTables, argsOf } from '@/testUtils/supabaseChain'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }))

const fromMock = supabase.from as jest.Mock

const GYM_ROW = {
  id: 's1', name: 'Bänkpress', created_at: '2026-07-20T07:20:00Z',
  exercises: [{
    category: 'strength', exercise_id: 'e1', exercise_name: 'Bänkpress',
    sets: [{ reps: 8, weight_kg: 60 }], workout_date: '2026-07-20',
  }],
}
const CARDIO_ROW = {
  id: 'c1', name: 'Löpning', created_at: '2026-07-20T18:00:00Z',
  exercises: [{ category: 'cardio', type: 'running', distance_km: 5 }],
}
const LEGACY_ROW = {
  // Äldre rad utan workout_date: datumet tas ur created_at
  id: 's2', name: 'Marklyft', created_at: '2026-07-19T17:00:00Z',
  exercises: [{
    category: 'strength', exercise_id: 'e2', exercise_name: 'Marklyft',
    sets: [{ reps: 5, weight_kg: 100 }],
  }],
}

beforeEach(() => jest.clearAllMocks())

describe('saveStrengthWorkout', () => {
  it('sparar övningen som en styrkepost med dagens datum som standard', async () => {
    const calls = installTables(fromMock, { user_workouts: { error: null } })
    const ok = await saveStrengthWorkout({
      userId: 'u1', exerciseId: 'e1', exerciseName: 'Bänkpress',
      category: 'strength', sets: [{ reps: 8, weight_kg: 60 }],
    })
    expect(ok).toBe(true)
    expect(argsOf(calls, 'user_workouts', 'insert')[0][0]).toEqual({
      user_id: 'u1', name: 'Bänkpress', is_favorite: false,
      exercises: [{
        category: 'strength', exercise_id: 'e1', exercise_name: 'Bänkpress',
        sets: [{ reps: 8, weight_kg: 60 }], workout_date: toLocalDateString(),
      }],
    })
  })

  it('respekterar angivet datum och kastar fel vidare', async () => {
    const calls = installTables(fromMock, { user_workouts: { error: null } })
    await saveStrengthWorkout({
      userId: 'u1', exerciseId: 'e1', exerciseName: 'Knäböj',
      category: 'strength', sets: [], workoutDate: '2026-07-01',
    })
    const entry = (argsOf(calls, 'user_workouts', 'insert')[0][0] as { exercises: Array<{ workout_date: string }> }).exercises[0]
    expect(entry.workout_date).toBe('2026-07-01')

    installTables(fromMock, { user_workouts: { error: { message: 'nej' } } })
    await expect(saveStrengthWorkout({
      userId: 'u1', exerciseId: 'e1', exerciseName: 'Knäböj', category: 'strength', sets: [],
    })).rejects.toThrow('nej')
  })
})

describe('deleteWorkout', () => {
  it('raderar på id och rapporterar utfallet', async () => {
    const calls = installTables(fromMock, { user_workouts: { error: null } })
    expect(await deleteWorkout('s1')).toBe(true)
    expect(argsOf(calls, 'user_workouts', 'eq')[0]).toEqual(['id', 's1'])

    installTables(fromMock, { user_workouts: { error: { message: 'nej' } } })
    expect(await deleteWorkout('s1')).toBe(false)
  })
})

describe('getWorkoutsForDate', () => {
  it('filtrerar bort cardio och matchar på passdatum eller created_at', async () => {
    installTables(fromMock, { user_workouts: { data: [GYM_ROW, CARDIO_ROW, LEGACY_ROW] } })
    const hits = await getWorkoutsForDate('u1', '2026-07-20')
    expect(hits.map(w => w.id)).toEqual(['s1'])

    installTables(fromMock, { user_workouts: { data: [GYM_ROW, LEGACY_ROW] } })
    const legacy = await getWorkoutsForDate('u1', '2026-07-19')
    expect(legacy.map(w => w.id)).toEqual(['s2'])
  })

  it('tom lista vid fel', async () => {
    installTables(fromMock, { user_workouts: { data: null, error: { message: 'nere' } } })
    expect(await getWorkoutsForDate('u1', '2026-07-20')).toEqual([])
  })
})

describe('getStrengthWorkouts', () => {
  it('returnerar bara styrkepass, mappade med data ur exercises', async () => {
    const calls = installTables(fromMock, { user_workouts: { data: [GYM_ROW, CARDIO_ROW, LEGACY_ROW] } })
    const rows = await getStrengthWorkouts('u1', 100)
    expect(rows.map(w => w.id)).toEqual(['s1', 's2'])
    expect(rows[0].data.exercise_name).toBe('Bänkpress')
    expect(argsOf(calls, 'user_workouts', 'limit')[0]).toEqual([100])
  })

  it('tom lista vid fel', async () => {
    installTables(fromMock, { user_workouts: { data: null, error: { message: 'nere' } } })
    expect(await getStrengthWorkouts('u1')).toEqual([])
  })
})

describe('workouts-fasaden', () => {
  it('återexporterar både styrke- och cardiofunktionerna', () => {
    expect(workoutsBarrel.saveStrengthWorkout).toBe(saveStrengthWorkout)
    expect(typeof workoutsBarrel.getCardioWorkouts).toBe('function')
  })
})
