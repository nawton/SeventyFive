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

  else if (table === 'direct_messages') {
    senderId = record.sender_id as string
    const excerpt = String(record.body ?? '').slice(0, 80)
    recipients.push({
      userId: record.recipient_id as string,
      makeBody: excerpt ? (n => `${n}: ”${excerpt}”`) : (n => `${n} skickade en bild`),
    })
  }

  else if (table === 'group_posts') {
    // Nytt inlägg → medlemmarna enligt sin notisnivå (alla/bara skaparens/av)
    const gid = record.group_id as string
    const [groupRes, memberRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/groups?id=eq.${gid}&select=name,owner_id`, { headers }),
      fetch(
        `${supabaseUrl}/rest/v1/group_members?group_id=eq.${gid}&status=eq.accepted&select=user_id,notify_posts`,
        { headers },
      ),
    ])
    const group: { name: string; owner_id: string } | undefined = (await groupRes.json())?.[0]
    if (!group) return json({ skipped: 'no group' })
    const members: Array<{ user_id: string; notify_posts: string }> = (await memberRes.json()) ?? []
    senderId = record.author_id as string
    const authorIsOwner = senderId === group.owner_id
    const excerpt = String(record.body ?? '').slice(0, 80)
    for (const m of members) {
      if (m.notify_posts === 'off') continue
      if (m.notify_posts === 'owner' && !authorIsOwner) continue
      recipients.push({
        userId: m.user_id,
        makeBody: n => `${n} i ${group.name}: ”${excerpt}”`,
      })
    }
  }

  else if (table === 'group_members') {
    // Inbjudan → den inbjudna; förfrågan → gruppens ägare;
    // godkänd förfrågan (UPDATE) → den som väntat
    const groupRes = await fetch(
      `${supabaseUrl}/rest/v1/groups?id=eq.${record.group_id}&select=name,owner_id`,
      { headers },
    )
    const group: { name: string; owner_id: string } | undefined = (await groupRes.json())?.[0]
    if (!group) return json({ skipped: 'no group' })
    if (op === 'UPDATE') {
      senderId = group.owner_id
      recipients.push({
        userId: record.user_id as string,
        makeBody: () => `Din förfrågan till ${group.name} godkändes, välkommen in!`,
      })
    } else if (record.status === 'invited') {
      senderId = (record.invited_by as string) ?? group.owner_id
      recipients.push({
        userId: record.user_id as string,
        makeBody: n => `${n} bjöd in dig till gruppen ${group.name}`,
      })
    } else {
      senderId = record.user_id as string
      recipients.push({
        userId: group.owner_id,
        makeBody: n => `${n} vill gå med i ${group.name}`,
      })
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
