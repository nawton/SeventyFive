import { supabase } from '@/lib/supabase'
import { toLocalDateString, parseLocalDate, startOfWeek } from '@/lib/date'
import type { TaskType, UserChallenge } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskDetails {
  glasses?: number
  book?: string
  pages?: number
  /** Framstegsfotot medvetet överhoppat idag — dagen godkänns ändå */
  skipped?: boolean
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

/**
 * Normals marginal: en missad dag per utmaningsvecka (dag 1–7 = vecka 1 osv)
 * är förlåten — utmaningen fortsätter utan omstartsfråga. Två missar i
 * samma vecka spränger marginalen.
 */
export function missedWithinWeeklyMargin(missedDayNumbers: number[]): boolean {
  const byWeek = new Map<number, number>()
  for (const day of missedDayNumbers) {
    const week = Math.ceil(day / 7)
    byWeek.set(week, (byWeek.get(week) ?? 0) + 1)
  }
  return [...byWeek.values()].every(count => count <= 1)
}

export interface DayTaskUpdate {
  /** 'tpl:<templateId>' när dagen saknar logg — raden skapas då vid sparning */
  completionId: string
  templateId: string
  completed: boolean
}

/**
 * Redigering i efterhand från kalendern: skriver dagens bockar och sätter
 * dagens status därefter. Skapar dagslogg och avbockningsrader om dagen
 * saknar dem (glömda dagar). Blir allt ibockat räknas dagen som klarad,
 * vilket slår igenom överallt eftersom hela appen läser daily_logs.status.
 */
export async function updateDayTasks(
  challengeId: string,
  dayNumber: number,
  date: string,
  updates: DayTaskUpdate[],
): Promise<'completed' | 'pending' | 'failed'> {
  if (updates.length === 0) return 'pending'

  // Dagens logg — skapa den om dagen aldrig registrerades
  const { data: existing, error: logError } = await supabase
    .from('daily_logs')
    .select('id')
    .eq('challenge_id', challengeId)
    .eq('day_number', dayNumber)
    .maybeSingle()
  if (logError) throw logError

  let logId: string = existing?.id
  if (!logId) {
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) throw new Error('Inte inloggad')
    const { data: created, error: createError } = await supabase
      .from('daily_logs')
      .insert({ challenge_id: challengeId, user_id: uid, day_number: dayNumber, date, status: 'pending' })
      .select('id')
      .single()
    if (createError) throw createError
    logId = created.id
  }

  // Upsert klarar både befintliga rader och glömda dagars saknade rader.
  // failed_reason nollas — en ibockad uppgift är inte längre missad.
  const now = new Date().toISOString()
  const { error: upsertError } = await supabase
    .from('task_completions')
    .upsert(updates.map(u => ({
      daily_log_id: logId,
      task_template_id: u.templateId,
      completed: u.completed,
      completed_at: u.completed ? now : null,
      failed_reason: null,
    })), { onConflict: 'daily_log_id,task_template_id' })
  if (upsertError) throw upsertError

  // Dagens status följer bockarna: allt som KRÄVS i → klarad; annars
  // pågående idag och missad bakåt i tiden. Egna regler räknas aldrig som
  // krav, och på Normal är foto och läsning valfria enligt nivåreglerna.
  const { data: ch } = await supabase
    .from('user_challenges')
    .select('challenge_levels(slug)')
    .eq('id', challengeId)
    .maybeSingle()
  const slug = (ch as { challenge_levels?: { slug?: string } } | null)?.challenge_levels?.slug
  const optionalTypes = new Set<string>(
    slug === 'normal' ? ['custom', 'photo', 'reading'] : ['custom'],
  )

  const { data: all, error: allError } = await supabase
    .from('task_completions')
    .select('completed, task_templates(type)')
    .eq('daily_log_id', logId)
  if (allError) throw allError

  const rows = (all ?? []) as Array<{ completed: boolean; task_templates?: { type?: string } | null }>
  const gating = rows.filter(r => !optionalTypes.has(r.task_templates?.type ?? ''))
  const allDone = gating.length > 0 && gating.every(r => r.completed)
  const status = allDone ? 'completed' : date === toLocalDateString() ? 'pending' : 'failed'
  const { error: statusError } = await supabase
    .from('daily_logs')
    .update({ status, completed_at: allDone ? now : null })
    .eq('id', logId)
  if (statusError) throw statusError

  return status
}

export async function countCompletedDays(challengeId: string): Promise<number> {
  const { count } = await supabase
    .from('daily_logs')
    .select('id', { count: 'exact', head: true })
    .eq('challenge_id', challengeId)
    .eq('status', 'completed')
  return count ?? 0
}

