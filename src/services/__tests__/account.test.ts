import { deleteAccount, deleteAccountStorage } from '../account'
import { supabase } from '@/lib/supabase'

const mockStorageApi = {
  list: jest.fn(),
  remove: jest.fn(),
}

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    storage: { from: jest.fn() },
  },
}))

const rpcMock = supabase.rpc as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  ;(supabase.storage.from as jest.Mock).mockReturnValue(mockStorageApi)
  mockStorageApi.list.mockResolvedValue({ data: [] })
  mockStorageApi.remove.mockResolvedValue({ data: null })
})

describe('deleteAccountStorage', () => {
  it('tar bort avataren som en platt fil, inte via mapplistning', async () => {
    await deleteAccountStorage('u1')
    expect(supabase.storage.from).toHaveBeenCalledWith('avatars')
    expect(mockStorageApi.remove).toHaveBeenCalledWith(['u1.jpg'])
  })

  it('listar och tar bort allt i progress-photos och pass-photos-mapparna', async () => {
    mockStorageApi.list.mockImplementation((prefix: string) =>
      Promise.resolve({ data: [{ name: `${prefix}-a.jpg` }, { name: `${prefix}-b.jpg` }] })
    )

    await deleteAccountStorage('u1')

    expect(mockStorageApi.list).toHaveBeenCalledWith('u1')
    expect(mockStorageApi.remove).toHaveBeenCalledWith(['u1/u1-a.jpg', 'u1/u1-b.jpg'])
  })

  it('rör inte mappen om den är tom', async () => {
    mockStorageApi.list.mockResolvedValue({ data: [] })
    await deleteAccountStorage('u1')
    // Bara avataren tas bort — inga tomma mapp-remove-anrop
    expect(mockStorageApi.remove).toHaveBeenCalledTimes(1)
    expect(mockStorageApi.remove).toHaveBeenCalledWith(['u1.jpg'])
  })

  it('en misslyckad filradering stoppar inte de andra (best effort)', async () => {
    mockStorageApi.remove.mockRejectedValueOnce(new Error('nätverksfel'))
    await expect(deleteAccountStorage('u1')).resolves.toBeUndefined()
  })
})

describe('deleteAccount', () => {
  it('städar lagring och anropar sedan delete_user_account-RPC:n', async () => {
    rpcMock.mockResolvedValue({ error: null })
    await deleteAccount('u1')
    expect(mockStorageApi.remove).toHaveBeenCalledWith(['u1.jpg'])
    expect(rpcMock).toHaveBeenCalledWith('delete_user_account')
  })

  it('kastar vidare fel från RPC:n', async () => {
    rpcMock.mockResolvedValue({ error: { message: 'rls' } })
    await expect(deleteAccount('u1')).rejects.toMatchObject({ message: 'rls' })
  })
})
