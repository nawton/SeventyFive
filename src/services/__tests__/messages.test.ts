import {
  getConversations, getThread, sendMessage, getMessageReactions,
  setReaction, removeReaction, deleteMessage, markThreadRead,
  getUnreadMessageCount, subscribeToMessages,
} from '../messages'
import { supabase } from '@/lib/supabase'
import { uploadImage } from '@/lib/storage'
import { installTables, installChannel, argsOf } from '@/testUtils/supabaseChain'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: { getSession: jest.fn() },
    storage: { from: jest.fn() },
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}))
jest.mock('@/lib/storage', () => ({ uploadImage: jest.fn().mockResolvedValue(undefined) }))

const fromMock = supabase.from as jest.Mock
const rpcMock = supabase.rpc as jest.Mock

function signIn(uid: string | null) {
  ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: uid ? { user: { id: uid } } : null },
  })
}

const msg = (over: Partial<Record<string, unknown>>) => ({
  id: 'm', sender_id: 'me', recipient_id: 'u2', body: 'hej',
  image_url: null, read_at: '2026-07-25T10:00:00Z', created_at: '2026-07-25T10:00:00Z',
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  signIn('me')
  rpcMock.mockResolvedValue({ data: [] })
})

describe('getConversations', () => {
  it('en rad per motpart med senaste meddelandet och olästa', async () => {
    installTables(fromMock, {
      direct_messages: { data: [
        msg({ id: 'm3', sender_id: 'u2', recipient_id: 'me', body: 'Ses!', read_at: null, image_url: 'x.jpg', created_at: '2026-07-25T12:00:00Z' }),
        msg({ id: 'm2', sender_id: 'me', recipient_id: 'u2', body: 'Kör vi', created_at: '2026-07-25T11:00:00Z' }),
        msg({ id: 'm1', sender_id: 'u3', recipient_id: 'me', body: 'Tja', created_at: '2026-07-25T09:00:00Z' }),
      ] },
    })
    rpcMock.mockResolvedValue({ data: [{ id: 'u2', name: 'Kalle', avatar_url: 'k.png' }] })
    const convos = await getConversations('me')
    expect(convos).toHaveLength(2)
    expect(convos[0]).toMatchObject({
      userId: 'u2', name: 'Kalle', lastBody: 'Ses!', lastFromMe: false,
      lastHasImage: true, unread: 1,
    })
    expect(convos[1]).toMatchObject({ userId: 'u3', name: null, unread: 0 })
  })

  it('tomt vid fel eller inga meddelanden', async () => {
    installTables(fromMock, { direct_messages: { data: null, error: { message: 'nere' } } })
    expect(await getConversations('me')).toEqual([])
    installTables(fromMock, { direct_messages: { data: [] } })
    expect(await getConversations('me')).toEqual([])
    expect(rpcMock).not.toHaveBeenCalled()
  })
})

describe('getThread', () => {
  it('returnerar tråden i kronologisk ordning, tom vid fel', async () => {
    const rows = [msg({ id: 'a' }), msg({ id: 'b' })]
    installTables(fromMock, { direct_messages: { data: rows } })
    expect(await getThread('me', 'u2')).toEqual(rows)
    installTables(fromMock, { direct_messages: { data: null, error: { message: 'x' } } })
    expect(await getThread('me', 'u2')).toEqual([])
  })
})

