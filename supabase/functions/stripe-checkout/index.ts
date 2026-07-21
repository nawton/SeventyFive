// Edge Function: stripe-checkout
// Skapar en Stripe Checkout-session (abonnemang) för den inloggade användaren
// och returnerar betalsidans URL. Appen öppnar den i webbläsaren — inga
// kortuppgifter passerar någonsin appen eller vår backend.
//
// Deploy:  supabase functions deploy stripe-checkout
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_ID

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { stripePost, jsonResponse } from '../_shared/stripe.ts'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    // Identifiera användaren från JWT:n i Authorization-headern
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return jsonResponse({ error: 'Inte inloggad' }, 401)

    const { redirectUrl, plan } = await req.json().catch(() => ({}))
    const redirect = typeof redirectUrl === 'string' && redirectUrl.length > 0
      ? redirectUrl
      : 'seventyfive://subscription-result'

    // Två planer: årlig (default) och månadsvis — egna Stripe-priser.
    // STRIPE_PRICE_ID fungerar som fallback om bara ett pris finns uppsatt.
    const priceId = (plan === 'monthly'
      ? Deno.env.get('STRIPE_PRICE_ID_MONTHLY')
      : Deno.env.get('STRIPE_PRICE_ID_ANNUAL')) ?? Deno.env.get('STRIPE_PRICE_ID')
    if (!priceId) return jsonResponse({ error: 'STRIPE_PRICE_ID saknas' }, 500)

    // Återanvänd Stripe-kunden om användaren redan har en — annars skapa
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: existing } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let customerId = existing?.stripe_customer_id as string | undefined
    if (!customerId) {
      const customer = await stripePost('/customers', {
        email: user.email ?? '',
        'metadata[user_id]': user.id,
      })
      customerId = customer.id as string
      await admin.from('subscriptions').upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        status: 'none',
        updated_at: new Date().toISOString(),
      })
    }

    const session = await stripePost('/checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${redirect}?status=success`,
      cancel_url: `${redirect}?status=cancel`,
      // user_id i metadata — webhooken mappar tillbaka utan extra uppslag
      'subscription_data[metadata][user_id]': user.id,
      'metadata[user_id]': user.id,
      allow_promotion_codes: 'true',
    })

    return jsonResponse({ url: session.url })
  } catch (e) {
    console.error('[stripe-checkout]', e)
    return jsonResponse({ error: (e as Error).message }, 500)
  }
})
