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
jest.mock('@/services/strengthWorkouts', () => ({
  getStrengthWorkouts: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/components/stats/GymSummaryView', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return { GymSummaryView: ({ name }: { name: string }) =>
    React.createElement(Text, null, `gym:${name}`) }
})
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

const { getStrengthWorkouts } = require('@/services/strengthWorkouts')

beforeEach(() => {
  jest.clearAllMocks()
  ;(getCardioWorkouts as jest.Mock).mockResolvedValue([RUN])
  ;(getStrengthWorkouts as jest.Mock).mockResolvedValue([])
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

  it('filtret växlar mellan alla, cardio och gym', async () => {
    ;(getStrengthWorkouts as jest.Mock).mockResolvedValue([{
      id: 's1', name: 'Bänkpress', created_at: '2026-07-15T17:00:00.000Z',
      data: {
        category: 'strength', exercise_id: 'e1', exercise_name: 'Bänkpress',
        sets: [{ reps: 8, weight_kg: 60 }], workout_date: '2026-07-15',
      },
    }])
    render(<ActivitiesScreen />)
    await screen.findAllByText('Anton Wretenberg')     // löprunda + gympass
    expect(screen.getByText('5,01')).toBeOnTheScreen()
    expect(screen.getByText(/Gympass — /)).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Gym'))
    expect(screen.queryByText('5,01')).not.toBeOnTheScreen()
    expect(screen.getByText(/Gympass — /)).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Cardio'))
    expect(screen.getByText('5,01')).toBeOnTheScreen()
    expect(screen.queryByText(/Gympass — /)).not.toBeOnTheScreen()
  })

  it('tom historik visar tomläge', async () => {
    ;(getCardioWorkouts as jest.Mock).mockResolvedValue([])
    render(<ActivitiesScreen />)
    expect(await screen.findByText('Inga aktiviteter ännu')).toBeOnTheScreen()
  })
})
