import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import PrivacyScreen from '../(app)/privacy'
import { getProfile, updateProfile } from '@/services/profile'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'u1', email: 'anton@example.com' } } },
      }),
    },
  },
}))
jest.mock('@/services/profile', () => ({
  getProfile: jest.fn().mockResolvedValue(null),
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

beforeEach(() => {
  jest.clearAllMocks()
  ;(getProfile as jest.Mock).mockResolvedValue({
    name: 'Anton', avatar_url: null,
    is_public: false, searchable: true, activity_visibility: 'followers',
  })
})

describe('Integritetsinställningar', () => {
  it('visar nuvarande värden för alla tre inställningarna', async () => {
    render(<PrivacyScreen />)
    expect(await screen.findByText('Sökning')).toBeOnTheScreen()
    expect(screen.getByText('Alla')).toBeOnTheScreen()               // sökning: alla
    expect(screen.getByText('Godkännande krävs')).toBeOnTheScreen()  // profil: privat
    expect(screen.getByText('Följare')).toBeOnTheScreen()            // aktiviteter
  })

  it('sökningsvalet Ingen sparas till profilen', async () => {
    render(<PrivacyScreen />)
    fireEvent.press(await screen.findByTestId('privacy-search'))
    fireEvent.press(await screen.findByTestId('option-none'))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { searchable: false }))
  })

  it('profilvalet Alla slår på auto-godkännande (is_public)', async () => {
    render(<PrivacyScreen />)
    fireEvent.press(await screen.findByTestId('privacy-profile'))
    fireEvent.press(await screen.findByTestId('option-all'))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { is_public: true }))
  })

  it('aktivitetsvalet Bara du gör passen privata', async () => {
    render(<PrivacyScreen />)
    fireEvent.press(await screen.findByTestId('privacy-activities'))
    fireEvent.press(await screen.findByTestId('option-private'))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { activity_visibility: 'private' }))
  })
})
