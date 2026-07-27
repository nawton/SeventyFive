import {
  fetchFeedPage, fetchGroupFeedPage, fetchUserWorkouts, getSharedWorkout, FEED_PAGE_SIZE,
} from '../feed'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }))

const rpcMock = supabase.rpc as jest.Mock

const CARDIO_ROW = {
  id: 'w1', user_id: 'u2', name: 'Löpning', created_at: '2026-07-26T18:00:00Z',
  exercises: [{
    category: 'cardio', type: 'running', distance_km: '5.2', duration_seconds: 1800,
    calories: null, route: [[59.33, 18.06]], effort: 4,
  }],
}
const GYM_ROW = {
  id: 'w2', user_id: 'u3', name: 'Bänkpress', created_at: '2026-07-25T07:00:00Z',
  exercises: [{ category: 'strength', exercise_name: 'Bänkpress', sets: [{ reps: 8, weight_kg: 60 }] }],
}
const BROKEN_ROW = { id: 'w3', user_id: 'u4', name: 'Trasig', created_at: 't', exercises: null }

beforeEach(() => jest.clearAllMocks())

describe('fetchFeedPage', () => {
  it('delar upp raderna i cardio och styrka och normaliserar siffrorna', async () => {
    rpcMock.mockResolvedValue({ data: [CARDIO_ROW, GYM_ROW, BROKEN_ROW] })
    const page = await fetchFeedPage()
    expect(rpcMock).toHaveBeenCalledWith('get_feed', expect.objectContaining({ page_size: FEED_PAGE_SIZE }))

    expect(page.cardio).toHaveLength(1)
    expect(page.cardio[0].workout.data).toMatchObject({
      distance_km: 5.2, duration_seconds: 1800, calories: 0, type: 'running',
    })
    expect(page.strength).toHaveLength(1)
    expect(page.strength[0].workout.data.exercise_name).toBe('Bänkpress')

    // Rader utan övningsinnehåll räknas men mappas inte
    expect(page.count).toBe(3)
    expect(page.oldest).toBe('t')
  })

  it('cursorn skickas vidare och fel ger en tom sida', async () => {
    rpcMock.mockResolvedValue({ data: [] })
    await fetchFeedPage('2026-07-20T00:00:00Z')
    expect(rpcMock.mock.calls[0][1].before).toBe('2026-07-20T00:00:00Z')

    rpcMock.mockResolvedValue({ data: null, error: { message: 'nere' } })
    expect(await fetchFeedPage()).toEqual({ cardio: [], strength: [], count: 0, oldest: null })
  })
})

describe('fetchGroupFeedPage', () => {
  it('anropar grupp-RPC:n med gruppens id', async () => {
    rpcMock.mockResolvedValue({ data: [CARDIO_ROW] })
    const page = await fetchGroupFeedPage('g1')
    expect(rpcMock).toHaveBeenCalledWith('get_group_feed', expect.objectContaining({ gid: 'g1' }))
    expect(page.cardio).toHaveLength(1)
    expect(page.oldest).toBe(CARDIO_ROW.created_at)
  })
})

describe('fetchUserWorkouts', () => {
  it('mappar historiken utan pagineringsfält, tomt vid fel', async () => {
    rpcMock.mockResolvedValue({ data: [CARDIO_ROW, GYM_ROW] })
    const result = await fetchUserWorkouts('u2')
    expect(rpcMock).toHaveBeenCalledWith('get_user_workouts', { target: 'u2', max_rows: 500 })
    expect(result.cardio).toHaveLength(1)
    expect(result.strength).toHaveLength(1)

    rpcMock.mockResolvedValue({ data: null, error: {} })
    expect(await fetchUserWorkouts('u2')).toEqual({ cardio: [], strength: [] })
  })
})

describe('getSharedWorkout', () => {
  it('plockar cardiopasset ur svaret, null annars', async () => {
    rpcMock.mockResolvedValue({ data: [CARDIO_ROW] })
    const workout = await getSharedWorkout('w1')
    expect(workout?.id).toBe('w1')

    rpcMock.mockResolvedValue({ data: [GYM_ROW] })   // inte cardio → null
    expect(await getSharedWorkout('w2')).toBeNull()

    rpcMock.mockResolvedValue({ data: null, error: {} })
    expect(await getSharedWorkout('w1')).toBeNull()
  })
})
