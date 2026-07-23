import { render, screen, fireEvent } from '@testing-library/react-native'
import CommunityScreen, { relativeDayLabel, dayPartTitle } from '../(app)/community'

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
  getProfile: jest.fn().mockResolvedValue({ name: 'Anton Wretenberg', avatar_url: '💪' }),
}))
jest.mock('@/services/feed', () => ({
  FEED_PAGE_SIZE: 60,
  fetchFeedPage: jest.fn().mockResolvedValue({ cardio: [], strength: [], count: 0, oldest: null }),
}))
jest.mock('@/services/follows', () => ({
  getFollowLists: jest.fn().mockResolvedValue({ followers: [], following: [] }),
}))
jest.mock('@/services/groups', () => ({
  getMyGroups: jest.fn().mockResolvedValue([
    { id: 'g1', name: 'Löparligan', avatar_url: null, is_private: false, memberCount: 3, myStatus: 'accepted' },
  ]),
  searchGroups: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/components/GroupWizard', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return { GroupWizard: ({ visible }: { visible: boolean }) =>
    visible ? React.createElement(Text, null, 'wizard:open') : null }
})
jest.mock('@/services/social', () => ({
  getFeedSocial: jest.fn().mockResolvedValue({}),
  likePost: jest.fn().mockResolvedValue(undefined),
  unlikePost: jest.fn().mockResolvedValue(undefined),
  getComments: jest.fn().mockResolvedValue([]),
  addComment: jest.fn().mockResolvedValue(undefined),
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
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}))
// Detaljvyerna har egna testpaket — här räcker det att se att de öppnas
jest.mock('@/components/CardioSummaryView', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return { CardioSummaryView: ({ title, effortReadOnly }: { title: string; effortReadOnly?: boolean }) =>
    React.createElement(Text, null, `summary:${title}${effortReadOnly ? ':readonly' : ''}`) }
})
jest.mock('@/components/stats/GymSummaryView', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return { GymSummaryView: ({ name }: { name: string }) =>
    React.createElement(Text, null, `gym:${name}`) }
})

const RUN = {
  id: 'w1',
  name: 'Löpning',
  created_at: '2026-07-16T07:30:00.000Z',
  data: {
    category: 'cardio', type: 'running',
    distance_km: 5.01, duration_seconds: 2709, calories: 400,
    route: [[58.55, 13.92], [58.56, 13.93]] as Array<[number, number]>,
  },
}

const GYM_DAY = [
  {
    id: 's1', name: 'Bänkpress', created_at: '2026-07-15T17:00:00.000Z',
    data: {
      category: 'strength', exercise_id: 'e1', exercise_name: 'Bänkpress',
      sets: [{ reps: 8, weight_kg: 60 }, { reps: 8, weight_kg: 60 }],
      workout_date: '2026-07-15',
    },
  },
  {
    id: 's2', name: 'Marklyft', created_at: '2026-07-15T17:20:00.000Z',
    data: {
      category: 'strength', exercise_id: 'e2', exercise_name: 'Marklyft',
      sets: [{ reps: 5, weight_kg: 100 }],
      workout_date: '2026-07-15',
    },
  },
]

const { fetchFeedPage } = require('@/services/feed')
const { getFollowLists } = require('@/services/follows')

const FRIEND_RUN = {
  id: 'w2',
  name: 'Kvällsrunda',
  created_at: '2026-07-20T18:30:00.000Z',
  data: {
    category: 'cardio', type: 'running',
    distance_km: 8.2, duration_seconds: 2952, calories: 600,
  },
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(fetchFeedPage as jest.Mock).mockResolvedValue({
    cardio: [{ userId: 'u1', workout: RUN }],
    strength: [],
    count: 1,
    oldest: RUN.created_at,
  })
  ;(getFollowLists as jest.Mock).mockResolvedValue({ followers: [], following: [] })
  const { getFeedSocial } = require('@/services/social')
  ;(getFeedSocial as jest.Mock).mockResolvedValue({})
})

