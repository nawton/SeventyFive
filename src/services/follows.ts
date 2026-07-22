import { supabase } from '@/lib/supabase'

// =============================================================================
// FÖLJ-SYSTEMET — vänförfrågningar i follows-tabellen: ett följe börjar
// som 'pending' och godkänns av mottagaren; först då låser databasen upp
// personens pass (statistiken). Skärmarna uppdaterar optimistiskt vid
// egna följ/avfölj och prenumererar på realtidsändringar för att fånga
// andras (ingen omladdning ska behövas).
// =============================================================================

export type FollowStatus = 'none' | 'pending' | 'accepted'

export interface FollowProfile {
  id: string
  name: string | null
  avatar_url: string | null
}

export interface FollowCounts {
  followers: number
  following: number
}

async function ownId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id ?? null
}

export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const [followers, following] = await Promise.all([
    supabase.from('follows').select('follower_id', { count: 'exact', head: true })
      .eq('followee_id', userId).eq('status', 'accepted'),
    supabase.from('follows').select('followee_id', { count: 'exact', head: true })
      .eq('follower_id', userId).eq('status', 'accepted'),
  ])
  return { followers: followers.count ?? 0, following: following.count ?? 0 }
}

/** Min relation till en annan användare: ingen, väntande eller godkänd */
export async function getFollowStatus(targetId: string): Promise<FollowStatus> {
  const uid = await ownId()
  if (!uid) return 'none'
  const { data } = await supabase
    .from('follows')
    .select('status')
    .eq('follower_id', uid)
    .eq('followee_id', targetId)
    .maybeSingle()
  return (data?.status as FollowStatus | undefined) ?? 'none'
}

/** Skickar en vänförfrågan — hamnar som 'pending' tills mottagaren godkänner */
export async function follow(targetId: string): Promise<void> {
  const uid = await ownId()
  if (!uid || uid === targetId) return   // man kan inte följa sig själv
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: uid, followee_id: targetId })
  // 23505 = redan skickad (dubbeltryck) — ofarligt
  if (error && error.code !== '23505') throw error
}

/** Mottagaren godkänner en väntande förfrågan */
export async function acceptFollower(followerId: string): Promise<void> {
  const uid = await ownId()
  if (!uid) return
  const { error } = await supabase
    .from('follows')
    .update({ status: 'accepted' })
    .eq('follower_id', followerId)
    .eq('followee_id', uid)
  if (error) throw error
}

/** Mottagaren avböjer en förfrågan (eller tar bort en följare) */
export async function declineFollower(followerId: string): Promise<void> {
  const uid = await ownId()
  if (!uid) return
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followee_id', uid)
  if (error) throw error
}

/** Antal väntande förfrågningar — till notisklockans badge */
export async function getIncomingRequestCount(): Promise<number> {
  const uid = await ownId()
  if (!uid) return 0
  const { count } = await supabase
    .from('follows')
    .select('follower_id', { count: 'exact', head: true })
    .eq('followee_id', uid)
    .eq('status', 'pending')
  return count ?? 0
}

/** Inkommande väntande förfrågningar med namn/avatar — till notiscentret */
export async function getIncomingRequests(): Promise<FollowProfile[]> {
  const uid = await ownId()
  if (!uid) return []
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('followee_id', uid)
    .eq('status', 'pending')
  const ids = (data ?? []).map(r => r.follower_id as string)
  if (ids.length === 0) return []
  const { data: profiles } = await supabase.rpc('follow_profiles', { ids })
  const byId = new Map<string, FollowProfile>(
    ((profiles ?? []) as FollowProfile[]).map(p => [p.id, p]))
  return ids.map(id => byId.get(id) ?? { id, name: null, avatar_url: null })
}

export async function unfollow(targetId: string): Promise<void> {
  const uid = await ownId()
  if (!uid) return
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', uid)
    .eq('followee_id', targetId)
  if (error) throw error
}

/** Följare- och följer-listorna med namn/avatar (via follow_profiles-RPC:n) */
export async function getFollowLists(userId: string): Promise<{
  followers: FollowProfile[]; following: FollowProfile[]
}> {
  const [fRes, gRes] = await Promise.all([
    supabase.from('follows').select('follower_id').eq('followee_id', userId).eq('status', 'accepted'),
    supabase.from('follows').select('followee_id').eq('follower_id', userId).eq('status', 'accepted'),
  ])
  const followerIds  = (fRes.data ?? []).map(r => r.follower_id as string)
  const followingIds = (gRes.data ?? []).map(r => r.followee_id as string)
  const ids = Array.from(new Set([...followerIds, ...followingIds]))
  if (ids.length === 0) return { followers: [], following: [] }

  const { data } = await supabase.rpc('follow_profiles', { ids })
  const byId = new Map<string, FollowProfile>(
    ((data ?? []) as FollowProfile[]).map(p => [p.id, p]))
  const pick = (list: string[]) =>
    list.map(id => byId.get(id) ?? { id, name: null, avatar_url: null })
  return { followers: pick(followerIds), following: pick(followingIds) }
}

/** Realtid: kör onChange när följgrafen ändras för användaren (som följare
    eller följd). Returnerar en upprensningsfunktion. */
export function subscribeToFollows(userId: string, onChange: () => void): () => void {
  try {
    const channel = supabase
      .channel(`follows-${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `followee_id=eq.${userId}` },
        onChange)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${userId}` },
        onChange)
      .subscribe()
    return () => { supabase.removeChannel(channel).catch(() => {}) }
  } catch {
    // Realtid är trevligt men aldrig kritiskt — skärmarna laddar om vid fokus
    return () => {}
  }
}
