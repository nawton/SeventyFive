import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { SubscriptionCard } from '../SubscriptionCard'
import { getSubscription, startCheckout, FREE_SUBSCRIPTION } from '@/services/subscription'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }) },
  },
}))
jest.mock('@/services/subscription', () => {
  const actual = jest.requireActual('@/services/subscription')
  return {
    ...actual,
    getSubscription: jest.fn().mockResolvedValue(actual.FREE_SUBSCRIPTION),
    startCheckout: jest.fn().mockResolvedValue(undefined),
    openBillingPortal: jest.fn().mockResolvedValue(undefined),
  }
})
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react')
    useEffect(cb, [cb])
  },
}))
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(), selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
}))

beforeEach(() => {
  jest.clearAllMocks()
  ;(getSubscription as jest.Mock).mockResolvedValue(FREE_SUBSCRIPTION)
})

describe('SubscriptionCard', () => {
  it('gratisläget: pitch + Uppgradera som startar checkout', async () => {
    render(<SubscriptionCard />)
    expect(await screen.findByText('SeventyFive Premium')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Uppgradera'))
    await waitFor(() => expect(startCheckout).toHaveBeenCalled())
  })

  it('aktivt abonnemang: badge, förnyelsedatum och Hantera', async () => {
    ;(getSubscription as jest.Mock).mockResolvedValue({
      status: 'active', price_id: 'p', current_period_end: '2099-08-18T00:00:00Z', cancel_at_period_end: false,
    })
    render(<SubscriptionCard />)
    expect(await screen.findByText('AKTIVT')).toBeOnTheScreen()
    expect(screen.getByText(/Förnyas 18 augusti/)).toBeOnTheScreen()
    expect(screen.getByText('Hantera abonnemang')).toBeOnTheScreen()
  })

  it('uppsagt men aktivt: "Avslutas … förnyas inte"', async () => {
    ;(getSubscription as jest.Mock).mockResolvedValue({
      status: 'active', price_id: 'p', current_period_end: '2099-08-18T00:00:00Z', cancel_at_period_end: true,
    })
    render(<SubscriptionCard />)
    expect(await screen.findByText(/Avslutas 18 augusti/)).toBeOnTheScreen()
  })

  it('misslyckad betalning: varning + Uppdatera betalning', async () => {
    ;(getSubscription as jest.Mock).mockResolvedValue({
      status: 'past_due', price_id: 'p', current_period_end: '2099-08-18T00:00:00Z', cancel_at_period_end: false,
    })
    render(<SubscriptionCard />)
    expect(await screen.findByText(/Betalningen misslyckades/)).toBeOnTheScreen()
    expect(screen.getByText('Uppdatera betalning')).toBeOnTheScreen()
  })
})
