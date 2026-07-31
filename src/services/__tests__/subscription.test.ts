import {
  getSubscription, isPremium, startCheckout, openBillingPortal, FREE_SUBSCRIPTION,
} from '../subscription'
import { supabase } from '@/lib/supabase'
import * as WebBrowser from 'expo-web-browser'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), functions: { invoke: jest.fn() } },
}))
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn().mockResolvedValue({ type: 'success' }) }))
jest.mock('expo-linking', () => ({ createURL: jest.fn(() => 'seventyfive://profile') }))

function mockSelect(result: unknown) {
  ;(supabase.from as jest.Mock).mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(result) }) }),
  })
}

beforeEach(() => jest.clearAllMocks())

describe('getSubscription', () => {
  it('mappar raden till abonnemanget', async () => {
    mockSelect({ data: { status: 'active', price_id: 'price_1', current_period_end: '2026-08-20T00:00:00Z', cancel_at_period_end: false }, error: null })
    const sub = await getSubscription('u1')
    expect(sub.status).toBe('active')
    expect(sub.price_id).toBe('price_1')
  })
  it('saknad rad eller fel betyder gratisnivån', async () => {
    mockSelect({ data: null, error: null })
    expect(await getSubscription('u1')).toEqual(FREE_SUBSCRIPTION)
    mockSelect({ data: null, error: new Error('boom') })
    expect(await getSubscription('u1')).toEqual(FREE_SUBSCRIPTION)
  })
  it('null-fält i raden faller tillbaka till standardvärden', async () => {
    mockSelect({ data: { status: null, price_id: null, current_period_end: null, cancel_at_period_end: null }, error: null })
    expect(await getSubscription('u1')).toEqual(FREE_SUBSCRIPTION)
  })
})

describe('isPremium', () => {
  const now = new Date('2026-07-21T12:00:00Z')
  const sub = (over: Partial<typeof FREE_SUBSCRIPTION>) => ({ ...FREE_SUBSCRIPTION, ...over })

  it('aktivt med framtida periodslut är premium', () => {
    expect(isPremium(sub({ status: 'active', current_period_end: '2026-08-01T00:00:00Z' }), now)).toBe(true)
    expect(isPremium(sub({ status: 'trialing', current_period_end: '2026-08-01T00:00:00Z' }), now)).toBe(true)
  })
  it('uppsagt men betalt till periodens slut är fortfarande premium', () => {
    expect(isPremium(sub({ status: 'active', current_period_end: '2026-08-01T00:00:00Z', cancel_at_period_end: true }), now)).toBe(true)
  })
  it('aktivt utan periodslut räknas som premium (t.ex. livstidsåtkomst)', () => {
    expect(isPremium(sub({ status: 'active', current_period_end: null }), now)).toBe(true)
    expect(isPremium(sub({ status: 'trialing', current_period_end: null }), now)).toBe(true)
  })
  it('now-parametern är valfri och defaultar till nuet', () => {
    expect(isPremium(FREE_SUBSCRIPTION)).toBe(false)
  })
  it('passerad period, canceled och past_due är inte premium', () => {
    expect(isPremium(sub({ status: 'active', current_period_end: '2026-07-01T00:00:00Z' }), now)).toBe(false)
    expect(isPremium(sub({ status: 'canceled', current_period_end: '2026-08-01T00:00:00Z' }), now)).toBe(false)
    expect(isPremium(sub({ status: 'past_due', current_period_end: '2026-08-01T00:00:00Z' }), now)).toBe(false)
    expect(isPremium(FREE_SUBSCRIPTION, now)).toBe(false)
  })
})

describe('startCheckout / openBillingPortal', () => {
  it('hämtar checkout-URL från edge-funktionen och öppnar webbläsaren', async () => {
    ;(supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { url: 'https://checkout.stripe.com/x' }, error: null })
    await startCheckout('monthly')
    expect(supabase.functions.invoke).toHaveBeenCalledWith('stripe-checkout', {
      body: { redirectUrl: 'seventyfive://profile', plan: 'monthly' },
    })
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith('https://checkout.stripe.com/x', 'seventyfive://profile')
  })
  it('portalflödet fungerar likadant', async () => {
    ;(supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { url: 'https://billing.stripe.com/x' }, error: null })
    await openBillingPortal()
    expect(supabase.functions.invoke).toHaveBeenCalledWith('stripe-portal', expect.anything())
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith('https://billing.stripe.com/x', 'seventyfive://profile')
  })
  it('fel från funktionen kastas vidare — webbläsaren öppnas aldrig', async () => {
    ;(supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: { message: 'nätverk' } })
    await expect(startCheckout()).rejects.toThrow('nätverk')
    ;(supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { error: 'STRIPE_PRICE_ID saknas' }, error: null })
    await expect(startCheckout()).rejects.toThrow('STRIPE_PRICE_ID saknas')
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled()
  })
  it('kundportalens fel kastas vidare med samma mönster som checkout', async () => {
    ;(supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: { message: 'nätverk' } })
    await expect(openBillingPortal()).rejects.toThrow('nätverk')
    ;(supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: {}, error: null })
    await expect(openBillingPortal()).rejects.toThrow('Kunde inte öppna kundportalen')
    ;(supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: {} })
    await expect(openBillingPortal()).rejects.toThrow('Kunde inte öppna kundportalen')
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled()
  })
  it('felmeddelande utan text faller tillbaka till standardtexten', async () => {
    ;(supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: {} })
    await expect(startCheckout()).rejects.toThrow('Kunde inte starta betalningen')
    ;(supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: null })
    await expect(startCheckout()).rejects.toThrow('Kunde inte starta betalningen')
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled()
  })
})
