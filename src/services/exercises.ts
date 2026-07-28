import { supabase } from '@/lib/supabase'
import { registerExerciseMuscles, type Slug } from '@/lib/muscles'
import type { ExerciseCategory, ExerciseDifficulty } from '@/types/database'

export type ExerciseEquipment =
  | 'none' | 'barbell' | 'dumbbell' | 'kettlebell' | 'machine'
  | 'plate' | 'band' | 'suspension' | 'other'

export type ExerciseType =
  | 'weight_reps' | 'bodyweight' | 'weighted_bodyweight'
  | 'assisted_bodyweight' | 'duration' | 'duration_weight'
  | 'distance_duration' | 'weight_distance'

export interface Exercise {
  id: string
  name: string
  description: string | null
  category: ExerciseCategory
  difficulty: ExerciseDifficulty
  video_url: string | null
  /** Satt för egna övningar — biblioteket har null */
  user_id?: string | null
  equipment?: ExerciseEquipment | null
  primary_muscle?: Slug | null
  other_muscles?: Slug[] | null
  exercise_type?: ExerciseType | null
}

export const EQUIPMENT_LABELS: Record<ExerciseEquipment, string> = {
  none:       'Ingen utrustning',
  barbell:    'Skivstång',
  dumbbell:   'Hantlar',
  kettlebell: 'Kettlebell',
  machine:    'Maskin',
  plate:      'Viktskiva',
  band:       'Gummiband',
  suspension: 'Suspensionsband',
  other:      'Annat',
}

export const EXERCISE_TYPE_INFO: Record<ExerciseType, { label: string; example: string; badges: string[] }> = {
  weight_reps:         { label: 'Vikt & reps',            example: 'Bänkpress, Hantelcurl',              badges: ['REPS', 'KG'] },
  bodyweight:          { label: 'Kroppsvikt',             example: 'Pull-ups, Situps, Burpees',          badges: ['REPS'] },
  weighted_bodyweight: { label: 'Kroppsvikt med vikt',    example: 'Viktade pull-ups, viktade dips',     badges: ['REPS', '+KG'] },
  assisted_bodyweight: { label: 'Assisterad kroppsvikt',  example: 'Assisterade pull-ups och dips',      badges: ['REPS', '-KG'] },
  duration:            { label: 'Endast tid',                    example: 'Plankan, yoga, stretching',          badges: ['TID'] },
  duration_weight:     { label: 'Tid & vikt',             example: 'Viktad planka, wall sit',            badges: ['KG', 'TID'] },
  distance_duration:   { label: 'Distans & tid',           example: 'Löpning, cykling, rodd',             badges: ['KM', 'TID'] },
  weight_distance:     { label: 'Vikt & distans',          example: 'Farmers walk, sled push',            badges: ['KG', 'KM'] },
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
    .select('id, name, description, category, difficulty, video_url, user_id, equipment, primary_muscle, other_muscles, exercise_type')
    .order('category')
    .order('name')

  if (error) throw error
  const exercises: Exercise[] = data ?? []
  // Egna övningar har explicit valda muskler — registrera dem så
  // muskelkartan och gruppindelningen i väljaren känner igen namnen
  for (const ex of exercises) {
    if (ex.user_id && ex.primary_muscle) {
      registerExerciseMuscles(ex.name, [ex.primary_muscle, ...(ex.other_muscles ?? [])])
    }
  }
  return exercises
}

/** Skapar en egen gymövning. Musklerna registreras direkt så kartan funkar. */
export async function createCustomExercise(params: {
  name: string
  equipment: ExerciseEquipment
  primaryMuscle: Slug
  otherMuscles: Slug[]
  exerciseType: ExerciseType
}): Promise<Exercise> {
  const { data: { session } } = await supabase.auth.getSession()
  const uid = session?.user?.id
  if (!uid) throw new Error('Inte inloggad')

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      user_id: uid,
      name: params.name.trim(),
      description: null,
      category: 'strength',
      difficulty: 'beginner',
      equipment: params.equipment,
      primary_muscle: params.primaryMuscle,
      other_muscles: params.otherMuscles,
      exercise_type: params.exerciseType,
    })
    .select('id, name, description, category, difficulty, video_url, user_id, equipment, primary_muscle, other_muscles, exercise_type')
    .single()
  if (error) throw error

  registerExerciseMuscles(data.name, [params.primaryMuscle, ...params.otherMuscles])
  return data
}

/** Raderar en egen övning — RLS stoppar allt som inte är ens eget. */
export async function deleteCustomExercise(id: string): Promise<void> {
  const { error } = await supabase.from('exercises').delete().eq('id', id)
  if (error) throw error
}
