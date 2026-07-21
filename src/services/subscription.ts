import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { supabase } from '@/lib/supabase'

// =============================================================================
// ABONNEMANG — Stripe via webbläsaren (fungerar i Expo Go; inga kortuppgifter
// nära appen). Checkout och kundportal skapas av edge functions; status
// speglas in i subscriptions-tabellen av stripe-webhook och läses härifrån.
// =============================================================================

export interface Subscription {
  status: string                        // 'none' | 'active' | 'trialing' | 'past_due' | 'canceled' …
  price_id: string | null
  current_period_end: string | null     // ISO-timestamp
  cancel_at_period_end: boolean
}

export const FREE_SUBSCRIPTION: Subscription = {
  status: 'none', price_id: null, current_period_end: null, cancel_at_period_end: false,
}

/** Användarens abonnemangsstatus — saknad rad betyder gratisnivån */
export async function getSubscription(userId: string): Promise<Subscription> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, price_id, current_period_end, cancel_at_period_end')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return FREE_SUBSCRIPTION
  return {
    status: data.status ?? 'none',
    price_id: data.price_id ?? null,
    current_period_end: data.current_period_end ?? null,
    cancel_at_period_end: !!data.cancel_at_period_end,
  }
}

/** Premium = aktivt/testperiod och perioden inte passerad. En uppsagd
    prenumeration är premium till periodens slut — man har betalat för den. */
export function isPremium(sub: Subscription, now: Date = new Date()): boolean {
  if (sub.status !== 'active' && sub.status !== 'trialing') return false
  if (!sub.current_period_end) return true
  return new Date(sub.current_period_end).getTime() > now.getTime()
}

/** Deep link tillbaka till profilen — funkar i Expo Go (exp://) och i
    standalone-appen (seventyfive://) */
function returnUrl(): string {
  return Linking.createURL('profile')
}

/** Startar Stripe Checkout i webbläsaren. Statusen uppdateras av webhooken —
    anroparen bör läsa om abonnemanget när skärmen får fokus igen. */
export async function startCheckout(plan: 'annual' | 'monthly' = 'annual'): Promise<void> {
  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: { redirectUrl: returnUrl(), plan },
  })
  if (error) throw new Error(error.message ?? 'Kunde inte starta betalningen')
  const url = (data as { url?: string })?.url
  if (!url) throw new Error((data as { error?: string })?.error ?? 'Kunde inte starta betalningen')
  await WebBrowser.openAuthSessionAsync(url, returnUrl())
}

/** Öppnar Stripes kundportal — byt kort, säg upp, kvitton */
export async function openBillingPortal(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('stripe-portal', {
    body: { redirectUrl: returnUrl() },
  })
  if (error) throw new Error(error.message ?? 'Kunde inte öppna kundportalen')
  const url = (data as { url?: string })?.url
  if (!url) throw new Error((data as { error?: string })?.error ?? 'Kunde inte öppna kundportalen')
  await WebBrowser.openAuthSessionAsync(url, returnUrl())
}
