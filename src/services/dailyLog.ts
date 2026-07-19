import { supabase } from '@/lib/supabase'
import { toLocalDateString, parseLocalDate } from '@/lib/date'
import type { TaskType, UserChallenge } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskDetails {
  glasses?: number
  book?: string
  pages?: number
}

export interface TaskItem {
  completionId: string
  templateId: string
  name: string
  description: string | null
  type: TaskType
  completed: boolean
  targetValue: number | null
  unit: string | null
  details: TaskDetails | null
  /** Ionicons-namn — bara satt för egna regler (valdes i regel-sheeten) */
  icon: string | null
}

// ─── Functions ────────────────────────────────────────────────────────────────

export async function getOrCreateTodayLog(
  challengeId: string,
  userId: string,
  dayNumber: number
) {
  const today = toLocalDateString()

  const { data: existing } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('challenge_id', challengeId)
    .eq('date', today)
    .maybeSingle()

  if (existing) return existing

  const { data, error } = await supabase
    .from('daily_logs')
    .insert({
      challenge_id: challengeId,
      user_id: userId,
      day_number: dayNumber,
      date: today,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getOrCreateTaskCompletions(
  dailyLogId: string,
  levelId: string,
  userId?: string,
  challengeId?: string,
): Promise<TaskItem[]> {
  const SELECT = 'id, completed, task_template_id, details, task_templates(name, description, type, target_value, unit, icon)'

  // A select error must never be treated as "first visit" — that would create duplicates
  const { data: existing, error: selectError } = await supabase
    .from('task_completions')
    .select(SELECT)
    .eq('daily_log_id', dailyLogId)
  if (selectError) throw selectError

  if (existing && existing.length > 0) {
    return existing.map(toTaskItem)
  }

  // First visit of the day — seed completions from level templates + user custom templates.
  // is('user_id', null) är kritiskt: utan det kommer egna custom-mallar med här OCKSÅ
  // (de har level_id satt) → dubbletter i insert-batchen → hela seedningen misslyckas,
  // och andra användares regler läcker in (mallar är publikt läsbara via RLS).
  const { data: levelTemplates } = await supabase
    .from('task_templates')
    .select('id')
    .eq('level_id', levelId)
    .is('user_id', null)

  const { data: customTemplates } = userId && challengeId
    ? await supabase
        .from('task_templates')
        .select('id')
        .eq('user_id', userId)
        .eq('challenge_id', challengeId)
    : { data: [] }

  // Dedupe på id — en dubblett i batchen fäller annars hela inserten
  // mot UNIQUE (daily_log_id, task_template_id) och dagen blir tom
  const templateIds = Array.from(
    new Set([...(levelTemplates ?? []), ...(customTemplates ?? [])].map(t => t.id))
  )
  if (templateIds.length === 0) return []

  const { data: created, error: insertError } = await supabase
    .from('task_completions')
    .insert(templateIds.map((id) => ({
      daily_log_id: dailyLogId,
      task_template_id: id,
      completed: false,
    })))
    .select(SELECT)

  // Unique violation = rows already exist (race or earlier failed read) — re-fetch
  if (insertError) {
    const { data: retry, error: retryError } = await supabase
      .from('task_completions')
      .select(SELECT)
      .eq('daily_log_id', dailyLogId)
    if (retryError) throw retryError
    return (retry ?? []).map(toTaskItem)
  }

  return (created ?? []).map(toTaskItem)
}

export async function setTaskCompleted(
  completionId: string,
  completed: boolean
): Promise<void> {
  const { error } = await supabase
    .from('task_completions')
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', completionId)

  if (error) throw error
}

/** Uppdaterar kvantitativ progress (glas, sidor, bok) tillsammans med klarstatus. */
export async function setTaskProgress(
  completionId: string,
  details: TaskDetails | null,
  completed: boolean
): Promise<void> {
  const { error } = await supabase
    .from('task_completions')
    .update({
      details,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', completionId)

  if (error) throw error
}

export async function markDayCompleted(dailyLogId: string): Promise<void> {
  const { error } = await supabase
    .from('daily_logs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', dailyLogId)
  if (error) throw error
}

/** Återställer dagen till pending, t.ex. när en uppgift bockas ur efter att dagen markerats klar. */
export async function markDayPending(dailyLogId: string): Promise<void> {
  const { error } = await supabase
    .from('daily_logs')
    .update({ status: 'pending', completed_at: null })
    .eq('id', dailyLogId)
  if (error) throw error
}

export async function markDayFailed(
  dailyLogId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase
    .from('daily_logs')
    .update({ status: 'failed' })
    .eq('id', dailyLogId)
  if (error) throw error

  // Spara ursäkten på alla oavklarade tasks för dagen
  await supabase
    .from('task_completions')
    .update({ failed_reason: reason })
    .eq('daily_log_id', dailyLogId)
    .eq('completed', false)
}

/**
 * Dagar före idag som varken är klara eller redan kvitterade som missade.
 * Räknar bara dagar från och med den dag utmaningen skapades i appen —
 * bakdaterade startdagar (onboarding "jag är på dag X") ska inte flaggas.
 */
export async function getMissedDayNumbers(
  challenge: UserChallenge,
  currentDay: number
): Promise<number[]> {
  const { data: logs } = await supabase
    .from('daily_logs')
    .select('day_number, status')
    .eq('challenge_id', challenge.id)

  const logMap = new Map((logs ?? []).map((l) => [l.day_number, l.status]))

  const start = parseLocalDate(challenge.start_date)
  const created = new Date(challenge.created_at)
  const createdMidnight = new Date(created.getFullYear(), created.getMonth(), created.getDate())
  const createdDay = Math.max(
    1,
    Math.round((createdMidnight.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  )

  const missed: number[] = []
  for (let day = createdDay; day < currentDay; day++) {
    const status = logMap.get(day)
    if (status !== 'completed' && status !== 'failed') missed.push(day)
  }
  return missed
}

/** "Fortsätt ändå": kvitterar missade dagar som failed så de inte flaggas igen. */
export async function acknowledgeMissedDays(
  challenge: UserChallenge,
  dayNumbers: number[]
): Promise<void> {
  if (dayNumbers.length === 0) return

  const start = parseLocalDate(challenge.start_date)
  const rows = dayNumbers.map((day) => {
    const d = new Date(start)
    d.setDate(start.getDate() + day - 1)
    return {
      challenge_id: challenge.id,
      user_id: challenge.user_id,
      day_number: day,
      date: toLocalDateString(d),
      status: 'failed' as const,
    }
  })

  const { error } = await supabase
    .from('daily_logs')
    .upsert(rows, { onConflict: 'challenge_id,day_number' })
  if (error) throw error
}

export async function countCompletedDays(challengeId: string): Promise<number> {
  const { count } = await supabase
    .from('daily_logs')
    .select('id', { count: 'exact', head: true })
    .eq('challenge_id', challengeId)
    .eq('status', 'completed')
  return count ?? 0
}

export interface DaySummary {
  dayNumber: number
  status: 'completed' | 'failed' | 'pending' | 'future'
}

export async function getAllDays(
  challengeId: string,
  currentDay: number
): Promise<DaySummary[]> {
  const { data: logs } = await supabase
    .from('daily_logs')
    .select('day_number, status')
    .eq('challenge_id', challengeId)

  const logMap = new Map((logs ?? []).map((l) => [l.day_number, l.status]))

  return Array.from({ length: 75 }, (_, i) => {
    const day = i + 1
    if (day > currentDay) return { dayNumber: day, status: 'future' }
    const status = logMap.get(day)
    if (status === 'completed') return { dayNumber: day, status: 'completed' }
    if (status === 'failed')    return { dayNumber: day, status: 'failed' }
    // Past days without a completed/failed log are missed → red
    if (day < currentDay)       return { dayNumber: day, status: 'failed' }
    return { dayNumber: day, status: 'pending' }
  })
}

/**
 * Counts consecutive days with status='completed', ending at today or yesterday
 * (if today is still pending). Returns 0 if no streak.
 */
export async function getStreak(challengeId: string): Promise<number> {
  const { data } = await supabase
    .from('daily_logs')
    .select('date, status')
    .eq('challenge_id', challengeId)
    .order('date', { ascending: false })
    .limit(75)

  if (!data || data.length === 0) return 0

  const today = toLocalDateString()
  const checkDate = new Date()

  // If today is not yet completed, start the streak check from yesterday
  const todayEntry = data.find(d => d.date === today)
  if (!todayEntry || todayEntry.status !== 'completed') {
    checkDate.setDate(checkDate.getDate() - 1)
  }

  let streak = 0
  for (let i = 0; i < 75; i++) {
    const dateStr = toLocalDateString(checkDate)
    const entry = data.find(d => d.date === dateStr)
    if (!entry || entry.status !== 'completed') break
    streak++
    checkDate.setDate(checkDate.getDate() - 1)
  }
  return streak
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toTaskItem(row: any): TaskItem {
  return {
    completionId: row.id,
    templateId: row.task_template_id,
    name: row.task_templates?.name ?? '',
    description: row.task_templates?.description ?? null,
    type: row.task_templates?.type ?? 'workout',
    completed: row.completed,
    targetValue: row.task_templates?.target_value ?? null,
    unit: row.task_templates?.unit ?? null,
    details: row.details ?? null,
    icon: row.task_templates?.icon ?? null,
  }
}

/** Uppgifterna för en historisk dag (read-only) — null om dagen saknar logg.
 *  Används av kalenderns dagvy för att visa vilka utmaningar som missades. */
export async function getTasksForDay(
  challengeId: string,
  dayNumber: number,
): Promise<TaskItem[] | null> {
  const { data: log } = await supabase
    .from('daily_logs')
    .select('id')
    .eq('challenge_id', challengeId)
    .eq('day_number', dayNumber)
    .maybeSingle()
  if (!log) return null

  const { data } = await supabase
    .from('task_completions')
    .select('id, completed, task_template_id, details, task_templates(name, description, type, target_value, unit, icon)')
    .eq('daily_log_id', log.id)
  if (!data || data.length === 0) return null
  return data.map(toTaskItem)
}
