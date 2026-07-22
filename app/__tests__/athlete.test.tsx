import { render, screen, fireEvent, within } from '@testing-library/react-native'
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
jest.mock('@/services/follows', () => ({
  getFollowCounts: jest.fn().mockResolvedValue({ followers: 0, following: 0 }),
  getFollowStatus: jest.fn().mockResolvedValue('none'),
  follow: jest.fn().mockResolvedValue(undefined),
  unfollow: jest.fn().mockResolvedValue(undefined),
  subscribeToFollows: jest.fn(() => () => {}),
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
  // clearAllMocks rensar inte implementationer — återställ statusen explicit
  const follows = require('@/services/follows')
  ;(follows.getFollowStatus as jest.Mock).mockResolvedValue('none')
  ;(follows.getFollowCounts as jest.Mock).mockResolvedValue({ followers: 0, following: 0 })
  ;(follows.subscribeToFollows as jest.Mock).mockReturnValue(() => {})
})

describe('Atletprofil', () => {
  it('egna profilen: räknare men INGEN statistiksektion (den har egen flik)', async () => {
    render(<AthleteScreen />)
    expect(await screen.findByText('Anton Wretenberg')).toBeOnTheScreen()
    expect(screen.getByText('16')).toBeOnTheScreen()        // 5,5 + 10 avrundat
    expect(screen.getByText('Totalt km')).toBeOnTheScreen()
    expect(screen.getByText('Följare')).toBeOnTheScreen()
    expect(screen.queryByText('Den här veckan')).not.toBeOnTheScreen()
    expect(screen.queryByText('chart:12')).not.toBeOnTheScreen()
    expect(screen.getByText('Aktiviteter')).toBeOnTheScreen()   // historiken finns kvar
  })

  it('vald punkt i grafen styr veckosektionen — på en godkänd väns profil', async () => {
    const { getFollowStatus } = require('@/services/follows')
    ;(getFollowStatus as jest.Mock).mockResolvedValue('accepted')
    mockParams = { userId: 'u2', name: 'Nawid', avatar: '' }
    render(<AthleteScreen />)
    expect(await screen.findByText('5,50 km')).toBeOnTheScreen()  // innevarande vecka
    fireEvent.press(screen.getByTestId('chartFirstPoint'))        // äldsta veckan, 11 veckor bakåt
    expect(screen.queryByText('Den här veckan')).not.toBeOnTheScreen()
    expect(screen.getByText('0,00 km')).toBeOnTheScreen()        // inga pass den veckan
    fireEvent.press(screen.getByTestId('chartFirstPoint'))        // samma punkt igen → rensar
    expect(screen.getByText('Den här veckan')).toBeOnTheScreen()
    expect(screen.getByText('5,50 km')).toBeOnTheScreen()
  })

  it('typ-chips byter statistiken — på en godkänd väns profil', async () => {
    const { getFollowStatus } = require('@/services/follows')
    ;(getFollowStatus as jest.Mock).mockResolvedValue('accepted')
    mockParams = { userId: 'u2', name: 'Nawid', avatar: '' }
    render(<AthleteScreen />)
    await screen.findByText('Den här veckan')
    fireEvent.press(screen.getByText('Cykling'))
    expect(screen.getByText('0,00 km')).toBeOnTheScreen()   // cyklingen var inte denna vecka
  })

  it('Aktiviteter-knappen visar antal pass och leder till aktivitetslistan', async () => {
    const { router } = require('expo-router')
    render(<AthleteScreen />)
    await screen.findByText('Anton Wretenberg')
    expect(screen.getByText('2 pass')).toBeOnTheScreen()
    fireEvent.press(screen.getByTestId('athleteActivities'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(app)/activities',
      params: { userId: '', name: '', avatar: '' },
    })
  })

  it('egna räknarna öppnar Följare/Följer-listorna på rätt flik', async () => {
    const { router } = require('expo-router')
    render(<AthleteScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByTestId('followersCounter'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(app)/following', params: { tab: 'followers' },
    })
    fireEvent.press(screen.getByTestId('followingCounter'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(app)/following', params: { tab: 'following' },
    })
  })

  it('andras räknare är inte tryckbara — listorna är ens egna', async () => {
    const { router } = require('expo-router')
    mockParams = { userId: 'u2', name: 'Nawid', avatar: '' }
    render(<AthleteScreen />)
    await screen.findByText('Nawid')
    fireEvent.press(screen.getByTestId('followersCounter'))
    expect(router.push).not.toHaveBeenCalled()
  })

  it('egna profilen har ingen följ-knapp — man kan inte följa sig själv', async () => {
    render(<AthleteScreen />)
    await screen.findByText('Anton Wretenberg')
    expect(screen.queryByTestId('athleteFollow')).not.toBeOnTheScreen()
  })

  it('följ skickar en vänförfrågan — pending tills godkännande', async () => {
    const { follow, unfollow } = require('@/services/follows')
    mockParams = { userId: 'u2', name: 'Nawid', avatar: '' }
    render(<AthleteScreen />)
    await screen.findByText('Nawid')
    fireEvent.press(screen.getByTestId('athleteFollow'))
    expect(follow).toHaveBeenCalledWith('u2')
    expect(within(screen.getByTestId('athleteFollow')).getByText('Förfrågan skickad')).toBeOnTheScreen()
    expect(screen.getByText('Väntar på godkännande — när Nawid godkänner din förfrågan ser du statistiken här.')).toBeOnTheScreen()
    fireEvent.press(screen.getByTestId('athleteFollow'))     // ångra förfrågan
    expect(unfollow).toHaveBeenCalledWith('u2')
    expect(within(screen.getByTestId('athleteFollow')).getByText('Följ')).toBeOnTheScreen()
  })

  it('annan användares profil utan godkännande: privat och låst', async () => {
    mockParams = { userId: 'u2', name: 'Nawid', avatar: '🔥' }
    render(<AthleteScreen />)
    expect(await screen.findByText('Nawid')).toBeOnTheScreen()
    expect(screen.getByText('Privat profil')).toBeOnTheScreen()
    expect(screen.getByText('Statistiken är privat')).toBeOnTheScreen()
    expect(screen.queryByText('Den här veckan')).not.toBeOnTheScreen()
    expect(screen.queryByText('Aktiviteter')).not.toBeOnTheScreen()
  })

  it('godkänd vänförfrågan låser upp statistiken', async () => {
    const { getFollowStatus } = require('@/services/follows')
    ;(getFollowStatus as jest.Mock).mockResolvedValue('accepted')
    mockParams = { userId: 'u2', name: 'Nawid', avatar: '🔥' }
    render(<AthleteScreen />)
    expect(await screen.findByText('Den här veckan')).toBeOnTheScreen()
    expect(screen.queryByText('Statistiken är privat')).not.toBeOnTheScreen()
    expect(within(screen.getByTestId('athleteFollow')).getByText('Följer')).toBeOnTheScreen()
  })

  it('profilbyte: nästa persons namn visas — inte första besökta', async () => {
    mockParams = { userId: 'u2', name: 'Nawid', avatar: '' }
    const { rerender } = render(<AthleteScreen />)
    expect(await screen.findByText('Nawid')).toBeOnTheScreen()
    mockParams = { userId: 'u3', name: 'Sara', avatar: '' }
    rerender(<AthleteScreen />)
    expect(await screen.findByText('Sara')).toBeOnTheScreen()
    expect(screen.queryByText('Nawid')).not.toBeOnTheScreen()
  })

  it('annan användares profil börjar som Följ, inte Följer', async () => {
    mockParams = { userId: 'u2', name: 'Nawid', avatar: '' }
    render(<AthleteScreen />)
    await screen.findByText('Nawid')
    expect(await screen.findByText('Följ')).toBeOnTheScreen()
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
