// Edge Function: stripe-webhook
// Stripes källa-till-sanning-kanal: varje förändring av ett abonnemang
// (köp, förnyelse, uppsägning, misslyckad betalning) landar här och
// speglas in i subscriptions-tabellen. Appen läser BARA tabellen.
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
//          (Stripe skickar ingen Supabase-JWT — signaturen ÄR autentiseringen)
// Secrets: STRIPE_WEBHOOK_SECRET (whsec_… från Stripes webhook-inställning)
// Events:  customer.subscription.created / updated / deleted

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Verifierar Stripe-signaturen: HMAC-SHA256 över "t.payload" med whsec-nyckeln */
async function verifySignature(payload: string, header: string, secret: string): Promise<boolean> {
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

interface StripeSubscription {
  id: string
  customer: string
  status: string
  cancel_at_period_end: boolean
  current_period_end: number
  metadata?: { user_id?: string }
  items?: { data?: Array<{ price?: { id?: string } }> }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!secret) return new Response('STRIPE_WEBHOOK_SECRET saknas', { status: 500 })

  const payload = await req.text()
  const signature = req.headers.get('Stripe-Signature') ?? ''
  if (!(await verifySignature(payload, signature, secret))) {
    return new Response('Ogiltig signatur', { status: 400 })
  }

  const event = JSON.parse(payload) as { type: string; data: { object: StripeSubscription } }

  if (!event.type.startsWith('customer.subscription.')) {
    return new Response(JSON.stringify({ received: true }), { status: 200 })
  }

  const sub = event.data.object
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Användaren: metadata i första hand, kund-id som reserv
  let userId = sub.metadata?.user_id
  if (!userId) {
    const { data } = await admin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', sub.customer)
      .maybeSingle()
    userId = data?.user_id
  }
  if (!userId) {
    console.error('[stripe-webhook] okänd kund', sub.customer)
    return new Response(JSON.stringify({ received: true }), { status: 200 })
  }

  const { error } = await admin.from('subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    status: event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status,
    price_id: sub.items?.data?.[0]?.price?.id ?? null,
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  })
  if (error) {
    console.error('[stripe-webhook]', error)
    return new Response('DB-fel', { status: 500 })   // Stripe försöker igen
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
