import { render, screen, fireEvent } from '@testing-library/react-native'
import CommunityScreen, { relativeDayLabel, dayPartTitle } from '../(app)/community'
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
  getProfile: jest.fn().mockResolvedValue({ name: 'Anton Wretenberg', avatar_url: '💪' }),
}))
jest.mock('@/services/cardioWorkouts', () => ({
  getCardioWorkouts: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/services/strengthWorkouts', () => ({
  getStrengthWorkouts: jest.fn().mockResolvedValue([]),
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
// Detaljvyerna har egna testpaket — här räcker det att se att de öppnas
jest.mock('@/components/CardioSummaryView', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return { CardioSummaryView: ({ title }: { title: string }) =>
    React.createElement(Text, null, `summary:${title}`) }
})
jest.mock('@/components/stats/GymSummaryView', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return { GymSummaryView: ({ name }: { name: string }) =>
    React.createElement(Text, null, `gym:${name}`) }
})

const RUN = {
  id: 'w1',
  name: 'Löpning',
  created_at: '2026-07-16T07:30:00.000Z',
  data: {
    category: 'cardio', type: 'running',
    distance_km: 5.01, duration_seconds: 2709, calories: 400,
    route: [[58.55, 13.92], [58.56, 13.93]] as Array<[number, number]>,
  },
}

const GYM_DAY = [
  {
    id: 's1', name: 'Bänkpress', created_at: '2026-07-15T17:00:00.000Z',
    data: {
      category: 'strength', exercise_id: 'e1', exercise_name: 'Bänkpress',
      sets: [{ reps: 8, weight_kg: 60 }, { reps: 8, weight_kg: 60 }],
      workout_date: '2026-07-15',
    },
  },
  {
    id: 's2', name: 'Marklyft', created_at: '2026-07-15T17:20:00.000Z',
    data: {
      category: 'strength', exercise_id: 'e2', exercise_name: 'Marklyft',
      sets: [{ reps: 5, weight_kg: 100 }],
      workout_date: '2026-07-15',
    },
  },
]

const { getStrengthWorkouts } = require('@/services/strengthWorkouts')

beforeEach(() => {
  jest.clearAllMocks()
  ;(getCardioWorkouts as jest.Mock).mockResolvedValue([RUN])
  ;(getStrengthWorkouts as jest.Mock).mockResolvedValue([])
})

describe('Community', () => {
  it('visar flödeskort med namn, typ, statistik och gilla-knapp', async () => {
    render(<CommunityScreen />)
    expect(await screen.findByText('Anton Wretenberg')).toBeOnTheScreen()
    expect(screen.getByText(/Löpning — /)).toBeOnTheScreen()
    expect(screen.getByText('5,01')).toBeOnTheScreen()
    expect(screen.getByText('45:09')).toBeOnTheScreen()   // fmtTime(2709)
    expect(screen.getByText('km')).toBeOnTheScreen()
    expect(screen.getByText('min/km')).toBeOnTheScreen()
    // Gilla växlar hjärtat lokalt
    fireEvent.press(screen.getByTestId('like-w1'))
    expect(screen.getByText('icon:heart')).toBeOnTheScreen()
  })

  it('gympass visas i flödet: dagens övningar grupperade till ett kort', async () => {
    ;(getStrengthWorkouts as jest.Mock).mockResolvedValue(GYM_DAY)
    render(<CommunityScreen />)
    await screen.findAllByText('Anton Wretenberg')   // löprundan + gympasset
    expect(screen.getByText(/Gympass — /)).toBeOnTheScreen()
    expect(screen.getByText('övningar')).toBeOnTheScreen()
    expect(screen.getByText('3')).toBeOnTheScreen()            // 2 + 1 set
    expect(screen.getByText((2 * 8 * 60 + 5 * 100).toLocaleString('sv-SE'))).toBeOnTheScreen()
    fireEvent.press(screen.getByTestId('post-gym-2026-07-15'))
    expect(screen.getByText('gym:Gympass')).toBeOnTheScreen()
  })

  it('filterchipsen växlar flödet mellan alla, cardio och gym', async () => {
    ;(getStrengthWorkouts as jest.Mock).mockResolvedValue(GYM_DAY)
    render(<CommunityScreen />)
    await screen.findAllByText('Anton Wretenberg')
    fireEvent.press(screen.getByText('Gym'))
    expect(screen.queryByText('5,01')).not.toBeOnTheScreen()
    expect(screen.getByText(/Gympass — /)).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Cardio'))
    expect(screen.getByText('5,01')).toBeOnTheScreen()
    expect(screen.queryByText(/Gympass — /)).not.toBeOnTheScreen()
    fireEvent.press(screen.getByText('Alla'))
    expect(screen.getByText('5,01')).toBeOnTheScreen()
    expect(screen.getByText(/Gympass — /)).toBeOnTheScreen()
  })

  it('tryck på kortet öppnar samma passdetaljvy som statistiken', async () => {
    render(<CommunityScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByTestId('post-w1'))
    expect(screen.getByText('summary:Löpning')).toBeOnTheScreen()
  })

  it('egna avataren leder till egna profilen — med rensade params', async () => {
    const { router } = require('expo-router')
    render(<CommunityScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByTestId('avatar-w1'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(app)/athlete',
      params: { userId: '', name: '', avatar: '' },
    })
  })

  it('följer-knappen leder till Följer-sidan', async () => {
    const { router } = require('expo-router')
    render(<CommunityScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByText('glassbtn:people-outline'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(app)/following',
      params: { tab: 'following' },
    })
  })

  it('Grupper-segmentet visar platshållare', async () => {
    render(<CommunityScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByText('Grupper'))
    expect(screen.getByText('Grupper kommer snart')).toBeOnTheScreen()
  })

  it('tomt flöde visar tom-läge när laddningen är klar', async () => {
    ;(getCardioWorkouts as jest.Mock).mockResolvedValue([])
    render(<CommunityScreen />)
    expect(await screen.findByText('Inget i flödet ännu')).toBeOnTheScreen()
  })

  it('relativeDayLabel: idag, igår och X dagar sedan', () => {
    const now = new Date('2026-07-22T10:00:00')
    expect(relativeDayLabel('2026-07-22T02:00:00', now)).toBe('idag')
    expect(relativeDayLabel('2026-07-21T23:00:00', now)).toBe('igår')
    expect(relativeDayLabel('2026-07-17T09:00:00', now)).toBe('5 dagar sedan')
  })

  it('dayPartTitle: veckodag + del av dygnet', () => {
    expect(dayPartTitle('2026-07-16T07:30:00')).toBe('Torsdag morgon')
    expect(dayPartTitle('2026-07-15T19:00:00')).toBe('Onsdag kväll')
  })
})
