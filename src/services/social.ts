import { supabase } from '@/lib/supabase'
import type { FollowProfile } from '@/services/follows'

// =============================================================================
// GILLANDEN & KOMMENTARER — sociala lagret ovanpå flödesinläggen.
// post_key = flödets inläggs-id (workout-uuid för cardio, gym-<ägar-id>-
// <datum> för gympass). Synligheten avgörs av RLS: ägaren + godkända
// följare. Notiserna härleds ur tabellerna (gillanden/kommentarer på MINA
// pass) — ingen egen notistabell behövs.
// =============================================================================

export interface PostSocial {
  likes: number
  likedByMe: boolean
  comments: number
}

export interface PostComment {
  id: string
  authorId: string
  authorName: string | null
  authorAvatar: string | null
  body: string
  createdAt: string
}

export interface SocialNotification {
  kind: 'like' | 'comment'
  postKey: string
  from: FollowProfile
  body: string | null    // kommentarens text
  createdAt: string
}

async function ownId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id ?? null
}

/** Namn/avatar för godtyckliga användar-id:n via follow_profiles-RPC:n */
async function resolveProfiles(ids: string[]): Promise<Map<string, FollowProfile>> {
  const unique = Array.from(new Set(ids))
  if (unique.length === 0) return new Map()
  const { data } = await supabase.rpc('follow_profiles', { ids: unique })
  return new Map(((data ?? []) as FollowProfile[]).map(p => [p.id, p]))
}

/** Gillanden + kommentarsantal för en uppsättning inlägg (en fråga per tabell) */
export async function getFeedSocial(postKeys: string[]): Promise<Record<string, PostSocial>> {
  const uid = await ownId()
  if (!uid || postKeys.length === 0) return {}
  const [likesRes, commentsRes] = await Promise.all([
    supabase.from('post_likes').select('post_key, liker_id').in('post_key', postKeys),
    supabase.from('post_comments').select('post_key').in('post_key', postKeys),
  ])
  const result: Record<string, PostSocial> = {}
  for (const key of postKeys) result[key] = { likes: 0, likedByMe: false, comments: 0 }
  for (const row of likesRes.data ?? []) {
    const entry = result[row.post_key as string]
    if (!entry) continue
    entry.likes += 1
    if (row.liker_id === uid) entry.likedByMe = true
  }
  for (const row of commentsRes.data ?? []) {
    const entry = result[row.post_key as string]
    if (entry) entry.comments += 1
  }
  return result
}

/** Vilka som gillat ett inlägg, nyast först — till diskussionssidans avatarrad */
export async function getPostLikers(postKey: string, limit = 12): Promise<FollowProfile[]> {
  const { data } = await supabase
    .from('post_likes')
    .select('liker_id, created_at')
    .eq('post_key', postKey)
    .order('created_at', { ascending: false })
    .limit(limit)
  const ids = (data ?? []).map(r => r.liker_id as string)
  const profiles = await resolveProfiles(ids)
  return ids.map(id => profiles.get(id) ?? { id, name: null, avatar_url: null })
}

export async function likePost(postKey: string, ownerId: string): Promise<void> {
  const uid = await ownId()
  if (!uid) return
  const { error } = await supabase
    .from('post_likes')
    .insert({ post_key: postKey, owner_id: ownerId, liker_id: uid })
  // 23505 = redan gillad (dubbeltryck) — ofarligt
  if (error && error.code !== '23505') throw error
}

export async function unlikePost(postKey: string): Promise<void> {
  const uid = await ownId()
  if (!uid) return
  const { error } = await supabase
    .from('post_likes')
    .delete()
    .eq('post_key', postKey)
    .eq('liker_id', uid)
  if (error) throw error
}

export async function getComments(postKey: string): Promise<PostComment[]> {
  const { data } = await supabase
    .from('post_comments')
    .select('id, author_id, body, created_at')
    .eq('post_key', postKey)
    .order('created_at', { ascending: true })
    .limit(200)
  const rows = data ?? []
  const profiles = await resolveProfiles(rows.map(r => r.author_id as string))
  return rows.map(r => {
    const p = profiles.get(r.author_id as string)
    return {
      id: r.id as string,
      authorId: r.author_id as string,
      authorName: p?.name ?? null,
      authorAvatar: p?.avatar_url ?? null,
      body: r.body as string,
      createdAt: r.created_at as string,
    }
  })
}

export async function addComment(postKey: string, ownerId: string, body: string): Promise<void> {
  const uid = await ownId()
  const trimmed = body.trim()
  if (!uid || trimmed.length === 0) return
  const { error } = await supabase
    .from('post_comments')
    .insert({ post_key: postKey, owner_id: ownerId, author_id: uid, body: trimmed.slice(0, 500) })
  if (error) throw error
}

/** Gillanden och kommentarer på MINA pass, nyast först — till notiscentret */
export async function getSocialNotifications(limit = 30): Promise<SocialNotification[]> {
  const uid = await ownId()
  if (!uid) return []
  const [likesRes, commentsRes] = await Promise.all([
    supabase.from('post_likes')
      .select('post_key, liker_id, created_at')
      .eq('owner_id', uid).neq('liker_id', uid)
      .order('created_at', { ascending: false }).limit(limit),
    supabase.from('post_comments')
      .select('post_key, author_id, body, created_at')
      .eq('owner_id', uid).neq('author_id', uid)
      .order('created_at', { ascending: false }).limit(limit),
  ])
  const likeRows = likesRes.data ?? []
  const commentRows = commentsRes.data ?? []
  const profiles = await resolveProfiles([
    ...likeRows.map(r => r.liker_id as string),
    ...commentRows.map(r => r.author_id as string),
  ])
  const fallback = (id: string): FollowProfile =>
    profiles.get(id) ?? { id, name: null, avatar_url: null }
  const items: SocialNotification[] = [
    ...likeRows.map(r => ({
      kind: 'like' as const,
      postKey: r.post_key as string,
      from: fallback(r.liker_id as string),
      body: null,
      createdAt: r.created_at as string,
    })),
    ...commentRows.map(r => ({
      kind: 'comment' as const,
      postKey: r.post_key as string,
      from: fallback(r.author_id as string),
      body: r.body as string,
      createdAt: r.created_at as string,
    })),
  ]
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
}

/** Antal sociala händelser nyare än en tidpunkt — till notisklockans badge */
export async function getSocialNotificationCount(sinceIso: string | null): Promise<number> {
  const uid = await ownId()
  if (!uid) return 0
  const since = sinceIso ?? '1970-01-01T00:00:00Z'
  const [likes, comments] = await Promise.all([
    supabase.from('post_likes')
      .select('post_key', { count: 'exact', head: true })
      .eq('owner_id', uid).neq('liker_id', uid).gt('created_at', since),
    supabase.from('post_comments')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', uid).neq('author_id', uid).gt('created_at', since),
  ])
  return (likes.count ?? 0) + (comments.count ?? 0)
}

/** Realtid: kör onChange vid nya gillanden/kommentarer på mina pass */
export function subscribeToSocial(userId: string, onChange: () => void): () => void {
  try {
    const channel = supabase
      .channel(`social-${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_likes', filter: `owner_id=eq.${userId}` },
        onChange)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_comments', filter: `owner_id=eq.${userId}` },
        onChange)
      .subscribe()
    return () => { supabase.removeChannel(channel).catch(() => {}) }
  } catch {
    return () => {}
  }
}
