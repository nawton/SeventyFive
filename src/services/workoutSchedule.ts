import { supabase } from '@/lib/supabase'
import { toLocalDateString } from '@/lib/date'

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
  notes: string | null
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
    weekdays: s.weekdays ?? [],
    notes: s.notes ?? null,
    exercises: [...(s.session_exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }))
}

export async function createWorkoutSession(
  userId: string,
  name: string,
  weekdays: number[],
  exercises: Array<{ exercise_name: string; sets: number | null; reps: string | null }>,
  notes?: string | null,
): Promise<WorkoutSession> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({ user_id: userId, name, weekdays, notes: notes ?? null })
    .select()
    .single()
  if (error) throw error

  if (exercises.length > 0) {
    await supabase.from('session_exercises').insert(
      exercises.map((e, i) => ({ session_id: data.id, ...e, sort_order: i }))
    )
  }
  return { ...data, notes: data.notes ?? null, exercises: [] }
}

export async function updateWorkoutSession(
  sessionId: string,
  name: string,
  weekdays: number[],
  exercises: Array<{ exercise_name: string; sets: number | null; reps: string | null }>,
  notes?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('workout_sessions')
    .update({ name, weekdays, notes: notes ?? null })
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

/** Deletes a session template and any per-day SKIP records that reference it. */
export async function deleteSessionWithSkips(userId: string, sessionId: string): Promise<void> {
  await supabase
    .from('workout_sessions')
    .delete()
    .eq('user_id', userId)
    .like('name', `SKIP:%:${sessionId}`)
  const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId)
  if (error) throw error
}

export async function deleteFutureOnceSessions(userId: string): Promise<number> {
  const todayStr = toLocalDateString()

  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, name, weekdays')
    .eq('user_id', userId)
  if (error) throw error

  const toDelete = (data ?? [])
    .filter(s => {
      if (s.weekdays && s.weekdays.length > 0) return false
      if (s.name.startsWith('ONCE:')) {
        const datePart = s.name.split(':')[1] ?? ''
        return datePart > todayStr
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(s.name)) {
        return s.name > todayStr
      }
      return false
    })
    .map(s => s.id)

  if (toDelete.length === 0) return 0

  const { error: delErr } = await supabase
    .from('workout_sessions')
    .delete()
    .in('id', toDelete)
  if (delErr) throw delErr
  return toDelete.length
}

/**
 * For a repeating session: creates a day-specific ONCE copy (without the skipped exercise)
 * and adds a SKIP record so the repeating session is hidden on that date.
 */
export async function skipExerciseForDay(
  userId: string,
  session: WorkoutSession,
  dateStr: string,
  skipExerciseId: string,
): Promise<void> {
  const baseName = session.name.startsWith('ONCE:')
    ? session.name.split(':').slice(2).join(':')
    : session.name
  const remaining = session.exercises
    .filter(e => e.id !== skipExerciseId)
    .map(e => ({ exercise_name: e.exercise_name, sets: e.sets, reps: e.reps }))
  await createWorkoutSession(userId, `ONCE:${dateStr}:${baseName}`, [], remaining)
  await supabase.from('workout_sessions').insert({
    user_id: userId,
    name: `SKIP:${dateStr}:${session.id}`,
    weekdays: [],
  })
}

export async function reorderWorkoutSessions(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from('workout_sessions').update({ sort_order: i }).eq('id', id)
    )
  )
}

export async function addMissedExercise(
  userId: string,
  dateStr: string,
  exerciseName: string,
  sets: number | null,
  reps: string | null,
): Promise<SessionExercise> {
  // Missed exercises go into a ONCE session so they appear under Träningspass
  const sessionName = `ONCE:${dateStr}:Träningspass`
  const { data: existing } = await supabase
    .from('workout_sessions')
    .select('id, session_exercises(id)')
    .eq('user_id', userId)
    .eq('name', sessionName)
    .maybeSingle()

  let sessionId: string
  let sortOrder: number

  if (existing) {
    sessionId = existing.id
    sortOrder = (existing.session_exercises as { id: string }[] ?? []).length
  } else {
    const { data: created, error } = await supabase
      .from('workout_sessions')
      .insert({ user_id: userId, name: sessionName, weekdays: [] })
      .select()
      .single()
    if (error) throw error
    sessionId = created.id
    sortOrder = 0
  }
  return addSingleExerciseToSession(sessionId, exerciseName, sortOrder, sets, reps)
}

