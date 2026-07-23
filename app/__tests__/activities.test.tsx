import { render, screen, fireEvent } from '@testing-library/react-native'
import ActivitiesScreen from '../(app)/activities'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'u1', email: 'erik@example.com' } } },
      }),
    },
  },
}))
jest.mock('@/services/profile', () => ({
  getProfile: jest.fn().mockResolvedValue({ name: 'Erik Larsson', avatar_url: null }),
}))
jest.mock('@/services/feed', () => ({
  fetchUserWorkouts: jest.fn().mockResolvedValue({ cardio: [], strength: [] }),
}))
jest.mock('@/components/stats/GymSummaryView', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return { GymSummaryView: ({ name }: { name: string }) =>
    React.createElement(Text, null, `gym:${name}`) }
})
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react')
    useEffect(cb, [cb])
  },
  useLocalSearchParams: () => mockParams,
}))
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}))
// Detaljvyn har ett eget testpaket — här räcker det att se att den öppnas
// och om betyget är skrivskyddat
jest.mock('@/components/CardioSummaryView', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return { CardioSummaryView: ({ title, effortReadOnly }: { title: string; effortReadOnly?: boolean }) =>
    React.createElement(Text, null, `summary:${title}${effortReadOnly ? ':readonly' : ''}`) }
})

const RUN = {
  id: 'w1',
  name: 'Morgonrunda',
  created_at: '2026-07-16T07:30:00.000Z',
  data: { category: 'cardio', type: 'running', distance_km: 5.01, duration_seconds: 2709, calories: 400 },
}

const { fetchUserWorkouts } = require('@/services/feed')

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {}
  ;(fetchUserWorkouts as jest.Mock).mockResolvedValue({
    cardio: [{ userId: 'u1', workout: RUN }],
    strength: [],
  })
})

describe('Aktiviteter', () => {
  it('listar passen som flödeskort med statistik', async () => {
    render(<ActivitiesScreen />)
    expect(await screen.findByText('Erik Larsson')).toBeOnTheScreen()
    expect(screen.getByText(/Löpning, /)).toBeOnTheScreen()
    expect(screen.getByText('5,01')).toBeOnTheScreen()
    expect(screen.getByText('45:09')).toBeOnTheScreen()
    expect(screen.getByText('min/km')).toBeOnTheScreen()
  })

  it('tryck på ett kort öppnar passdetaljvyn', async () => {
    render(<ActivitiesScreen />)
    await screen.findByText('Erik Larsson')
    fireEvent.press(screen.getByTestId('post-w1'))
    expect(screen.getByText('summary:Morgonrunda')).toBeOnTheScreen()
  })

  it('filtret växlar mellan alla, cardio och gym', async () => {
    ;(fetchUserWorkouts as jest.Mock).mockResolvedValue({
      cardio: [{ userId: 'u1', workout: RUN }],
      strength: [{
        userId: 'u1',
        workout: {
          id: 's1', name: 'Bänkpress', created_at: '2026-07-15T17:00:00.000Z',
          data: {
            category: 'strength', exercise_id: 'e1', exercise_name: 'Bänkpress',
            sets: [{ reps: 8, weight_kg: 60 }], workout_date: '2026-07-15',
          },
        },
      }],
    })
    render(<ActivitiesScreen />)
    await screen.findAllByText('Erik Larsson')     // löprunda + gympass
    expect(screen.getByText('5,01')).toBeOnTheScreen()
    expect(screen.getByText(/Gympass, /)).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Gym'))
    expect(screen.queryByText('5,01')).not.toBeOnTheScreen()
    expect(screen.getByText(/Gympass, /)).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Cardio'))
    expect(screen.getByText('5,01')).toBeOnTheScreen()
    expect(screen.queryByText(/Gympass, /)).not.toBeOnTheScreen()
  })

  it('annans pass: betyget är skrivskyddat i detaljvyn', async () => {
    mockParams = { userId: 'u9', name: 'Kalle', avatar: '' }
    render(<ActivitiesScreen />)
    await screen.findByText('Kalle')
    fireEvent.press(screen.getByTestId('post-w1'))
    expect(screen.getByText('summary:Morgonrunda:readonly')).toBeOnTheScreen()
  })

  it('tom historik visar tomläge', async () => {
    ;(fetchUserWorkouts as jest.Mock).mockResolvedValue({ cardio: [], strength: [] })
    render(<ActivitiesScreen />)
    expect(await screen.findByText('Inga aktiviteter ännu')).toBeOnTheScreen()
  })
})
