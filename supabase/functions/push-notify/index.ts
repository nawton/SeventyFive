// push-notify: tar emot databastriggern (pg_net) för sociala händelser
// och skickar Expo-pushnotiser till mottagarnas registrerade enheter.
// Kommentarer notifierar både passägaren och alla andra som kommenterat
// i samma tråd. Skyddas av x-push-secret (edge-funktionssecret
// PUSH_WEBHOOK_SECRET, samma värde som triggern skickar). Döda tokens
// städas bort när Expo svarar DeviceNotRegistered.

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }

  // Vilka ska ha notisen, från vem, och vad ska den säga?
  let senderId: string | null = null
  const recipients: Array<{ userId: string; makeBody: (name: string) => string }> = []

  if (table === 'follows') {
    if (op === 'UPDATE') {
      // pending → accepted: berätta för AVSÄNDAREN att förfrågan godkänts
      senderId = record.followee_id as string
      recipients.push({
        userId: record.follower_id as string,
        makeBody: n => `${n} godkände din vänförfrågan`,
      })
    } else {
      senderId = record.follower_id as string
      recipients.push({
        userId: record.followee_id as string,
        makeBody: record.status === 'pending'
          ? (n => `${n} vill följa dig`)
          : (n => `${n} började följa dig`),   // offentlig profil: direktgodkänt
      })
    }
  } else if (table === 'post_likes') {
    senderId = record.liker_id as string
    recipients.push({
      userId: record.owner_id as string,
      makeBody: String(record.post_key ?? '').startsWith('gym-')
        ? (n => `${n} gillade ditt gympass`)
        : (n => `${n} gillade ditt pass`),
    })
  } else if (table === 'post_comments') {
    senderId = record.author_id as string
    const ownerId = record.owner_id as string
    const excerpt = String(record.body ?? '').slice(0, 80)
    recipients.push({
      userId: ownerId,
      makeBody: n => `${n} kommenterade: ”${excerpt}”`,
    })
    // Alla ANDRA som deltagit i tråden får också veta
    const threadRes = await fetch(
      `${supabaseUrl}/rest/v1/post_comments?post_key=eq.${encodeURIComponent(String(record.post_key))}&select=author_id`,
      { headers },
    )
    const participants: Array<{ author_id: string }> = await threadRes.json().catch(() => [])
    for (const uid of new Set(participants.map(p => p.author_id))) {
      if (uid !== ownerId && uid !== senderId) {
        recipients.push({
          userId: uid,
          makeBody: n => `${n} kommenterade också: ”${excerpt}”`,
        })
      }
    }
  }

  const targets = recipients.filter(r => r.userId && r.userId !== senderId)
  if (!senderId || targets.length === 0) return json({ skipped: 'self or unknown' })

  const [profileRes, tokenRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${senderId}&select=name`, { headers }),
    fetch(
      `${supabaseUrl}/rest/v1/push_tokens?user_id=in.(${targets.map(t => t.userId).join(',')})&select=user_id,token`,
      { headers },
    ),
  ])
  const senderName: string = (await profileRes.json())?.[0]?.name ?? 'Någon'
  const tokenRows: Array<{ user_id: string; token: string }> = (await tokenRes.json()) ?? []
  if (tokenRows.length === 0) return json({ skipped: 'no tokens' })

  const bodyByUser = new Map(targets.map(t => [t.userId, t.makeBody(senderName)]))
  const messages = tokenRows
    .filter(r => bodyByUser.has(r.user_id))
    .map(r => ({
      to: r.token,
      title: 'SeventyFive',
      body: bodyByUser.get(r.user_id)!,
      sound: 'default',
    }))
  if (messages.length === 0) return json({ skipped: 'no tokens' })

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
      ? fetch(`${supabaseUrl}/rest/v1/push_tokens?token=eq.${encodeURIComponent(messages[i].to)}`, {
          method: 'DELETE', headers,
        })
      : Promise.resolve(null)
  ))

  return json({ sent: messages.length })
})
