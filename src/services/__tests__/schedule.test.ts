import { saveSchedule, getSchedule } from '../schedule'
import { supabase } from '@/lib/supabase'
import { installTables, argsOf } from '@/testUtils/supabaseChain'
import type { MealTime, WorkoutTime } from '@/types/database'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }))

const fromMock = supabase.from as jest.Mock

const INPUT = {
  userId: 'u1',
  templateId: '5am',
  wakeTime: '05:00',
  mealTimes: [{ label: 'Frukost', time: '06:00' }] as unknown as MealTime[],
  workoutTimes: [{ label: 'Pass 1', time: '17:00' }] as unknown as WorkoutTime[],
}

beforeEach(() => jest.clearAllMocks())

describe('saveSchedule', () => {
  it('upsertar på användaren så schemat alltid är ett per person', async () => {
    const calls = installTables(fromMock, { user_schedules: { data: null } })
    await saveSchedule(INPUT)

    const [payload, options] = argsOf(calls, 'user_schedules', 'upsert')[0]
    expect(payload).toEqual({
      user_id: 'u1',
      template_id: '5am',
      wake_time: '05:00:00',
      meal_times: INPUT.mealTimes,
      workout_times: INPUT.workoutTimes,
      notifications_enabled: true,
    })
    expect(options).toEqual({ onConflict: 'user_id' })
  })

  it('kastar vidare fel', async () => {
    installTables(fromMock, { user_schedules: { data: null, error: { message: 'stopp' } } })
    await expect(saveSchedule(INPUT)).rejects.toMatchObject({ message: 'stopp' })
  })
})

describe('getSchedule', () => {
  it('hämtar användarens schema, null om inget finns', async () => {
    const row = { user_id: 'u1', template_id: 'balanced', wake_time: '06:30:00' }
    const calls = installTables(fromMock, { user_schedules: { data: row } })
    expect(await getSchedule('u1')).toEqual(row)
    expect(argsOf(calls, 'user_schedules', 'eq')[0]).toEqual(['user_id', 'u1'])

    installTables(fromMock, { user_schedules: { data: null } })
    expect(await getSchedule('u1')).toBeNull()
  })
})
