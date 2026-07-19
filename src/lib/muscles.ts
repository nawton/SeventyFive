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

const MUSCLE_KEYWORDS: Array<{ words: string[]; slugs: Slug[] }> = [
  { words: ['bänk', 'bench', 'bröst', 'chest', 'butterfly'], slugs: ['chest', 'triceps', 'deltoids'] },
  { words: ['knäböj', 'squat', 'benpress', 'utfall', 'lunge', 'leg press'], slugs: ['quadriceps', 'gluteal', 'hamstring'] },
  { words: ['marklyft', 'deadlift', 'rumänsk', 'romanian'], slugs: ['lower-back', 'hamstring', 'gluteal', 'trapezius'] },
  { words: ['axelpress', 'shoulder', 'militär', 'overhead', 'arnold'], slugs: ['deltoids', 'triceps'] },
  { words: ['bicep', 'curl', 'hammer'], slugs: ['biceps', 'forearm'] },
  { words: ['tricep', 'dip'], slugs: ['triceps'] },
  { words: ['rygg', 'pull', 'rodd', 'row', 'chin', 'lat'], slugs: ['upper-back', 'biceps', 'trapezius'] },
  { words: ['mage', 'ab', 'plankan', 'plank', 'situp', 'crunch', 'core'], slugs: ['abs', 'obliques'] },
  { words: ['vader', 'calf', 'calves'], slugs: ['calves'] },
  { words: ['shrug', 'axellyftar', 'trapezius'], slugs: ['trapezius'] },
  { words: ['adductor', 'höftadd'], slugs: ['adductors'] },
]

export function getMusclesForName(name: string): Slug[] {
  const lower = name.toLowerCase()
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
