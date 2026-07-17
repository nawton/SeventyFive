import { supabase } from '@/lib/supabase'
import { toLocalDateString, weekdayOf } from '@/lib/date'

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
  session_type: 'gym' | 'cardio'
  cardio_type: string | null   // 'running' | 'cycling' | 'interval' | 'walking'
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
    weekdays:     s.weekdays ?? [],
    notes:        s.notes ?? null,
    session_type: (s.session_type ?? 'gym') as 'gym' | 'cardio',
    cardio_type:  s.cardio_type ?? null,
    exercises:    [...(s.session_exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }))
}

export async function createWorkoutSession(
  userId: string,
  name: string,
  weekdays: number[],
  exercises: Array<{ exercise_name: string; sets: number | null; reps: string | null }>,
  notes?: string | null,
  sessionType: 'gym' | 'cardio' = 'gym',
  cardioType?: string | null,
): Promise<WorkoutSession> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: userId, name, weekdays,
      notes: notes ?? null,
      session_type: sessionType,
      cardio_type: cardioType ?? null,
    })
    .select()
    .single()
  if (error) throw error

  if (sessionType === 'gym' && exercises.length > 0) {
    // Misslyckas inserten får passet inte bli tyst tomt — kasta så anroparen ser felet
    const { error: exError } = await supabase.from('session_exercises').insert(
      exercises.map((e, i) => ({ session_id: data.id, ...e, sort_order: i }))
    )
    if (exError) throw exError
  }
  return {
    ...data,
    notes:        data.notes ?? null,
    session_type: (data.session_type ?? 'gym') as 'gym' | 'cardio',
    cardio_type:  data.cardio_type ?? null,
    exercises:    [],
  }
}

export async function updateWorkoutSession(
  sessionId: string,
  name: string,
  weekdays: number[],
  exercises: Array<{ exercise_name: string; sets: number | null; reps: string | null }>,
  notes?: string | null,
  sessionType: 'gym' | 'cardio' = 'gym',
  cardioType?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('workout_sessions')
    .update({
      name, weekdays,
      notes: notes ?? null,
      session_type: sessionType,
      cardio_type: cardioType ?? null,
    })
    .eq('id', sessionId)
  if (error) throw error

  const { error: delError } = await supabase.from('session_exercises').delete().eq('session_id', sessionId)
  if (delError) throw delError
  if (sessionType === 'gym' && exercises.length > 0) {
    const { error: exError } = await supabase.from('session_exercises').insert(
      exercises.map((e, i) => ({ session_id: sessionId, ...e, sort_order: i }))
    )
    if (exError) throw exError
  }
}

export async function completeCardioSession(
  sessionId: string,
  userId: string,
  date: string,
  distanceKm: number,
  durationSeconds: number,
): Promise<void> {
  const { error } = await supabase
    .from('workout_completions')
    .upsert(
      { session_id: sessionId, user_id: userId, completed_date: date, distance_km: distanceKm, duration_seconds: durationSeconds },
      { onConflict: 'session_id,completed_date' },
    )
  // 23505 = redan markerad som klar — ofarligt
  if (error && error.code !== '23505') throw error
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

/** Tar bort alla upprepande pass och deras SKIP-poster. Returnerar antal borttagna pass. */
export async function deleteRepeatingSessions(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, name, weekdays')
    .eq('user_id', userId)
  if (error) throw error

  const repeating = (data ?? []).filter(s => (s.weekdays ?? []).length > 0)
  if (repeating.length === 0) return 0

  const repeatingIds = repeating.map(s => s.id)
  const skipIds = (data ?? [])
    .filter(s => s.name.startsWith('SKIP:') && repeatingIds.some(id => s.name.endsWith(`:${id}`)))
    .map(s => s.id)

  const { error: delError } = await supabase
    .from('workout_sessions')
    .delete()
    .in('id', [...repeatingIds, ...skipIds])
  if (delError) throw delError
  return repeating.length
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

export interface CompletedSessionItem {
  id: string
  completedDate: string          // YYYY-MM-DD
  name: string                   // visningsnamn utan ONCE:-prefix
  sessionType: 'gym' | 'cardio'
  cardioType: string | null
  exerciseNames: string[]
  distanceKm: number | null
  durationSeconds: number | null
}

/** Alla avbockade schemapass med passinfo — för framstegskalenderns dagvy. */
export async function getCompletedSessionsHistory(userId: string): Promise<CompletedSessionItem[]> {
  const { data, error } = await supabase
    .from('workout_completions')
    .select('id, completed_date, distance_km, duration_seconds, workout_sessions(name, session_type, cardio_type, session_exercises(exercise_name, sort_order))')
    .eq('user_id', userId)
    .order('completed_date', { ascending: false })
  if (error) throw error

  return (data ?? []).map((c: any) => {
    const ws = c.workout_sessions as any
    let name: string = ws?.name ?? 'Pass'
    if (name.startsWith('ONCE:')) name = name.split(':').slice(2).join(':')
    return {
      id: c.id,
      completedDate: c.completed_date,
      name,
      sessionType: (ws?.session_type ?? 'gym') as 'gym' | 'cardio',
      cardioType: ws?.cardio_type ?? null,
      exerciseNames: [...(ws?.session_exercises ?? [])]
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((e: any) => e.exercise_name as string),
      distanceKm: c.distance_km != null ? Number(c.distance_km) : null,
      durationSeconds: c.duration_seconds ?? null,
    }
  })
}

/** Antal genomföranden per övning (session_exercise-id) — underlag för progression. */
export async function getExerciseCompletionCounts(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('exercise_completions')
    .select('exercise_id')
    .eq('user_id', userId)
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.exercise_id] = (counts[row.exercise_id] ?? 0) + 1
  }
  return counts
}

export async function completeExercise(exerciseId: string, userId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('exercise_completions')
    .insert({ exercise_id: exerciseId, user_id: userId, completed_date: date })
  // 23505 = duplicate (already complete) — fine. Other errors throw so the
  // optimistic checkbox in add.tsx rolls back instead of silently losing the check.
  if (error && error.code !== '23505') throw error
}

export async function uncompleteExercise(exerciseId: string, userId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('exercise_completions')
    .delete()
    .eq('exercise_id', exerciseId)
    .eq('user_id', userId)
    .eq('completed_date', date)
  if (error) throw error
}

// ─── Completions ──────────────────────────────────────────────────────────────

function isoDate(date: Date): string {
  return toLocalDateString(date)
}

/** Returns the calendar date (YYYY-MM-DD) for a given weekday (1=Mon…7=Sun) in the current week. */
export function dateForWeekday(weekdayNum: number): string {
  const today = new Date()
  const diff = weekdayNum - weekdayOf(today)
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
