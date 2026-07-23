import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import SearchUsersScreen from '../(app)/search-users'
import { searchProfiles } from '@/services/profile'

jest.mock('@/services/profile', () => ({
  searchProfiles: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/services/follows', () => ({
  getFollowStatuses: jest.fn().mockResolvedValue({}),
  getFollowStatus: jest.fn().mockResolvedValue('pending'),
  follow: jest.fn().mockResolvedValue(undefined),
  unfollow: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}))
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}))

const { getFollowStatuses, getFollowStatus, follow, unfollow } = require('@/services/follows')

beforeEach(() => {
  jest.clearAllMocks()
  ;(searchProfiles as jest.Mock).mockResolvedValue([])
  ;(getFollowStatuses as jest.Mock).mockResolvedValue({})
  ;(getFollowStatus as jest.Mock).mockResolvedValue('pending')
})

describe('Sök användare', () => {
  it('kort fråga söker inte — visar instruktionen', () => {
    render(<SearchUsersScreen />)
    fireEvent.changeText(screen.getByTestId('searchInput'), 'a')
    expect(screen.getByText('Sök efter andra')).toBeOnTheScreen()
    expect(searchProfiles).not.toHaveBeenCalled()
  })

  it('söker efter debounce och listar träffar', async () => {
    ;(searchProfiles as jest.Mock).mockResolvedValue([
      { id: 'u2', name: 'Kalle', avatar_url: '🔥' },
      { id: 'u3', name: 'Nadja', avatar_url: null },
    ])
    render(<SearchUsersScreen />)
    fireEvent.changeText(screen.getByTestId('searchInput'), 'Na')
    expect(await screen.findByText('Kalle')).toBeOnTheScreen()
    expect(screen.getByText('Nadja')).toBeOnTheScreen()
    expect(searchProfiles).toHaveBeenCalledWith('Na')
  })

  it('träffarna visar följstatus och kan följas direkt', async () => {
    ;(searchProfiles as jest.Mock).mockResolvedValue([
      { id: 'u2', name: 'Kalle', avatar_url: '🔥' },
      { id: 'u3', name: 'Sara', avatar_url: null },
    ])
    ;(getFollowStatuses as jest.Mock).mockResolvedValue({ u2: 'accepted', u3: 'none' })
    render(<SearchUsersScreen />)
    fireEvent.changeText(screen.getByTestId('searchInput'), 'a b')
    expect(await screen.findByText('Följer')).toBeOnTheScreen()   // Kalle följs redan
    expect(screen.getByText('Följ')).toBeOnTheScreen()            // Sara följs inte
    fireEvent.press(screen.getByTestId('follow-u3'))              // skicka förfrågan
    expect(follow).toHaveBeenCalledWith('u3')
    expect(await screen.findByText('Förfrågad')).toBeOnTheScreen()
  })

  it('Följer-pillen avföljer direkt', async () => {
    ;(searchProfiles as jest.Mock).mockResolvedValue([
      { id: 'u2', name: 'Kalle', avatar_url: '🔥' },
    ])
    ;(getFollowStatuses as jest.Mock).mockResolvedValue({ u2: 'accepted' })
    render(<SearchUsersScreen />)
    fireEvent.changeText(screen.getByTestId('searchInput'), 'Na')
    await screen.findByText('Följer')
    fireEvent.press(screen.getByTestId('follow-u2'))
    expect(unfollow).toHaveBeenCalledWith('u2')
    expect(screen.getByText('Följ')).toBeOnTheScreen()
  })

  it('tryck på en träff öppnar personens profil', async () => {
    const { router } = require('expo-router')
    ;(searchProfiles as jest.Mock).mockResolvedValue([
      { id: 'u2', name: 'Kalle', avatar_url: '🔥' },
    ])
    render(<SearchUsersScreen />)
    fireEvent.changeText(screen.getByTestId('searchInput'), 'Na')
    await screen.findByText('Kalle')
    fireEvent.press(screen.getByTestId('hit-u2'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(app)/athlete',
      params: { userId: 'u2', name: 'Kalle', avatar: '🔥' },
    })
  })

  it('inga träffar visar tomläget', async () => {
    render(<SearchUsersScreen />)
    fireEvent.changeText(screen.getByTestId('searchInput'), 'Zzz')
    await waitFor(() => expect(screen.getByText('Inga träffar')).toBeOnTheScreen())
  })
})
