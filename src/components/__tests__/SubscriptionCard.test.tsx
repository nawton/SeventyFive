import { render, screen, fireEvent } from '@testing-library/react-native'
import { SubscriptionCard } from '../SubscriptionCard'
import { getSubscription, FREE_SUBSCRIPTION } from '@/services/subscription'
import { router } from 'expo-router'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }) },
  },
}))
jest.mock('@/services/subscription', () => {
  const actual = jest.requireActual('@/services/subscription')
  return { ...actual, getSubscription: jest.fn().mockResolvedValue(actual.FREE_SUBSCRIPTION) }
})
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react')
    useEffect(cb, [cb])
  },
}))
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }))
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native')
  return { LinearGradient: View }
})

beforeEach(() => {
  jest.clearAllMocks()
  ;(getSubscription as jest.Mock).mockResolvedValue(FREE_SUBSCRIPTION)
})

describe('SubscriptionCard (premium-bannern)', () => {
  it('gratis: personlig pitch + PRENUMERERA, tryck leder till /premium', async () => {
    render(<SubscriptionCard name="Anton Wretenberg" />)
    expect(await screen.findByText('Anton, skaffa Premium')).toBeOnTheScreen()
    expect(screen.getByText('PRENUMERERA')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('PRENUMERERA'))
    expect(router.push).toHaveBeenCalledWith('/premium')
  })

  it('utan namn: generisk rubrik', async () => {
    render(<SubscriptionCard />)
    expect(await screen.findByText('Skaffa SeventyFive Premium')).toBeOnTheScreen()
  })

  it('aktivt: status + förnyelsedatum + HANTERA', async () => {
    ;(getSubscription as jest.Mock).mockResolvedValue({
      status: 'active', price_id: 'p', current_period_end: '2099-08-18T00:00:00Z', cancel_at_period_end: false,
    })
    render(<SubscriptionCard name="Anton" />)
    expect(await screen.findByText(/förnyas 18 augusti/)).toBeOnTheScreen()
    expect(screen.getByText('HANTERA')).toBeOnTheScreen()
  })

  it('uppsagt men betalt: "Avslutas …"', async () => {
    ;(getSubscription as jest.Mock).mockResolvedValue({
      status: 'active', price_id: 'p', current_period_end: '2099-08-18T00:00:00Z', cancel_at_period_end: true,
    })
    render(<SubscriptionCard />)
    expect(await screen.findByText(/Avslutas 18 augusti/)).toBeOnTheScreen()
  })

  it('misslyckad betalning: varning + UPPDATERA BETALNING', async () => {
    ;(getSubscription as jest.Mock).mockResolvedValue({
      status: 'past_due', price_id: 'p', current_period_end: '2099-08-18T00:00:00Z', cancel_at_period_end: false,
    })
    render(<SubscriptionCard />)
    expect(await screen.findByText(/Betalningen misslyckades/)).toBeOnTheScreen()
    expect(screen.getByText('UPPDATERA BETALNING')).toBeOnTheScreen()
  })
})
