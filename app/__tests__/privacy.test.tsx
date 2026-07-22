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
jest.mock('@/services/blocks', () => ({
  getBlockedUsers: jest.fn().mockResolvedValue([]),
  unblockUser: jest.fn().mockResolvedValue(undefined),
}))

const { getBlockedUsers, unblockUser } = require('@/services/blocks')

beforeEach(() => {
  jest.clearAllMocks()
  ;(getProfile as jest.Mock).mockResolvedValue({
    name: 'Anton', avatar_url: null,
    is_public: false, searchable: true, activity_visibility: 'followers',
    trim_route_meters: 0, hide_route_maps: false,
  })
  ;(getBlockedUsers as jest.Mock).mockResolvedValue([])
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

  it('kartsynlighet: dolda meter väljs på slidern och sparas', async () => {
    render(<PrivacyScreen />)
    fireEvent.press(await screen.findByTestId('privacy-maps'))
    fireEvent.press(await screen.findByTestId('maps-trim'))
    fireEvent.press(await screen.findByTestId('trim-400'))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { trim_route_meters: 400 }))
    expect(screen.getByText('400 dolda meter')).toBeOnTheScreen()
    // Menyraden speglar valet när man går tillbaka (sista pilen = modalens)
    const backs = screen.getAllByText('glassbtn:chevron-back')
    fireEvent.press(backs[backs.length - 1])
    expect(screen.getByText('400 m döljs i varje ände')).toBeOnTheScreen()
  })

  it('kartsynlighet: dölj alla kartor sparas från undervyn', async () => {
    render(<PrivacyScreen />)
    fireEvent.press(await screen.findByTestId('privacy-maps'))
    fireEvent.press(await screen.findByTestId('maps-hide'))
    fireEvent(await screen.findByTestId('hideMapsSwitch'), 'valueChange', true)
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { hide_route_maps: true }))
  })

  it('blockerade konton listas och kan avblockeras', async () => {
    ;(getBlockedUsers as jest.Mock).mockResolvedValue([
      { id: 'u2', name: 'Nawid', avatar_url: '🔥' },
    ])
    render(<PrivacyScreen />)
    fireEvent.press(await screen.findByTestId('privacy-blocked'))
    expect(await screen.findByText('Nawid')).toBeOnTheScreen()
    fireEvent.press(screen.getByTestId('unblock-u2'))
    expect(unblockUser).toHaveBeenCalledWith('u2')
    expect(screen.queryByText('Nawid')).not.toBeOnTheScreen()
  })
})
