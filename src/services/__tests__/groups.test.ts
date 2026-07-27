import {
  createGroup, updateGroup, getMyGroups, updateGroupSettings, searchGroups,
  getGroup, getGroupMembers, joinGroup, inviteToGroup, getGroupNotifications,
  acceptGroupInvite, leaveGroup, removeMember, approveMember, banMember,
  getGroupLeaderboard, getGroupNotificationCount, transferGroupOwnership,
  deleteGroup, getGroupPosts, createGroupPost, deleteGroupPost,
  setGroupPostPinned, setGroupNotify,
  type CreateGroupInput, type Group,
} from '../groups'
import { supabase } from '@/lib/supabase'
import { uploadImage } from '@/lib/storage'
import { installTables, argsOf } from '@/testUtils/supabaseChain'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: { getSession: jest.fn() },
    storage: { from: jest.fn() },
  },
}))
jest.mock('@/lib/storage', () => ({ uploadImage: jest.fn().mockResolvedValue(undefined) }))

const fromMock = supabase.from as jest.Mock
const rpcMock = supabase.rpc as jest.Mock

const INPUT: CreateGroupInput = {
  name: '  Team Sthlm  ',
  description: ' Vi kör. ',
  sport: 'all',
  tags: ['Löpning'],
  isPrivate: false,
  location: '  Stockholm ',
  imageUri: null,
}

const GROUP = { id: 'g1', owner_id: 'u1', name: 'Team Sthlm' } as unknown as Group

