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

  const { error: challengeError } = await supabase.from('user_challenges').insert({
    user_id: userId,
    level_id: levelId,
    start_date,
    current_day: clampedStartDay,
    status: 'active',
  })
  if (challengeError) throw challengeError
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
