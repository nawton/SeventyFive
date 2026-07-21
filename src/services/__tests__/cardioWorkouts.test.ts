import {
  saveCardioWorkout,
  getCardioWorkoutById,
  getCardioWorkoutByDate,
  getCardioWorkoutsForDate,
  getCardioWorkouts,
  updateCardioEffort,
} from '../cardioWorkouts'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }))

/** Kedjebar Supabase-mock: alla querymetoder returnerar kedjan, och kedjan
    är awaitbar (thenable) med det givna resultatet. Anropen spelas in. */
function mockChain(result: unknown) {
  const calls: Record<string, unknown[][]> = {}
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte', 'lt', 'order', 'limit', 'insert', 'update']) {
    calls[m] = []
    c[m] = (...args: unknown[]) => { calls[m].push(args); return c }
  }
  c.maybeSingle = () => Promise.resolve(result)
  c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej)
  ;(supabase.from as jest.Mock).mockReturnValue(c)
  return calls
}

const FULL_ROW = {
  id: 'w1',
  name: 'Intervaller',
  created_at: '2026-07-20T10:00:00Z',
  exercises: [{
    category: 'cardio',
    type: 'interval',
    distance_km: 6.2,
    duration_seconds: 1860,
    calories: 400,
    route: [[59.33, 18.07]],
    splits: [{ label: '1 km', paceSec: 300 }],
    intervals: [{ label: 'Intervall 1 av 6', distanceM: 1000, durationS: 295, paceSec: 295 }],
    intervals_planned: 6,
    effort: 7,
    smuggled_field: 'ska inte läcka igenom',
  }],
}

beforeEach(() => jest.clearAllMocks())

describe('saveCardioWorkout', () => {
  it('sparar passet som en cardio-post i user_workouts', async () => {
    const calls = mockChain({ error: null })
    await saveCardioWorkout({
      userId: 'u1', name: 'Löpning', type: 'running',
      distanceKm: 5, durationSeconds: 1500, calories: 320,
      splits: [{ label: '1 km', paceSec: 300 }],
      intervals: [{ label: 'Tempo', distanceM: 4000, durationS: 1260, paceSec: 315 }],
      intervalsPlanned: 1,
    })
    expect(supabase.from).toHaveBeenCalledWith('user_workouts')
    const [payload] = calls.insert[0] as [Record<string, unknown>]
    expect(payload.user_id).toBe('u1')
    expect(payload.name).toBe('Löpning')
    expect(payload.is_favorite).toBe(false)
    expect(payload.exercises).toEqual([expect.objectContaining({
      category: 'cardio', type: 'running',
      distance_km: 5, duration_seconds: 1500, calories: 320,
      intervals: [{ label: 'Tempo', distanceM: 4000, durationS: 1260, paceSec: 315 }],
      intervals_planned: 1,
    })])
  })

  it('kastar vidare skrivfel', async () => {
    mockChain({ error: new Error('RLS sa nej') })
    await expect(saveCardioWorkout({
      userId: 'u1', name: 'x', type: 'running',
      distanceKm: 1, durationSeconds: 60, calories: 10,
    })).rejects.toThrow('RLS sa nej')
  })
})

describe('getCardioWorkoutById', () => {
  it('mappar raden och whitelistar fälten', async () => {
    mockChain({ data: FULL_ROW, error: null })
    const w = await getCardioWorkoutById('u1', 'w1')
    expect(w).not.toBeNull()
    expect(w!.data.intervals_planned).toBe(6)
    expect(w!.data.intervals![0].paceSec).toBe(295)
    expect(w!.data.effort).toBe(7)
    expect((w!.data as unknown as Record<string, unknown>).smuggled_field).toBeUndefined()
  })

  it('saknade fält får ofarliga defaultvärden', async () => {
    mockChain({ data: { id: 'w2', name: 'Gammalt pass', created_at: 'x', exercises: [{ category: 'cardio' }] }, error: null })
    const w = await getCardioWorkoutById('u1', 'w2')
    expect(w!.data).toMatchObject({ type: 'running', distance_km: 0, duration_seconds: 0, calories: 0 })
  })

  it('gympass, fel och tomma svar ger null', async () => {
    mockChain({ data: { id: 'g1', name: 'Bänkpress', created_at: 'x', exercises: [{ category: 'strength' }] }, error: null })
    expect(await getCardioWorkoutById('u1', 'g1')).toBeNull()
    mockChain({ data: null, error: new Error('boom') })
    expect(await getCardioWorkoutById('u1', 'w1')).toBeNull()
    mockChain({ data: null, error: null })
    expect(await getCardioWorkoutById('u1', 'w1')).toBeNull()
  })
})

describe('getCardioWorkoutsForDate', () => {
  it('frågar bara det lokala dygnets UTC-intervall', async () => {
    const calls = mockChain({ data: [], error: null })
    await getCardioWorkoutsForDate('u1', '2026-07-20')
    const dayStart = new Date(2026, 6, 20) // lokal midnatt
    const dayEnd   = new Date(2026, 6, 21)
    expect(calls.gte[0]).toEqual(['created_at', dayStart.toISOString()])
    expect(calls.lt[0]).toEqual(['created_at', dayEnd.toISOString()])
  })

  it('filtrerar bort allt som inte är cardio', async () => {
    mockChain({ data: [
      FULL_ROW,
      { id: 'g1', name: 'Gympass', created_at: 'x', exercises: [{ category: 'strength' }] },
      { id: 'x1', name: 'Trasig', created_at: 'x', exercises: 'inte en array' },
    ], error: null })
    const list = await getCardioWorkoutsForDate('u1', '2026-07-20')
    expect(list.map(w => w.id)).toEqual(['w1'])
  })
})

describe('getCardioWorkoutByDate', () => {
  it('hittar passet med rätt typ', async () => {
    const runRow = { ...FULL_ROW, id: 'w9', exercises: [{ ...FULL_ROW.exercises[0], type: 'running' }] }
    mockChain({ data: [FULL_ROW, runRow], error: null })
    const w = await getCardioWorkoutByDate('u1', 'running', '2026-07-20')
    expect(w!.id).toBe('w9')
    expect(await getCardioWorkoutByDate('u1', 'cycling', '2026-07-20')).toBeNull()
  })
})

describe('getCardioWorkouts', () => {
  it('hämtar senaste passen med angiven gräns', async () => {
    const calls = mockChain({ data: [FULL_ROW], error: null })
    const list = await getCardioWorkouts('u1', 10)
    expect(calls.limit[0]).toEqual([10])
    expect(calls.order[0]).toEqual(['created_at', { ascending: false }])
    expect(list).toHaveLength(1)
  })
})

describe('updateCardioEffort', () => {
  it('sätter effort utan att tappa övriga fält', async () => {
    const calls = mockChain({ data: { exercises: FULL_ROW.exercises }, error: null })
    await updateCardioEffort('w1', 9)
    const [payload] = calls.update[0] as [{ exercises: Record<string, unknown>[] }]
    expect(payload.exercises[0].effort).toBe(9)
    expect(payload.exercises[0].intervals_planned).toBe(6)
    expect(payload.exercises[0].type).toBe('interval')
  })

  it('kastar när passet inte finns eller inte är cardio', async () => {
    mockChain({ data: null, error: null })
    await expect(updateCardioEffort('saknas', 5)).rejects.toThrow('Passet hittades inte')
    mockChain({ data: { exercises: [{ category: 'strength' }] }, error: null })
    await expect(updateCardioEffort('g1', 5)).rejects.toThrow('Passet hittades inte')
  })
})
