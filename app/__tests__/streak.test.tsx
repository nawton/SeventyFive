import { render, screen } from '@testing-library/react-native'
import StreakScreen, { visibleMilestones } from '../(app)/streak'
import { toLocalDateString, startOfWeek } from '@/lib/date'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'u1', email: 'erik@example.com' } } },
      }),
    },
  },
}))
jest.mock('@/services/challenge', () => ({
  getActiveChallenge: jest.fn().mockResolvedValue({ id: 'c1' }),
}))
jest.mock('@/services/dailyLog', () => ({
  getStreak: jest.fn().mockResolvedValue(10),
  getWeekStatuses: jest.fn().mockResolvedValue({}),
}))
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react')
    useEffect(cb, [cb])
  },
}))
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }))

const { getStreak, getWeekStatuses } = require('@/services/dailyLog')

beforeEach(() => {
  jest.clearAllMocks()
  ;(getStreak as jest.Mock).mockResolvedValue(10)
  ;(getWeekStatuses as jest.Mock).mockResolvedValue({})
})

describe('Streak', () => {
  it('visar streaken, veckoraden och nästa milstolpe', async () => {
    const monday = toLocalDateString(startOfWeek())
    ;(getWeekStatuses as jest.Mock).mockResolvedValue({ [monday]: 'completed' })
    render(<StreakScreen />)
    expect(await screen.findByText('10')).toBeOnTheScreen()
    expect(screen.getByText('dagars streak')).toBeOnTheScreen()
    expect(screen.getByText('NÄSTA MILSTOLPE: 14 DAGAR')).toBeOnTheScreen()
    expect(screen.getByText('7 dagar')).toBeOnTheScreen()     // klarad — visas överstruken
    expect(screen.getByText('14 dagar')).toBeOnTheScreen()
    expect(screen.getByText('icon:checkmark')).toBeOnTheScreen()  // måndagens bock
  })

  it('visibleMilestones: fönstret följer streaken', () => {
    expect(visibleMilestones(0)).toEqual([7, 14, 21, 28])
    expect(visibleMilestones(10)).toEqual([7, 14, 21, 28])
    expect(visibleMilestones(25)).toEqual([21, 28, 50, 75])
    expect(visibleMilestones(80)).toEqual([14, 21, 28, 50, 75].slice(1))
  })
})
