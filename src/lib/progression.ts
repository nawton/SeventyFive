// =============================================================================
// PROGRESSION
// Lätt, deterministisk skalning av reps baserat på hur många gånger användaren
// genomfört övningen: +1 rep var TREDJE genomförande (inte varje pass), max +4.
// Gäller bara rena numeriska reps ("8") — "60 sek", "max" och "6×400 m" lämnas.
// =============================================================================

export const PROGRESSION_EVERY = 3   // genomföranden per steg
export const PROGRESSION_MAX   = 4   // max extra reps över basvärdet

export function scaledReps(
  baseReps: string | null,
  completions: number,
): { reps: string | null; progressed: boolean } {
  if (!baseReps) return { reps: baseReps, progressed: false }
  const trimmed = baseReps.trim()
  const base = parseInt(trimmed, 10)
  if (!Number.isFinite(base) || String(base) !== trimmed) {
    return { reps: baseReps, progressed: false }
  }
  const bump = Math.min(Math.floor(completions / PROGRESSION_EVERY), PROGRESSION_MAX)
  if (bump <= 0) return { reps: baseReps, progressed: false }
  return { reps: String(base + bump), progressed: true }
}