export async function addQuickExercise(
  userId: string,
  date: string,
  exerciseName: string,
  sets: number | null,
  reps: string | null,
): Promise<SessionExercise> {
  // One-off "daily log" sessions use weekdays=[] and name=ISO date
  const { data: existing } = await supabase
    .from('workout_sessions')
    .select('id, session_exercises(id)')
    .eq('user_id', userId)
    .eq('name', date)
    .maybeSingle()

  let sessionId: string
  let sortOrder: number

  if (existing) {
    sessionId = existing.id
    sortOrder = (existing.session_exercises as { id: string }[] ?? []).length
  } else {
    const { data: created, error } = await supabase
      .from('workout_sessions')
      .insert({ user_id: userId, name: date, weekdays: [] })
      .select()
      .single()
    if (error) throw error
    sessionId = created.id
    sortOrder = 0
  }
  return addSingleExerciseToSession(sessionId, exerciseName, sortOrder, sets, reps)
}

export async function addSingleExerciseToSession(
  sessionId: string,
  exerciseName: string,
  sortOrder: number,
  sets: number | null,
  reps: string | null,
): Promise<SessionExercise> {
  const { data, error } = await supabase
    .from('session_exercises')
    .insert({ session_id: sessionId, exercise_name: exerciseName, sets, reps, sort_order: sortOrder })
    .select()
    .single()
  if (error) throw error
  return data as SessionExercise
}

export async function deleteSessionExercise(id: string): Promise<void> {
  const { error } = await supabase.from('session_exercises').delete().eq('id', id)
  if (error) throw error
}

export async function updateSessionExercise(
  id: string,
  sets: number | null,
  reps: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('session_exercises')
    .update({ sets, reps })
    .eq('id', id)
  if (error) throw error
}

// ─── Per-exercise completions ─────────────────────────────────────────────────

export async function getCompletedExerciseNamesForWeek(
  userId: string,
  weekStart: string,
  weekEnd: string,
): Promise<string[]> {
  const { data: completions } = await supabase
    .from('exercise_completions')
    .select('exercise_id')
    .eq('user_id', userId)
    .gte('completed_date', weekStart)
    .lte('completed_date', weekEnd)
  const ids = (completions ?? []).map(c => c.exercise_id as string)
  if (ids.length === 0) return []
  const { data: exRows } = await supabase
    .from('session_exercises')
    .select('exercise_name')
    .in('id', ids)
  return (exRows ?? []).map(e => e.exercise_name as string)
}

export async function getCompletedExerciseIds(userId: string, date: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('exercise_completions')
    .select('exercise_id')
    .eq('user_id', userId)
    .eq('completed_date', date)
  if (error) throw error
  return (data ?? []).map(r => r.exercise_id)
}

export async function completeExercise(exerciseId: string, userId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('exercise_completions')
    .insert({ exercise_id: exerciseId, user_id: userId, completed_date: date })
  // 23505 = duplicate (already complete) — fine.
  // All other errors: log but never throw. Local state is the source of truth.
  // To enable Supabase persistence run: supabase/migrations/20260701000001_exercise_completions.sql
  if (error && error.code !== '23505') {
    console.warn('[completeExercise]', error.code, error.message)
  }
}

export async function uncompleteExercise(exerciseId: string, userId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('exercise_completions')
    .delete()
    .eq('exercise_id', exerciseId)
    .eq('user_id', userId)
    .eq('completed_date', date)
  if (error) console.warn('[uncompleteExercise]', error.code, error.message)
}

// ─── Completions ──────────────────────────────────────────────────────────────

function isoDate(date: Date): string {
  return toLocalDateString(date)
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
