import { supabase } from '@/lib/supabase'
import { toLocalDateString, parseLocalDate } from '@/lib/date'
import { trimRouteEnds } from '@/lib/cardioUtils'
import { deleteWorkout } from './strengthWorkouts'

export interface CardioSplit {
  label: string    // "1 km", "0,4 km"
  paceSec: number  // sekunder för den kilometern (= tid för full km)
}

/** Resultat för ett avklarat arbetssegment i ett guidat pass */
export interface CardioInterval {
  label: string      // "Intervall 1 av 6", "Tempo"
  distanceM: number  // faktisk distans i meter
  durationS: number  // faktisk tid i sekunder
  paceSec: number    // sek/km för segmentet
}

export interface CardioData {
  category: 'cardio'
  type: string
  distance_km: number
  duration_seconds: number
  calories: number
  route?: Array<[number, number]>
  splits?: CardioSplit[]
  /** Guidade pass: resultat per avklarat arbetssegment */
  intervals?: CardioInterval[]
  /** Guidade pass: planerat antal arbetssegment — så "4 av 6" kan visas */
  intervals_planned?: number
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
  intervals?: CardioInterval[]
  intervalsPlanned?: number
  effort?: number
}): Promise<void> {
  // Kartintegritet: klipp start/slut ur rutten INNAN den sparas om
  // användaren valt det — punkterna lagras då aldrig någonstans
  let route = params.route
  if (route && route.length > 1) {
    const { data: prefs } = await supabase
      .from('profiles')
      .select('trim_route_ends')
      .eq('id', params.userId)
      .maybeSingle()
    if (prefs?.trim_route_ends) route = trimRouteEnds(route)
  }

  const entry: CardioData = {
    category: 'cardio',
    type: params.type,
    distance_km: params.distanceKm,
    duration_seconds: params.durationSeconds,
    calories: params.calories,
    route,
    splits: params.splits,
    intervals: params.intervals,
    intervals_planned: params.intervalsPlanned,
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
      intervals:        raw.intervals,
      intervals_planned: raw.intervals_planned,
      effort:           raw.effort,
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
          intervals:        raw.intervals,
          intervals_planned: raw.intervals_planned,
          effort:           raw.effort,
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
          intervals:        raw.intervals,
          intervals_planned: raw.intervals_planned,
          effort:           raw.effort,
        } satisfies CardioData,
      }
    })
}

/** Uppdaterar ansträngningsbetyget (RPE 1–10) på ett redan sparat cardio-pass */
export async function updateCardioEffort(id: string, effort: number): Promise<void> {
  const { data, error } = await supabase
    .from('user_workouts')
    .select('exercises')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data || !Array.isArray(data.exercises) || data.exercises[0]?.category !== 'cardio') {
    throw new Error('Passet hittades inte')
  }
  const exercises = [...data.exercises]
  exercises[0] = { ...exercises[0], effort }
  const { error: upError } = await supabase
    .from('user_workouts')
    .update({ exercises })
    .eq('id', id)
  if (upError) throw upError
}
