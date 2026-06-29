import { supabase } from '@/lib/supabase'
import type { TaskType } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskItem {
  completionId: string
  templateId: string
  name: string
  description: string | null
  type: TaskType
  completed: boolean
}

// ─── Functions ────────────────────────────────────────────────────────────────

export async function getOrCreateTodayLog(
  challengeId: string,
  userId: string,
  dayNumber: number
) {
  const today = new Date().toISOString().split('T')[0]

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
  levelId: string
): Promise<TaskItem[]> {
  const { data: existing } = await supabase
    .from('task_completions')
    .select('id, completed, task_template_id, task_templates(name, description, type)')
    .eq('daily_log_id', dailyLogId)

  if (existing && existing.length > 0) {
    return existing.map(toTaskItem)
  }

  // First visit of the day — seed completions from templates
  const { data: templates } = await supabase
    .from('task_templates')
    .select('id')
    .eq('level_id', levelId)

  if (!templates || templates.length === 0) return []

  const { data: created } = await supabase
    .from('task_completions')
    .insert(templates.map((t) => ({
      daily_log_id: dailyLogId,
      task_template_id: t.id,
      completed: false,
    })))
    .select('id, completed, task_template_id, task_templates(name, description, type)')

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

export async function markDayCompleted(dailyLogId: string): Promise<void> {
  await supabase
    .from('daily_logs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', dailyLogId)
}

export async function markDayFailed(
  dailyLogId: string,
  reason: string
): Promise<void> {
  await supabase
    .from('daily_logs')
    .update({ status: 'failed' })
    .eq('id', dailyLogId)

  // Spara ursäkten på alla oavklarade tasks för dagen
  await supabase
    .from('task_completions')
    .update({ failed_reason: reason })
    .eq('daily_log_id', dailyLogId)
    .eq('completed', false)
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toTaskItem(row: any): TaskItem {
  return {
    completionId: row.id,
    templateId: row.task_template_id,
    name: row.task_templates?.name ?? '',
    description: row.task_templates?.description ?? null,
    type: row.task_templates?.type ?? 'workout',
    completed: row.completed,
  }
}