/**
 * Klarade dagar över ALLA utmaningar, även failade. Medaljer och poäng
 * räknas härifrån så en fail bara nollar streaken, aldrig statistiken.
 */
export async function countCompletedDaysAllTime(userId: string): Promise<number> {
  const { count } = await supabase
    .from('daily_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed')
  return count ?? 0
}

/**
 * Längsta sviten av klarade dagar någonsin, över alla utmaningar.
 * Streakmedaljerna ska aldrig låsas igen för att utmaningen startats om.
 */
export async function getBestStreakAllTime(userId: string): Promise<number> {
  const { data } = await supabase
    .from('daily_logs')
    .select('date, status')
    .eq('user_id', userId)
    .order('date', { ascending: true })

  let best = 0
  let run = 0
  let prev: Date | null = null
  for (const row of data ?? []) {
    if (row.status !== 'completed') continue
    const d = parseLocalDate(row.date)
    // Math.round tål DST-dygn (23/25 timmar); 0 = dubbellogg på samma datum
    // (gammal failad utmaning + ny på samma dag) och ska inte bryta sviten
    const diffDays = prev ? Math.round((d.getTime() - prev.getTime()) / 86400000) : null
    if (diffDays === 0) continue
    run = diffDays === 1 ? run + 1 : 1
    prev = d
    if (run > best) best = run
  }
  return best
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

/** Status per datum för innevarande vecka (mån–sön) — till streaksidan */
export async function getWeekStatuses(challengeId: string): Promise<Record<string, string>> {
  const monday = startOfWeek()
  const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6)
  const { data } = await supabase
    .from('daily_logs')
    .select('date, status')
    .eq('challenge_id', challengeId)
    .gte('date', toLocalDateString(monday))
    .lte('date', toLocalDateString(sunday))
  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.date] = row.status
  return map
}

/** En annan persons streak — definer-RPC gated av samma synlighet som
    statistiken; låsta profiler ger 0 */
export async function getStreakOf(targetId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_streak_of', {
    target: targetId,
    today: toLocalDateString(),
  })
  if (error || typeof data !== 'number') return 0
  return data
}

/** En dags status och uppgifter, UTAN att skapa något — streaksidans
    dagvy ska kunna titta på gamla dagar utan bieffekter */
export async function getDayDetail(challengeId: string, date: string): Promise<{
  status: string | null
  tasks: TaskItem[]
}> {
  const { data: log } = await supabase
    .from('daily_logs')
    .select('id, status')
    .eq('challenge_id', challengeId)
    .eq('date', date)
    .maybeSingle()
  if (!log) return { status: null, tasks: [] }
  const { data } = await supabase
    .from('task_completions')
    .select('id, completed, task_template_id, details, task_templates(name, description, type, target_value, unit, icon)')
    .eq('daily_log_id', log.id)
  return { status: (log.status as string) ?? null, tasks: (data ?? []).map(toTaskItem) }
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

/** Uppgifterna för en historisk dag (read-only). Saknar dagen logg (öppnade
 *  aldrig appen) visas nivåns mallar som obockade i stället för ingenting.
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

  if (log) {
    const { data } = await supabase
      .from('task_completions')
      .select('id, completed, task_template_id, details, task_templates(name, description, type, target_value, unit, icon)')
      .eq('daily_log_id', log.id)
    if (data && data.length > 0) return data.map(toTaskItem)
  }

  // Ingen logg/inga bockar — visa nivåns uppgifter (+ egna regler) som ogjorda
  const { data: ch } = await supabase
    .from('user_challenges')
    .select('level_id, user_id')
    .eq('id', challengeId)
    .maybeSingle()
  if (!ch) return null

  const [{ data: levelTpls }, { data: customTpls }] = await Promise.all([
    supabase
      .from('task_templates')
      .select('id, name, description, type, target_value, unit, icon')
      .eq('level_id', ch.level_id)
      .is('user_id', null),
    supabase
      .from('task_templates')
      .select('id, name, description, type, target_value, unit, icon')
      .eq('user_id', ch.user_id)
      .eq('challenge_id', challengeId),
  ])
  const tpls = [...(levelTpls ?? []), ...(customTpls ?? [])]
  if (tpls.length === 0) return null
  return tpls.map(t => ({
    completionId: `tpl:${t.id}`,
    templateId: t.id,
    name: t.name,
    description: t.description ?? null,
    type: t.type,
    completed: false,
    targetValue: t.target_value ?? null,
    unit: t.unit ?? null,
    details: null,
    icon: t.icon ?? null,
  }))
}
