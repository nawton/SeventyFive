import { supabase } from '@/lib/supabase'
import { toLocalDateString } from '@/lib/date'

export interface StrengthSet {
  reps: number
  weight_kg: number
}

export interface StrengthData {
  category: 'strength' | 'mobility' | 'hiit'
  exercise_id: string
  exercise_name: string
  sets: StrengthSet[]
  workout_date?: string
}

export interface StrengthWorkout {
  id: string
  name: string
  created_at: string
  data: StrengthData
}

export async function saveStrengthWorkout(params: {
  userId: string
  exerciseId: string
  exerciseName: string
  category: 'strength' | 'mobility' | 'hiit'
  sets: StrengthSet[]
  workoutDate?: string
}): Promise<boolean> {
  const today = toLocalDateString()
  const entry: StrengthData = {
    category: params.category,
    exercise_id: params.exerciseId,
    exercise_name: params.exerciseName,
    sets: params.sets,
    workout_date: params.workoutDate ?? today,
  }
  const { error } = await supabase.from('user_workouts').insert({
    user_id: params.userId,
    name: params.exerciseName,
    is_favorite: false,
    exercises: [entry],
  })
  if (error) throw new Error(error.message)
  return true
}

export async function deleteWorkout(id: string): Promise<boolean> {
  const { error } = await supabase.from('user_workouts').delete().eq('id', id)
  return !error
}

export async function getWorkoutsForDate(userId: string, date: string): Promise<StrengthWorkout[]> {
  const { data, error } = await supabase
    .from('user_workouts')
    .select('id, name, created_at, exercises')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error || !data) return []

  return data
    .filter(w => {
      if (!Array.isArray(w.exercises) || w.exercises[0]?.category === 'cardio') return false
      const wd: string | undefined = w.exercises[0]?.workout_date
      const wDate = wd ?? w.created_at?.split('T')[0]
      return wDate === date
    })
    .map(w => ({
      id: w.id,
      name: w.name,
      created_at: w.created_at,
      data: w.exercises[0] as StrengthData,
    }))
}

export async function getStrengthWorkouts(userId: string, limit = 50): Promise<StrengthWorkout[]> {
  const { data, error } = await supabase
    .from('user_workouts')
    .select('id, name, created_at, exercises')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data
    .filter(w => Array.isArray(w.exercises) && w.exercises[0]?.category !== 'cardio')
    .map(w => ({
      id: w.id,
      name: w.name,
      created_at: w.created_at,
      data: w.exercises[0] as StrengthData,
    }))
}
