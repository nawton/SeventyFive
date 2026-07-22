import { render, screen, fireEvent } from '@testing-library/react-native'
import AthleteScreen, { activeLabel, buildWeekBuckets } from '../(app)/athlete'
import type { CardioWorkout } from '@/services/cardioWorkouts'

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
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react')
    useEffect(cb, [cb])
  },
  useLocalSearchParams: () => mockParams,
}))
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }))
// Grafen har egen logik — mocken exponerar bara första punkten som knapp
jest.mock('@/components/stats/DistanceAreaChart', () => {
  const React = require('react')
  const { Text, Pressable } = require('react-native')
  return { DistanceAreaChart: ({ buckets, onSelect }: {
    buckets: Array<{ key: string; total: number }>
    onSelect?: (key: string) => void
  }) =>
    React.createElement(React.Fragment, null,
      React.createElement(Text, null, `chart:${buckets.length}`),
      React.createElement(Pressable, {
        testID: 'chartFirstPoint',
        onPress: () => onSelect?.(buckets[0].key),
      })) }
})

const { getCardioWorkouts } = require('@/services/cardioWorkouts')

function makeRun(iso: string, km: number, type = 'running'): CardioWorkout {
  return {
    id: `w-${iso}-${km}`,
    name: 'Löpning',
    created_at: iso,
    data: { category: 'cardio', type, distance_km: km, duration_seconds: 1800, calories: 300 },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {}
  ;(getCardioWorkouts as jest.Mock).mockResolvedValue([
    makeRun(new Date().toISOString(), 5.5),
    makeRun('2026-07-10T08:00:00.000Z', 10, 'cycling'),
  ])
})

describe('Atletprofil', () => {
  it('visar namn, totalsiffra, räknare och veckostatistik', async () => {
    render(<AthleteScreen />)
    expect(await screen.findByText('Anton Wretenberg')).toBeOnTheScreen()
    expect(screen.getByText('16')).toBeOnTheScreen()        // 5,5 + 10 avrundat
    expect(screen.getByText('Totalt km')).toBeOnTheScreen()
    expect(screen.getByText('Följare')).toBeOnTheScreen()
    expect(screen.getByText('Den här veckan')).toBeOnTheScreen()
    expect(screen.getByText('5,50 km')).toBeOnTheScreen()   // veckans löpning
    expect(screen.getByText('chart:12')).toBeOnTheScreen()
  })

  it('vald punkt i grafen styr veckosektionen — rubrik och statistik', async () => {
    render(<AthleteScreen />)
    await screen.findByText('Anton Wretenberg')
    expect(screen.getByText('5,50 km')).toBeOnTheScreen()        // innevarande vecka
    fireEvent.press(screen.getByTestId('chartFirstPoint'))        // äldsta veckan, 11 veckor bakåt
    expect(screen.queryByText('Den här veckan')).not.toBeOnTheScreen()
    expect(screen.getByText('0,00 km')).toBeOnTheScreen()        // inga pass den veckan
    fireEvent.press(screen.getByTestId('chartFirstPoint'))        // samma punkt igen → rensar
    expect(screen.getByText('Den här veckan')).toBeOnTheScreen()
    expect(screen.getByText('5,50 km')).toBeOnTheScreen()
  })

  it('typ-chips byter statistiken', async () => {
    render(<AthleteScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByText('Cykling'))
    expect(screen.getByText('0,00 km')).toBeOnTheScreen()   // cyklingen var inte denna vecka
  })

  it('Aktiviteter-knappen visar antal pass och leder till aktivitetslistan', async () => {
    const { router } = require('expo-router')
    render(<AthleteScreen />)
    await screen.findByText('Anton Wretenberg')
    expect(screen.getByText('2 pass')).toBeOnTheScreen()
    fireEvent.press(screen.getByTestId('athleteActivities'))
    expect(router.push).toHaveBeenCalledWith('/(app)/activities')
  })

  it('följ-pillen växlar lokalt', async () => {
    render(<AthleteScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByTestId('athleteFollow'))
    expect(screen.getByText('Följ')).toBeOnTheScreen()
  })

  it('annan användares profil: namn från sökningen och ärligt tomläge', async () => {
    mockParams = { userId: 'u2', name: 'Nawid', avatar: '🔥' }
    render(<AthleteScreen />)
    expect(await screen.findByText('Nawid')).toBeOnTheScreen()
    expect(screen.getByText('Delar inga pass ännu')).toBeOnTheScreen()
    expect(screen.getByText('Inga delade pass ännu')).toBeOnTheScreen()
    expect(screen.queryByText('Den här veckan')).not.toBeOnTheScreen()
    expect(screen.queryByText('Aktiviteter')).not.toBeOnTheScreen()
  })

  it('activeLabel: idag, igår, dagar sedan och tomt', () => {
    const now = new Date('2026-07-22T10:00:00')
    expect(activeLabel(null)).toBe('Inga pass ännu')
    expect(activeLabel('2026-07-22T02:00:00', now)).toBe('Aktiv: idag')
    expect(activeLabel('2026-07-21T22:00:00', now)).toBe('Aktiv: igår')
    expect(activeLabel('2026-07-15T09:00:00', now)).toBe('Aktiv: 7 dagar sedan')
  })

  it('buildWeekBuckets: 12 veckor, distans i rätt vecka, månadsetiketter utan upprepning', () => {
    const now = new Date('2026-07-22T10:00:00')
    const buckets = buildWeekBuckets([makeRun('2026-07-21T08:00:00', 7.5)], 'running', now)
    expect(buckets).toHaveLength(12)
    expect(buckets[11].total).toBeCloseTo(7.5)
    expect(buckets[11].isCurrent).toBe(true)
    const labels = buckets.map(b => b.label).filter(Boolean)
    expect(new Set(labels).size).toBe(labels.length)   // varje månad bara en gång
  })
})
