import { supabase } from '@/lib/supabase'
import type { MealTime, WorkoutTime } from '@/types/database'

export interface ScheduleInput {
  userId: string
  wakeTime: string        // "HH:MM"
  mealTimes: MealTime[]
  workoutTimes: WorkoutTime[]
}

export async function saveSchedule(input: ScheduleInput): Promise<void> {
  const { error } = await supabase
    .from('user_schedules')
    .upsert(
      {
        user_id:        input.userId,
        wake_time:      input.wakeTime + ':00',
        meal_times:     input.mealTimes,
        workout_times:  input.workoutTimes,
        notifications_enabled: true,
      },
      { onConflict: 'user_id' }
    )

  if (error) throw error
}

export async function getSchedule(userId: string) {
  const { data } = await supabase
    .from('user_schedules')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  return data
}
