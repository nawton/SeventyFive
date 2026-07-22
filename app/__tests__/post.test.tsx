import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import PostScreen from '../(app)/post'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'u1', email: 'anton@example.com' } } },
      }),
    },
  },
}))
jest.mock('@/services/cardioWorkouts', () => ({
  getCardioWorkoutById: jest.fn().mockResolvedValue(null),
}))
jest.mock('@/services/social', () => ({
  getFeedSocial: jest.fn().mockResolvedValue({}),
  getPostLikers: jest.fn().mockResolvedValue([]),
  getComments: jest.fn().mockResolvedValue([]),
  addComment: jest.fn().mockResolvedValue(undefined),
  likePost: jest.fn().mockResolvedValue(undefined),
  unlikePost: jest.fn().mockResolvedValue(undefined),
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
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}))

const {
  getFeedSocial, getPostLikers, getComments, addComment, likePost,
} = require('@/services/social')

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {
    postKey: 'w1', ownerId: 'u2', ownerName: 'Alva Wretenberg', ownerAvatar: '',
    kind: 'cardio', title: 'Löpning på eftermiddagen',
    createdAt: '2026-07-21T16:00:00.000Z', meta: '6,05 km',
  }
  ;(getFeedSocial as jest.Mock).mockResolvedValue({
    w1: { likes: 2, likedByMe: false, comments: 1 },
  })
  ;(getPostLikers as jest.Mock).mockResolvedValue([
    { id: 'u3', name: 'Johan', avatar_url: null },
    { id: 'u4', name: 'Malin', avatar_url: '🌊' },
  ])
  ;(getComments as jest.Mock).mockResolvedValue([
    {
      id: 'c1', authorId: 'u3', authorName: 'Johan Wretenberg', authorAvatar: null,
      body: 'Du är bra igång Alva!', createdAt: '2026-07-21T18:00:00.000Z',
    },
  ])
})

describe('Diskussion', () => {
  it('visar titel, meta, gillanden och kommentarstråden', async () => {
    render(<PostScreen />)
    expect(await screen.findByText('Löpning på eftermiddagen')).toBeOnTheScreen()
    expect(screen.getByText(/Alva Wretenberg/)).toBeOnTheScreen()
    expect(screen.getByText(/6,05 km/)).toBeOnTheScreen()
    expect(await screen.findByText('2')).toBeOnTheScreen()          // gillaräknare
    expect(await screen.findByText('Johan Wretenberg')).toBeOnTheScreen()
    expect(screen.getByText('Du är bra igång Alva!')).toBeOnTheScreen()
  })

  it('gilla sparar och räknaren tickar', async () => {
    render(<PostScreen />)
    await screen.findByText('2')
    fireEvent.press(screen.getByTestId('postLike'))
    expect(likePost).toHaveBeenCalledWith('w1', 'u2')
    expect(screen.getByText('3')).toBeOnTheScreen()
  })

  it('tryck på en kommentar öppnar personens profil', async () => {
    const { router } = require('expo-router')
    render(<PostScreen />)
    await screen.findByText('Johan Wretenberg')
    fireEvent.press(screen.getByTestId('comment-c1'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(app)/athlete',
      params: { userId: 'u3', name: 'Johan Wretenberg', avatar: '' },
    })
  })

  it('skicka lägger till kommentaren', async () => {
    render(<PostScreen />)
    await screen.findByText('Löpning på eftermiddagen')
    fireEvent.changeText(screen.getByTestId('commentInput'), 'Grymt tempo!')
    fireEvent.press(screen.getByTestId('commentSend'))
    await waitFor(() =>
      expect(addComment).toHaveBeenCalledWith('w1', 'u2', 'Grymt tempo!'))
  })
})
