import { blockUser, unblockUser, isBlockedByMe, getBlockedUsers, isBlocked } from '../blocks'
import { supabase } from '@/lib/supabase'
import { installTables, argsOf } from '@/testUtils/supabaseChain'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), auth: { getSession: jest.fn() } },
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

describe('blockUser', () => {
  it('skriver blockeringen, sväljer dubbletter och vägrar självblockering', async () => {
    const calls = installTables(fromMock, { blocks: { error: { code: '23505' } } })
    await blockUser('u2')
    expect(argsOf(calls, 'blocks', 'insert')[0][0]).toEqual({ blocker_id: 'me', blocked_id: 'u2' })

    jest.clearAllMocks()
    signIn('me')
    await blockUser('me')
    expect(fromMock).not.toHaveBeenCalled()

    installTables(fromMock, { blocks: { error: { code: '500' } } })
    await expect(blockUser('u2')).rejects.toBeTruthy()
  })
})

describe('unblockUser', () => {
  it('raderar min blockeringsrad', async () => {
    const calls = installTables(fromMock, { blocks: { error: null } })
    await unblockUser('u2')
    expect(argsOf(calls, 'blocks', 'eq')).toEqual([['blocker_id', 'me'], ['blocked_id', 'u2']])
  })
})

describe('statusuppslag', () => {
  it('isBlockedByMe räknar rader, isBlocked kollar radens existens', async () => {
    installTables(fromMock, { blocks: { count: 1 } })
    expect(await isBlockedByMe('u2')).toBe(true)
    installTables(fromMock, { blocks: { count: 0 } })
    expect(await isBlockedByMe('u2')).toBe(false)

    installTables(fromMock, { blocks: { data: { blocked_id: 'u2' } } })
    expect(await isBlocked('u2')).toBe(true)
    installTables(fromMock, { blocks: { data: null } })
    expect(await isBlocked('u2')).toBe(false)

    signIn(null)
    expect(await isBlockedByMe('u2')).toBe(false)
    expect(await isBlocked('u2')).toBe(false)
  })
})

describe('getBlockedUsers', () => {
  it('slår upp namn med namnlös fallback, tom lista utan blockeringar', async () => {
    installTables(fromMock, { blocks: { data: [{ blocked_id: 'u2' }, { blocked_id: 'u3' }] } })
    rpcMock.mockResolvedValue({ data: [{ id: 'u3', name: 'Vera', avatar_url: 'v.png' }] })
    const blocked = await getBlockedUsers()
    expect(blocked[0]).toEqual({ id: 'u2', name: null, avatar_url: null })
    expect(blocked[1]).toMatchObject({ id: 'u3', name: 'Vera' })

    installTables(fromMock, { blocks: { data: [] } })
    expect(await getBlockedUsers()).toEqual([])
    signIn(null)
    expect(await getBlockedUsers()).toEqual([])
  })
})