describe('Community', () => {
  it('visar flödeskort med namn, typ, statistik och gilla-knapp', async () => {
    render(<CommunityScreen />)
    expect(await screen.findByText('Anton Wretenberg')).toBeOnTheScreen()
    expect(screen.getByText(/Löpning, /)).toBeOnTheScreen()
    expect(screen.getByText('5,01')).toBeOnTheScreen()
    expect(screen.getByText('45:09')).toBeOnTheScreen()   // fmtTime(2709)
    expect(screen.getByText('km')).toBeOnTheScreen()
    expect(screen.getByText('min/km')).toBeOnTheScreen()
    // Gilla växlar hjärtat lokalt
    fireEvent.press(screen.getByTestId('like-w1'))
    expect(screen.getByText('icon:heart')).toBeOnTheScreen()
  })

  it('godkända vänners pass blandas in i flödet', async () => {
    const { router } = require('expo-router')
    ;(getFollowLists as jest.Mock).mockResolvedValue({
      followers: [],
      following: [{ id: 'u2', name: 'Nawid', avatar_url: '🔥' }],
    })
    ;(fetchFeedPage as jest.Mock).mockResolvedValue({
      cardio: [
        { userId: 'u1', workout: RUN },
        { userId: 'u2', workout: FRIEND_RUN },
      ],
      strength: [],
      count: 2,
      oldest: FRIEND_RUN.created_at,
    })
    render(<CommunityScreen />)
    expect(await screen.findByText('Nawid')).toBeOnTheScreen()
    expect(screen.getByText('Anton Wretenberg')).toBeOnTheScreen()
    expect(screen.getByText('8,20')).toBeOnTheScreen()          // vännens distans
    // Vännens avatar leder till DERAS profil
    fireEvent.press(screen.getByTestId('avatar-w2'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(app)/athlete',
      params: { userId: 'u2', name: 'Nawid', avatar: '🔥' },
    })
    // Vännens pass öppnas med skrivskyddat betyg
    fireEvent.press(screen.getByTestId('post-w2'))
    expect(screen.getByText('summary:Kvällsrunda:readonly')).toBeOnTheScreen()
  })

  it('gilla sparar på riktigt och räknaren tickar direkt', async () => {
    const { likePost, unlikePost, getFeedSocial } = require('@/services/social')
    ;(getFeedSocial as jest.Mock).mockResolvedValue({
      w1: { likes: 2, likedByMe: false, comments: 1 },
    })
    render(<CommunityScreen />)
    await screen.findByText('Anton Wretenberg')
    expect(await screen.findByText('2')).toBeOnTheScreen()      // gillaräknare
    fireEvent.press(screen.getByTestId('like-w1'))
    expect(likePost).toHaveBeenCalledWith('w1', 'u1')
    expect(screen.getByText('3')).toBeOnTheScreen()             // optimistiskt +1
    fireEvent.press(screen.getByTestId('like-w1'))
    expect(unlikePost).toHaveBeenCalledWith('w1')
    expect(screen.getByText('2')).toBeOnTheScreen()
  })

  it('pratbubblan öppnar inläggets diskussionssida', async () => {
    const { router } = require('expo-router')
    render(<CommunityScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByTestId('comments-w1'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(app)/post',
      params: {
        postKey: 'w1',
        ownerId: 'u1',
        ownerName: 'Anton Wretenberg',
        ownerAvatar: '💪',
        kind: 'cardio',
        title: 'Löpning',
        createdAt: RUN.created_at,
        meta: '5,01 km',
      },
    })
  })

  it('gympass visas i flödet: dagens övningar grupperade till ett kort', async () => {
    ;(fetchFeedPage as jest.Mock).mockResolvedValue({
      cardio: [{ userId: 'u1', workout: RUN }],
      strength: GYM_DAY.map(w => ({ userId: 'u1', workout: w })),
      count: 3,
      oldest: RUN.created_at,
    })
    render(<CommunityScreen />)
    await screen.findAllByText('Anton Wretenberg')   // löprundan + gympasset
    expect(screen.getByText(/Gympass, /)).toBeOnTheScreen()
    expect(screen.getByText('övningar')).toBeOnTheScreen()
    expect(screen.getByText('3')).toBeOnTheScreen()            // 2 + 1 set
    expect(screen.getByText((2 * 8 * 60 + 5 * 100).toLocaleString('sv-SE'))).toBeOnTheScreen()
    fireEvent.press(screen.getByTestId('post-gym-u1-2026-07-15'))
    expect(screen.getByText('gym:Gympass')).toBeOnTheScreen()
  })

  it('filterchipsen växlar flödet mellan alla, cardio och gym', async () => {
    ;(fetchFeedPage as jest.Mock).mockResolvedValue({
      cardio: [{ userId: 'u1', workout: RUN }],
      strength: GYM_DAY.map(w => ({ userId: 'u1', workout: w })),
      count: 3,
      oldest: RUN.created_at,
    })
    render(<CommunityScreen />)
    await screen.findAllByText('Anton Wretenberg')
    fireEvent.press(screen.getByText('Gym'))
    expect(screen.queryByText('5,01')).not.toBeOnTheScreen()
    expect(screen.getByText(/Gympass, /)).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Cardio'))
    expect(screen.getByText('5,01')).toBeOnTheScreen()
    expect(screen.queryByText(/Gympass, /)).not.toBeOnTheScreen()
    fireEvent.press(screen.getByText('Alla'))
    expect(screen.getByText('5,01')).toBeOnTheScreen()
    expect(screen.getByText(/Gympass, /)).toBeOnTheScreen()
  })

  it('tryck på kortet öppnar samma passdetaljvy som statistiken', async () => {
    render(<CommunityScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByTestId('post-w1'))
    expect(screen.getByText('summary:Löpning')).toBeOnTheScreen()
  })

  it('egna avataren leder direkt till profilfliken', async () => {
    const { router } = require('expo-router')
    render(<CommunityScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByTestId('avatar-w1'))
    expect(router.push).toHaveBeenCalledWith('/(app)/profile')
  })

  it('följer-knappen leder till Följer-sidan', async () => {
    const { router } = require('expo-router')
    render(<CommunityScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByText('glassbtn:people-outline'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(app)/following',
      params: { tab: 'following' },
    })
  })

  it('Grupper-segmentet listar mina grupper och öppnar gruppsidan', async () => {
    const { router } = require('expo-router')
    render(<CommunityScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByText('Grupper'))
    expect(await screen.findByText('Löparligan')).toBeOnTheScreen()
    expect(screen.getByText('3 medlemmar')).toBeOnTheScreen()
    fireEvent.press(screen.getByTestId('group-g1'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(app)/group',
      params: { groupId: 'g1' },
    })
  })

  it('Skapa grupp öppnar skaparguiden', async () => {
    render(<CommunityScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByText('Grupper'))
    fireEvent.press(await screen.findByTestId('createGroup'))
    expect(screen.getByText('wizard:open')).toBeOnTheScreen()
  })

  it('Sök grupper öppnar sökvyn med QR-skanning', async () => {
    render(<CommunityScreen />)
    await screen.findByText('Anton Wretenberg')
    fireEvent.press(screen.getByText('Grupper'))
    fireEvent.press(await screen.findByTestId('searchGroups'))
    expect(screen.getByText('Hitta grupper')).toBeOnTheScreen()
    expect(screen.getByTestId('scanGroup')).toBeOnTheScreen()
  })

  it('tomt flöde visar tom-läge med Hitta vänner-knapp', async () => {
    const { router } = require('expo-router')
    ;(fetchFeedPage as jest.Mock).mockResolvedValue({ cardio: [], strength: [], count: 0, oldest: null })
    render(<CommunityScreen />)
    expect(await screen.findByText('Inget i flödet ännu')).toBeOnTheScreen()
    fireEvent.press(screen.getByTestId('emptyCta'))
    expect(router.push).toHaveBeenCalledWith('/(app)/search-users')
  })

  it('relativeDayLabel: idag, igår och X dagar sedan', () => {
    const now = new Date('2026-07-22T10:00:00')
    expect(relativeDayLabel('2026-07-22T02:00:00', now)).toBe('idag')
    expect(relativeDayLabel('2026-07-21T23:00:00', now)).toBe('igår')
    expect(relativeDayLabel('2026-07-17T09:00:00', now)).toBe('5 dagar sedan')
  })

  it('dayPartTitle: veckodag + del av dygnet', () => {
    expect(dayPartTitle('2026-07-16T07:30:00')).toBe('Torsdag morgon')
    expect(dayPartTitle('2026-07-15T19:00:00')).toBe('Onsdag kväll')
  })
})
