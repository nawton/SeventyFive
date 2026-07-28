import {
  getMusclesForName, bestSideForMuscles, getExerciseMuscleGroup,
  SLUG_LABELS, SLUG_TO_GROUP, MUSCLE_GROUPS_6, type Slug,
} from '../muscles'

describe('getMusclesForName', () => {
  it('känner igen svenska och engelska övningsnamn', () => {
    expect(getMusclesForName('Bänkpress')).toEqual(expect.arrayContaining(['chest', 'triceps', 'deltoids']))
    expect(getMusclesForName('Incline bench press')).toContain('chest')
    expect(getMusclesForName('Knäböj')).toEqual(expect.arrayContaining(['quadriceps', 'gluteal', 'hamstring']))
    expect(getMusclesForName('Rumänsk marklyft')).toContain('lower-back')
    expect(getMusclesForName('Hammer curl')).toEqual(expect.arrayContaining(['biceps', 'forearm']))
  })

  it('slår ihop träffar utan dubbletter och ger tomt för okända namn', () => {
    // "Marklyft med rodd" träffar både marklyft- och rodd-raden
    const slugs = getMusclesForName('Marklyft med rodd')
    expect(slugs).toContain('lower-back')
    expect(slugs).toContain('upper-back')
    expect(new Set(slugs).size).toBe(slugs.length)

    expect(getMusclesForName('Yoga nidra')).toEqual([])
  })

  it('är skiftlägesokänslig', () => {
    expect(getMusclesForName('BÄNKPRESS')).toContain('chest')
  })
})

describe('bestSideForMuscles', () => {
  it('väljer baksidan bara när majoriteten av musklerna sitter där', () => {
    expect(bestSideForMuscles(['lower-back', 'hamstring', 'gluteal', 'trapezius'] as Slug[])).toBe('back')
    expect(bestSideForMuscles(['chest', 'triceps', 'deltoids'] as Slug[])).toBe('front')
    // Jämnt: hälften bak räcker inte, framsidan vinner
    expect(bestSideForMuscles(['chest', 'hamstring'] as Slug[])).toBe('front')
    expect(bestSideForMuscles([] as Slug[])).toBe('front')
  })
})

describe('getExerciseMuscleGroup', () => {
  it('mappar övningar till väljargruppen', () => {
    expect(getExerciseMuscleGroup('Bänkpress')).toBe('chest')
    expect(getExerciseMuscleGroup('Knäböj')).toBe('legs')
    expect(getExerciseMuscleGroup('Bicepscurl')).toBe('arms')
    expect(getExerciseMuscleGroup('Plankan')).toBe('core')
    expect(getExerciseMuscleGroup('Burpees')).toBe('all')   // okänd → all
  })

  it('kabelövningarna och de tidigare osynliga namnen hamnar i rätt grupp', () => {
    expect(getExerciseMuscleGroup('Kabelpress')).toBe('chest')
    expect(getExerciseMuscleGroup('Lutande hantelpress')).toBe('chest')
    expect(getExerciseMuscleGroup('Hantelpress liggande')).toBe('chest')
    expect(getExerciseMuscleGroup('Push-ups')).toBe('chest')
    expect(getExerciseMuscleGroup('Genomdrag med kabel')).toBe('legs')
    expect(getExerciseMuscleGroup('Glute kickback i kabel')).toBe('legs')
    expect(getExerciseMuscleGroup('Kettlebell swing')).toBe('legs')
    expect(getExerciseMuscleGroup('Thrusters')).toBe('legs')
    expect(getExerciseMuscleGroup('Frontlyft i kabel')).toBe('shoulders')
    expect(getExerciseMuscleGroup('Bakre deltalyft i kabel')).toBe('shoulders')
    expect(getExerciseMuscleGroup('Omvänd flyes')).toBe('shoulders')
    expect(getExerciseMuscleGroup('Landmine press')).toBe('shoulders')
    expect(getExerciseMuscleGroup('Push press')).toBe('shoulders')
    expect(getExerciseMuscleGroup('Skull crushers')).toBe('arms')
    expect(getExerciseMuscleGroup('Handledscurl')).toBe('arms')
    expect(getExerciseMuscleGroup('Hyperextensions')).toBe('back')
    expect(getExerciseMuscleGroup('Shrugs med hantlar')).toBe('back')
    expect(getExerciseMuscleGroup('Kabelvridning')).toBe('core')
    expect(getExerciseMuscleGroup('Russian twist')).toBe('core')
    expect(getExerciseMuscleGroup('Pallof press')).toBe('core')
    expect(getExerciseMuscleGroup('Hängande benlyft')).toBe('core')

    // Viktiga gamla mappningar rubbas inte av de nya nyckelorden
    expect(getExerciseMuscleGroup('Hantelpress axlar')).toBe('shoulders')
    expect(getExerciseMuscleGroup('Bencurl liggande')).toBe('legs')
    expect(getExerciseMuscleGroup('Triceps kickback')).toBe('arms')
  })
})

describe('datakonsistens', () => {
  it('alla slugs i grupperna och mappningen har svenska etiketter', () => {
    for (const slug of Object.keys(SLUG_TO_GROUP)) {
      expect(SLUG_LABELS[slug as Slug]).toBeTruthy()
    }
    for (const group of MUSCLE_GROUPS_6) {
      for (const slug of group.slugs) {
        expect(SLUG_LABELS[slug]).toBeTruthy()
      }
    }
  })

  it('sexgruppsindelningen täcker sex olika grupper utan överlapp', () => {
    const all = MUSCLE_GROUPS_6.flatMap(g => g.slugs)
    expect(new Set(all).size).toBe(all.length)
    expect(MUSCLE_GROUPS_6.map(g => g.label)).toEqual(['Bröst', 'Rygg', 'Ben', 'Axlar', 'Armar', 'Mage'])
  })
})
