import { epley1RM, getPersonalRecords, findNewPR } from '../personalRecords'
import { getStrengthWorkouts, type StrengthWorkout } from '../strengthWorkouts'

jest.mock('../strengthWorkouts', () => ({ getStrengthWorkouts: jest.fn() }))

const workoutsMock = getStrengthWorkouts as jest.Mock

function pass(
  exercise: string,
  sets: Array<{ reps: number; weight_kg: number }>,
  date?: string,
): StrengthWorkout {
  return {
    id: 'w', name: exercise, created_at: '2026-07-01T10:00:00Z',
    data: { category: 'strength', exercise_id: 'e1', exercise_name: exercise, sets, workout_date: date },
  }
}

beforeEach(() => jest.clearAllMocks())

describe('epley1RM', () => {
  it('viktar upp med reps: 80×8 slår 82,5×1', () => {
    expect(epley1RM(80, 8)).toBeCloseTo(80 * (1 + 8 / 30))
    expect(epley1RM(82.5, 1)).toBeCloseTo(85.25)
    expect(epley1RM(80, 8)).toBeGreaterThan(epley1RM(82.5, 1))
  })

  it('noll eller negativt ger 0', () => {
    expect(epley1RM(0, 5)).toBe(0)
    expect(epley1RM(100, 0)).toBe(0)
    expect(epley1RM(-10, 5)).toBe(0)
  })
})

describe('getPersonalRecords', () => {
  it('spårar tyngsta vikten och bästa 1RM var för sig', async () => {
    workoutsMock.mockResolvedValue([
      pass('Bänkpress', [{ reps: 1, weight_kg: 82.5 }], '2026-06-01'),
      pass('Bänkpress', [{ reps: 8, weight_kg: 80 }], '2026-06-15'),
    ])
    const [rec] = await getPersonalRecords('u1')
    // 82,5 kg är tyngst men 80×8 ger högst 1RM — datumet följer 1RM-setet
    expect(rec.bestWeightKg).toBe(82.5)
    expect(rec.bestWeightReps).toBe(1)
    expect(rec.bestE1rm).toBeCloseTo(epley1RM(80, 8))
    expect(rec.date).toBe('2026-06-15')
  })

  it('sorterar övningarna på bästa 1RM och hoppar över viktlösa set', async () => {
    workoutsMock.mockResolvedValue([
      pass('Bicepscurl', [{ reps: 10, weight_kg: 15 }]),
      pass('Marklyft', [{ reps: 5, weight_kg: 140 }, { reps: 12, weight_kg: 0 }]),
    ])
    const recs = await getPersonalRecords('u1')
    expect(recs.map(r => r.exerciseName)).toEqual(['Marklyft', 'Bicepscurl'])
    expect(workoutsMock).toHaveBeenCalledWith('u1')
  })

  it('utan workout_date faller datumet tillbaka på skapelsedagen', async () => {
    workoutsMock.mockResolvedValue([pass('Knäböj', [{ reps: 5, weight_kg: 100 }])])
    const [rec] = await getPersonalRecords('u1')
    expect(rec.date).toBe('2026-07-01')
  })

  it('inga pass ger tom lista', async () => {
    workoutsMock.mockResolvedValue([])
    expect(await getPersonalRecords('u1')).toEqual([])
  })
})

describe('findNewPR', () => {
  const existing = {
    exerciseName: 'Bänkpress', bestWeightKg: 80, bestWeightReps: 5,
    bestE1rm: epley1RM(80, 5), date: '2026-06-01',
  }

  it('hittar setet som slår rekordet, och väljer det bästa av flera', () => {
    const pr = findNewPR(existing, [
      { reps: 5, weight_kg: 82.5 },
      { reps: 8, weight_kg: 80 },     // högst 1RM av de två
      { reps: 3, weight_kg: 60 },
    ])
    expect(pr).toEqual({ weightKg: 80, reps: 8, e1rm: epley1RM(80, 8) })
  })

  it('ger null när inget set slår rekordet', () => {
    expect(findNewPR(existing, [{ reps: 5, weight_kg: 80 }])).toBeNull()
    expect(findNewPR(existing, [{ reps: 5, weight_kg: 0 }])).toBeNull()
    expect(findNewPR(existing, [])).toBeNull()
  })

  it('utan tidigare rekord räknas första riktiga setet', () => {
    expect(findNewPR(undefined, [{ reps: 5, weight_kg: 40 }])).toEqual({
      weightKg: 40, reps: 5, e1rm: epley1RM(40, 5),
    })
  })
})
