import { supabase } from '@/lib/supabase'
import { setFiveKTime } from '@/lib/prefs'
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
// Runna-stil: passtyper som börjar lågt och växer vecka för vecka —
// progressionen skrivs i notes på formatet som resolveRunProgression läser
// ("Start … · +… per vecka · max …") och nivån följer kalendern: planvecka
// räknat från att passet skapades. Start, ökningstakt och tak följer
// erfarenhetsnivån (samma försiktiga upptrappning som etablerade planer:
// långpasset ökar ~0,5–2 km/vecka beroende på nivå och mål, i linje med
// 10 %-regeln). Anger man en 5 km-testtid skrivs tempozoner in i passen.

export type RunExperience = 'beginner' | 'intermediate' | 'advanced'

interface ProgSpec     { start: number; step: number; max: number }
interface IntervalSpec { dist: number; start: number; max: number }

interface RunLevelPlan {
  long:     ProgSpec
  tempo:    ProgSpec
  interval: IntervalSpec
  /** Återhämtningspassets längd, t.ex. "25–35 min" — medvetet utan progression */
  recovery: string
  /** Målspecifikt femte pass (fartlek/distanspass/maratonfart) */
  extra:    { name: string; spec: ProgSpec; suffix: string }
}

const RUN_TABLES: Record<string, Record<RunExperience, RunLevelPlan>> = {
  '5k': {
    beginner: {
      long:  { start: 2, step: 0.5, max: 5 },
      tempo: { start: 1.5, step: 0.5, max: 3 },
      interval: { dist: 400, start: 4, max: 8 },
      recovery: '15–20 min',
      extra: { name: 'Fartlek', spec: { start: 2, step: 0.5, max: 4 }, suffix: ' fartlek' },
    },
    intermediate: {
      long:  { start: 3, step: 0.5, max: 7 },
      tempo: { start: 2, step: 0.5, max: 4 },
      interval: { dist: 400, start: 6, max: 10 },
      recovery: '20–25 min',
      extra: { name: 'Fartlek', spec: { start: 3, step: 0.5, max: 5 }, suffix: ' fartlek' },
    },
    advanced: {
      long:  { start: 4, step: 1, max: 9 },
      tempo: { start: 3, step: 0.5, max: 5 },
      interval: { dist: 400, start: 8, max: 12 },
      recovery: '25–30 min',
      extra: { name: 'Fartlek', spec: { start: 4, step: 0.5, max: 6 }, suffix: ' fartlek' },
    },
  },
  '10k': {
    beginner: {
      long:  { start: 4, step: 0.5, max: 8 },
      tempo: { start: 2, step: 0.5, max: 4 },
      interval: { dist: 800, start: 3, max: 6 },
      recovery: '20–30 min',
      extra: { name: 'Fartlek', spec: { start: 3, step: 0.5, max: 5 }, suffix: ' fartlek' },
    },
    intermediate: {
      long:  { start: 5, step: 1, max: 12 },
      tempo: { start: 3, step: 0.5, max: 6 },
      interval: { dist: 800, start: 4, max: 7 },
      recovery: '25–35 min',
      extra: { name: 'Fartlek', spec: { start: 4, step: 0.5, max: 6 }, suffix: ' fartlek' },
    },
    advanced: {
      long:  { start: 6, step: 1, max: 14 },
      tempo: { start: 4, step: 1, max: 8 },
      interval: { dist: 800, start: 5, max: 8 },
      recovery: '30–40 min',
      extra: { name: 'Fartlek', spec: { start: 5, step: 0.5, max: 7 }, suffix: ' fartlek' },
    },
  },
  half: {
    beginner: {
      long:  { start: 5, step: 1, max: 16 },
      tempo: { start: 3, step: 0.5, max: 6 },
      interval: { dist: 800, start: 4, max: 7 },
      recovery: '25–35 min',
      extra: { name: 'Distanspass', spec: { start: 6, step: 1, max: 10 }, suffix: ' i jämn, behaglig fart' },
    },
    intermediate: {
      long:  { start: 6, step: 1, max: 18 },
      tempo: { start: 4, step: 1, max: 8 },
      interval: { dist: 800, start: 5, max: 8 },
      recovery: '30–40 min',
      extra: { name: 'Distanspass', spec: { start: 8, step: 1, max: 12 }, suffix: ' i jämn, behaglig fart' },
    },
    advanced: {
      long:  { start: 8, step: 1.5, max: 21 },
      tempo: { start: 5, step: 1, max: 10 },
      interval: { dist: 1000, start: 5, max: 8 },
      recovery: '35–45 min',
      extra: { name: 'Distanspass', spec: { start: 10, step: 1, max: 14 }, suffix: ' i jämn, behaglig fart' },
    },
  },
  marathon: {
    beginner: {
      long:  { start: 8, step: 1.5, max: 30 },
      tempo: { start: 4, step: 0.5, max: 8 },
      interval: { dist: 800, start: 4, max: 8 },
      recovery: '30–40 min',
      extra: { name: 'Maratonfart', spec: { start: 4, step: 1, max: 10 }, suffix: ' i maratonfart' },
    },
    intermediate: {
      long:  { start: 10, step: 1.5, max: 30 },
      tempo: { start: 5, step: 1, max: 10 },
      interval: { dist: 1000, start: 5, max: 8 },
      recovery: '30–45 min',
      extra: { name: 'Maratonfart', spec: { start: 5, step: 1, max: 12 }, suffix: ' i maratonfart' },
    },
    advanced: {
      long:  { start: 12, step: 2, max: 34 },
      tempo: { start: 6, step: 1, max: 12 },
      interval: { dist: 1000, start: 6, max: 10 },
      recovery: '40–50 min',
      extra: { name: 'Maratonfart', spec: { start: 6, step: 1, max: 14 }, suffix: ' i maratonfart' },
    },
  },
}

