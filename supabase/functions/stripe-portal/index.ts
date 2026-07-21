// Edge Function: stripe-portal
// Öppnar Stripes kundportal för den inloggade användaren — där sköts allt
// underhåll (byt kort, säg upp, kvitton) av Stripe, inte av oss.
//
// Deploy:  supabase functions deploy stripe-portal
// Secrets: STRIPE_SECRET_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { stripePost, jsonResponse } from '../_shared/stripe.ts'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return jsonResponse({ error: 'Inte inloggad' }, 401)

    const { redirectUrl } = await req.json().catch(() => ({}))
    const redirect = typeof redirectUrl === 'string' && redirectUrl.length > 0
      ? redirectUrl
      : 'seventyfive://subscription-result'

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: sub } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!sub?.stripe_customer_id) return jsonResponse({ error: 'Inget abonnemang hittades' }, 404)

    const session = await stripePost('/billing_portal/sessions', {
      customer: sub.stripe_customer_id,
      return_url: redirect,
    })

    return jsonResponse({ url: session.url })
  } catch (e) {
    console.error('[stripe-portal]', e)
    return jsonResponse({ error: (e as Error).message }, 500)
  }
})
