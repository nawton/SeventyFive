import { supabase } from '@/lib/supabase'
import type { ExerciseCategory, ExerciseDifficulty } from '@/types/database'

export interface Exercise {
  id: string
  name: string
  description: string | null
  category: ExerciseCategory
  difficulty: ExerciseDifficulty
  video_url: string | null
}

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  strength: 'Styrka',
  cardio:   'Cardio',
  mobility: 'Rörlighet',
  hiit:     'HIIT',
}

export const DIFFICULTY_LABELS: Record<ExerciseDifficulty, string> = {
  beginner:     'Nybörjare',
  intermediate: 'Medel',
  advanced:     'Avancerad',
}

export const DIFFICULTY_COLORS: Record<ExerciseDifficulty, string> = {
  beginner:     '#3BE862',
  intermediate: '#FFA817',
  advanced:     '#FF3B4A',
}

export async function getExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, description, category, difficulty, video_url')
    .order('category')
    .order('name')

  if (error) throw error
  return data ?? []
}
