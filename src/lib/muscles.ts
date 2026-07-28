import type { Slug } from 'react-native-body-highlighter'

export type { Slug }

export const SLUG_LABELS: Record<Slug, string> = {
  abs:         'Mage',
  adductors:   'Adduktorer',
  ankles:      'Anklar',
  biceps:      'Biceps',
  calves:      'Vader',
  chest:       'Bröst',
  deltoids:    'Deltoideus',
  feet:        'Fötter',
  forearm:     'Underarm',
  gluteal:     'Säte',
  hamstring:   'Hamstring',
  hands:       'Händer',
  hair:        'Hår',
  head:        'Huvud',
  knees:       'Knän',
  'lower-back':'Nedre rygg',
  neck:        'Nacke',
  obliques:    'Snedmage',
  quadriceps:  'Quadriceps',
  tibialis:    'Tibialis',
  trapezius:   'Trapezius',
  triceps:     'Triceps',
  'upper-back':'Övre rygg',
}

// Ordningen spelar roll: gruppen (Bröst/Rygg/…) avgörs av FÖRSTA träffens
// första slug, så specifika poster (bakre delta, bencurl) står före de
// breda ('curl' vinner annars över 'bencurl' och benmaskiner blir armar)
const MUSCLE_KEYWORDS: Array<{ words: string[]; slugs: Slug[] }> = [
  { words: ['bakre delta', 'rear delt', 'reverse fly', 'omvänd', 'face pull'], slugs: ['deltoids', 'upper-back'] },
  { words: ['bänk', 'bench', 'bröst', 'chest', 'butterfly', 'korsning', 'crossover', 'flyes', 'pec'], slugs: ['chest', 'triceps', 'deltoids'] },
  { words: ['bencurl', 'leg curl', 'hamstring', 'nordic'], slugs: ['hamstring'] },
  { words: ['benextension', 'leg extension'], slugs: ['quadriceps'] },
  { words: ['knäböj', 'squat', 'benpress', 'utfall', 'lunge', 'leg press', 'steg-ups', 'step-up', 'hip thrust', 'höftlyft'], slugs: ['quadriceps', 'gluteal', 'hamstring'] },
  { words: ['marklyft', 'deadlift', 'rumänsk', 'romanian'], slugs: ['lower-back', 'hamstring', 'gluteal', 'trapezius'] },
  { words: ['frivändning', 'clean'], slugs: ['quadriceps', 'hamstring', 'gluteal', 'trapezius'] },
  { words: ['axelpress', 'shoulder', 'militär', 'overhead', 'arnold'], slugs: ['deltoids', 'triceps'] },
  { words: ['sidolyft', 'frontlyft', 'delta', 'axellyft', 'axlar', 'lateral', 'upright'], slugs: ['deltoids'] },
  { words: ['bicep', 'curl', 'hammer'], slugs: ['biceps', 'forearm'] },
  { words: ['tricep', 'dip', 'pushdown'], slugs: ['triceps'] },
  { words: ['rygg', 'pull', 'rodd', 'row', 'chin', 'lats', 'pulldown'], slugs: ['upper-back', 'biceps', 'trapezius'] },
  { words: ['mage', 'abs', 'ab wheel', 'plankan', 'plank', 'situp', 'crunch', 'core'], slugs: ['abs', 'obliques'] },
  { words: ['vader', 'vadpress', 'calf', 'calves'], slugs: ['calves'] },
  { words: ['shrug', 'axellyftar', 'trapezius'], slugs: ['trapezius'] },
  { words: ['adductor', 'höftadd'], slugs: ['adductors'] },
]

// Egna övningar: muskler väljs explicit vid skapandet istället för
// nyckelordsmatchning. Registret fylls när övningarna hämtas och
// konsulteras FÖRE nyckelorden, så muskelkartan funkar för egna namn.
const CUSTOM_EXERCISE_MUSCLES = new Map<string, Slug[]>()

export function registerExerciseMuscles(name: string, slugs: Slug[]): void {
  if (slugs.length > 0) CUSTOM_EXERCISE_MUSCLES.set(name.trim().toLowerCase(), slugs)
}

export function getMusclesForName(name: string): Slug[] {
  const lower = name.toLowerCase()
  // Egna övningar har explicit valda muskler — de vinner över nyckelorden
  const custom = CUSTOM_EXERCISE_MUSCLES.get(lower.trim())
  if (custom) return [...custom]
  const result = new Set<Slug>()
  for (const entry of MUSCLE_KEYWORDS) {
    if (entry.words.some(w => lower.includes(w))) {
      entry.slugs.forEach(s => result.add(s))
    }
  }
  return Array.from(result)
}

// Which slugs live on the front vs back of the body
const BACK_SLUGS = new Set<Slug>(['upper-back', 'lower-back', 'hamstring', 'gluteal', 'trapezius', 'adductors'])

export function bestSideForMuscles(slugs: Slug[]): 'front' | 'back' {
  const backCount = slugs.filter(s => BACK_SLUGS.has(s)).length
  return backCount > slugs.length / 2 ? 'back' : 'front'
}

// ─── Muscle group mapping (used by exercise picker and activity screen) ────────

export type MuscleGroup = 'all' | 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core'

export const SLUG_TO_GROUP: Record<string, MuscleGroup> = {
  chest:         'chest',
  'upper-back':  'back',
  'lower-back':  'back',
  trapezius:     'back',
  quadriceps:    'legs',
  hamstring:     'legs',
  gluteal:       'legs',
  calves:        'legs',
  adductors:     'legs',
  deltoids:      'shoulders',
  biceps:        'arms',
  triceps:       'arms',
  forearm:       'arms',
  abs:           'core',
  obliques:      'core',
}

export function getExerciseMuscleGroup(name: string): MuscleGroup {
  for (const slug of getMusclesForName(name)) {
    const g = SLUG_TO_GROUP[slug]
    if (g) return g
  }
  return 'all'
}

/** De sex huvudgrupperna som muskelstatistiken (radar, tabeller, rutnät) räknar på */
export const MUSCLE_GROUPS_6: Array<{ label: string; slugs: Slug[] }> = [
  { label: 'Bröst', slugs: ['chest'] as Slug[] },
  { label: 'Rygg',  slugs: ['upper-back', 'lower-back', 'trapezius'] as Slug[] },
  { label: 'Ben',   slugs: ['quadriceps', 'hamstring', 'gluteal', 'calves'] as Slug[] },
  { label: 'Axlar', slugs: ['deltoids'] as Slug[] },
  { label: 'Armar', slugs: ['biceps', 'triceps'] as Slug[] },
  { label: 'Mage',  slugs: ['abs', 'obliques'] as Slug[] },
]
