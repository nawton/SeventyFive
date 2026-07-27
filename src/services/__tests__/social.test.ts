import {
  getFeedSocial, getPostLikers, likePost, unlikePost,
  getComments, likeComment, unlikeComment, addComment, deleteComment,
  getSocialNotifications, getSocialNotificationCount, subscribeToSocial,
} from '../social'
import { supabase } from '@/lib/supabase'
import { installTables, installChannel, argsOf } from '@/testUtils/supabaseChain'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: { getSession: jest.fn() },
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}))

const fromMock = supabase.from as jest.Mock
const rpcMock = supabase.rpc as jest.Mock

function signIn(uid: string | null) {
  ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: uid ? { user: { id: uid } } : null },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  signIn('u1')
  rpcMock.mockResolvedValue({ data: [] })
})

describe('getFeedSocial', () => {
  it('räknar gillanden, kommentarer och min egen markering per inlägg', async () => {
    installTables(fromMock, {
      post_likes: { data: [
        { post_key: 'a', liker_id: 'u2' },
        { post_key: 'a', liker_id: 'u1' },
        { post_key: 'okänd', liker_id: 'u9' },   // inlägg utanför listan ignoreras
      ] },
      post_comments: { data: [{ post_key: 'a' }, { post_key: 'b' }] },
    })
    const result = await getFeedSocial(['a', 'b'])
    expect(result.a).toEqual({ likes: 2, likedByMe: true, comments: 1 })
    expect(result.b).toEqual({ likes: 0, likedByMe: false, comments: 1 })
  })

  it('tomt utan inloggning eller utan inlägg', async () => {
    expect(await getFeedSocial([])).toEqual({})
    signIn(null)
    expect(await getFeedSocial(['a'])).toEqual({})
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('gillanden', () => {
  it('likePost skriver rätt rad och sväljer dubbeltryck (23505)', async () => {
    const calls = installTables(fromMock, { post_likes: { error: { code: '23505' } } })
    await likePost('p1', 'ägare')
    expect(argsOf(calls, 'post_likes', 'insert')[0][0]).toEqual({
      post_key: 'p1', owner_id: 'ägare', liker_id: 'u1',
    })
  })

  it('likePost kastar andra fel vidare', async () => {
    installTables(fromMock, { post_likes: { error: { code: '500' } } })
    await expect(likePost('p1', 'ägare')).rejects.toBeTruthy()
  })

  it('unlikePost raderar min rad för inlägget', async () => {
    const calls = installTables(fromMock, { post_likes: { error: null } })
    await unlikePost('p1')
    expect(argsOf(calls, 'post_likes', 'eq')).toEqual([['post_key', 'p1'], ['liker_id', 'u1']])
  })

  it('gör ingenting utloggad', async () => {
    signIn(null)
    await likePost('p1', 'o')
    await unlikePost('p1')
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('getComments', () => {
  it('mappar kommentarer med profil och gillanden', async () => {
    installTables(fromMock, {
      post_comments: { data: [
        { id: 'c1', author_id: 'u2', body: 'Starkt!', created_at: '2026-07-25T10:00:00Z' },
        { id: 'c2', author_id: 'u3', body: 'Grymt', created_at: '2026-07-25T11:00:00Z' },
      ] },
      comment_likes: { data: [
        { comment_id: 'c1', liker_id: 'u1' },
        { comment_id: 'c1', liker_id: 'u3' },
      ] },
    })
    rpcMock.mockResolvedValue({ data: [{ id: 'u2', name: 'Kalle', avatar_url: 'k.png' }] })
    const comments = await getComments('p1')
    expect(comments).toHaveLength(2)
    expect(comments[0]).toMatchObject({
      id: 'c1', authorName: 'Kalle', authorAvatar: 'k.png', likes: 2, likedByMe: true,
    })
    // Profil som saknas i RPC-svaret blir namnlös i stället för att krascha
    expect(comments[1]).toMatchObject({ authorName: null, likes: 0, likedByMe: false })
  })
})

describe('kommentarsgillanden och kommentarer', () => {
  it('likeComment sväljer dubbeltryck men kastar riktiga fel', async () => {
    installTables(fromMock, { comment_likes: { error: { code: '23505' } } })
    await likeComment('c1')
    installTables(fromMock, { comment_likes: { error: { code: '42' } } })
    await expect(likeComment('c1')).rejects.toBeTruthy()
  })

  it('unlikeComment raderar min rad', async () => {
    const calls = installTables(fromMock, { comment_likes: { error: null } })
    await unlikeComment('c1')
    expect(argsOf(calls, 'comment_likes', 'eq')).toEqual([['comment_id', 'c1'], ['liker_id', 'u1']])
  })

  it('addComment trimmar, kapar till 500 tecken och hoppar över tomt', async () => {
    const calls = installTables(fromMock, { post_comments: { error: null } })
    await addComment('p1', 'ägare', '   ')
    expect(fromMock).not.toHaveBeenCalled()

    await addComment('p1', 'ägare', '  ' + 'x'.repeat(600) + '  ')
    const row = argsOf(calls, 'post_comments', 'insert')[0][0] as { body: string }
    expect(row.body).toHaveLength(500)
  })

  it('deleteComment raderar på id och kastar fel vidare', async () => {
    const calls = installTables(fromMock, { post_comments: { error: null } })
    await deleteComment('c9')
    expect(argsOf(calls, 'post_comments', 'eq')[0]).toEqual(['id', 'c9'])
    installTables(fromMock, { post_comments: { error: { message: 'nej' } } })
    await expect(deleteComment('c9')).rejects.toBeTruthy()
  })
})

describe('getPostLikers', () => {
  it('slår upp profiler och faller tillbaka på namnlös', async () => {
    installTables(fromMock, {
      post_likes: { data: [{ liker_id: 'u2' }, { liker_id: 'u3' }] },
    })
    rpcMock.mockResolvedValue({ data: [{ id: 'u2', name: 'Kalle', avatar_url: null }] })
    const likers = await getPostLikers('p1')
    expect(likers[0]).toMatchObject({ id: 'u2', name: 'Kalle' })
    expect(likers[1]).toEqual({ id: 'u3', name: null, avatar_url: null })
  })
})

describe('getSocialNotifications', () => {
  it('grupperar per inlägg, räknar unika "andra" och sorterar nyast först', async () => {
    installTables(fromMock, {
      post_likes: { data: [
        { post_key: 'p1', liker_id: 'u2', created_at: '2026-07-25T12:00:00Z' },
        { post_key: 'p1', liker_id: 'u3', created_at: '2026-07-25T11:00:00Z' },
        { post_key: 'p1', liker_id: 'u2', created_at: '2026-07-25T10:30:00Z' },  // dubblett av u2
        { post_key: 'p2', liker_id: 'u3', created_at: '2026-07-25T09:00:00Z' },
      ] },
      post_comments: { data: [
        { post_key: 'p1', author_id: 'u4', body: 'Snyggt!', created_at: '2026-07-25T13:00:00Z' },
      ] },
    })
    rpcMock.mockResolvedValue({ data: [
      { id: 'u2', name: 'Kalle', avatar_url: null },
      { id: 'u4', name: 'Vera', avatar_url: null },
    ] })
    const items = await getSocialNotifications()
    expect(items.map(i => i.kind)).toEqual(['comment', 'like', 'like'])
    // Kommentaren är nyast och bär texten
    expect(items[0]).toMatchObject({ postKey: 'p1', body: 'Snyggt!', others: 0 })
    expect(items[0].from.name).toBe('Vera')
    // p1-gillandena: senaste gillaren syns, dubbletter räknas inte i "andra"
    expect(items[1]).toMatchObject({ postKey: 'p1', others: 1 })
    expect(items[1].from.name).toBe('Kalle')
    expect(items[2]).toMatchObject({ postKey: 'p2', others: 0 })
  })

  it('tom lista utan inloggning', async () => {
    signIn(null)
    expect(await getSocialNotifications()).toEqual([])
  })
})

describe('getSocialNotificationCount', () => {
  it('summerar gillanden och kommentarer efter tidpunkten', async () => {
    const calls = installTables(fromMock, {
      post_likes: { count: 2 },
      post_comments: { count: 3 },
    })
    expect(await getSocialNotificationCount('2026-07-20T00:00:00Z')).toBe(5)
    expect(argsOf(calls, 'post_likes', 'gt')[0]).toEqual(['created_at', '2026-07-20T00:00:00Z'])
  })

  it('utan tidpunkt räknas allt, utan inloggning blir det noll', async () => {
    const calls = installTables(fromMock, { post_likes: { count: 1 }, post_comments: { count: 0 } })
    expect(await getSocialNotificationCount(null)).toBe(1)
    expect(argsOf(calls, 'post_likes', 'gt')[0][1]).toBe('1970-01-01T00:00:00Z')
    signIn(null)
    expect(await getSocialNotificationCount(null)).toBe(0)
  })
})

describe('subscribeToSocial', () => {
  it('lyssnar på gillanden och kommentarer och städar upp', async () => {
    const { chain, handle, listeners } = installChannel(supabase as never)
    const unsub = subscribeToSocial('u1', jest.fn())
    expect(supabase.channel).toHaveBeenCalledWith('social-u1')
    expect(listeners).toHaveLength(2)
    expect(chain.subscribe).toHaveBeenCalled()
    unsub()
    expect(supabase.removeChannel).toHaveBeenCalledWith(handle)
  })

  it('överlever att kanalen inte går att skapa', () => {
    ;(supabase.channel as jest.Mock).mockImplementation(() => { throw new Error('nere') })
    const unsub = subscribeToSocial('u1', jest.fn())
    expect(() => unsub()).not.toThrow()
  })
})