function signIn(uid: string | null) {
  ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: uid ? { user: { id: uid } } : null },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  signIn('u1')
  rpcMock.mockResolvedValue({ data: [], error: null })
  ;(supabase.storage.from as jest.Mock).mockReturnValue({
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${path}` } }),
  })
})

describe('createGroup', () => {
  it('trimmar fälten och skapar utan bild', async () => {
    const calls = installTables(fromMock, { groups: { data: GROUP, error: null } })
    const group = await createGroup('u1', INPUT)
    expect(group).toEqual(GROUP)
    expect(argsOf(calls, 'groups', 'insert')[0][0]).toEqual({
      owner_id: 'u1', name: 'Team Sthlm', description: 'Vi kör.',
      avatar_url: null, sport: 'all', tags: ['Löpning'],
      is_private: false, location: 'Stockholm',
    })
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('laddar upp vald bild och tolkar tom plats som Global', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000)
    const calls = installTables(fromMock, { groups: { data: GROUP, error: null } })
    await createGroup('u1', { ...INPUT, imageUri: 'file:///a.jpg', location: '  ' })
    expect(uploadImage).toHaveBeenCalledWith('avatars', 'groups/u1-1700000000000.jpg', 'file:///a.jpg')
    const row = argsOf(calls, 'groups', 'insert')[0][0] as { avatar_url: string; location: null }
    expect(row.avatar_url).toBe('https://cdn/groups/u1-1700000000000.jpg')
    expect(row.location).toBeNull()
  })

  it('kastar databasfel vidare', async () => {
    installTables(fromMock, { groups: { data: null, error: { message: 'nej' } } })
    await expect(createGroup('u1', INPUT)).rejects.toBeTruthy()
  })
})

describe('updateGroup', () => {
  it('behåller gamla bilden när ingen ny valts', async () => {
    const calls = installTables(fromMock, { groups: { data: GROUP, error: null } })
    await updateGroup('u1', 'g1', INPUT)
    const patch = argsOf(calls, 'groups', 'update')[0][0] as Record<string, unknown>
    expect(patch.avatar_url).toBeUndefined()
    expect(argsOf(calls, 'groups', 'eq')[0]).toEqual(['id', 'g1'])
  })

  it('ny bild laddas upp och läggs i uppdateringen', async () => {
    const calls = installTables(fromMock, { groups: { data: GROUP, error: null } })
    await updateGroup('u1', 'g1', { ...INPUT, imageUri: 'file:///ny.jpg' })
    const patch = argsOf(calls, 'groups', 'update')[0][0] as Record<string, unknown>
    expect(String(patch.avatar_url)).toContain('https://cdn/groups/u1-')
  })
})

describe('getMyGroups', () => {
  it('mappar medlemskap med status och medlemsantal', async () => {
    installTables(fromMock, {
      group_members: [
        { data: [
          { status: 'accepted', groups: { id: 'g1', name: 'A' } },
          { status: 'pending', groups: { id: 'g2', name: 'B' } },
          { status: 'accepted', groups: null },   // raderad grupp filtreras bort
        ] },
        { count: 3 },
        { count: 8 },
      ],
    })
    const groups = await getMyGroups('u1')
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ id: 'g1', myStatus: 'accepted', memberCount: 3 })
    expect(groups[1]).toMatchObject({ id: 'g2', myStatus: 'pending', memberCount: 8 })
  })

  it('tom lista vid fel', async () => {
    installTables(fromMock, { group_members: { data: null, error: { message: 'x' } } })
    expect(await getMyGroups('u1')).toEqual([])
  })
})

describe('updateGroupSettings', () => {
  it('skickar bara de fält som ändras', async () => {
    const calls = installTables(fromMock, { groups: { data: GROUP, error: null } })
    await updateGroupSettings('g1', { hidden: true, only_owner_pins: false })
    expect(argsOf(calls, 'groups', 'update')[0][0]).toEqual({ hidden: true, only_owner_pins: false })
  })
})

describe('searchGroups', () => {
  it('kräver minst två tecken och escapar jokertecken', async () => {
    expect(await searchGroups(' a ')).toEqual([])
    expect(fromMock).not.toHaveBeenCalled()

    const calls = installTables(fromMock, {
      groups: { data: [GROUP] },
      group_members: { count: 4 },
    })
    const hits = await searchGroups('te%_am')
    expect(argsOf(calls, 'groups', 'ilike')[0]).toEqual(['name', '%te\\%\\_am%'])
    expect(hits[0].memberCount).toBe(4)
  })
})

describe('getGroup', () => {
  it('tar första raden ur RPC-svaret oavsett form', async () => {
    rpcMock.mockResolvedValue({ data: [GROUP] })
    expect(await getGroup('g1')).toEqual(GROUP)
    rpcMock.mockResolvedValue({ data: GROUP })
    expect(await getGroup('g1')).toEqual(GROUP)
    rpcMock.mockResolvedValue({ data: null })
    expect(await getGroup('g1')).toBeNull()
    expect(rpcMock).toHaveBeenCalledWith('get_group_by_id', { gid: 'g1' })
  })
})

describe('getGroupMembers', () => {
  it('slår upp profiler, ägaren sorteras först och notisnivån får standard', async () => {
    installTables(fromMock, {
      group_members: { data: [
        { user_id: 'u2', role: 'member', status: 'accepted', notify_posts: 'off' },
        { user_id: 'u1', role: 'owner', status: 'accepted', notify_posts: null },
      ] },
    })
    rpcMock.mockResolvedValue({ data: [{ id: 'u1', name: 'Elin', avatar_url: null }] })
    const members = await getGroupMembers('g1')
    expect(members[0]).toMatchObject({ id: 'u1', role: 'owner', name: 'Elin', notifyPosts: 'all' })
    expect(members[1]).toMatchObject({ id: 'u2', name: null, notifyPosts: 'off' })
  })

  it('tom grupp ger tom lista utan profiluppslag', async () => {
    installTables(fromMock, { group_members: { data: [] } })
    expect(await getGroupMembers('g1')).toEqual([])
    expect(rpcMock).not.toHaveBeenCalled()
  })
})

describe('medlemskap', () => {
  it('joinGroup: offentlig grupp accepteras direkt, privat blir förfrågan', async () => {
    const calls = installTables(fromMock, { group_members: { error: null } })
    await joinGroup('g1', 'u1', false)
    await joinGroup('g1', 'u1', true)
    const inserts = argsOf(calls, 'group_members', 'insert')
      .concat(argsOf(calls, 'group_members', 'insert', 1))
    expect(inserts[0][0]).toMatchObject({ status: 'accepted' })
    expect(inserts[1][0]).toMatchObject({ status: 'pending' })
  })

  it('inviteToGroup går via RPC och hoppar över tomma listor', async () => {
    await inviteToGroup('g1', [])
    expect(rpcMock).not.toHaveBeenCalled()
    await inviteToGroup('g1', ['u2', 'u3'])
    expect(rpcMock).toHaveBeenCalledWith('invite_to_group', { gid: 'g1', uids: ['u2', 'u3'] })
    rpcMock.mockResolvedValue({ error: { message: 'stopp' } })
    await expect(inviteToGroup('g1', ['u2'])).rejects.toBeTruthy()
  })

  it('accept/leave/approve/ban träffar rätt rader', async () => {
    await acceptGroupInvite('g1')
    expect(rpcMock).toHaveBeenCalledWith('accept_group_invite', { gid: 'g1' })

    let calls = installTables(fromMock, { group_members: { error: null } })
    await leaveGroup('g1', 'u2')
    expect(argsOf(calls, 'group_members', 'eq')).toEqual([['group_id', 'g1'], ['user_id', 'u2']])

    calls = installTables(fromMock, { group_members: { error: null } })
    await approveMember('g1', 'u2')
    expect(argsOf(calls, 'group_members', 'update')[0][0]).toEqual({ status: 'accepted' })

    calls = installTables(fromMock, { group_members: { error: null } })
    await banMember('g1', 'u2')
    expect(argsOf(calls, 'group_members', 'update')[0][0]).toEqual({ status: 'banned', role: 'member' })

    calls = installTables(fromMock, { group_members: { error: null } })
    await removeMember('g1', 'u2')
    expect(argsOf(calls, 'group_members', 'delete')).toHaveLength(1)
  })
})

describe('getGroupNotifications', () => {
  it('samlar förfrågningar till mina grupper och inbjudningar till mig', async () => {
    installTables(fromMock, {
      group_members: [
        { data: [{ invited_by: 'u5', groups: { id: 'g9', name: 'Inbjuden' } }] },   // invited till mig
        { data: [{ group_id: 'g1', user_id: 'u7' }] },                              // pending i min grupp
      ],
      groups: { data: [{ ...GROUP, id: 'g1' }] },
    })
    rpcMock.mockResolvedValue({ data: [{ id: 'u5', name: 'Hugo', avatar_url: null }] })
    const items = await getGroupNotifications('u1')
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ kind: 'request', from: { id: 'u7', name: null } })
    expect(items[0].group.id).toBe('g1')
    expect(items[1]).toMatchObject({ kind: 'invite', from: { id: 'u5', name: 'Hugo' } })
  })
})

describe('topplista och räknare', () => {
  it('getGroupLeaderboard normaliserar RPC-raderna', async () => {
    rpcMock.mockResolvedValue({ data: [
      { user_id: 'u1', km: '12.5', cardio_passes: 3, gym_days: null },
    ] })
    const rows = await getGroupLeaderboard('g1', '2026-07-21')
    expect(rows[0]).toEqual({ user_id: 'u1', km: 12.5, cardio_passes: 3, gym_days: 0 })
    rpcMock.mockResolvedValue({ data: null, error: { message: 'x' } })
    expect(await getGroupLeaderboard('g1', '2026-07-21')).toEqual([])
  })

  it('getGroupNotificationCount summerar inbjudningar och förfrågningar', async () => {
    installTables(fromMock, {
      group_members: [{ count: 2 }, { count: 3 }],
      groups: { data: [{ id: 'g1' }] },
    })
    expect(await getGroupNotificationCount('u1')).toBe(5)
  })

  it('utan egna grupper räknas bara inbjudningarna', async () => {
    installTables(fromMock, {
      group_members: { count: 1 },
      groups: { data: [] },
    })
    expect(await getGroupNotificationCount('u1')).toBe(1)
  })
})

describe('ägarskap och radering', () => {
  it('transferGroupOwnership och deleteGroup', async () => {
    await transferGroupOwnership('g1', 'u2')
    expect(rpcMock).toHaveBeenCalledWith('transfer_group_ownership', { gid: 'g1', new_owner: 'u2' })

    const calls = installTables(fromMock, { groups: { error: null } })
    await deleteGroup('g1')
    expect(argsOf(calls, 'groups', 'eq')[0]).toEqual(['id', 'g1'])
  })
})

describe('gruppinlägg', () => {
  it('getGroupPosts mappar rader med författarprofil och standardvärden', async () => {
    installTables(fromMock, {
      group_posts: { data: [
        { id: 'p1', group_id: 'g1', author_id: 'u2', body: 'Hej', image_url: undefined, reply_to: undefined, pinned: 1, created_at: 't1' },
      ] },
    })
    rpcMock.mockResolvedValue({ data: [{ id: 'u2', name: 'Hugo', avatar_url: 'h.png' }] })
    const posts = await getGroupPosts('g1')
    expect(posts[0]).toEqual({
      id: 'p1', group_id: 'g1', author_id: 'u2', body: 'Hej',
      image_url: null, reply_to: null, pinned: true, created_at: 't1',
      authorName: 'Hugo', authorAvatar: 'h.png',
    })
  })

  it('tomt flöde slår inte upp profiler', async () => {
    installTables(fromMock, { group_posts: { data: [] } })
    expect(await getGroupPosts('g1')).toEqual([])
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('createGroupPost trimmar, hanterar svar och bild, och kräver inloggning', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000)
    const calls = installTables(fromMock, { group_posts: { error: null } })
    await createGroupPost('g1', '  Hej gruppen  ', { replyTo: 'p9', imageUri: 'file:///b.jpg' })
    expect(uploadImage).toHaveBeenCalledWith('avatars', 'posts/u1-1700000000000.jpg', 'file:///b.jpg')
    expect(argsOf(calls, 'group_posts', 'insert')[0][0]).toEqual({
      group_id: 'g1', author_id: 'u1', body: 'Hej gruppen',
      reply_to: 'p9', image_url: 'https://cdn/posts/u1-1700000000000.jpg',
    })

    signIn(null)
    await expect(createGroupPost('g1', 'Hej')).rejects.toThrow('inte inloggad')
  })

  it('radering, fästning och notisnivå', async () => {
    const calls = installTables(fromMock, { group_posts: { error: null } })
    await deleteGroupPost('p1')
    expect(argsOf(calls, 'group_posts', 'eq')[0]).toEqual(['id', 'p1'])

    await setGroupPostPinned('p1', true)
    expect(rpcMock).toHaveBeenCalledWith('set_group_post_pinned', { pid: 'p1', is_pinned: true })

    await setGroupNotify('g1', 'owner')
    expect(rpcMock).toHaveBeenCalledWith('set_group_notify', { gid: 'g1', level: 'owner' })
  })
})
