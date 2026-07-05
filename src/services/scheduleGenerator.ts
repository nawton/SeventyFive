import { createWorkoutSession } from './workoutSchedule'
import type { WizardResult } from '@/components/ScheduleWizard'

// =============================================================================
// SCHEMAGENERATOR
// Översätter ScheduleWizard-svaren till riktiga workout_sessions.
// Veckodagar: 1=Mån … 7=Sön. Övningsnamnen matchar övningsbiblioteket i seed.
// =============================================================================

interface PlannedExercise {
  exercise_name: string
  sets: number | null
  reps: string | null
}

interface PlannedSession {
  name: string
  weekdays: number[]
  exercises: PlannedExercise[]
}

// ─── Löpprogram ───────────────────────────────────────────────────────────────
// Tis intervaller, Tor lugnt pass, Lör långpass — halvmara/mara får även tempopass

const RUN_PLANS: Record<string, PlannedSession[]> = {
  '5k': [
    { name: 'Intervaller',  weekdays: [2], exercises: [{ exercise_name: 'Intervallspring', sets: null, reps: '6×400 m' }] },
    { name: 'Lugn löpning', weekdays: [4], exercises: [{ exercise_name: 'Löpning',         sets: null, reps: '20–25 min' }] },
    { name: 'Långpass',     weekdays: [6], exercises: [{ exercise_name: 'Löpning',         sets: null, reps: '4–5 km' }] },
  ],
  '10k': [
    { name: 'Intervaller',  weekdays: [2], exercises: [{ exercise_name: 'Intervallspring', sets: null, reps: '5×800 m' }] },
    { name: 'Lugn löpning', weekdays: [4], exercises: [{ exercise_name: 'Löpning',         sets: null, reps: '30–40 min' }] },
    { name: 'Långpass',     weekdays: [6], exercises: [{ exercise_name: 'Löpning',         sets: null, reps: '7–9 km' }] },
  ],
  half: [
    { name: 'Intervaller',  weekdays: [2], exercises: [{ exercise_name: 'Intervallspring', sets: null, reps: '6×1000 m' }] },
    { name: 'Tempopass',    weekdays: [4], exercises: [{ exercise_name: 'Löpning',         sets: null, reps: '8 km i tempofart' }] },
    { name: 'Lugn löpning', weekdays: [5], exercises: [{ exercise_name: 'Löpning',         sets: null, reps: '40 min' }] },
    { name: 'Långpass',     weekdays: [7], exercises: [{ exercise_name: 'Löpning',         sets: null, reps: '12–16 km' }] },
  ],
  marathon: [
    { name: 'Intervaller',  weekdays: [2], exercises: [{ exercise_name: 'Intervallspring', sets: null, reps: '8×1000 m' }] },
    { name: 'Tempopass',    weekdays: [4], exercises: [{ exercise_name: 'Löpning',         sets: null, reps: '10–12 km i tempofart' }] },
    { name: 'Lugn löpning', weekdays: [5], exercises: [{ exercise_name: 'Löpning',         sets: null, reps: '45–60 min' }] },
    { name: 'Långpass',     weekdays: [7], exercises: [{ exercise_name: 'Löpning',         sets: null, reps: '20–30 km' }] },
  ],
}

// ─── Styrka: helkropp (3 dagar) ───────────────────────────────────────────────

const FULL_BODY_PLAN: PlannedSession[] = [
  {
    name: 'Helkropp A',
    weekdays: [1],
    exercises: [
      { exercise_name: 'Knäböj',             sets: 4, reps: '8' },
      { exercise_name: 'Bänkpress',          sets: 4, reps: '8' },
      { exercise_name: 'Rodd med skivstång', sets: 4, reps: '8' },
      { exercise_name: 'Militärpress',       sets: 3, reps: '10' },
      { exercise_name: 'Plankan',            sets: 3, reps: '60 sek' },
    ],
  },
  {
    name: 'Helkropp B',
    weekdays: [3],
    exercises: [
      { exercise_name: 'Marklyft',             sets: 4, reps: '6' },
      { exercise_name: 'Hantelpress liggande', sets: 4, reps: '10' },
      { exercise_name: 'Latsdrag framifrån',   sets: 4, reps: '10' },
      { exercise_name: 'Sidolyft',             sets: 3, reps: '12' },
      { exercise_name: 'Situps',               sets: 3, reps: '15' },
    ],
  },
  {
    name: 'Helkropp C',
    weekdays: [5],
    exercises: [
      { exercise_name: 'Benpress',          sets: 4, reps: '10' },
      { exercise_name: 'Push-ups',          sets: 3, reps: 'max' },
      { exercise_name: 'Enarms hantelrodd', sets: 4, reps: '10' },
      { exercise_name: 'Hantelpress axlar', sets: 3, reps: '10' },
      { exercise_name: 'Russian twist',     sets: 3, reps: '20' },
    ],
  },
]

