// Delade Stripe-helpers för edge functions — Stripes REST-API via fetch
// (inget SDK behövs i Deno; allt är formkodade POST-anrop).

export const STRIPE_API = 'https://api.stripe.com/v1'

export function stripeKey(): string {
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) throw new Error('STRIPE_SECRET_KEY saknas — sätt den med `supabase secrets set`')
  return key
}

/** Formkodad POST till Stripe. Nycklar med punktnotation ("metadata[user_id]") stöds. */
export async function stripePost(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(params)
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error((json as { error?: { message?: string } }).error?.message ?? `Stripe ${res.status}`)
  }
  return json as Record<string, unknown>
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
