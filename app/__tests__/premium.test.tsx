import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import PremiumScreen from '../premium'
import { getSubscription, startCheckout, openBillingPortal, FREE_SUBSCRIPTION } from '@/services/subscription'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }) },
  },
}))
jest.mock('@/services/profile', () => ({
  getProfile: jest.fn().mockResolvedValue({ name: 'Anton Wretenberg', avatar_url: null }),
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
  router: { push: jest.fn(), back: jest.fn() },
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

describe('premium — paywallen', () => {
  it('visar rubrik, personlig hälsning, fördelar och båda planerna', async () => {
    render(<PremiumScreen />)
    expect(await screen.findByText(/Lås upp din/)).toBeOnTheScreen()
    expect(screen.getByText('Anton, kom igång idag')).toBeOnTheScreen()
    expect(screen.getByText(/Intervallguidning med röst/)).toBeOnTheScreen()
    expect(screen.getByText('Årligen')).toBeOnTheScreen()
    expect(screen.getByText('Månadsvis')).toBeOnTheScreen()
    expect(screen.getByText('SPARA 40%')).toBeOnTheScreen()
  })

  it('årsplanen är förvald — CTA:n köper den', async () => {
    render(<PremiumScreen />)
    fireEvent.press(await screen.findByText('Kom igång nu'))
    await waitFor(() => expect(startCheckout).toHaveBeenCalledWith('annual'))
  })

  it('välj månadsvis → CTA:n köper månadsplanen', async () => {
    render(<PremiumScreen />)
    fireEvent.press(await screen.findByText('Månadsvis'))
    fireEvent.press(screen.getByText('Kom igång nu'))
    await waitFor(() => expect(startCheckout).toHaveBeenCalledWith('monthly'))
  })

  it('med Premium: statusvy + Hantera via portalen', async () => {
    ;(getSubscription as jest.Mock).mockResolvedValue({
      status: 'active', price_id: 'p', current_period_end: '2099-08-18T00:00:00Z', cancel_at_period_end: false,
    })
    render(<PremiumScreen />)
    expect(await screen.findByText('Du har Premium')).toBeOnTheScreen()
    expect(screen.queryByText('Årligen')).toBeNull()          // inga planer att köpa igen
    fireEvent.press(screen.getByText('Hantera abonnemang'))
    await waitFor(() => expect(openBillingPortal).toHaveBeenCalled())
  })
})
