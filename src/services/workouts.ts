import { supabase } from '@/lib/supabase'

export interface StrengthSet {
  reps: number
  weight_kg: number
}

export interface StrengthData {
  category: 'strength' | 'mobility' | 'hiit'
  exercise_id: string
  exercise_name: string
  sets: StrengthSet[]
}

export async function saveStrengthWorkout(params: {
  userId: string
  exerciseId: string
  exerciseName: string
  category: 'strength' | 'mobility' | 'hiit'
  sets: StrengthSet[]
}): Promise<boolean> {
  const entry: StrengthData = {
    category: params.category,
    exercise_id: params.exerciseId,
    exercise_name: params.exerciseName,
    sets: params.sets,
  }
  const { error } = await supabase.from('user_workouts').insert({
    user_id: params.userId,
    name: params.exerciseName,
    is_favorite: false,
    exercises: [entry],
  })
  return !error
}

export interface CardioData {
  category: 'cardio'
  type: string
  distance_km: number
  duration_seconds: number
  calories: number
  route?: Array<[number, number]>
}

export interface CardioWorkout {
  id: string
  name: string
  created_at: string
  data: CardioData
}

export async function saveCardioWorkout(params: {
  userId: string
  name: string
  type: string
  distanceKm: number
  durationSeconds: number
  calories: number
  route?: Array<[number, number]>
}): Promise<boolean> {
  const entry: CardioData = {
    category: 'cardio',
    type: params.type,
    distance_km: params.distanceKm,
    duration_seconds: params.durationSeconds,
    calories: params.calories,
    route: params.route,
  }

  const { error } = await supabase.from('user_workouts').insert({
    user_id: params.userId,
    name: params.name,
    is_favorite: false,
    exercises: [entry],
  })

  return !error
}

export async function deleteCardioWorkout(id: string): Promise<boolean> {
  const { error } = await supabase.from('user_workouts').delete().eq('id', id)
  return !error
}

export interface StrengthWorkout {
  id: string
  name: string
  created_at: string
  data: StrengthData
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

export async function getCardioWorkouts(userId: string, limit = 30): Promise<CardioWorkout[]> {
  const { data, error } = await supabase
    .from('user_workouts')
    .select('id, name, created_at, exercises')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data
    .filter(w => Array.isArray(w.exercises) && w.exercises[0]?.category === 'cardio')
    .map(w => ({
      id: w.id,
      name: w.name,
      created_at: w.created_at,
      data: w.exercises[0] as CardioData,
    }))
}
