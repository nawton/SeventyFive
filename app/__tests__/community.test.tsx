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
  name: 'Löpning',
  created_at: '2026-07-16T07:30:00.000Z',
  data: {
    category: 'cardio', type: 'running',
    distance_km: 5.01, duration_seconds: 2709, calories: 400,
    route: [[58.55, 13.92], [58.56, 13.93]] as Array<[number, number]>,
  },
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getCardioWorkouts as jest.Mock).mockResolvedValue([RUN])
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

  it('tryck på kortet öppnar samma passdetaljvy som statistiken', async () => {
    render(<CommunityScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByTestId('post-w1'))
    expect(screen.getByText('summary:Löpning')).toBeOnTheScreen()
  })

  it('avataren på kortet leder till atletprofilen', async () => {
    const { router } = require('expo-router')
    render(<CommunityScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByTestId('avatar-w1'))
    expect(router.push).toHaveBeenCalledWith('/(app)/athlete')
  })

  it('följer-knappen leder till Följer-sidan', async () => {
    const { router } = require('expo-router')
    render(<CommunityScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByText('glassbtn:people-outline'))
    expect(router.push).toHaveBeenCalledWith('/(app)/following')
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
