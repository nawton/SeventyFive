import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import GenderScreen from '../(app)/gender'
import { getProfile, updateProfile } from '@/services/profile'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }) },
  },
}))
jest.mock('@/services/profile', () => ({
  getProfile: jest.fn().mockResolvedValue({ gender: 'Man' }),
  updateProfile: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react')
    useEffect(cb, [cb])
  },
}))
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }))

beforeEach(() => jest.clearAllMocks())

describe('Kön-sidan', () => {
  it('visar de fyra alternativen med nuvarande val markerat', async () => {
    render(<GenderScreen />)
    for (const opt of ['Man', 'Kvinna', 'Icke-binär', 'Vill inte ange']) {
      expect(await screen.findByText(opt)).toBeOnTheScreen()
    }
  })

  it('ett val sparas direkt och sidan stängs', async () => {
    jest.useFakeTimers()
    const { router } = require('expo-router')
    render(<GenderScreen />)
    // Vänta in profilladdningen så userId finns när valet görs
    await screen.findByText('Icke-binär')
    await waitFor(() => expect(getProfile).toHaveBeenCalled())
    fireEvent.press(screen.getByText('Icke-binär'))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { gender: 'Icke-binär' }))
    jest.advanceTimersByTime(300)
    expect(router.back).toHaveBeenCalled()
    jest.useRealTimers()
  })
})
