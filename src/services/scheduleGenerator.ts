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
  cardioType?: 'running' | 'interval' | 'cycling' | 'walking'
  notes?: string
}

// ─── Löpprogram ───────────────────────────────────────────────────────────────
// Tis intervaller, Tor lugnt pass, Lör långpass — halvmara/mara får även tempopass.
// Skapas som riktiga cardio-pass (session_type 'cardio') med passbeskrivningen i notes.

const RUN_PLANS: Record<string, PlannedSession[]> = {
  '5k': [
    { name: 'Intervaller',  weekdays: [2], exercises: [], cardioType: 'interval', notes: '6×400 m' },
    { name: 'Lugn löpning', weekdays: [4], exercises: [], cardioType: 'running',  notes: '20–25 min' },
    { name: 'Långpass',     weekdays: [6], exercises: [], cardioType: 'running',  notes: '4–5 km' },
  ],
  '10k': [
    { name: 'Intervaller',  weekdays: [2], exercises: [], cardioType: 'interval', notes: '5×800 m' },
    { name: 'Lugn löpning', weekdays: [4], exercises: [], cardioType: 'running',  notes: '30–40 min' },
    { name: 'Långpass',     weekdays: [6], exercises: [], cardioType: 'running',  notes: '7–9 km' },
  ],
  half: [
    { name: 'Intervaller',  weekdays: [2], exercises: [], cardioType: 'interval', notes: '6×1000 m' },
    { name: 'Tempopass',    weekdays: [4], exercises: [], cardioType: 'running',  notes: '8 km i tempofart' },
    { name: 'Lugn löpning', weekdays: [5], exercises: [], cardioType: 'running',  notes: '40 min' },
    { name: 'Långpass',     weekdays: [7], exercises: [], cardioType: 'running',  notes: '12–16 km' },
  ],
  marathon: [
    { name: 'Intervaller',  weekdays: [2], exercises: [], cardioType: 'interval', notes: '8×1000 m' },
    { name: 'Tempopass',    weekdays: [4], exercises: [], cardioType: 'running',  notes: '10–12 km i tempofart' },
    { name: 'Lugn löpning', weekdays: [5], exercises: [], cardioType: 'running',  notes: '45–60 min' },
    { name: 'Långpass',     weekdays: [7], exercises: [], cardioType: 'running',  notes: '20–30 km' },
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

// ─── Dagar per vecka ─────────────────────────────────────────────────────────
// Jämn fördelning över veckan med vilodagar emellan

const DAYS_TO_WEEKDAYS: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 3, 5, 6],
  5: [1, 2, 4, 5, 6],
}

// ─── Besvär: övningsbyten ────────────────────────────────────────────────────
// Byter belastande övningar mot snällare alternativ ur samma övningsbibliotek

const LIMITATION_SUBS: Record<string, Record<string, string>> = {
  knee: {
    'Knäböj':  'Rumänsk marklyft',
    'Utfall':  'Hyperextensions',
  },
  back: {
    'Marklyft':           'Benpress',
    'Rumänsk marklyft':   'Benpress',
    'Rodd med skivstång': 'Kabelrodd sittande',
    'Knäböj':             'Benpress',
    'Hyperextensions':    'Plankan',
  },
  shoulder: {
    'Militärpress':      'Hantelpress axlar',
    'Bänkpress':         'Hantelpress liggande',
    'Lutande bänkpress': 'Hantelpress liggande',
    'Sidolyft':          'Face pulls',
    'Arnold press':      'Face pulls',
    'Frontlyft':         'Face pulls',
    'Dips':              'Kabelkorsning',
    'Push-ups':          'Kabelkorsning',
  },
}

/** Byter ut övningar enligt valda besvär och tar bort dubbletter som uppstår. */
function applyLimitations(exercises: PlannedExercise[], limitations: string[]): PlannedExercise[] {
  if (limitations.length === 0) return exercises
  const seen = new Set<string>()
  const out: PlannedExercise[] = []
  for (const ex of exercises) {
    let name = ex.exercise_name
    for (const lim of limitations) {
      name = LIMITATION_SUBS[lim]?.[name] ?? name
    }
    if (seen.has(name)) continue
    seen.add(name)
    out.push({ ...ex, exercise_name: name })
  }
  return out
}

// ─── Generator ────────────────────────────────────────────────────────────────

function buildPlan(result: WizardResult): PlannedSession[] {
  const days     = DAYS_TO_WEEKDAYS[result.daysPerWeek] ?? DAYS_TO_WEEKDAYS[3]
  const numDays  = days.length

  if (result.goal === 'running') {
    const base = RUN_PLANS[result.runDistance ?? '5k'] ?? RUN_PLANS['5k']
    // Prioritera långpass + intervaller vid få dagar; fyll ut med lugn löpning vid många
    const priority = [...base].sort((a, b) => {
      const rank = (s: PlannedSession) =>
        s.name === 'Långpass' ? 0 : s.name === 'Intervaller' ? 1 : s.name === 'Tempopass' ? 2 : 3
      return rank(a) - rank(b)
    })
    const picked = priority.slice(0, numDays)
    while (picked.length < numDays) {
      picked.push({
        name: `Lugn löpning ${picked.length}`, weekdays: [], exercises: [],
        cardioType: 'running', notes: '20–30 min i lugnt tempo',
      })
    }
    return picked.map((s, i) => ({ ...s, weekdays: [days[i]] }))
  }

  let plan: PlannedSession[]
  if (result.musclePlan === 'focus' && result.focusGroups.length > 0) {
    const [first, second] = result.focusGroups
    const focusA = FOCUS_SESSIONS[first]
    const focusB = second ? FOCUS_SESSIONS[second] : null
    // Mönster: fokus 1 → helkropp som bas → fokus 2 (eller fokus 1 igen) → upprepa
    const pattern: PlannedSession[] = [
      { name: `Fokus: ${focusA.label}`, weekdays: [], exercises: focusA.exercises },
      { ...FULL_BODY_PLAN[1], name: 'Helkropp', weekdays: [] },
      focusB
        ? { name: `Fokus: ${focusB.label}`, weekdays: [], exercises: focusB.exercises }
        : { name: `Fokus: ${focusA.label} 2`, weekdays: [], exercises: focusA.exercises },
    ]
    plan = Array.from({ length: numDays }, (_, i) => {
      const p = pattern[i % pattern.length]
      const round = Math.floor(i / pattern.length)
      return { ...p, name: round > 0 ? `${p.name} · ${round + 1}` : p.name }
    })
  } else {
    // Helkropp A/B/C cyklas över valda dagar
    plan = Array.from({ length: numDays }, (_, i) => {
      const p = FULL_BODY_PLAN[i % FULL_BODY_PLAN.length]
      const round = Math.floor(i / FULL_BODY_PLAN.length)
      return { ...p, name: round > 0 ? `${p.name} · ${round + 1}` : p.name }
    })
  }

  return plan.map((s, i) => ({
    ...s,
    weekdays: [days[i]],
    exercises: applyLimitations(s.exercises, result.limitations ?? []),
  }))
}

/** Skapar veckoscheman utifrån wizard-svaren. Returnerar antal skapade pass. */
export async function generateScheduleFromWizard(
  userId: string,
  result: WizardResult
): Promise<number> {
  const plan = buildPlan(result)
  for (const session of plan) {
    await createWorkoutSession(
      userId,
      session.name,
      session.weekdays,
      session.exercises,
      session.notes ?? null,
      session.cardioType ? 'cardio' : 'gym',
      session.cardioType ?? null,
    )
  }
  return plan.length
}
