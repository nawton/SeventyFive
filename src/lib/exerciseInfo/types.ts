// =============================================================================
// Övningsinfo från det licensierade ExerciseDB-paketet (EULA tillåter
// integrering i appen). Muskler och utrustning är svenska strängar som
// t() översätter, stegen bär båda språken eftersom samma svenska mening
// kan ha olika engelska original i källan.
// =============================================================================

export type ExerciseStep = { sv: string; en: string }

export type ExerciseInfo = {
  /** Utrustning på svenska, visas via t() */
  equipment: string
  /** Primär muskel på svenska, visas via t() */
  target: string
  /** Övriga muskler på svenska, utan dubbletter av target */
  secondary: string[]
  /** Steg-för-steg-instruktioner, sv översatt från en */
  steps: ExerciseStep[]
}
