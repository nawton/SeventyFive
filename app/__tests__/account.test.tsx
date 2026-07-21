import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import AccountScreen from '../(app)/account'
import { getProfile, updateProfile } from '@/services/profile'
import { getBodyWeightKg } from '@/lib/prefs'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
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

const PROFILE = {
  name: 'Anton Wretenberg', avatar_url: null,
  birth_date: '2004-01-09', gender: 'Man', weight_kg: 75.5, height_cm: 182,
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getProfile as jest.Mock).mockResolvedValue(PROFILE)
})

describe('Profilinställningar', () => {
  it('visar alla rader med värden från profilen', async () => {
    render(<AccountScreen />)
    expect(await screen.findByText('Anton')).toBeOnTheScreen()
    expect(screen.getByText('Wretenberg')).toBeOnTheScreen()
    expect(screen.getByText('2004-01-09')).toBeOnTheScreen()
    expect(screen.getByText('Man')).toBeOnTheScreen()
    expect(screen.getByText('75,5 kg')).toBeOnTheScreen()
    expect(screen.getByText('182 cm')).toBeOnTheScreen()
    expect(screen.getByText('anton@example.com')).toBeOnTheScreen()
  })

  it('tom profil: "Lägg till"/"Ej specificerad" och Språk är låst', async () => {
    ;(getProfile as jest.Mock).mockResolvedValue({
      name: null, avatar_url: null, birth_date: null, gender: null, weight_kg: null, height_cm: null,
    })
    render(<AccountScreen />)
    expect(await screen.findAllByText('Lägg till')).toHaveLength(2)
    expect(screen.getAllByText('Ej specificerad')).toHaveLength(2)
    expect(screen.getAllByText('Ej angivet')).toHaveLength(2)  // födelsedatum + kön
    expect(screen.getByText('Svenska')).toBeOnTheScreen()      // låst rad utan chevron
  })

  it('könsvalet sparas direkt till profilen', async () => {
    render(<AccountScreen />)
    fireEvent.press(await screen.findByText('Kön'))
    fireEvent.press(screen.getByText('Kvinna'))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { gender: 'Kvinna' }))
  })

  it('viktshjulet sparar till profilen OCH kaloriberäkningens inställning', async () => {
    render(<AccountScreen />)
    fireEvent.press(await screen.findByText('Vikt'))
    fireEvent.press(screen.getByText('Klar'))   // sparar förvalda 75,5 (från profilen)
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { weight_kg: 75.5 }))
    expect(await getBodyWeightKg()).toBe(76)    // prefs rundar till hela kg
  })

  it('förnamnet redigeras och sparas ihop med efternamnet', async () => {
    render(<AccountScreen />)
    fireEvent.press(await screen.findByText('Förnamn'))
    const input = screen.getByDisplayValue('Anton')
    fireEvent.changeText(input, 'Tony')
    fireEvent.press(screen.getByText('Spara'))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { name: 'Tony Wretenberg' }))
  })

  it('födelsedatumshjulet sparar valt datum', async () => {
    render(<AccountScreen />)
    fireEvent.press(await screen.findByText('Födelsedatum'))
    fireEvent.press(screen.getByText('Klar'))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { birth_date: '2004-01-09' }))
  })
})
