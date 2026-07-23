import { render, screen, fireEvent } from '@testing-library/react-native'
import NotificationsScreen from '../(app)/notifications'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'u1', email: 'erik@example.com' } } },
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
jest.mock('@/services/social', () => ({
  getSocialNotifications: jest.fn().mockResolvedValue([]),
  subscribeToSocial: jest.fn(() => () => {}),
}))
jest.mock('@/lib/prefs', () => ({
  setNotifSeenAt: jest.fn().mockResolvedValue(undefined),
  getNotifSeenAt: jest.fn().mockResolvedValue(null),
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
const { getSocialNotifications } = require('@/services/social')

beforeEach(() => {
  jest.clearAllMocks()
  ;(getIncomingRequests as jest.Mock).mockResolvedValue([])
  ;(getSocialNotifications as jest.Mock).mockResolvedValue([])
})

describe('Notiser', () => {
  it('utan förfrågningar visas tomläget', async () => {
    render(<NotificationsScreen />)
    expect(await screen.findByText('Inga notiser ännu')).toBeOnTheScreen()
  })

  it('vänförfrågningar listas och Godkänn sparar', async () => {
    ;(getIncomingRequests as jest.Mock).mockResolvedValue([
      { id: 'u2', name: 'Kalle', avatar_url: '🔥' },
    ])
    render(<NotificationsScreen />)
    expect(await screen.findByText('Kalle')).toBeOnTheScreen()
    expect(screen.getByText('vill följa dig och se din statistik')).toBeOnTheScreen()
    fireEvent.press(screen.getByTestId('accept-u2'))
    expect(acceptFollower).toHaveBeenCalledWith('u2')
    expect(screen.queryByText('Kalle')).not.toBeOnTheScreen()   // raden försvinner direkt
  })

  it('gillanden och kommentarer listas under Aktivitet', async () => {
    ;(getSocialNotifications as jest.Mock).mockResolvedValue([
      {
        kind: 'like', postKey: 'w1',
        from: { id: 'u2', name: 'Kalle', avatar_url: '🔥' },
        body: null, createdAt: '2026-07-22T08:00:00.000Z',
      },
      {
        kind: 'comment', postKey: 'gym-u1-2026-07-20',
        from: { id: 'u3', name: 'Sara', avatar_url: null },
        body: 'Snyggt jobbat!', createdAt: '2026-07-22T07:00:00.000Z',
      },
    ])
    render(<NotificationsScreen />)
    expect(await screen.findByText('Aktivitet')).toBeOnTheScreen()
    expect(screen.getByText(/gillade ditt pass/)).toBeOnTheScreen()
    expect(screen.getByText(/kommenterade ditt pass/)).toBeOnTheScreen()
    expect(screen.getByText('”Snyggt jobbat!”')).toBeOnTheScreen()
  })

  it('Avböj tar bort förfrågan', async () => {
    ;(getIncomingRequests as jest.Mock).mockResolvedValue([
      { id: 'u2', name: 'Kalle', avatar_url: null },
    ])
    render(<NotificationsScreen />)
    await screen.findByText('Kalle')
    fireEvent.press(screen.getByTestId('decline-u2'))
    expect(declineFollower).toHaveBeenCalledWith('u2')
    expect(screen.queryByText('Kalle')).not.toBeOnTheScreen()
  })
})
