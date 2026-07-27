import * as FileSystem from 'expo-file-system/legacy'
import { uploadImage } from '../storage'
import { supabase } from '@/lib/supabase'

jest.mock('expo-file-system/legacy', () => ({ uploadAsync: jest.fn() }))
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }))

const uploadAsync = FileSystem.uploadAsync as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-nyckel'
  ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { access_token: 'jwt-token' } },
  })
})

describe('uploadImage', () => {
  it('laddar upp till rätt storage-URL med sessionens token', async () => {
    uploadAsync.mockResolvedValue({ status: 200, body: '{}' })
    await uploadImage('avatars', 'posts/u1-1.jpg', 'file:///bild.jpg')
    expect(uploadAsync).toHaveBeenCalledWith(
      'https://proj.supabase.co/storage/v1/object/avatars/posts/u1-1.jpg',
      'file:///bild.jpg',
      expect.objectContaining({
        httpMethod: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-token',
          apikey: 'anon-nyckel',
          'x-upsert': 'true',
        }),
      }),
    )
  })

  it('kräver inloggning', async () => {
    ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } })
    await expect(uploadImage('avatars', 'p.jpg', 'file:///x.jpg')).rejects.toThrow('Inte inloggad')
    expect(uploadAsync).not.toHaveBeenCalled()
  })

  it('läser ut felmeddelandet ur JSON-svar vid uppladdningsfel', async () => {
    uploadAsync.mockResolvedValue({ status: 404, body: '{"message":"Bucket not found"}' })
    await expect(uploadImage('avatars', 'p.jpg', 'file:///x.jpg'))
      .rejects.toThrow(/404.*Bucket not found.*avatars/s)
  })

  it('faller tillbaka på råtexten när svaret inte är JSON', async () => {
    uploadAsync.mockResolvedValue({ status: 500, body: 'serverfel' })
    await expect(uploadImage('avatars', 'p.jpg', 'file:///x.jpg'))
      .rejects.toThrow(/500.*serverfel/s)
  })
})
