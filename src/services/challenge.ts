import { supabase } from '@/lib/supabase'
import type { UserChallengeWithLevel } from '@/types/database'

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
  answers: QuizAnswers
): Promise<void> {
  const levelId = LEVEL_IDS[levelSlug]
  const today = new Date().toISOString().split('T')[0]

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
    start_date: today,
    current_day: 1,
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

export function calculateCurrentDay(startDate: string): number {
  const start = new Date(startDate)
  const today = new Date()
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.min(diff + 1, 75)
}
