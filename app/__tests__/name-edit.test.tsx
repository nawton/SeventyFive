import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import NameEditScreen from '../(app)/name-edit'
import { updateProfile } from '@/services/profile'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }) },
  },
}))
jest.mock('@/services/profile', () => ({
  getProfile: jest.fn().mockResolvedValue({ name: 'Anton Wretenberg' }),
  updateProfile: jest.fn().mockResolvedValue(undefined),
}))
const mockParams = { part: 'first' }
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react')
    useEffect(cb, [cb])
  },
}))

beforeEach(() => jest.clearAllMocks())

describe('Namnsidan', () => {
  it('redigerar förnamnet och sparar ihop med efternamnet', async () => {
    mockParams.part = 'first'
    render(<NameEditScreen />)
    const input = await screen.findByDisplayValue('Anton')
    fireEvent.changeText(input, 'Tony')
    fireEvent.press(screen.getByText('Spara'))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { name: 'Tony Wretenberg' }))
  })

  it('redigerar efternamnet och behåller förnamnet', async () => {
    mockParams.part = 'last'
    render(<NameEditScreen />)
    const input = await screen.findByDisplayValue('Wretenberg')
    fireEvent.changeText(input, 'Berg')
    fireEvent.press(screen.getByText('Spara'))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('u1', { name: 'Anton Berg' }))
  })
})
