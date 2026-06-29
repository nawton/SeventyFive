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

// ─── Completions ──────────────────────────────────────────────────────────────

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/** Returns the calendar date (YYYY-MM-DD) for a given weekday (1=Mon…7=Sun) in the current week. */
export function dateForWeekday(weekdayNum: number): string {
  const today = new Date()
  const todayWd = today.getDay() || 7
  const diff = weekdayNum - todayWd
  const target = new Date(today)
  target.setDate(today.getDate() + diff)
  return isoDate(target)
}

export async function getCompletedSessionIds(userId: string, date: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('workout_completions')
    .select('session_id')
    .eq('user_id', userId)
    .eq('completed_date', date)
  if (error) throw error
  return (data ?? []).map(r => r.session_id)
}

export async function completeSession(sessionId: string, userId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('workout_completions')
    .insert({ session_id: sessionId, user_id: userId, completed_date: date })
  // ignore unique-violation (already completed)
  if (error && error.code !== '23505') throw error
}

export async function uncompleteSession(sessionId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('workout_completions')
    .delete()
    .eq('session_id', sessionId)
    .eq('completed_date', date)
  if (error) throw error
}
