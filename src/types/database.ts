// =============================================================================
// DATABASTYPER — SEVENTYFIVE BY NAWTON
// Dessa typer speglar schemat exakt. Om schemat ändras, uppdatera hit.
// Genereras automatiskt med: npx supabase gen types typescript --local
// =============================================================================

export type SubscriptionStatus = 'trial' | 'active' | 'expired'
export type ChallengeStatus = 'active' | 'failed' | 'completed'
export type DailyLogStatus = 'pending' | 'completed' | 'failed'
export type TaskType = 'workout' | 'diet' | 'water' | 'reading' | 'photo'
export type ExerciseCategory = 'strength' | 'cardio' | 'mobility' | 'hiit'
export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced'
export type ChallengeSlug = 'normal' | 'hard' | 'extreme'

export interface Profile {
  id: string
  name: string | null
  avatar_url: string | null
  subscription_status: SubscriptionStatus
  trial_started_at: string
  payment_completed_at: string | null
  created_at: string
}

export interface ChallengeLevel {
  id: string
  slug: ChallengeSlug
  display_name: string
  description: string
  rules: ChallengeRule[]
}

export interface ChallengeRule {
  rule: string
  icon: string
}

export interface QuizResult {
  id: string
  user_id: string
  why_answer: string
  goal_answers: QuizAnswer[]
  pressure_level: number
  recommended_level_id: string
  created_at: string
}

export interface QuizAnswer {
  question: string
  answer: string
}

export interface UserChallenge {
  id: string
  user_id: string
  level_id: string
  start_date: string
  current_day: number
  status: ChallengeStatus
  failed_on_day: number | null
  created_at: string
}

export interface TaskTemplate {
  id: string
  level_id: string
  type: TaskType
  name: string
  description: string | null
  target_value: number | null
  unit: string | null
}

export interface DailyLog {
  id: string
  challenge_id: string
  user_id: string
  day_number: number
  date: string
  status: DailyLogStatus
  reflection: string | null
  completed_at: string | null
  created_at: string
}

export interface TaskCompletion {
  id: string
  daily_log_id: string
  task_template_id: string
  completed: boolean
  completed_at: string | null
  failed_reason: string | null
  ai_coach_response: string | null
}

export interface Exercise {
  id: string
  name: string
  description: string | null
  video_url: string | null
  category: ExerciseCategory
  difficulty: ExerciseDifficulty
  created_at: string
}

export interface WorkoutExercise {
  exercise_id: string
  sets: number | null
  reps: number | null
  duration_seconds: number | null
}

export interface UserWorkout {
  id: string
  user_id: string
  name: string
  is_favorite: boolean
  exercises: WorkoutExercise[]
  created_at: string
}

export interface MealTime {
  label: string
  time: string // "HH:MM"
}

export interface WorkoutTime {
  label: string
  time: string // "HH:MM"
}

export interface UserSchedule {
  id: string
  user_id: string
  wake_time: string | null // "HH:MM:SS"
  meal_times: MealTime[]
  workout_times: WorkoutTime[]
  notifications_enabled: boolean
  updated_at: string
}

export interface ProgressPhoto {
  id: string
  user_id: string
  challenge_id: string
  day_number: number
  photo_url: string
  caption: string | null
  is_public: boolean
  created_at: string
}

// =============================================================================
// SAMMANSATTA TYPER — används i komponenter
// =============================================================================

// Hemskärmen behöver loggen + alla dess tasks i en fråga
export interface DailyLogWithTasks extends DailyLog {
  task_completions: (TaskCompletion & {
    task_templates: TaskTemplate
  })[]
}

// Utmaningen med sin nivå
export interface UserChallengeWithLevel extends UserChallenge {
  challenge_levels: ChallengeLevel
}
