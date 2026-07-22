import { supabase } from '@/lib/supabase'
import type { FollowProfile } from '@/services/follows'

// =============================================================================
// BLOCKERINGAR — att blockera någon raderar följen åt båda håll
// (databastrigger), stoppar nya förfrågningar och döljer er för varandra
// i sökningen. Den blockerade får ingen notis och kan inte se att den
// är blockerad.
// =============================================================================

async function ownId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id ?? null
}

export async function blockUser(targetId: string): Promise<void> {
  const uid = await ownId()
  if (!uid || uid === targetId) return
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: uid, blocked_id: targetId })
  // 23505 = redan blockerad — ofarligt
  if (error && error.code !== '23505') throw error
}

export async function unblockUser(targetId: string): Promise<void> {
  const uid = await ownId()
  if (!uid) return
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', uid)
    .eq('blocked_id', targetId)
  if (error) throw error
}

/** Alla jag blockerat, med namn/avatar — till listan i integritets-
    inställningarna */
export async function getBlockedUsers(): Promise<FollowProfile[]> {
  const uid = await ownId()
  if (!uid) return []
  const { data } = await supabase
    .from('blocks')
    .select('blocked_id, created_at')
    .eq('blocker_id', uid)
    .order('created_at', { ascending: false })
  const ids = (data ?? []).map(r => r.blocked_id as string)
  if (ids.length === 0) return []
  const { data: profiles } = await supabase.rpc('follow_profiles', { ids })
  const byId = new Map<string, FollowProfile>(
    ((profiles ?? []) as FollowProfile[]).map(p => [p.id, p]))
  return ids.map(id => byId.get(id) ?? { id, name: null, avatar_url: null })
}

/** Har JAG blockerat personen? (Motsatt riktning är osynlig by design) */
export async function isBlocked(targetId: string): Promise<boolean> {
  const uid = await ownId()
  if (!uid) return false
  const { data } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', uid)
    .eq('blocked_id', targetId)
    .maybeSingle()
  return !!data
}
