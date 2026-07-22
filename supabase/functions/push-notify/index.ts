// push-notify: tar emot databastriggern (pg_net) för sociala händelser
// och skickar Expo-pushnotiser till mottagarens registrerade enheter.
// Skyddas av x-push-secret (edge-funktionssecret PUSH_WEBHOOK_SECRET,
// samma värde som triggern skickar). Döda tokens städas bort när Expo
// svarar DeviceNotRegistered.

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.headers.get('x-push-secret') !== Deno.env.get('PUSH_WEBHOOK_SECRET')) {
    return json({ error: 'forbidden' }, 403)
  }

  let payload: { table?: string; op?: string; record?: Record<string, unknown> }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'bad payload' }, 400)
  }
  const { table, op, record } = payload
  if (!table || !record) return json({ error: 'bad payload' }, 400)

  // Vem ska ha notisen, från vem, och vad ska den säga?
  let recipient: string | null = null
  let senderId: string | null = null
  let makeBody: (name: string) => string = () => ''

  if (table === 'follows') {
    if (op === 'UPDATE') {
      // pending → accepted: berätta för AVSÄNDAREN att förfrågan godkänts
      recipient = record.follower_id as string
      senderId = record.followee_id as string
      makeBody = n => `${n} godkände din vänförfrågan`
    } else if (record.status === 'pending') {
      recipient = record.followee_id as string
      senderId = record.follower_id as string
      makeBody = n => `${n} vill följa dig`
    } else {
      // Offentlig profil: följet blev accepted direkt vid insert
      recipient = record.followee_id as string
      senderId = record.follower_id as string
      makeBody = n => `${n} började följa dig`
    }
  } else if (table === 'post_likes') {
    recipient = record.owner_id as string
    senderId = record.liker_id as string
    makeBody = n => String(record.post_key ?? '').startsWith('gym-')
      ? `${n} gillade ditt gympass`
      : `${n} gillade ditt pass`
  } else if (table === 'post_comments') {
    recipient = record.owner_id as string
    senderId = record.author_id as string
    makeBody = n => `${n} kommenterade: ”${String(record.body ?? '').slice(0, 80)}”`
  }

  if (!recipient || !senderId || recipient === senderId) {
    return json({ skipped: 'self or unknown' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }

  const [profileRes, tokenRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${senderId}&select=name`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/push_tokens?user_id=eq.${recipient}&select=token`, { headers }),
  ])
  const senderName: string = (await profileRes.json())?.[0]?.name ?? 'Någon'
  const tokens: string[] = ((await tokenRes.json()) ?? []).map((r: { token: string }) => r.token)
  if (tokens.length === 0) return json({ skipped: 'no tokens' })

  const messages = tokens.map(to => ({
    to,
    title: 'SeventyFive',
    body: makeBody(senderName),
    sound: 'default',
  }))
  const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  })
  const result = await pushRes.json().catch(() => null)

  // Städa tokens för avinstallerade enheter
  const tickets: Array<{ details?: { error?: string } }> = result?.data ?? []
  await Promise.all(tickets.map((t, i) =>
    t?.details?.error === 'DeviceNotRegistered'
      ? fetch(`${supabaseUrl}/rest/v1/push_tokens?token=eq.${encodeURIComponent(tokens[i])}`, {
          method: 'DELETE', headers,
        })
      : Promise.resolve(null)
  ))

  return json({ sent: tokens.length })
})
