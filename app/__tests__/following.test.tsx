import { render, screen, fireEvent } from '@testing-library/react-native'
import FollowingScreen from '../(app)/following'

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
  getProfile: jest.fn().mockResolvedValue({ name: 'Anton Wretenberg', avatar_url: null }),
}))
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react')
    useEffect(cb, [cb])
  },
}))
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }))

describe('Följare/Följer', () => {
  it('visar namnet i headern och flikar med nollräknare', async () => {
    render(<FollowingScreen />)
    expect(await screen.findByText('Anton Wretenberg')).toBeOnTheScreen()
    expect(screen.getByText('0 Följare')).toBeOnTheScreen()
    expect(screen.getByText('0 Följer')).toBeOnTheScreen()
  })

  it('tomlägena skiljer på flikarna', async () => {
    render(<FollowingScreen />)
    await screen.findByText('Anton Wretenberg')
    expect(screen.getByText('Du följer ingen ännu')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('0 Följare'))
    expect(screen.getByText('Inga följare ännu')).toBeOnTheScreen()
  })
})
