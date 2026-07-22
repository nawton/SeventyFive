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
jest.mock('@/services/follows', () => ({
  getFollowLists: jest.fn().mockResolvedValue({ followers: [], following: [] }),
  follow: jest.fn().mockResolvedValue(undefined),
  unfollow: jest.fn().mockResolvedValue(undefined),
  subscribeToFollows: jest.fn(() => () => {}),
}))
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react')
    useEffect(cb, [cb])
  },
  useLocalSearchParams: () => mockParams,
}))
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }))

const { getFollowLists, follow, unfollow } = require('@/services/follows')

const NAWID = { id: 'u2', name: 'Nawid', avatar_url: '🔥' }
const SARA  = { id: 'u3', name: 'Sara', avatar_url: null }

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {}
  ;(getFollowLists as jest.Mock).mockResolvedValue({ followers: [], following: [] })
})

describe('Följare/Följer', () => {
  it('tomma listor: nollräknare och tomlägen per flik', async () => {
    render(<FollowingScreen />)
    expect(await screen.findByText('Anton Wretenberg')).toBeOnTheScreen()
    expect(screen.getByText('0 Följare')).toBeOnTheScreen()
    expect(screen.getByText('0 Följer')).toBeOnTheScreen()
    expect(screen.getByText('Du följer ingen ännu')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('0 Följare'))
    expect(screen.getByText('Inga följare ännu')).toBeOnTheScreen()
  })

  it('riktiga listor: räknare, rader och avfölj som sparar', async () => {
    ;(getFollowLists as jest.Mock).mockResolvedValue({
      followers: [SARA],
      following: [NAWID],
    })
    render(<FollowingScreen />)
    expect(await screen.findByText('Nawid')).toBeOnTheScreen()   // Följer-fliken är default
    expect(screen.getByText('1 Följare')).toBeOnTheScreen()
    expect(screen.getByText('1 Följer')).toBeOnTheScreen()

    fireEvent.press(screen.getByTestId('follow-u2'))             // avfölj Nawid
    expect(unfollow).toHaveBeenCalledWith('u2')
    expect(screen.getByText('Följ')).toBeOnTheScreen()           // pillen vände direkt

    fireEvent.press(screen.getByText('1 Följare'))               // Sara följer mig
    expect(screen.getByText('Sara')).toBeOnTheScreen()
    fireEvent.press(screen.getByTestId('follow-u3'))             // följ tillbaka = förfrågan
    expect(follow).toHaveBeenCalledWith('u3')
    expect(screen.getByText('Förfrågad')).toBeOnTheScreen()      // pending tills godkänd
  })

  it('tab-parametern öppnar rätt flik', async () => {
    mockParams = { tab: 'followers' }
    ;(getFollowLists as jest.Mock).mockResolvedValue({ followers: [SARA], following: [NAWID] })
    render(<FollowingScreen />)
    expect(await screen.findByText('Sara')).toBeOnTheScreen()       // följare-fliken direkt
    expect(screen.queryByText('Nawid')).not.toBeOnTheScreen()
  })

  it('tryck på en rad öppnar personens profil', async () => {
    const { router } = require('expo-router')
    ;(getFollowLists as jest.Mock).mockResolvedValue({ followers: [], following: [NAWID] })
    render(<FollowingScreen />)
    await screen.findByText('Nawid')
    fireEvent.press(screen.getByText('Nawid'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(app)/athlete',
      params: { userId: 'u2', name: 'Nawid', avatar: '🔥' },
    })
  })
})
