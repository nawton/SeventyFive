import {
  getProgressPhotos, addProgressPhoto, hasPhotoForDay, deleteProgressPhoto,
} from '../progressPhotos'
import { supabase } from '@/lib/supabase'
import { uploadImage } from '@/lib/storage'
import { installTables, argsOf } from '@/testUtils/supabaseChain'

const mockStorageApi = {
  createSignedUrls: jest.fn(),
  remove: jest.fn(),
}

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: { from: jest.fn(() => mockStorageApi) },
  },
}))
jest.mock('@/lib/storage', () => ({ uploadImage: jest.fn() }))

const fromMock = supabase.from as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  ;(supabase.storage.from as jest.Mock).mockReturnValue(mockStorageApi)
})

describe('getProgressPhotos', () => {
  const rows = [
    { id: 'p1', day_number: 5, caption: 'Vecka 1', created_at: '2026-07-01', photo_url: 'u1/a.jpg' },
    { id: 'p2', day_number: 12, caption: null, created_at: '2026-07-08', photo_url: 'u1/b.jpg' },
  ]

  it('signerar alla sökvägar i ett svep, osignerade blir null', async () => {
    installTables(fromMock, { progress_photos: { data: rows } })
    mockStorageApi.createSignedUrls.mockResolvedValue({
      data: [{ path: 'u1/a.jpg', signedUrl: 'https://signed/a' }],
    })

    const photos = await getProgressPhotos('u1')
    expect(mockStorageApi.createSignedUrls).toHaveBeenCalledWith(['u1/a.jpg', 'u1/b.jpg'], 3600)
    expect(photos).toEqual([
      { id: 'p1', dayNumber: 5, caption: 'Vecka 1', createdAt: '2026-07-01', path: 'u1/a.jpg', url: 'https://signed/a' },
      { id: 'p2', dayNumber: 12, caption: null, createdAt: '2026-07-08', path: 'u1/b.jpg', url: null },
    ])
  })

  it('utan foton görs ingen signering alls', async () => {
    installTables(fromMock, { progress_photos: { data: [] } })
    expect(await getProgressPhotos('u1')).toEqual([])
    expect(mockStorageApi.createSignedUrls).not.toHaveBeenCalled()
  })

  it('kastar vidare läsfel', async () => {
    installTables(fromMock, { progress_photos: { data: null, error: { message: 'rls' } } })
    await expect(getProgressPhotos('u1')).rejects.toMatchObject({ message: 'rls' })
  })
})

describe('addProgressPhoto', () => {
  it('laddar upp till privata bucketen och sparar sökvägen, inte URL:en', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1750000000000)
    const calls = installTables(fromMock, { progress_photos: { data: null } })

    await addProgressPhoto({
      userId: 'u1', challengeId: 'c1', dayNumber: 7,
      uri: 'file:///tmp/foto.jpg', caption: 'Dag 7',
    })

    expect(uploadImage).toHaveBeenCalledWith('progress-photos', 'u1/1750000000000-day7.jpg', 'file:///tmp/foto.jpg')
    expect(argsOf(calls, 'progress_photos', 'insert')[0][0]).toEqual({
      user_id: 'u1', challenge_id: 'c1', day_number: 7,
      photo_url: 'u1/1750000000000-day7.jpg', caption: 'Dag 7',
    })
    nowSpy.mockRestore()
  })

  it('kastar vidare fel från radinserten', async () => {
    installTables(fromMock, { progress_photos: { data: null, error: { message: 'stopp' } } })
    await expect(addProgressPhoto({
      userId: 'u1', challengeId: 'c1', dayNumber: 7, uri: 'file:///x.jpg', caption: null,
    })).rejects.toMatchObject({ message: 'stopp' })
  })
})

describe('hasPhotoForDay', () => {
  it('sant när minst en rad finns för dagen', async () => {
    const calls = installTables(fromMock, { progress_photos: { data: [{ id: 'p1' }] } })
    expect(await hasPhotoForDay('u1', 'c1', 7)).toBe(true)
    expect(argsOf(calls, 'progress_photos', 'eq')).toEqual([
      ['user_id', 'u1'], ['challenge_id', 'c1'], ['day_number', 7],
    ])

    installTables(fromMock, { progress_photos: { data: [] } })
    expect(await hasPhotoForDay('u1', 'c1', 8)).toBe(false)
  })

  it('kastar vidare fel', async () => {
    installTables(fromMock, { progress_photos: { data: null, error: { message: 'nej' } } })
    await expect(hasPhotoForDay('u1', 'c1', 7)).rejects.toMatchObject({ message: 'nej' })
  })
})

describe('deleteProgressPhoto', () => {
  it('raderar raden först och städar filen bäst-effort', async () => {
    installTables(fromMock, { progress_photos: { data: null } })
    mockStorageApi.remove.mockResolvedValue({ data: null })
    await deleteProgressPhoto('p1', 'u1/a.jpg')
    expect(mockStorageApi.remove).toHaveBeenCalledWith(['u1/a.jpg'])
  })

  it('rör inte filen om raden inte gick att radera', async () => {
    installTables(fromMock, { progress_photos: { data: null, error: { message: 'rls' } } })
    await expect(deleteProgressPhoto('p1', 'u1/a.jpg')).rejects.toMatchObject({ message: 'rls' })
    expect(mockStorageApi.remove).not.toHaveBeenCalled()
  })
})
