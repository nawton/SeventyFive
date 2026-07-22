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
    expect(await screen.findByDisplayValue('Anton')).toBeOnTheScreen()
    expect(screen.getByDisplayValue('Wretenberg')).toBeOnTheScreen()
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
    expect(await screen.findAllByPlaceholderText('Lägg till')).toHaveLength(2)
    expect(screen.getAllByText('Ej specificerad')).toHaveLength(2)  // vikt + längd
    expect(screen.getAllByText('Ej angivet')).toHaveLength(2)       // födelsedatum + kön
    expect(screen.getByText('Svenska')).toBeOnTheScreen()           // låst rad utan chevron
  })

  it('checkbocken i headern sparar namnen och stänger sidan', async () => {
    const { router } = require('expo-router')
    render(<AccountScreen />)
    const input = await screen.findByDisplayValue('Anton')
    fireEvent.changeText(input, 'Tony')
    fireEvent.press(screen.getByText('glassbtn:checkmark'))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { name: 'Tony Wretenberg' }))
    expect(router.back).toHaveBeenCalled()
  })

  it('Profilbild och Allmänt leder till sina sidor', async () => {
    const { router } = require('expo-router')
    render(<AccountScreen />)
    fireEvent.press(await screen.findByText('Profilbild'))
    expect(router.push).toHaveBeenCalledWith('/(app)/edit-profile')
    fireEvent.press(screen.getByText('Allmänt'))
    expect(router.push).toHaveBeenCalledWith('/(app)/general')
  })

  it('könsraden leder till den egna könssidan', async () => {
    const { router } = require('expo-router')
    render(<AccountScreen />)
    fireEvent.press(await screen.findByText('Kön'))
    expect(router.push).toHaveBeenCalledWith('/gender')
  })

  it('viktshjulet: Klar sparar till profilen OCH kaloriberäkningens inställning', async () => {
    render(<AccountScreen />)
    fireEvent.press(await screen.findByText('Vikt'))
    fireEvent.press(screen.getByTestId('panelKlar'))   // sparar förvalda 75,5 (från profilen)
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { weight_kg: 75.5 }))
    expect(await getBodyWeightKg()).toBe(76)    // prefs rundar till hela kg
  })

  it('längdhjulet: Klar sparar valt värde', async () => {
    render(<AccountScreen />)
    fireEvent.press(await screen.findByText('Längd'))
    fireEvent.press(screen.getByTestId('panelKlar'))   // sparar förvalda 182 (från profilen)
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { height_cm: 182 }))
  })

  it('tryck utanför panelen committar också — ett snurrat hjul får inte tappas', async () => {
    render(<AccountScreen />)
    fireEvent.press(await screen.findByText('Vikt'))
    fireEvent.press(screen.getByTestId('sheetOverlay'))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { weight_kg: 75.5 }))
    expect(screen.queryByTestId('panelKlar')).not.toBeOnTheScreen()
  })

  it('namnen redigeras direkt i raden — returknappen sparar ihop dem', async () => {
    render(<AccountScreen />)
    const input = await screen.findByDisplayValue('Anton')
    fireEvent.changeText(input, 'Tony')
    fireEvent(input, 'submitEditing')
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { name: 'Tony Wretenberg' }))
  })

  it('blur sparar också — man ska inte kunna tappa en namnändring', async () => {
    render(<AccountScreen />)
    const input = await screen.findByDisplayValue('Wretenberg')
    fireEvent.changeText(input, 'Berg')
    fireEvent(input, 'blur')
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { name: 'Anton Berg' }))
  })

  it('Done-pillen över tangentbordet sparar förnamnet', async () => {
    render(<AccountScreen />)
    const input = await screen.findByDisplayValue('Anton')
    fireEvent.changeText(input, 'Tony')
    fireEvent.press(screen.getByTestId('firstNameDone'))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { name: 'Tony Wretenberg' }))
  })

  it('efternamnet har en egen Done-pill (delad accessory tappas av iOS)', async () => {
    render(<AccountScreen />)
    const input = await screen.findByDisplayValue('Wretenberg')
    fireEvent.changeText(input, 'Berg')
    fireEvent.press(screen.getByTestId('lastNameDone'))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { name: 'Anton Berg' }))
  })

  it('födelsedatumshjulet: Klar sparar valt datum', async () => {
    render(<AccountScreen />)
    fireEvent.press(await screen.findByText('Födelsedatum'))
    fireEvent(screen.getByTestId('birthPicker'), 'change', { type: 'set' }, new Date(2003, 4, 17))
    fireEvent.press(screen.getByTestId('panelKlar'))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { birth_date: '2003-05-17' }))
  })
})
