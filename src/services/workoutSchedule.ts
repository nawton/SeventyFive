import { supabase } from '@/lib/supabase'

export interface SessionExercise {
  id: string
  session_id: string
  exercise_name: string
  sets: number | null
  reps: string | null
  sort_order: number
}

export interface WorkoutSession {
  id: string
  user_id: string
  name: string
  weekdays: number[]   // 1=Mån … 7=Sön
  sort_order: number
  created_at: string
  exercises: SessionExercise[]
}

export async function getWorkoutSessions(userId: string): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*, session_exercises(*)')
    .eq('user_id', userId)
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map(s => ({
    ...s,
    exercises: [...(s.session_exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }))
}

export async function createWorkoutSession(
  userId: string,
  name: string,
  weekdays: number[],
  exercises: Array<{ exercise_name: string; sets: number | null; reps: string | null }>,
): Promise<WorkoutSession> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({ user_id: userId, name, weekdays })
    .select()
    .single()
  if (error) throw error

  if (exercises.length > 0) {
    await supabase.from('session_exercises').insert(
      exercises.map((e, i) => ({ session_id: data.id, ...e, sort_order: i }))
    )
  }
  return { ...data, exercises: [] }
}

export async function updateWorkoutSession(
  sessionId: string,
  name: string,
  weekdays: number[],
  exercises: Array<{ exercise_name: string; sets: number | null; reps: string | null }>,
): Promise<void> {
  const { error } = await supabase
    .from('workout_sessions')
    .update({ name, weekdays })
    .eq('id', sessionId)
  if (error) throw error

  await supabase.from('session_exercises').delete().eq('session_id', sessionId)
  if (exercises.length > 0) {
    await supabase.from('session_exercises').insert(
      exercises.map((e, i) => ({ session_id: sessionId, ...e, sort_order: i }))
    )
  }
}

export async function deleteWorkoutSession(id: string): Promise<void> {
  const { error } = await supabase.from('workout_sessions').delete().eq('id', id)
  if (error) throw error
}