describe('sendMessage', () => {
  it('skickar trimmad text utan bild', async () => {
    const calls = installTables(fromMock, { direct_messages: { error: null } })
    await sendMessage('u2', '  hej du  ')
    expect(argsOf(calls, 'direct_messages', 'insert')[0][0]).toEqual({
      sender_id: 'me', recipient_id: 'u2', body: 'hej du', image_url: null,
    })
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('laddar upp bilden först och sparar dess publika länk', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000)
    ;(supabase.storage.from as jest.Mock).mockReturnValue({
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${path}` } }),
    })
    const calls = installTables(fromMock, { direct_messages: { error: null } })
    await sendMessage('u2', 'kolla', 'file:///bild.jpg')
    expect(uploadImage).toHaveBeenCalledWith('avatars', 'posts/me-1700000000000.jpg', 'file:///bild.jpg')
    const row = argsOf(calls, 'direct_messages', 'insert')[0][0] as { image_url: string }
    expect(row.image_url).toBe('https://cdn/posts/me-1700000000000.jpg')
  })

  it('kräver inloggning och kastar databasfel vidare', async () => {
    signIn(null)
    await expect(sendMessage('u2', 'hej')).rejects.toThrow('inte inloggad')
    signIn('me')
    installTables(fromMock, { direct_messages: { error: { message: 'stoppad' } } })
    await expect(sendMessage('u2', 'hej')).rejects.toBeTruthy()
  })
})

describe('reaktioner', () => {
  it('getMessageReactions grupperar per meddelande', async () => {
    installTables(fromMock, {
      message_reactions: { data: [
        { message_id: 'm1', user_id: 'u2', emoji: '🔥' },
        { message_id: 'm1', user_id: 'me', emoji: '❤️' },
        { message_id: 'm2', user_id: 'u2', emoji: '👍' },
      ] },
    })
    const grouped = await getMessageReactions(['m1', 'm2'])
    expect(grouped.m1).toHaveLength(2)
    expect(grouped.m2).toHaveLength(1)
    expect(await getMessageReactions([])).toEqual({})
  })

  it('setReaction upsertar min reaktion med rätt konfliktnyckel', async () => {
    const calls = installTables(fromMock, { message_reactions: { error: null } })
    await setReaction('m1', '🔥')
    expect(argsOf(calls, 'message_reactions', 'upsert')[0]).toEqual([
      { message_id: 'm1', user_id: 'me', emoji: '🔥' },
      { onConflict: 'message_id,user_id' },
    ])
    signIn(null)
    await expect(setReaction('m1', '🔥')).rejects.toThrow('inte inloggad')
  })

  it('removeReaction raderar min rad, tyst utloggad', async () => {
    const calls = installTables(fromMock, { message_reactions: { error: null } })
    await removeReaction('m1')
    expect(argsOf(calls, 'message_reactions', 'eq')).toEqual([['message_id', 'm1'], ['user_id', 'me']])
    jest.clearAllMocks()
    signIn(null)
    await removeReaction('m1')
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('övrigt', () => {
  it('deleteMessage raderar på id och kastar fel vidare', async () => {
    const calls = installTables(fromMock, { direct_messages: { error: null } })
    await deleteMessage('m1')
    expect(argsOf(calls, 'direct_messages', 'eq')[0]).toEqual(['id', 'm1'])
    installTables(fromMock, { direct_messages: { error: { message: 'nej' } } })
    await expect(deleteMessage('m1')).rejects.toBeTruthy()
  })

  it('markThreadRead går via definer-RPC:n', async () => {
    await markThreadRead('u2')
    expect(rpcMock).toHaveBeenCalledWith('mark_messages_read', { other: 'u2' })
  })

  it('getUnreadMessageCount räknar olästa till mig', async () => {
    const calls = installTables(fromMock, { direct_messages: { count: 7 } })
    expect(await getUnreadMessageCount('me')).toBe(7)
    expect(argsOf(calls, 'direct_messages', 'is')[0]).toEqual(['read_at', null])
    installTables(fromMock, { direct_messages: { count: null } })
    expect(await getUnreadMessageCount('me')).toBe(0)
  })

  it('subscribeToMessages lyssnar på meddelanden och reaktioner', () => {
    const { handle, listeners } = installChannel(supabase as never)
    const unsub = subscribeToMessages('me', jest.fn())
    expect(supabase.channel).toHaveBeenCalledWith('dm-me')
    expect(listeners).toHaveLength(2)
    unsub()
    expect(supabase.removeChannel).toHaveBeenCalledWith(handle)

    ;(supabase.channel as jest.Mock).mockImplementation(() => { throw new Error('nere') })
    expect(() => subscribeToMessages('me', jest.fn())()).not.toThrow()
  })
})
