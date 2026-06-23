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
const BACK_SLUGS = new Set<Slug>(['upper-back', 'lower-back', 'hamstring', 'gluteal', 'trapezius', 'abductors'])

export function bestSideForMuscles(slugs: Slug[]): 'front' | 'back' {
  const backCount = slugs.filter(s => BACK_SLUGS.has(s)).length
  return backCount > slugs.length / 2 ? 'back' : 'front'
}
