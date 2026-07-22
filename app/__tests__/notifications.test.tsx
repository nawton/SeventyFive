import { render, screen, fireEvent } from '@testing-library/react-native'
import NotificationsScreen from '../(app)/notifications'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'u1', email: 'anton@example.com' } } },
      }),
    },
  },
}))
jest.mock('@/services/follows', () => ({
  getIncomingRequests: jest.fn().mockResolvedValue([]),
  acceptFollower: jest.fn().mockResolvedValue(undefined),
  declineFollower: jest.fn().mockResolvedValue(undefined),
  subscribeToFollows: jest.fn(() => () => {}),
}))
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react')
    useEffect(cb, [cb])
  },
}))
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success' },
}))

const { getIncomingRequests, acceptFollower, declineFollower } = require('@/services/follows')

beforeEach(() => {
  jest.clearAllMocks()
  ;(getIncomingRequests as jest.Mock).mockResolvedValue([])
})

describe('Notiser', () => {
  it('utan förfrågningar visas tomläget', async () => {
    render(<NotificationsScreen />)
    expect(await screen.findByText('Inga notiser ännu')).toBeOnTheScreen()
  })

  it('vänförfrågningar listas och Godkänn sparar', async () => {
    ;(getIncomingRequests as jest.Mock).mockResolvedValue([
      { id: 'u2', name: 'Nawid', avatar_url: '🔥' },
    ])
    render(<NotificationsScreen />)
    expect(await screen.findByText('Nawid')).toBeOnTheScreen()
    expect(screen.getByText('vill följa dig och se din statistik')).toBeOnTheScreen()
    fireEvent.press(screen.getByTestId('accept-u2'))
    expect(acceptFollower).toHaveBeenCalledWith('u2')
    expect(screen.queryByText('Nawid')).not.toBeOnTheScreen()   // raden försvinner direkt
  })

  it('Avböj tar bort förfrågan', async () => {
    ;(getIncomingRequests as jest.Mock).mockResolvedValue([
      { id: 'u2', name: 'Nawid', avatar_url: null },
    ])
    render(<NotificationsScreen />)
    await screen.findByText('Nawid')
    fireEvent.press(screen.getByTestId('decline-u2'))
    expect(declineFollower).toHaveBeenCalledWith('u2')
    expect(screen.queryByText('Nawid')).not.toBeOnTheScreen()
  })
})
