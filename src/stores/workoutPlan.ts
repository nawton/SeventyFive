export type PlanExercise = {
  id: string
  name: string
  category: string
  difficulty: string
  sets: number
  reps: number
  weight: string
}

export type WorkoutPlan = {
  exercises: PlanExercise[]
  restSeconds: number
}

let _plan: WorkoutPlan | null = null

export const workoutPlanStore = {
  get: (): WorkoutPlan | null => _plan,
  set: (p: WorkoutPlan | null) => { _plan = p },
}
