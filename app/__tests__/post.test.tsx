import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
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
  deleteComment: jest.fn().mockResolvedValue(undefined),
  likePost: jest.fn().mockResolvedValue(undefined),
  unlikePost: jest.fn().mockResolvedValue(undefined),
  likeComment: jest.fn().mockResolvedValue(undefined),
  unlikeComment: jest.fn().mockResolvedValue(undefined),
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
// Detaljvyn har ett eget testpaket — här räcker det att se att den öppnas
jest.mock('@/components/CardioSummaryView', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return { CardioSummaryView: ({ title, effortReadOnly }: { title: string; effortReadOnly?: boolean }) =>
    React.createElement(Text, null, `summary:${title}${effortReadOnly ? ':readonly' : ''}`) }
})

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
      likes: 0, likedByMe: false,
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

  it('long-press på egen kommentar raderar efter bekräftelse', async () => {
    const { Alert } = require('react-native')
    const { deleteComment } = require('@/services/social')
    const alertSpy = jest.spyOn(Alert, 'alert')
    ;(getComments as jest.Mock).mockResolvedValue([
      {
        id: 'c2', authorId: 'u1', authorName: 'Anton', authorAvatar: null,
        body: 'Min egen kommentar', createdAt: '2026-07-21T19:00:00.000Z',
        likes: 0, likedByMe: false,
      },
    ])
    render(<PostScreen />)
    await screen.findByText('Min egen kommentar')
    fireEvent(screen.getByTestId('comment-c2'), 'longPress')
    expect(alertSpy).toHaveBeenCalled()
    // Tryck "Radera" i dialogen
    const buttons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>
    act(() => { buttons.find(b => b.text === 'Radera')?.onPress?.() })
    expect(deleteComment).toHaveBeenCalledWith('c2')
    expect(screen.queryByText('Min egen kommentar')).not.toBeOnTheScreen()
  })

  it('long-press på annans kommentar på annans pass gör ingenting', async () => {
    const { Alert } = require('react-native')
    const alertSpy = jest.spyOn(Alert, 'alert')
    render(<PostScreen />)
    await screen.findByText('Johan Wretenberg')
    fireEvent(screen.getByTestId('comment-c1'), 'longPress')
    expect(alertSpy).not.toHaveBeenCalled()
  })

  it('hjärtat på en kommentar gillar och räknar upp', async () => {
    const { likeComment } = require('@/services/social')
    render(<PostScreen />)
    await screen.findByText('Johan Wretenberg')
    fireEvent.press(screen.getByTestId('commentLike-c1'))
    expect(likeComment).toHaveBeenCalledWith('c1')
    expect(screen.getByText('1')).toBeOnTheScreen()   // kommentarens gillaräknare
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

  it('tryck på kartan öppnar passdetaljvyn — skrivskyddad på annans pass', async () => {
    const { getCardioWorkoutById } = require('@/services/cardioWorkouts')
    ;(getCardioWorkoutById as jest.Mock).mockResolvedValue({
      id: 'w1', name: 'Löpning på eftermiddagen', created_at: '2026-07-21T16:00:00.000Z',
      data: {
        category: 'cardio', type: 'running',
        distance_km: 6.05, duration_seconds: 2000, calories: 400,
        route: [[58.55, 13.92], [58.56, 13.93]],
      },
    })
    render(<PostScreen />)
    const map = await screen.findByTestId('postMap')
    fireEvent.press(map)
    expect(screen.getByText('summary:Löpning på eftermiddagen:readonly')).toBeOnTheScreen()
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
