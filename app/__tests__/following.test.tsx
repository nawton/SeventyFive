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
  it('visar namnet i headern, flikar med räknare och exempellistan', async () => {
    render(<FollowingScreen />)
    expect(await screen.findByText('Anton Wretenberg')).toBeOnTheScreen()
    expect(screen.getByText('2 Följare')).toBeOnTheScreen()
    expect(screen.getByText('2 Följer')).toBeOnTheScreen()
    expect(screen.getByText('Lukas')).toBeOnTheScreen()
    expect(screen.getByText('11 km totalt')).toBeOnTheScreen()
  })

  it('följer-pillen växlar mellan Följer och Följ lokalt', async () => {
    render(<FollowingScreen />)
    await screen.findByText('Lukas')
    fireEvent.press(screen.getByTestId('follow-p1'))
    expect(screen.getByText('Följ')).toBeOnTheScreen()
    fireEvent.press(screen.getByTestId('follow-p1'))
    expect(screen.queryByText('Följ')).not.toBeOnTheScreen()
  })

  it('flikarna går att växla', async () => {
    render(<FollowingScreen />)
    await screen.findByText('Lukas')
    fireEvent.press(screen.getByText('2 Följare'))
    expect(screen.getByText('Tanja')).toBeOnTheScreen()
  })
})
