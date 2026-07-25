import { supabase } from '@/lib/supabase'
import { uploadImage } from '@/lib/storage'

// =============================================================================
// DIREKTMEDDELANDEN, privata trådar mellan två personer. Vem som får
// skriva till vem avgörs i databasen (följrelation eller gemensam grupp,
// aldrig blockerade). Läskvitton sätts via definer-RPC.
// =============================================================================

export interface DirectMessage {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  image_url: string | null
  created_at: string
  read_at: string | null
}

export interface Conversation {
  userId: string
  name: string | null
  avatar_url: string | null
  lastBody: string
  lastAt: string
  lastFromMe: boolean
  lastHasImage: boolean
  unread: number
}

type MiniProfile = { id: string; name: string | null; avatar_url: string | null }

/** Samtalslistan: senaste meddelandet per motpart + antal olästa */
export async function getConversations(me: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
    .order('created_at', { ascending: false })
    .limit(400)
  if (error || !data) return []
  const rows = data as DirectMessage[]
  const byOther = new Map<string, { last: DirectMessage; unread: number }>()
  for (const m of rows) {
    const other = m.sender_id === me ? m.recipient_id : m.sender_id
    let entry = byOther.get(other)
    if (!entry) { entry = { last: m, unread: 0 }; byOther.set(other, entry) }
    if (m.recipient_id === me && !m.read_at) entry.unread += 1
  }
  const ids = Array.from(byOther.keys())
  if (ids.length === 0) return []
  const { data: profiles } = await supabase.rpc('follow_profiles', { ids })
  const byId = new Map<string, MiniProfile>(
    ((profiles ?? []) as MiniProfile[]).map(p => [p.id, p]))
  return ids.map(id => {
    const { last, unread } = byOther.get(id)!
    return {
      userId: id,
      name: byId.get(id)?.name ?? null,
      avatar_url: byId.get(id)?.avatar_url ?? null,
      lastBody: last.body,
      lastAt: last.created_at,
      lastFromMe: last.sender_id === me,
      lastHasImage: !!last.image_url,
      unread,
    }
  }).sort((a, b) => b.lastAt.localeCompare(a.lastAt))
}

/** Tråden med en person, äldst först */
export async function getThread(me: string, other: string): Promise<DirectMessage[]> {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .or(`and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error || !data) return []
  return data as DirectMessage[]
}

/** Skicka text och/eller bild. Bilden laddas upp först. */
export async function sendMessage(recipientId: string, body: string, imageUri?: string | null): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('inte inloggad')
  let imageUrl: string | null = null
  if (imageUri) {
    const path = `posts/${session.user.id}-${Date.now()}.jpg`
    await uploadImage('avatars', path, imageUri)
    imageUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  }
  const { error } = await supabase.from('direct_messages').insert({
    sender_id: session.user.id,
    recipient_id: recipientId,
    body: body.trim(),
    image_url: imageUrl,
  })
  if (error) throw error
}

export interface MessageReaction {
  message_id: string
  user_id: string
  emoji: string
}

/** Trådens reaktioner, grupperade per meddelande */
export async function getMessageReactions(messageIds: string[]): Promise<Record<string, MessageReaction[]>> {
  if (messageIds.length === 0) return {}
  const { data, error } = await supabase
    .from('message_reactions')
    .select('message_id, user_id, emoji')
    .in('message_id', messageIds)
  if (error || !data) return {}
  const map: Record<string, MessageReaction[]> = {}
  for (const r of data as MessageReaction[]) {
    (map[r.message_id] ??= []).push(r)
  }
  return map
}

/** Sätt/byt sin reaktion — en per person och meddelande */
export async function setReaction(messageId: string, emoji: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('inte inloggad')
  const { error } = await supabase.from('message_reactions').upsert(
    { message_id: messageId, user_id: session.user.id, emoji },
    { onConflict: 'message_id,user_id' },
  )
  if (error) throw error
}

export async function removeReaction(messageId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return
  await supabase.from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', session.user.id)
}

/** Avsändaren raderar sitt eget meddelande (RLS) */
export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase.from('direct_messages').delete().eq('id', id)
  if (error) throw error
}

export async function markThreadRead(otherId: string): Promise<void> {
  await supabase.rpc('mark_messages_read', { other: otherId })
}

/** Olästa totalt, till pricken på meddelandeikonen */
export async function getUnreadMessageCount(me: string): Promise<number> {
  const { count } = await supabase
    .from('direct_messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', me)
    .is('read_at', null)
  return count ?? 0
}

/** Realtid: nya meddelanden till mig — returnerar upprensningsfunktion */
export function subscribeToMessages(me: string, onChange: () => void): () => void {
  try {
    const channel = supabase
      .channel(`dm-${me}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${me}` },
        onChange)
      // Reaktioner i mina trådar — RLS avgör vilka händelser som når mig
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        onChange)
      .subscribe()
    return () => { supabase.removeChannel(channel).catch(() => {}) }
  } catch {
    return () => {}
  }
}