/** Vad varje passtyp betyder — visas i schemaguiden så begreppen inte är grekiska */
export const RUN_SESSION_INFO: Record<string, string> = {
  'Långpass':     'Långsamt och långt — bygger uthålligheten. Farten ska kännas pratvänlig.',
  'Intervaller':  'Korta, snabba upprepningar med vila emellan — höjer maxfart och flås.',
  'Återhämtning': 'Kort och riktigt lugnt — hjälper kroppen hämta sig mellan de tunga passen.',
  'Tempopass':    'Jämn, ansträngande fart strax under tävlingstempo — lär dig hålla fart längre.',
  'Fartlek':      'Lek med farten — växla fritt mellan snabbt och lugnt under passet.',
  'Distanspass':  'Medellångt pass i jämn, behaglig fart — vänjer kroppen vid distans.',
  'Maratonfart':  'Kilometer i din tänkta tävlingsfart — övar exakt det tempo du ska hålla.',
}

const fmtKm   = (n: number) => String(n).replace('.', ',')
const fmtPace = (sec: number) => {
  const r = Math.round(sec)
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`
}
const paceRange = (a: number, b: number) => ` · ca ${fmtPace(a)}–${fmtPace(b)} /km`

const progNotes = (p: ProgSpec, suffix = '') =>
  `Start ${fmtKm(p.start)} km · +${fmtKm(p.step)} km per vecka · max ${fmtKm(p.max)} km${suffix}`

/** Passen i prioritetsordning för valt mål — de första N används för N dagar.
    Exporterad för enhetstester — appen går via generateScheduleFromWizard. */
export function buildRunSessions(distance: string, exp: RunExperience, fiveKSec: number | null): PlannedSession[] {
  const t = (RUN_TABLES[distance] ?? RUN_TABLES['5k'])[exp]
  // Tempozoner från 5 km-testet (P = sek/km i testet) — beprövade påslag:
  // lugnt +60–90 s, tempo +15–25 s, intervaller ≈ testfart, maraton +45–60 s.
  // Orimliga tider (under 12 eller över 90 min — troligen ett tempo eller en
  // felskrivning) ignoreras hellre än att ge löjliga tempoförslag
  const P = fiveKSec && fiveKSec >= 12 * 60 && fiveKSec <= 90 * 60 ? fiveKSec / 5 : null
  const easyPace  = P ? paceRange(P + 60, P + 90) : ''
  const tempoPace = P ? paceRange(P + 15, P + 25) : ''
  const intPace   = P ? ` · ca ${fmtPace(P - 5)} /km` : ''
  const extraPace = P
    ? t.extra.name === 'Maratonfart' ? paceRange(P + 45, P + 60)
    : t.extra.name === 'Distanspass' ? paceRange(P + 35, P + 50)
    : ''
    : ''

  return [
    { name: 'Långpass',     weekdays: [], exercises: [], cardioType: 'running',  notes: progNotes(t.long, easyPace) },
    { name: 'Intervaller',  weekdays: [], exercises: [], cardioType: 'interval', notes: `Start ${t.interval.start}×${t.interval.dist} m · +1 per vecka · max ${t.interval.max}×${t.interval.dist} m${intPace}` },
    { name: 'Återhämtning', weekdays: [], exercises: [], cardioType: 'running',  notes: `${t.recovery} i lugnt tempo${easyPace}` },
    { name: 'Tempopass',    weekdays: [], exercises: [], cardioType: 'running',  notes: progNotes(t.tempo, ` i tempofart${tempoPace}`) },
    { name: t.extra.name,   weekdays: [], exercises: [], cardioType: 'running',  notes: progNotes(t.extra.spec, `${t.extra.suffix}${extraPace}`) },
  ]
}

// ─── Uppdatera 5 km-tiden mitt i planen ──────────────────────────────────────
// Skriver om tempoförslagen i befintliga plan-pass utifrån en ny testtid —
// progressionen (start/ökning/max) lämnas orörd, och pass utan planformat
// (egna anteckningar) rörs aldrig.

const PACE_SUFFIX_RE = /\s*·\s*ca\s+[0-9]+:[0-9]{2}(?:–[0-9]+:[0-9]{2})?\s*\/(?:km|mi)/

export function rewritePaces(notes: string, fiveKSec: number): string {
  const base = notes.replace(PACE_SUFFIX_RE, '')
  const isSpec = /^Start /.test(base)
  const isRecovery = base.includes('i lugnt tempo')
  if (!isSpec && !isRecovery) return notes          // egna anteckningar — rör ej
  if (/fartlek/i.test(base)) return base            // fartlek har inget tempoförslag
  const P = fiveKSec / 5
  if (/^Start \d+×\d+\s*m/.test(base))        return `${base} · ca ${fmtPace(P - 5)} /km`
  if (base.includes('i tempofart'))           return `${base}${paceRange(P + 15, P + 25)}`
  if (base.includes('i maratonfart'))         return `${base}${paceRange(P + 45, P + 60)}`
  if (base.includes('i jämn, behaglig fart')) return `${base}${paceRange(P + 35, P + 50)}`
  return `${base}${paceRange(P + 60, P + 90)}`      // långpass + återhämtning
}

/** Uppdaterar tempoförslagen i alla plan-pass. Returnerar antal ändrade pass. */
export async function updateRunPaces(userId: string, fiveKSec: number): Promise<number> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, notes, session_type, weekdays')
    .eq('user_id', userId)
  if (error) throw error

  const cardio = (data ?? []).filter(s =>
    s.session_type === 'cardio' && (s.weekdays ?? []).length > 0 && s.notes)

  const updates = cardio
    .map(s => ({ id: s.id as string, next: rewritePaces(s.notes as string, fiveKSec) }))
    .filter((u, i) => u.next !== cardio[i].notes)

  await Promise.all(updates.map(u =>
    supabase.from('workout_sessions').update({ notes: u.next }).eq('id', u.id)))
  await setFiveKTime(fiveKSec)
  return updates.length
}

/** Passtyperna som ingår för mål + antal dagar — till schemaguidens förklaring */
export function plannedRunTypes(distance: string, numDays: number): string[] {
  const names = buildRunSessions(distance, 'intermediate', null).map(x => x.name)
  const picked = names.slice(0, Math.max(1, numDays))
  if (numDays > names.length && !picked.includes('Återhämtning')) picked.push('Återhämtning')
  return picked
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

// ─── Muskelsplittar ──────────────────────────────────────────────────────────
// Ihophängande pass där varje dag har ett tydligt tema (bröst+triceps,
// rygg+biceps, ben+mage …) — vilken split som används beror på antal dagar.

interface SplitDay {
  name: string
  groups: string[]   // muskelgrupper dagen täcker (matchar fokusgruppernas nycklar)
  exercises: PlannedExercise[]
}

const e = (exercise_name: string, sets: number | null, reps: string | null): PlannedExercise =>
  ({ exercise_name, sets, reps })

const SPLIT_DAYS: Record<string, SplitDay> = {
  chestTri: {
    name: 'Bröst & Triceps', groups: ['chest', 'arms'],
    exercises: [
      e('Bänkpress', 4, '8'), e('Lutande bänkpress', 3, '10'), e('Hantelpress liggande', 3, '10'),
      e('Tricepsstötning kabel', 3, '10'), e('Skull crushers', 3, '10'),
    ],
  },
  backBi: {
    name: 'Rygg & Biceps', groups: ['back', 'arms'],
    exercises: [
      e('Marklyft', 4, '6'), e('Latsdrag framifrån', 4, '10'), e('Kabelrodd sittande', 3, '10'),
      e('Bicepscurl', 3, '12'), e('Hammercurl', 3, '12'),
    ],
  },
  legsCore: {
    name: 'Ben & Mage', groups: ['legs', 'core'],
    exercises: [
      e('Knäböj', 4, '8'), e('Benpress', 3, '10'), e('Rumänsk marklyft', 3, '10'),
      e('Vadpress stående', 3, '15'), e('Plankan', 3, '60 sek'), e('Russian twist', 3, '20'),
    ],
  },
  shouldersCore: {
    name: 'Axlar & Mage', groups: ['shoulders', 'core'],
    exercises: [
      e('Militärpress', 4, '8'), e('Sidolyft', 3, '12'), e('Bakre deltalyft', 3, '12'),
      e('Hängande benlyft', 3, '10'), e('Sidoplanka', 3, '45 sek'),
    ],
  },
  upper: {
    name: 'Överkropp', groups: ['chest', 'back', 'shoulders', 'arms'],
    exercises: [
      e('Bänkpress', 4, '8'), e('Rodd med skivstång', 4, '8'), e('Militärpress', 3, '10'),
      e('Latsdrag framifrån', 3, '10'), e('Bicepscurl', 3, '12'), e('Tricepsstötning kabel', 3, '12'),
    ],
  },
  lower: {
    name: 'Underkropp & Mage', groups: ['legs', 'core'],
    exercises: [
      e('Knäböj', 4, '8'), e('Marklyft', 4, '6'), e('Utfall', 3, '12'),
      e('Vadpress stående', 3, '15'), e('Plankan', 3, '60 sek'),
    ],
  },
  fullBody:  { name: 'Helkropp', groups: ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'], exercises: FULL_BODY_PLAN[0].exercises },
  chest:     { name: 'Bröst',  groups: ['chest'],     exercises: FOCUS_SESSIONS.chest.exercises },
  back:      { name: 'Rygg',   groups: ['back'],      exercises: FOCUS_SESSIONS.back.exercises },
  legs:      { name: 'Ben',    groups: ['legs'],      exercises: FOCUS_SESSIONS.legs.exercises },
  shoulders: { name: 'Axlar',  groups: ['shoulders'], exercises: FOCUS_SESSIONS.shoulders.exercises },
  arms:      { name: 'Armar',  groups: ['arms'],      exercises: FOCUS_SESSIONS.arms.exercises },
  core:      { name: 'Mage',   groups: ['core'],      exercises: FOCUS_SESSIONS.core.exercises },
}

const SPLITS_BY_DAYS: Record<number, string[]> = {
  1: ['fullBody'],
  2: ['upper', 'lower'],
  3: ['chestTri', 'backBi', 'legsCore'],
  4: ['chestTri', 'backBi', 'legs', 'shouldersCore'],
  5: ['chestTri', 'backBi', 'legs', 'shouldersCore', 'arms'],
  6: ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'],
  7: ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'fullBody'],
}

/** Bygger dagsteman för valt antal dagar; fokusgrupper garanteras täckning och läggs först i veckan. */
function buildMuscleSplit(numDays: number, focusGroups: string[]): SplitDay[] {
  const dayKeys = [...(SPLITS_BY_DAYS[Math.min(Math.max(numDays, 1), 7)] ?? SPLITS_BY_DAYS[3])]

  if (focusGroups.length > 0) {
    const coversFocus = (key: string) =>
      SPLIT_DAYS[key].groups.some(g => focusGroups.includes(g))

    // Täcks inte en fokusgrupp av splitten? Byt ut sista icke-fokusdagen mot den
    for (const g of focusGroups) {
      if (dayKeys.some(k => SPLIT_DAYS[k].groups.includes(g))) continue
      for (let i = dayKeys.length - 1; i >= 0; i--) {
        if (!coversFocus(dayKeys[i])) { dayKeys[i] = g; break }
      }
    }

    // Fokusdagarna först i veckan
    dayKeys.sort((a, b) => Number(coversFocus(b)) - Number(coversFocus(a)))
  }

  return dayKeys.map(k => SPLIT_DAYS[k])
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
  // Användarens egna valda dagar (1=Mån … 7=Sön), i veckoordning
  const days    = [...(result.weekdays?.length ? result.weekdays : [1, 3, 5])].sort((a, b) => a - b)
  const numDays = days.length

  if (result.goal === 'running') {
    // Passen kommer i prioritetsordning: långpass, intervaller, återhämtning,
    // tempopass och sist det målspecifika passet; extra dagar fylls med
    // fler återhämtningspass
    const base = buildRunSessions(
      result.runDistance ?? '5k',
      result.runExperience ?? 'beginner',
      result.fiveKTimeSec ?? null,
    )
    const picked = base.slice(0, numDays)
    while (picked.length < numDays) {
      const recovery = base.find(x => x.name === 'Återhämtning')!
      picked.push({ ...recovery, name: `Återhämtning ${picked.length}` })
    }
    // Kvalitetspassen tidigt i veckan, återhämtning emellan, långpasset sist
    // (hamnar på helgen när man valt en helgdag)
    const weekRank = (x: PlannedSession) =>
      x.name === 'Intervaller' ? 0 : x.name === 'Tempopass' ? 1 : x.name === 'Långpass' ? 4
        : x.name.startsWith('Återhämtning') ? 3 : 2
    return picked
      .sort((a, b) => weekRank(a) - weekRank(b))
      .map((x, i) => ({ ...x, weekdays: [days[i]] }))
  }

  // Styrka: ihophängande split där varje dag har ett tydligt muskeltema
  const split = buildMuscleSplit(
    numDays,
    result.musclePlan === 'focus' ? result.focusGroups : []
  )

  return split.map((day, i) => ({
    name: day.name,
    weekdays: [days[i]],
    exercises: applyLimitations(day.exercises, result.limitations ?? []),
  }))
}

/** Skapar veckoscheman utifrån wizard-svaren. Returnerar antal skapade pass. */
export async function generateScheduleFromWizard(
  userId: string,
  result: WizardResult
): Promise<number> {
  const plan = buildPlan(result)
  // Alla pass skapas parallellt och oberoende — ett enskilt fel får inte
  // hugga av resten av veckan (då står man med ett halvt schema)
  const results = await Promise.allSettled(plan.map(session =>
    createWorkoutSession(
      userId,
      session.name,
      session.weekdays,
      session.exercises,
      session.notes ?? null,
      session.cardioType ? 'cardio' : 'gym',
      session.cardioType ?? null,
    )
  ))
  const failed = results
    .map((r, i) => r.status === 'rejected' ? `${plan[i].name}: ${(r.reason as Error)?.message ?? 'okänt fel'}` : null)
    .filter((x): x is string => x !== null)
  if (failed.length > 0) {
    throw new Error(`${failed.length} av ${plan.length} pass kunde inte skapas:\n${failed.join('\n')}`)
  }
  // Spara testtiden så den kan uppdateras senare under Anpassning
  if (result.fiveKTimeSec) await setFiveKTime(result.fiveKTimeSec)
  return plan.length
}
