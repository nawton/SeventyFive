import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import SearchUsersScreen from '../(app)/search-users'
import { searchProfiles } from '@/services/profile'

jest.mock('@/services/profile', () => ({
  searchProfiles: jest.fn().mockResolvedValue([]),
}))
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}))
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}))

beforeEach(() => {
  jest.clearAllMocks()
  ;(searchProfiles as jest.Mock).mockResolvedValue([])
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
      { id: 'u2', name: 'Nawid', avatar_url: '🔥' },
      { id: 'u3', name: 'Nadja', avatar_url: null },
    ])
    render(<SearchUsersScreen />)
    fireEvent.changeText(screen.getByTestId('searchInput'), 'Na')
    expect(await screen.findByText('Nawid')).toBeOnTheScreen()
    expect(screen.getByText('Nadja')).toBeOnTheScreen()
    expect(searchProfiles).toHaveBeenCalledWith('Na')
  })

  it('inga träffar visar tomläget', async () => {
    render(<SearchUsersScreen />)
    fireEvent.changeText(screen.getByTestId('searchInput'), 'Zzz')
    await waitFor(() => expect(screen.getByText('Inga träffar')).toBeOnTheScreen())
  })
})
