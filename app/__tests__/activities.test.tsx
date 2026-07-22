import { render, screen, fireEvent } from '@testing-library/react-native'
import ActivitiesScreen from '../(app)/activities'
import { getCardioWorkouts } from '@/services/cardioWorkouts'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'u1', email: 'anton@example.com' } } },
      }),
    },
  },
}))
jest.mock('@/services/profile', () => ({
  getProfile: jest.fn().mockResolvedValue({ name: 'Anton Wretenberg', avatar_url: null }),
}))
jest.mock('@/services/cardioWorkouts', () => ({
  getCardioWorkouts: jest.fn().mockResolvedValue([]),
}))
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react')
    useEffect(cb, [cb])
  },
}))
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}))
// Detaljvyn har ett eget testpaket — här räcker det att se att den öppnas
jest.mock('@/components/CardioSummaryView', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return { CardioSummaryView: ({ title }: { title: string }) =>
    React.createElement(Text, null, `summary:${title}`) }
})

const RUN = {
  id: 'w1',
  name: 'Morgonrunda',
  created_at: '2026-07-16T07:30:00.000Z',
  data: { category: 'cardio', type: 'running', distance_km: 5.01, duration_seconds: 2709, calories: 400 },
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getCardioWorkouts as jest.Mock).mockResolvedValue([RUN])
})

describe('Aktiviteter', () => {
  it('listar passen som flödeskort med statistik', async () => {
    render(<ActivitiesScreen />)
    expect(await screen.findByText('Anton Wretenberg')).toBeOnTheScreen()
    expect(screen.getByText(/Löpning — /)).toBeOnTheScreen()
    expect(screen.getByText('5,01')).toBeOnTheScreen()
    expect(screen.getByText('45:09')).toBeOnTheScreen()
    expect(screen.getByText('min/km')).toBeOnTheScreen()
  })

  it('tryck på ett kort öppnar passdetaljvyn', async () => {
    render(<ActivitiesScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByTestId('post-w1'))
    expect(screen.getByText('summary:Morgonrunda')).toBeOnTheScreen()
  })

  it('tom historik visar tomläge', async () => {
    ;(getCardioWorkouts as jest.Mock).mockResolvedValue([])
    render(<ActivitiesScreen />)
    expect(await screen.findByText('Inga aktiviteter ännu')).toBeOnTheScreen()
  })
})
