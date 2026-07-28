import { getPassMeta, savePassMeta, passPhotoUrl } from '../gymPassMeta'
import { supabase } from '@/lib/supabase'
import { uploadImage } from '@/lib/storage'
import { installTables, argsOf } from '@/testUtils/supabaseChain'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() } },
}))

const fromMock = jest.requireMock('@/lib/supabase').supabase.from as jest.Mock
jest.mock('@/lib/storage', () => ({ uploadImage: jest.fn().mockResolvedValue(undefined) }))

const getSession = supabase.auth.getSession as jest.Mock
const uploadMock = uploadImage as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
})

describe('gymPassMeta', () => {
  it('hämtar raden för användare och datum', async () => {
    const calls = installTables(fromMock, { gym_pass_meta: { data: { user_id: 'u1', workout_date: '2026-07-28', title: 'Oh snap', note: null, photo_path: null }, error: null } })
    const meta = await getPassMeta('u1', '2026-07-28')
    expect(meta?.title).toBe('Oh snap')
    expect(argsOf(calls, 'gym_pass_meta', 'eq')).toEqual([['user_id', 'u1'], ['workout_date', '2026-07-28'], ['pass_key', '']])
  })

  it('sparar trimmad titel och kommentar, tomt blir null', async () => {
    const calls = installTables(fromMock, { gym_pass_meta: { data: null, error: null } })
    await savePassMeta({ workoutDate: '2026-07-28', title: '  Tungt benpass  ', note: '' })
    const upsert = argsOf(calls, 'gym_pass_meta', 'upsert')[0]
    const row = upsert[0] as Record<string, unknown>
    const opts = upsert[1]
    expect(row).toMatchObject({ user_id: 'u1', workout_date: '2026-07-28', pass_key: '', title: 'Tungt benpass', note: null })
    expect('photo_path' in row).toBe(false)
    expect(opts).toEqual({ onConflict: 'user_id,workout_date,pass_key' })
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('laddar upp fotot till egen mapp innan raden skrivs', async () => {
    const calls = installTables(fromMock, { gym_pass_meta: { data: null, error: null } })
    await savePassMeta({ workoutDate: '2026-07-28', title: 'x', note: 'y', photoUri: 'file://p.jpg' })
    const [bucket, path, uri] = uploadMock.mock.calls[0]
    expect(bucket).toBe('pass-photos')
    expect(path).toMatch(/^u1\/2026-07-28-\d+\.jpg$/)
    expect(uri).toBe('file://p.jpg')
    const row = argsOf(calls, 'gym_pass_meta', 'upsert')[0][0] as Record<string, unknown>
    expect(row.photo_path).toBe(path)
  })

  it('utloggad kan inte spara', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    await expect(savePassMeta({ workoutDate: '2026-07-28', title: 'x', note: '' })).rejects.toThrow('Inte inloggad')
  })

  it('publika foto-URL:en byggs utan klienten', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
    expect(passPhotoUrl('u1/2026-07-28-1.jpg'))
      .toBe('https://proj.supabase.co/storage/v1/object/public/pass-photos/u1/2026-07-28-1.jpg')
  })
})
