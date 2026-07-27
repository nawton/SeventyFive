import { scaledReps, PROGRESSION_EVERY, PROGRESSION_MAX } from '../progression'

describe('scaledReps', () => {
  it('+1 rep var tredje genomförande, med tak på +4', () => {
    expect(scaledReps('8', 0)).toEqual({ reps: '8', progressed: false })
    expect(scaledReps('8', 2)).toEqual({ reps: '8', progressed: false })
    expect(scaledReps('8', 3)).toEqual({ reps: '9', progressed: true })
    expect(scaledReps('8', 6)).toEqual({ reps: '10', progressed: true })
    expect(scaledReps('8', 11)).toEqual({ reps: '11', progressed: true })
    // 30 genomföranden vore +10 utan tak — max +4 gäller
    expect(scaledReps('8', 30)).toEqual({ reps: '12', progressed: true })
  })

  it('rör bara rena numeriska reps', () => {
    expect(scaledReps('60 sek', 9)).toEqual({ reps: '60 sek', progressed: false })
    expect(scaledReps('max', 9)).toEqual({ reps: 'max', progressed: false })
    expect(scaledReps('6×400 m', 9)).toEqual({ reps: '6×400 m', progressed: false })
    expect(scaledReps('8-12', 9)).toEqual({ reps: '8-12', progressed: false })
    expect(scaledReps(null, 9)).toEqual({ reps: null, progressed: false })
    // "08" parsas till 8 men är inte identiskt med basen → lämnas
    expect(scaledReps('08', 9)).toEqual({ reps: '08', progressed: false })
  })

  it('konstanterna beskriver skalningen', () => {
    expect(PROGRESSION_EVERY).toBe(3)
    expect(PROGRESSION_MAX).toBe(4)
  })
})
