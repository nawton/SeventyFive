// Ren logik utan Deno-specifika beroenden (bara Web Crypto, som finns i både
// Deno och Node) — testbar med Jest. index.ts (Deno-handlern) importerar och
// använder dessa funktioner, och sköter själv HTTP/env/DB-delen.

/** Verifierar Stripe-signaturen: HMAC-SHA256 över "t.payload" med whsec-nyckeln */
export async function verifySignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=') as [string, string]))
  const t = parts['t']
  const v1 = parts['v1']
  if (!t || !v1) return false
  // Replay-skydd: äldre än 5 min avvisas
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`))
  const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('')

  // Konstanttidsjämförelse
  if (expected.length !== v1.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i)
  return diff === 0
}

export interface StripeSubscription {
  id: string
  customer: string
  status: string
  cancel_at_period_end: boolean
  current_period_end: number
  metadata?: { user_id?: string }
  items?: { data?: Array<{ price?: { id?: string } }> }
}

export interface StripeSubscriptionEvent {
  type: string
  data: { object: StripeSubscription }
}

/** True om händelsetypen ska speglas in i subscriptions-tabellen */
export function isSubscriptionEvent(eventType: string): boolean {
  return eventType.startsWith('customer.subscription.')
}

/** Raden som ska upsertas i subscriptions-tabellen. userId måste redan vara
    uppslaget (metadata eller kund-id-fallback) — den delen kräver DB-access
    och ligger kvar i Deno-handlern. */
export function subscriptionRowFromEvent(event: StripeSubscriptionEvent, userId: string) {
  const sub = event.data.object
  return {
    user_id: userId,
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    // "deleted"-eventet har ofta status 'active' kvar i payloaden — det är
    // själva borttagningen som betyder uppsagt, inte fältet
    status: event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status,
    price_id: sub.items?.data?.[0]?.price?.id ?? null,
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at_period_end: sub.cancel_at_period_end,
  }
}
