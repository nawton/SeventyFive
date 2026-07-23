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
  /** Ägaren kan stänga av aktivitetsflödet — upprätthålls i get_group_feed */
  show_feed: boolean
  /** Veckans topplista på gruppsidan */
  show_leaderboard: boolean
  /** Avstängt = bara ägaren får bjuda in — upprätthålls i RLS */
  allow_member_invites: boolean
  /** Dold: syns inte i sökningen, nås via QR-kod/inbjudan (RLS) */
  hidden: boolean
  /** Bara ägaren får skriva inlägg — upprätthålls i RLS */
  only_owner_posts: boolean
  created_at: string
}

export type GroupNotifyLevel = 'all' | 'owner' | 'off'

export interface GroupMember {
  id: string
  name: string | null
  avatar_url: string | null
  role: 'owner' | 'member'
  status: 'pending' | 'accepted' | 'invited' | 'banned'
  /** Egen notisnivå för gruppens inlägg (bara meningsfull på egna raden) */
  notifyPosts: GroupNotifyLevel
}

type MiniProfile = { id: string; name: string | null; avatar_url: string | null }

export interface GroupNotification {
  kind: 'invite' | 'request'
  group: Group
  /** invite: vem som bjöd in; request: vem som vill gå med */
  from: MiniProfile | null
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

/** Ägarens snabbinställningar — RLS släpper bara igenom ägaren */
export async function updateGroupSettings(
  groupId: string,
  patch: Partial<Pick<Group, 'is_private' | 'show_feed' | 'show_leaderboard' | 'allow_member_invites' | 'hidden' | 'only_owner_posts'>>,
): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .update(patch)
    .eq('id', groupId)
    .select()
    .single()
  if (error) throw error
  return data as Group
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

/** Uppslag via id (QR/djuplänk) — definer-RPC:n hittar även dolda grupper */
export async function getGroup(groupId: string): Promise<Group | null> {
  const { data } = await supabase.rpc('get_group_by_id', { gid: groupId })
  const row = Array.isArray(data) ? data[0] : data
  return (row as Group) ?? null
}

/** Medlemmar med namn/avatar via follow_profiles-RPC:n (profiles-RLS är egna rader) */
export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('user_id, role, status, notify_posts')
    .eq('group_id', groupId)
  if (error || !data || data.length === 0) return []
  const ids = data.map(m => m.user_id)
  const { data: profiles } = await supabase.rpc('follow_profiles', { ids })
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
      notifyPosts: (m.notify_posts ?? 'all') as GroupNotifyLevel,
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

/** Bjud in flera på en gång via definer-RPC:n: den som redan väntar på
    godkännande blir medlem direkt (inbjudan ÄR ett ja), spärrade och
    befintliga medlemmar hoppas över tyst. */
export async function inviteToGroup(groupId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return
  const { error } = await supabase.rpc('invite_to_group', { gid: groupId, uids: userIds })
  if (error) throw error
}

/** Notiscentrets grupprader: inbjudningar till mig + förfrågningar till
    grupper jag skapat. Pushnotisen pekar hit. */
export async function getGroupNotifications(userId: string): Promise<GroupNotification[]> {
  const [invitesRes, ownedRes] = await Promise.all([
    supabase.from('group_members')
      .select('invited_by, groups(*)')
      .eq('user_id', userId)
      .eq('status', 'invited'),
    supabase.from('groups').select('*').eq('owner_id', userId),
  ])
  const owned = (ownedRes.data ?? []) as Group[]
  let pendings: Array<{ group_id: string; user_id: string }> = []
  if (owned.length > 0) {
    const { data } = await supabase.from('group_members')
      .select('group_id, user_id')
      .in('group_id', owned.map(g => g.id))
      .eq('status', 'pending')
    pendings = data ?? []
  }
  const invites = (invitesRes.data ?? []).filter(r => r.groups)
  const profileIds = Array.from(new Set([
    ...invites.map(r => r.invited_by as string | null).filter((v): v is string => !!v),
    ...pendings.map(p => p.user_id),
  ]))
  const byId = new Map<string, MiniProfile>()
  if (profileIds.length > 0) {
    const { data } = await supabase.rpc('follow_profiles', { ids: profileIds })
    for (const p of ((data ?? []) as MiniProfile[])) byId.set(p.id, p)
  }
  return [
    ...pendings.map(p => ({
      kind: 'request' as const,
      group: owned.find(g => g.id === p.group_id)!,
      from: byId.get(p.user_id) ?? { id: p.user_id, name: null, avatar_url: null },
    })),
    ...invites.map(r => ({
      kind: 'invite' as const,
      group: r.groups as unknown as Group,
      from: r.invited_by ? byId.get(r.invited_by as string) ?? null : null,
    })),
  ]
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

/** Spärra: raden blir kvar som 'banned' och blockerar återinträde.
    Ägaren tar bort spärren genom att radera raden (removeMember). */
export async function banMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .update({ status: 'banned', role: 'member' })
    .eq('group_id', groupId)
    .eq('user_id', userId)
  if (error) throw error
}

export interface GroupLeaderboardRow {
  user_id: string
  km: number
  cardio_passes: number
  gym_days: number
}

/** Veckotopplistan summeras i databasen — hela perioden, inte bara
    flödessidans senaste rader */
export async function getGroupLeaderboard(groupId: string, sinceIso: string): Promise<GroupLeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_group_leaderboard', {
    gid: groupId,
    since: sinceIso,
  })
  if (error || !data) return []
  return (data as Array<Record<string, unknown>>).map(r => ({
    user_id: String(r.user_id),
    km: Number(r.km ?? 0),
    cardio_passes: Number(r.cardio_passes ?? 0),
    gym_days: Number(r.gym_days ?? 0),
  }))
}

