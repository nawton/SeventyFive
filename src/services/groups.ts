import { supabase } from '@/lib/supabase'
import { uploadImage } from '@/lib/storage'

// =============================================================================
// GRUPPER — skapas via guiden i communityt. Reglerna bor i databasen:
// ägaren blir medlem via trigger, privata grupper ger pending-medlemskap
// som bara ägaren kan godkänna (RLS), offentliga accepteras direkt.
// =============================================================================

export type GroupSport = 'all' | 'running' | 'cycling' | 'walking' | 'gym'

export interface Group {
  id: string
  owner_id: string
  name: string
  description: string
  avatar_url: string | null
  sport: GroupSport
  tags: string[]
  is_private: boolean
  location: string | null
  created_at: string
}

export interface GroupMember {
  id: string
  name: string | null
  avatar_url: string | null
  role: 'owner' | 'member'
  status: 'pending' | 'accepted' | 'invited'
}

export interface CreateGroupInput {
  name: string
  description: string
  sport: GroupSport
  tags: string[]
  isPrivate: boolean
  /** null = Global */
  location: string | null
  /** Lokal bild-URI från väljaren — laddas upp före insert */
  imageUri: string | null
}

export async function createGroup(userId: string, input: CreateGroupInput): Promise<Group> {
  let avatarUrl: string | null = null
  if (input.imageUri) {
    const path = `groups/${userId}-${Date.now()}.jpg`
    await uploadImage('avatars', path, input.imageUri)
    avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  }
  const { data, error } = await supabase
    .from('groups')
    .insert({
      owner_id: userId,
      name: input.name.trim(),
      description: input.description.trim(),
      avatar_url: avatarUrl,
      sport: input.sport,
      tags: input.tags,
      is_private: input.isPrivate,
      location: input.location?.trim() || null,
    })
    .select()
    .single()
  if (error) throw error
  return data as Group
}

/** Ägaren uppdaterar gruppen (RLS). Ny bild laddas upp, annars behålls den gamla */
export async function updateGroup(userId: string, groupId: string, input: CreateGroupInput): Promise<Group> {
  let avatarUrl: string | undefined
  if (input.imageUri) {
    const path = `groups/${userId}-${Date.now()}.jpg`
    await uploadImage('avatars', path, input.imageUri)
    avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  }
  const { data, error } = await supabase
    .from('groups')
    .update({
      name: input.name.trim(),
      description: input.description.trim(),
      sport: input.sport,
      tags: input.tags,
      is_private: input.isPrivate,
      location: input.location?.trim() || null,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    })
    .eq('id', groupId)
    .select()
    .single()
  if (error) throw error
  return data as Group
}

/** Grupper jag är medlem i (inkl. väntande förfrågningar jag skickat) */
export async function getMyGroups(userId: string): Promise<Array<Group & { memberCount: number; myStatus: string }>> {
  const { data, error } = await supabase
    .from('group_members')
    .select('status, groups(*)')
    .eq('user_id', userId)
  if (error || !data) return []
  const rows = data
    .filter(r => r.groups)
    .map(r => ({ ...(r.groups as unknown as Group), myStatus: r.status as string }))

  const counts = await Promise.all(rows.map(async g => {
    const { count } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', g.id)
      .eq('status', 'accepted')
    return count ?? 0
  }))
  return rows.map((g, i) => ({ ...g, memberCount: counts[i] }))
}

/** Sök bland alla grupper på namn — upptäcktsvägen utöver QR och inbjudan */
export async function searchGroups(query: string): Promise<Array<Group & { memberCount: number }>> {
  const q = query.trim().replace(/[%_]/g, m => `\\${m}`)
  if (q.length < 2) return []
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .ilike('name', `%${q}%`)
    .order('created_at', { ascending: false })
    .limit(25)
  if (error || !data) return []
  const rows = data as Group[]
  const counts = await Promise.all(rows.map(async g => {
    const { count } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', g.id)
      .eq('status', 'accepted')
    return count ?? 0
  }))
  return rows.map((g, i) => ({ ...g, memberCount: counts[i] }))
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const { data } = await supabase.from('groups').select('*').eq('id', groupId).maybeSingle()
  return (data as Group) ?? null
}

/** Medlemmar med namn/avatar via follow_profiles-RPC:n (profiles-RLS är egna rader) */
export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('user_id, role, status')
    .eq('group_id', groupId)
  if (error || !data || data.length === 0) return []
  const ids = data.map(m => m.user_id)
  const { data: profiles } = await supabase.rpc('follow_profiles', { ids })
  type MiniProfile = { id: string; name: string | null; avatar_url: string | null }
  const byId = new Map<string, MiniProfile>(
    ((profiles ?? []) as MiniProfile[]).map(p => [p.id, p]))
  return data.map(m => {
    const p = byId.get(m.user_id)
    return {
      id: m.user_id,
      name: p?.name ?? null,
      avatar_url: p?.avatar_url ?? null,
      role: m.role as GroupMember['role'],
      status: m.status as GroupMember['status'],
    }
  }).sort((a, b) => (a.role === 'owner' ? -1 : 0) - (b.role === 'owner' ? -1 : 0))
}

/** Offentlig grupp → medlem direkt; privat → förfrågan (RLS upprätthåller) */
export async function joinGroup(groupId: string, userId: string, isPrivate: boolean): Promise<void> {
  const { error } = await supabase.from('group_members').insert({
    group_id: groupId,
    user_id: userId,
    role: 'member',
    status: isPrivate ? 'pending' : 'accepted',
  })
  if (error) throw error
}

/** Bjud in flera på en gång — de som redan är med hoppas över tyst */
export async function inviteToGroup(groupId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return
  const rows = userIds.map(id => ({
    group_id: groupId, user_id: id, role: 'member', status: 'invited',
  }))
  const { error } = await supabase
    .from('group_members')
    .upsert(rows, { onConflict: 'group_id,user_id', ignoreDuplicates: true })
  if (error) throw error
}

/** Tacka ja till en inbjudan — definer-RPC:n rör bara den egna raden */
export async function acceptGroupInvite(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_group_invite', { gid: groupId })
  if (error) throw error
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function approveMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .update({ status: 'accepted' })
    .eq('group_id', groupId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
  return leaveGroup(groupId, userId)
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('groups').delete().eq('id', groupId)
  if (error) throw error
}
