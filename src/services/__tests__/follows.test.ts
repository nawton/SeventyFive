import {
  getFollowCounts, getFollowStatus, getFollowStatuses, follow,
  acceptFollower, declineFollower, getIncomingRequestCount,
  getIncomingRequests, unfollow, getFollowLists, subscribeToFollows,
} from '../follows'
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
  signIn('me')
  rpcMock.mockResolvedValue({ data: [] })
})

describe('räknare och status', () => {
  it('getFollowCounts läser båda riktningarna', async () => {
    installTables(fromMock, { follows: [{ count: 12 }, { count: 7 }] })
    expect(await getFollowCounts('u1')).toEqual({ followers: 12, following: 7 })
  })

  it('getFollowStatus: min relation, none som standard och utloggad', async () => {
    installTables(fromMock, { follows: { data: { status: 'pending' } } })
    expect(await getFollowStatus('u2')).toBe('pending')

    installTables(fromMock, { follows: { data: null } })
    expect(await getFollowStatus('u2')).toBe('none')

    signIn(null)
    expect(await getFollowStatus('u2')).toBe('none')
  })

  it('getFollowStatuses fyller none och skriver över med raderna', async () => {
    installTables(fromMock, { follows: { data: [
      { followee_id: 'u2', status: 'accepted' },
    ] } })
    expect(await getFollowStatuses(['u2', 'u3'])).toEqual({ u2: 'accepted', u3: 'none' })
    expect(await getFollowStatuses([])).toEqual({})
  })
})

describe('följen', () => {
  it('follow skickar förfrågan, sväljer dubbeltryck och vägrar självföljning', async () => {
    const calls = installTables(fromMock, { follows: { error: { code: '23505' } } })
    await follow('u2')
    expect(argsOf(calls, 'follows', 'insert')[0][0]).toEqual({ follower_id: 'me', followee_id: 'u2' })

    jest.clearAllMocks()
    signIn('me')
    await follow('me')
    expect(fromMock).not.toHaveBeenCalled()

    installTables(fromMock, { follows: { error: { code: '500' } } })
    await expect(follow('u2')).rejects.toBeTruthy()
  })

  it('acceptera, avböj och avfölj träffar rätt rader', async () => {
    let calls = installTables(fromMock, { follows: { error: null } })
    await acceptFollower('u2')
    expect(argsOf(calls, 'follows', 'update')[0][0]).toEqual({ status: 'accepted' })
    expect(argsOf(calls, 'follows', 'eq')).toEqual([['follower_id', 'u2'], ['followee_id', 'me']])

    calls = installTables(fromMock, { follows: { error: null } })
    await declineFollower('u2')
    expect(argsOf(calls, 'follows', 'eq')).toEqual([['follower_id', 'u2'], ['followee_id', 'me']])

    calls = installTables(fromMock, { follows: { error: null } })
    await unfollow('u2')
    expect(argsOf(calls, 'follows', 'eq')).toEqual([['follower_id', 'me'], ['followee_id', 'u2']])
  })
})

describe('förfrågningar', () => {
  it('räknaren är noll utloggad och läser pending annars', async () => {
    installTables(fromMock, { follows: { count: 3 } })
    expect(await getIncomingRequestCount()).toBe(3)
    signIn(null)
    expect(await getIncomingRequestCount()).toBe(0)
  })

  it('inkommande förfrågningar slår upp profiler med namnlös fallback', async () => {
    installTables(fromMock, { follows: { data: [{ follower_id: 'u2' }, { follower_id: 'u3' }] } })
    rpcMock.mockResolvedValue({ data: [{ id: 'u2', name: 'Hugo', avatar_url: null }] })
    const requests = await getIncomingRequests()
    expect(requests[0]).toMatchObject({ id: 'u2', name: 'Hugo' })
    expect(requests[1]).toEqual({ id: 'u3', name: null, avatar_url: null })

    installTables(fromMock, { follows: { data: [] } })
    expect(await getIncomingRequests()).toEqual([])
  })
})

describe('getFollowLists', () => {
  it('bygger båda listorna ur ett gemensamt profiluppslag', async () => {
    installTables(fromMock, {
      follows: [
        { data: [{ follower_id: 'u2' }, { follower_id: 'u3' }] },
        { data: [{ followee_id: 'u2' }] },
      ],
    })
    rpcMock.mockResolvedValue({ data: [{ id: 'u2', name: 'Hugo', avatar_url: null }] })
    const lists = await getFollowLists('me')
    expect(lists.followers.map(p => p.id)).toEqual(['u2', 'u3'])
    expect(lists.following).toEqual([{ id: 'u2', name: 'Hugo', avatar_url: null }])
    // Profilerna hämtas EN gång trots att u2 finns i båda listorna
    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(rpcMock.mock.calls[0][1].ids).toEqual(['u2', 'u3'])
  })

  it('tomma listor gör inget profiluppslag', async () => {
    installTables(fromMock, { follows: { data: [] } })
    expect(await getFollowLists('me')).toEqual({ followers: [], following: [] })
    expect(rpcMock).not.toHaveBeenCalled()
  })
})

describe('subscribeToFollows', () => {
  it('lyssnar på båda riktningarna och städar upp', () => {
    const { handle, listeners } = installChannel(supabase as never)
    const unsub = subscribeToFollows('me', jest.fn())
    expect(supabase.channel).toHaveBeenCalledWith('follows-me')
    expect(listeners).toHaveLength(2)
    unsub()
    expect(supabase.removeChannel).toHaveBeenCalledWith(handle)

    ;(supabase.channel as jest.Mock).mockImplementation(() => { throw new Error('nere') })
    expect(() => subscribeToFollows('me', jest.fn())()).not.toThrow()
  })
})
