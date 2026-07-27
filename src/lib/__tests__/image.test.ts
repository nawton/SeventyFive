import { ImageManipulator } from 'expo-image-manipulator'
import { compressImage } from '../image'

const saveAsync = jest.fn().mockResolvedValue({ uri: 'file:///komprimerad.jpg' })
const renderAsync = jest.fn().mockResolvedValue({ saveAsync })
const resize = jest.fn()

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: { manipulate: jest.fn() },
}))

beforeEach(() => {
  jest.clearAllMocks()
  ;(ImageManipulator.manipulate as jest.Mock).mockReturnValue({ resize, renderAsync })
})

describe('compressImage', () => {
  it('skalar ner när bredden är okänd och returnerar den nya bilden', async () => {
    const uri = await compressImage('file:///original.jpg')
    expect(resize).toHaveBeenCalledWith({ width: 1600, height: null })
    expect(saveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.8 })
    expect(uri).toBe('file:///komprimerad.jpg')
  })

  it('skalar ner stora bilder men aldrig upp små', async () => {
    await compressImage('file:///stor.jpg', 4000)
    expect(resize).toHaveBeenCalledWith({ width: 1600, height: null })

    resize.mockClear()
    await compressImage('file:///liten.jpg', 1200)
    expect(resize).not.toHaveBeenCalled()
  })

  it('respekterar egna gränser för bredd och kvalitet', async () => {
    await compressImage('file:///x.jpg', 3000, 800, 0.5)
    expect(resize).toHaveBeenCalledWith({ width: 800, height: null })
    expect(saveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.5 })
  })
})
