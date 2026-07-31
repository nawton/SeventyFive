// Edge Function: stripe-webhook
// Stripes källa-till-sanning-kanal: varje förändring av ett abonnemang
// (köp, förnyelse, uppsägning, misslyckad betalning) landar här och
// speglas in i subscriptions-tabellen. Appen läser BARA tabellen.
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
//          (Stripe skickar ingen Supabase-JWT — signaturen ÄR autentiseringen)
// Secrets: STRIPE_WEBHOOK_SECRET (whsec_… från Stripes webhook-inställning)
// Events:  customer.subscription.created / updated / deleted
//
// Signaturverifiering och event→rad-mappning bor i logic.ts (ren logik,
// testad med Jest) — den här filen sköter bara HTTP/env/DB.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifySignature, isSubscriptionEvent, subscriptionRowFromEvent, type StripeSubscriptionEvent } from './logic.ts'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!secret) return new Response('STRIPE_WEBHOOK_SECRET saknas', { status: 500 })

  const payload = await req.text()
  const signature = req.headers.get('Stripe-Signature') ?? ''
  if (!(await verifySignature(payload, signature, secret))) {
    return new Response('Ogiltig signatur', { status: 400 })
  }

  const event = JSON.parse(payload) as StripeSubscriptionEvent

  if (!isSubscriptionEvent(event.type)) {
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
    ...subscriptionRowFromEvent(event, userId),
    updated_at: new Date().toISOString(),
  })
  if (error) {
    console.error('[stripe-webhook]', error)
    return new Response('DB-fel', { status: 500 })   // Stripe försöker igen
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
