import { getStrengthWorkouts, type StrengthSet } from './strengthWorkouts'

// =============================================================================
// PERSONLIGA REKORD
// Beräknas ur loggade styrkepass (user_workouts) — ingen egen tabell.
// Två rekord per övning: tyngsta vikt och beräknat 1RM (Epley: vikt·(1+reps/30)),
// så att 80 kg × 8 räknas som starkare än 82,5 kg × 1.
// =============================================================================

export interface ExerciseRecord {
  exerciseName: string
  bestWeightKg: number
  bestWeightReps: number
  bestE1rm: number
  date: string            // YYYY-MM-DD för bästa 1RM-setet
}

export function epley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0
  return weightKg * (1 + reps / 30)
}

/** Alla rekord per övning, sorterade på bästa 1RM. */
export async function getPersonalRecords(userId: string): Promise<ExerciseRecord[]> {
  const workouts = await getStrengthWorkouts(userId)
  const byExercise = new Map<string, ExerciseRecord>()

  for (const w of workouts) {
    const date = w.data.workout_date ?? w.created_at.slice(0, 10)
    for (const set of w.data.sets) {
      if (set.weight_kg <= 0) continue
      const e1rm = epley1RM(set.weight_kg, set.reps)
      const rec  = byExercise.get(w.data.exercise_name)
      if (!rec) {
        byExercise.set(w.data.exercise_name, {
          exerciseName: w.data.exercise_name,
          bestWeightKg: set.weight_kg,
          bestWeightReps: set.reps,
          bestE1rm: e1rm,
          date,
        })
        continue
      }
      if (set.weight_kg > rec.bestWeightKg) {
        rec.bestWeightKg = set.weight_kg
        rec.bestWeightReps = set.reps
      }
      if (e1rm > rec.bestE1rm) {
        rec.bestE1rm = e1rm
        rec.date = date
      }
    }
  }

  return [...byExercise.values()].sort((a, b) => b.bestE1rm - a.bestE1rm)
}

/** Slår de nya seten övningens rekord? Returnerar det nya bästa 1RM-setet, annars null. */
export function findNewPR(
  existing: ExerciseRecord | undefined,
  sets: StrengthSet[],
): { weightKg: number; reps: number; e1rm: number } | null {
  let best: { weightKg: number; reps: number; e1rm: number } | null = null
  for (const set of sets) {
    if (set.weight_kg <= 0) continue
    const e1rm = epley1RM(set.weight_kg, set.reps)
    if (e1rm > (existing?.bestE1rm ?? 0) && e1rm > (best?.e1rm ?? 0)) {
      best = { weightKg: set.weight_kg, reps: set.reps, e1rm }
    }
  }
  return best
}
