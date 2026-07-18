import { supabase } from '@/lib/supabase'
import { toLocalDateString, parseLocalDate } from '@/lib/date'
import { deleteWorkout } from './strengthWorkouts'

export interface CardioSplit {
  label: string    // "1 km", "0,4 km"
  paceSec: number  // sekunder för den kilometern (= tid för full km)
}

export interface CardioData {
  category: 'cardio'
  type: string
  distance_km: number
  duration_seconds: number
  calories: number
  route?: Array<[number, number]>
  splits?: CardioSplit[]
  /** Upplevd ansträngning (RPE) 1–10 — sätts av användaren efter passet */
  effort?: number
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
  splits?: CardioSplit[]
  effort?: number
}): Promise<void> {
  const entry: CardioData = {
    category: 'cardio',
    type: params.type,
    distance_km: params.distanceKm,
    duration_seconds: params.durationSeconds,
    calories: params.calories,
    route: params.route,
    splits: params.splits,
    effort: params.effort,
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
/** Hämtar ett specifikt cardio-pass på id — säkraste uppslaget för detaljvyn. */
export async function getCardioWorkoutById(userId: string, id: string): Promise<CardioWorkout | null> {
  const { data, error } = await supabase
    .from('user_workouts')
    .select('id, name, created_at, exercises')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()
  if (error || !data || !Array.isArray(data.exercises) || data.exercises[0]?.category !== 'cardio') return null
  const raw = data.exercises[0]
  return {
    id: data.id,
    name: data.name,
    created_at: data.created_at,
    data: {
      category:         'cardio' as const,
      type:             raw.type             ?? 'running',
      distance_km:      raw.distance_km      ?? 0,
      duration_seconds: raw.duration_seconds ?? 0,
      calories:         raw.calories         ?? 0,
      route:            raw.route,
      splits:           raw.splits,
    } satisfies CardioData,
  }
}

export async function getCardioWorkoutByDate(
  userId: string,
  type: string,
  date: string,
): Promise<CardioWorkout | null> {
  const workouts = await getCardioWorkoutsForDate(userId, date)
  return workouts.find(w => w.data.type === type) ?? null
}

/** Cardio-pass loggade ett visst LOKALT datum. Frågar bara dygnets UTC-intervall
 *  istället för hela historiken — rutterna är stora och detta körs per dagbyte. */
export async function getCardioWorkoutsForDate(userId: string, date: string): Promise<CardioWorkout[]> {
  const dayStart = parseLocalDate(date)
  const dayEnd   = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const { data, error } = await supabase
    .from('user_workouts')
    .select('id, name, created_at, exercises')
    .eq('user_id', userId)
    .gte('created_at', dayStart.toISOString())
    .lt('created_at', dayEnd.toISOString())
    .order('created_at', { ascending: false })

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
          splits:           raw.splits,
        } satisfies CardioData,
      }
    })
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
          splits:           raw.splits,
        } satisfies CardioData,
      }
    })
}