/** Antalet grupphändelser som väntar på svar — till klock-badgen och
    hemskärmens pulsrad */
export async function getGroupNotificationCount(userId: string): Promise<number> {
  const [inv, owned] = await Promise.all([
    supabase.from('group_members')
      .select('group_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'invited'),
    supabase.from('groups').select('id').eq('owner_id', userId),
  ])
  let pending = 0
  const ids = ((owned.data ?? []) as Array<{ id: string }>).map(g => g.id)
  if (ids.length > 0) {
    const { count } = await supabase.from('group_members')
      .select('group_id', { count: 'exact', head: true })
      .in('group_id', ids)
      .eq('status', 'pending')
    pending = count ?? 0
  }
  return (inv.count ?? 0) + pending
}

/** Överlåt gruppen till en accepterad medlem — RPC:n byter ägare och roller i ett svep */
export async function transferGroupOwnership(groupId: string, newOwnerId: string): Promise<void> {
  const { error } = await supabase.rpc('transfer_group_ownership', {
    gid: groupId,
    new_owner: newOwnerId,
  })
  if (error) throw error
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('groups').delete().eq('id', groupId)
  if (error) throw error
}

// ── Gruppinlägg ──────────────────────────────────────────────────────────────

export interface GroupPost {
  id: string
  group_id: string
  author_id: string
  body: string
  /** Bild i inlägget, uppladdad före insert */
  image_url: string | null
  /** Svar på ett annat inlägg — visas indraget under föräldern */
  reply_to: string | null
  created_at: string
  authorName: string | null
  authorAvatar: string | null
}

/** Senaste inläggen, nyast först. Namn via follow_profiles-RPC:n så även
    ex-medlemmars gamla inlägg får rätt avsändare. */
export async function getGroupPosts(groupId: string, limit = 50): Promise<GroupPost[]> {
  const { data, error } = await supabase
    .from('group_posts')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data || data.length === 0) return []
  const ids = Array.from(new Set(data.map(p => p.author_id as string)))
  const { data: profiles } = await supabase.rpc('follow_profiles', { ids })
  const byId = new Map<string, MiniProfile>(
    ((profiles ?? []) as MiniProfile[]).map(p => [p.id, p]))
  return data.map(p => ({
    id: p.id as string,
    group_id: p.group_id as string,
    author_id: p.author_id as string,
    body: p.body as string,
    image_url: (p.image_url as string | null) ?? null,
    reply_to: (p.reply_to as string | null) ?? null,
    created_at: p.created_at as string,
    authorName: byId.get(p.author_id as string)?.name ?? null,
    authorAvatar: byId.get(p.author_id as string)?.avatar_url ?? null,
  }))
}

export async function createGroupPost(
  groupId: string,
  body: string,
  opts: { replyTo?: string | null; imageUri?: string | null } = {},
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('inte inloggad')
  let imageUrl: string | null = null
  if (opts.imageUri) {
    const path = `posts/${session.user.id}-${Date.now()}.jpg`
    await uploadImage('avatars', path, opts.imageUri)
    imageUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  }
  const { error } = await supabase.from('group_posts').insert({
    group_id: groupId,
    author_id: session.user.id,
    body: body.trim(),
    reply_to: opts.replyTo ?? null,
    image_url: imageUrl,
  })
  if (error) throw error
}

/** Författaren eller gruppens ägare — RLS avgör */
export async function deleteGroupPost(postId: string): Promise<void> {
  const { error } = await supabase.from('group_posts').delete().eq('id', postId)
  if (error) throw error
}

/** Egen notisnivå för gruppens inlägg — via definer-RPC:n */
export async function setGroupNotify(groupId: string, level: GroupNotifyLevel): Promise<void> {
  const { error } = await supabase.rpc('set_group_notify', { gid: groupId, level })
  if (error) throw error
}
