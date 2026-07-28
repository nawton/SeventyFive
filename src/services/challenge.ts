import { supabase } from '@/lib/supabase'
import { toLocalDateString, parseLocalDate } from '@/lib/date'
import type { UserChallenge, UserChallengeWithLevel } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_IDS: Record<string, string> = {
  normal:  'a1b2c3d4-0001-0001-0001-000000000001',
  hard:    'a1b2c3d4-0002-0002-0002-000000000002',
  extreme: 'a1b2c3d4-0003-0003-0003-000000000003',
}

const PRESSURE_NUMBERS: Record<string, number> = {
  normal: 1,
  hard: 2,
  extreme: 3,
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizAnswers {
  why: string
  goal: string
  pressure: string
}

// ─── Functions ────────────────────────────────────────────────────────────────

export async function acceptChallenge(
  userId: string,
  levelSlug: string,
  answers: QuizAnswers,
  startDay: number = 1
): Promise<void> {
  const levelId = LEVEL_IDS[levelSlug]

  const clampedStartDay = Math.min(Math.max(startDay, 1), 75)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (clampedStartDay - 1))
  const start_date = toLocalDateString(startDate)

  const { error: quizError } = await supabase.from('quiz_results').insert({
    user_id: userId,
    why_answer: answers.why,
    goal_answers: [{ question: 'goal', answer: answers.goal }],
    pressure_level: PRESSURE_NUMBERS[answers.pressure] ?? 1,
    recommended_level_id: levelId,
  })
  if (quizError) throw quizError

  const { data: challenge, error: challengeError } = await supabase
    .from('user_challenges')
    .insert({
      user_id: userId,
      level_id: levelId,
      start_date,
      current_day: clampedStartDay,
      status: 'active',
    })
    .select('id')
    .single()
  if (challengeError) throw challengeError

  // Hoppar man in mitt i utmaningen räknas dagarna fram till startdagen som
  // klarade: gröna i kalendern, ifyllda checkar och noll missade dagar
  if (clampedStartDay > 1 && challenge) {
    await backfillCompletedDays(userId, challenge.id, levelId, startDate, clampedStartDay)
  }
}

/** Skapar klarade dagsloggar med avbockade uppgifter för dag 1 … startDay-1. */
async function backfillCompletedDays(
  userId: string,
  challengeId: string,
  levelId: string,
  dayOneDate: Date,
  startDay: number,
): Promise<void> {
  const now = new Date().toISOString()
  const logs = Array.from({ length: startDay - 1 }, (_, i) => {
    const d = new Date(dayOneDate)
    d.setDate(d.getDate() + i)
    return {
      challenge_id: challengeId,
      user_id: userId,
      day_number: i + 1,
      date: toLocalDateString(d),
      status: 'completed',
      completed_at: now,
    }
  })

  const { data: created, error: logError } = await supabase
    .from('daily_logs')
    .insert(logs)
    .select('id')
  if (logError) throw logError

  // Nivåns uppgiftsmallar — is('user_id', null) håller andras egna regler ute
  const { data: templates, error: tplError } = await supabase
    .from('task_templates')
    .select('id')
    .eq('level_id', levelId)
    .is('user_id', null)
  if (tplError) throw tplError

  const completions = (created ?? []).flatMap(log =>
    (templates ?? []).map(t => ({
      daily_log_id: log.id,
      task_template_id: t.id,
      completed: true,
      completed_at: now,
    }))
  )
  if (completions.length === 0) return

  const { error: compError } = await supabase.from('task_completions').insert(completions)
  if (compError) throw compError
}

/**
 * Byter nivå på en pågående utmaning — tillåts EN gång per utmaning.
 * Historiken lämnas helt orörd: gamla dagar behåller sina loggar och
 * bockar, de nya reglerna seedas från nästa dags logg.
 */
export async function changeLevel(challenge: UserChallenge, newSlug: string): Promise<void> {
  if (challenge.level_changed_at) {
    throw new Error('Nivån kan bara ändras en gång per utmaning.')
  }
  const levelId = LEVEL_IDS[newSlug]
  if (!levelId) throw new Error('Okänd nivå.')
  if (levelId === challenge.level_id) throw new Error('Du är redan på den nivån.')

  const { error } = await supabase
    .from('user_challenges')
    .update({ level_id: levelId, level_changed_at: new Date().toISOString() })
    .eq('id', challenge.id)
  if (error) throw error
}

const LEVEL_NAMES: Record<string, string> = {
  normal: 'Normal',
  hard: 'Hard',
  extreme: 'Extreme',
}

/**
 * Nivånamnet som visas i appen. Härleds från slugen så gamla databasnamn
 * (Nawton Flow/Hard/Extreme) aldrig läcker ut i UI:t, oavsett om
 * namnbytesmigrationen körts eller inte.
 */
export function levelDisplayName(challenge: UserChallengeWithLevel | null): string {
  const level = challenge?.challenge_levels
  if (!level) return ''
  return LEVEL_NAMES[level.slug] ?? (level.display_name ?? '').replace(/^Nawton\s+/i, '')
}

export async function getActiveChallenge(userId: string): Promise<UserChallengeWithLevel | null> {
  const { data } = await supabase
    .from('user_challenges')
    .select('*, challenge_levels(*)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  return data as UserChallengeWithLevel | null
}

/** Dagnummer sedan start utan tak — kan bli > 75 när utmaningen är slut. */
export function calculateDaysSinceStart(startDate: string): number {
  const start = parseLocalDate(startDate)
  const now = new Date()
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // Math.round tål DST-skiften (dygn som är 23/25 timmar)
  const diff = Math.round((todayMidnight.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return diff + 1
}

export function calculateCurrentDay(startDate: string): number {
  return Math.min(calculateDaysSinceStart(startDate), 75)
}

/**
 * Markerar den aktiva utmaningen som failed och startar en ny från dag 1
 * på samma nivå. Ordningen spelar roll — det partiella unika indexet tillåter
 * bara en aktiv utmaning per användare.
 */
export async function restartChallenge(challenge: UserChallenge): Promise<void> {
  const failedDay = Math.min(calculateDaysSinceStart(challenge.start_date), 75)

  const { error: failError } = await supabase
    .from('user_challenges')
    .update({ status: 'failed', failed_on_day: failedDay })
    .eq('id', challenge.id)
  if (failError) throw failError

  const { error: insertError } = await supabase.from('user_challenges').insert({
    user_id: challenge.user_id,
    level_id: challenge.level_id,
    start_date: toLocalDateString(),
    current_day: 1,
    status: 'active',
  })
  if (insertError) throw insertError
}

export async function completeChallenge(challengeId: string): Promise<void> {
  const { error } = await supabase
    .from('user_challenges')
    .update({ status: 'completed', current_day: 75 })
    .eq('id', challengeId)
  if (error) throw error
}