// ─── Styrka: fokuspass per muskelgrupp ────────────────────────────────────────

const FOCUS_SESSIONS: Record<string, { label: string; exercises: PlannedExercise[] }> = {
  chest: {
    label: 'Bröst',
    exercises: [
      { exercise_name: 'Bänkpress',            sets: 4, reps: '8' },
      { exercise_name: 'Lutande bänkpress',    sets: 4, reps: '10' },
      { exercise_name: 'Hantelpress liggande', sets: 3, reps: '10' },
      { exercise_name: 'Kabelkorsning',        sets: 3, reps: '12' },
      { exercise_name: 'Dips',                 sets: 3, reps: 'max' },
    ],
  },
  back: {
    label: 'Rygg',
    exercises: [
      { exercise_name: 'Latsdrag framifrån',  sets: 4, reps: '10' },
      { exercise_name: 'Rodd med skivstång',  sets: 4, reps: '8' },
      { exercise_name: 'Kabelrodd sittande',  sets: 3, reps: '10' },
      { exercise_name: 'Face pulls',          sets: 3, reps: '15' },
      { exercise_name: 'Pull-ups',            sets: 3, reps: 'max' },
    ],
  },
  legs: {
    label: 'Ben',
    exercises: [
      { exercise_name: 'Knäböj',            sets: 4, reps: '8' },
      { exercise_name: 'Benpress',          sets: 4, reps: '10' },
      { exercise_name: 'Rumänsk marklyft',  sets: 3, reps: '10' },
      { exercise_name: 'Utfall',            sets: 3, reps: '12' },
      { exercise_name: 'Vadpress stående',  sets: 4, reps: '15' },
    ],
  },
  shoulders: {
    label: 'Axlar',
    exercises: [
      { exercise_name: 'Militärpress',    sets: 4, reps: '8' },
      { exercise_name: 'Sidolyft',        sets: 4, reps: '12' },
      { exercise_name: 'Bakre deltalyft', sets: 3, reps: '12' },
      { exercise_name: 'Arnold press',    sets: 3, reps: '10' },
      { exercise_name: 'Frontlyft',       sets: 3, reps: '12' },
    ],
  },
  arms: {
    label: 'Armar',
    exercises: [
      { exercise_name: 'Bicepscurl',            sets: 4, reps: '10' },
      { exercise_name: 'Tricepsstötning kabel', sets: 4, reps: '10' },
      { exercise_name: 'Hammercurl',            sets: 3, reps: '12' },
      { exercise_name: 'Skull crushers',        sets: 3, reps: '10' },
      { exercise_name: 'Preacher curl',         sets: 3, reps: '12' },
    ],
  },
  core: {
    label: 'Mage',
    exercises: [
      { exercise_name: 'Plankan',           sets: 3, reps: '60 sek' },
      { exercise_name: 'Hängande benlyft',  sets: 3, reps: '10' },
      { exercise_name: 'Kabelcrunch',       sets: 3, reps: '15' },
      { exercise_name: 'Russian twist',     sets: 3, reps: '20' },
      { exercise_name: 'Sidoplanka',        sets: 3, reps: '45 sek' },
    ],
  },
}

// ─── Generator ────────────────────────────────────────────────────────────────

function buildPlan(result: WizardResult): PlannedSession[] {
  if (result.goal === 'running') {
    return RUN_PLANS[result.runDistance ?? '5k'] ?? RUN_PLANS['5k']
  }

  if (result.musclePlan === 'focus' && result.focusGroups.length > 0) {
    const [first, second] = result.focusGroups
    const focusA = FOCUS_SESSIONS[first]
    const focusB = second ? FOCUS_SESSIONS[second] : null

    // Mån = fokus 1, Ons = helkropp som bas, Fre = fokus 2 (eller fokus 1 igen)
    return [
      { name: `Fokus: ${focusA.label}`, weekdays: [1], exercises: focusA.exercises },
      { ...FULL_BODY_PLAN[1], name: 'Helkropp', weekdays: [3] },
      focusB
        ? { name: `Fokus: ${focusB.label}`, weekdays: [5], exercises: focusB.exercises }
        : { name: `Fokus: ${focusA.label} 2`, weekdays: [5], exercises: focusA.exercises },
    ]
  }

  return FULL_BODY_PLAN
}

/** Skapar veckoscheman utifrån wizard-svaren. Returnerar antal skapade pass. */
export async function generateScheduleFromWizard(
  userId: string,
  result: WizardResult
): Promise<number> {
  const plan = buildPlan(result)
  for (const session of plan) {
    await createWorkoutSession(userId, session.name, session.weekdays, session.exercises)
  }
  return plan.length
}
