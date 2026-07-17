import { supabase } from '@/lib/supabase'
import { deleteWorkout } from './strengthWorkouts'

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
}): Promise<void> {
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
  if (error) throw error
}

export async function deleteCardioWorkout(id: string): Promise<boolean> {
  return deleteWorkout(id)
}

/**
 * Hittar det sparade cardio-passet av en viss typ som loggades ett visst datum.
 * Passen saknar direkt koppling till schemat, så vi matchar på typ + dag och tar
 * det senaste (om man loggat flera samma dag).
 */
export async function getCardioWorkoutByDate(
  userId: string,
  type: string,
  date: string,
): Promise<CardioWorkout | null> {
  const workouts = await getCardioWorkouts(userId, 100)
  const match = workouts.find(
    w => w.data.type === type && w.created_at.slice(0, 10) === date,
  )
  // Reservlösning: samma typ även om datumet inte råkar matcha (senaste passet)
  return match ?? workouts.find(w => w.data.type === type) ?? null
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
    .map(w => {
      const raw = w.exercises[0]
      return {
        id: w.id,
        name: w.name,
        created_at: w.created_at,
        data: {
          category:         'cardio' as const,
          type:             raw.type             ?? 'running',
          distance_km:      raw.distance_km      ?? 0,
          duration_seconds: raw.duration_seconds ?? 0,
          calories:         raw.calories         ?? 0,
          route:            raw.route,
        } satisfies CardioData,
      }
    })
}
