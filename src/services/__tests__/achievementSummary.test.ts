import { getAchievementSummary } from '../achievementSummary'
import { computeAchievements } from '@/lib/achievements'
import { getCardioWorkouts, getStrengthWorkouts } from '@/services/workouts'
import { getCompletedSessionsHistory } from '@/services/workoutSchedule'
import { getPersonalRecords } from '@/services/personalRecords'
import { countCompletedDaysAllTime, getBestStreakAllTime } from '@/services/dailyLog'

jest.mock('@/services/workouts', () => ({
  getCardioWorkouts: jest.fn(),
  getStrengthWorkouts: jest.fn(),
}))
jest.mock('@/services/workoutSchedule', () => ({ getCompletedSessionsHistory: jest.fn() }))
jest.mock('@/services/personalRecords', () => ({ getPersonalRecords: jest.fn() }))
jest.mock('@/services/dailyLog', () => ({ countCompletedDaysAllTime: jest.fn(), getBestStreakAllTime: jest.fn() }))

const cardioMock = getCardioWorkouts as jest.Mock
const strengthMock = getStrengthWorkouts as jest.Mock
const historyMock = getCompletedSessionsHistory as jest.Mock
const prsMock = getPersonalRecords as jest.Mock
const daysMock = countCompletedDaysAllTime as jest.Mock
const streakMock = getBestStreakAllTime as jest.Mock

function run(km: number, sec: number, created: string, splits?: Array<{ label: string; paceSec: number }>) {
  return {
    id: 'w', name: 'Löpning', created_at: created,
    data: { category: 'cardio', type: 'run', distance_km: km, duration_seconds: sec, calories: 0, splits },
  }
}

function setup(overrides: Partial<Record<'cardio' | 'strength' | 'history' | 'prs', unknown[]>> = {}) {
  cardioMock.mockResolvedValue(overrides.cardio ?? [])
  strengthMock.mockResolvedValue(overrides.strength ?? [])
  historyMock.mockResolvedValue(overrides.history ?? [])
  prsMock.mockResolvedValue(overrides.prs ?? [])
  daysMock.mockResolvedValue(10)
  streakMock.mockResolvedValue(3)
}

beforeEach(() => jest.clearAllMocks())

describe('getAchievementSummary', () => {
  it('aggregerar passen till samma medaljunderlag som rekordsidan', async () => {
    setup({
      cardio: [
        // Mån + ons samma vecka: 15 km ihop — veckans största
        run(10, 3000, '2026-07-20T09:00:00', [
          { label: '1 km', paceSec: 290 },
          { label: 'Intervall 2', paceSec: 100 },   // räknas inte som split-rekord
        ]),
        run(5, 1500, '2026-07-22T18:00:00'),
        run(12, 4800, '2026-07-01T09:00:00'),       // annan vecka, längsta rundan
      ],
      strength: [{}, {}],
      history: [{}],
      prs: [{}, {}],
    })

    const summary = await getAchievementSummary('u1')

    const expectedInput = {
      completedDays: 10, streak: 3,
      totalWorkouts: 6, totalCardio: 3, totalKm: 27,
      prCount: 2, longestRunKm: 12, bestPace3kSec: 300, biggestWeekKm: 15,
    }
    const expected = computeAchievements(expectedInput)
    expect(summary.medalsTotal).toBe(expected.length)
    expect(summary.medalsUnlocked).toBe(expected.filter(m => m.unlocked).length)
    expect(summary.medalsUnlocked).toBeGreaterThan(0)

    // 2 styrkerekord + längsta rundan, bästa tempot, snabbaste splitten, största veckan
    expect(summary.recordCount).toBe(2 + 4)
    // All-time på ANVÄNDAREN — statistiken överlever en failad utmaning
    expect(daysMock).toHaveBeenCalledWith('u1')
    expect(streakMock).toHaveBeenCalledWith('u1')
  })

  it('bara riktiga km- och mi-splittar räknas som splitrekord', async () => {
    setup({ cardio: [run(0, 0, '2026-07-20T09:00:00', [{ label: 'Intervall 1', paceSec: 100 }])] })
    expect((await getAchievementSummary('u1')).recordCount).toBe(0)

    setup({ cardio: [run(0, 0, '2026-07-20T09:00:00', [{ label: '1 km', paceSec: 290 }])] })
    expect((await getAchievementSummary('u1')).recordCount).toBe(1)
  })

  it('räknar all-time även utan aktiv utmaning: en omstart backar aldrig medaljerna', async () => {
    setup()
    daysMock.mockResolvedValue(25)   // klarade dagar från TIDIGARE (failade) utmaningar
    streakMock.mockResolvedValue(7)
    const summary = await getAchievementSummary('u1')
    // day1+day10+day25 och streak3+streak7 hålls upplåsta av historiken
    const expected = computeAchievements({
      completedDays: 25, streak: 7, totalWorkouts: 0, totalCardio: 0, totalKm: 0,
      prCount: 0, longestRunKm: 0, bestPace3kSec: Infinity, biggestWeekKm: 0,
    }).filter(m => m.unlocked).length
    expect(summary.medalsUnlocked).toBe(expected)
    expect(summary.medalsUnlocked).toBeGreaterThanOrEqual(5)
  })

  it('tål att varje delkälla felar: allt landar på noll istället för att krascha', async () => {
    cardioMock.mockRejectedValue(new Error('nät'))
    strengthMock.mockRejectedValue(new Error('nät'))
    historyMock.mockRejectedValue(new Error('nät'))
    prsMock.mockRejectedValue(new Error('nät'))
    daysMock.mockRejectedValue(new Error('nät'))
    streakMock.mockRejectedValue(new Error('nät'))

    expect(await getAchievementSummary('u1')).toEqual({
      medalsUnlocked: 0, medalsTotal: 26, recordCount: 0,
    })
  })
})
