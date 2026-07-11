// Edge Function: advance-days
// Anropar SQL-funktionen advance_challenge_days() via RPC.
// Kan triggas av pg_cron (via pg_net), GitHub Actions, eller manuellt.
//
// Deploy:  supabase functions deploy advance-days
// Test:    curl -X POST $SUPABASE_URL/functions/v1/advance-days \
//            -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  // Tillåt bara POST och anrop med service-role-nyckel
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data, error } = await supabase.rpc('advance_challenge_days')

  if (error) {
    console.error('[advance-days]', error)
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ ok: true, result: data }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
