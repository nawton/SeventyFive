import { getProfile, updateProfile, searchProfiles, uploadAvatar } from '../profile'
import { supabase } from '@/lib/supabase'
import { uploadImage } from '@/lib/storage'
import { installTables, argsOf } from '@/testUtils/supabaseChain'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), storage: { from: jest.fn() } },
}))
jest.mock('@/lib/storage', () => ({ uploadImage: jest.fn().mockResolvedValue(undefined) }))

const fromMock = supabase.from as jest.Mock
const rpcMock = supabase.rpc as jest.Mock

beforeEach(() => jest.clearAllMocks())

describe('getProfile och updateProfile', () => {
  it('läser profilen på id och uppdaterar via upsert', async () => {
    const profile = { name: 'Elin', avatar_url: null }
    let calls = installTables(fromMock, { profiles: { data: profile } })
    expect(await getProfile('u1')).toEqual(profile)
    expect(argsOf(calls, 'profiles', 'eq')[0]).toEqual(['id', 'u1'])

    calls = installTables(fromMock, { profiles: { error: null } })
    await updateProfile('u1', { name: 'Elin Berg', is_public: true })
    expect(argsOf(calls, 'profiles', 'upsert')[0][0]).toEqual({
      id: 'u1', name: 'Elin Berg', is_public: true,
    })

    installTables(fromMock, { profiles: { error: { message: 'nej' } } })
    await expect(updateProfile('u1', {})).rejects.toBeTruthy()
  })
})

describe('searchProfiles', () => {
  it('kräver minst två tecken och går via RPC:n', async () => {
    expect(await searchProfiles(' a ')).toEqual([])
    expect(rpcMock).not.toHaveBeenCalled()

    rpcMock.mockResolvedValue({ data: [{ id: 'u2', name: 'Hugo', avatar_url: null }] })
    const hits = await searchProfiles('  hugo  ')
    expect(rpcMock).toHaveBeenCalledWith('search_profiles', { search: 'hugo' })
    expect(hits).toHaveLength(1)

    rpcMock.mockResolvedValue({ data: null, error: {} })
    expect(await searchProfiles('hugo')).toEqual([])
  })
})

describe('uploadAvatar', () => {
  it('laddar upp till en fast sökväg per användare och ger publika länken', async () => {
    ;(supabase.storage.from as jest.Mock).mockReturnValue({
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${path}` } }),
    })
    const url = await uploadAvatar('u1', 'file:///selfie.jpg')
    expect(uploadImage).toHaveBeenCalledWith('avatars', 'u1.jpg', 'file:///selfie.jpg')
    expect(url).toBe('https://cdn/u1.jpg')
  })
})
