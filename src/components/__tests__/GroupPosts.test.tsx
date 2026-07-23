import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { GroupPosts } from '../GroupPosts'
import { getGroupPosts, createGroupPost, type Group } from '@/services/groups'

jest.mock('@/services/groups', () => ({
  getGroupPosts: jest.fn().mockResolvedValue([]),
  createGroupPost: jest.fn().mockResolvedValue(undefined),
  deleteGroupPost: jest.fn().mockResolvedValue(undefined),
  setGroupPostPinned: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/services/social', () => ({
  getFeedSocial: jest.fn().mockResolvedValue({}),
  likePost: jest.fn().mockResolvedValue(undefined),
  unlikePost: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/report', () => ({ promptReport: jest.fn() }))
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}))
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react')
    useEffect(cb, [cb])
  },
}))

const group = { id: 'g1', name: 'Löparligan', only_owner_posts: false } as Group

const POST = {
  id: 'p1', group_id: 'g1', author_id: 'u2', body: 'Grymt jobbat allihop!',
  image_url: null, reply_to: null, pinned: false,
  created_at: new Date().toISOString(), authorName: 'Anna Andersson', authorAvatar: null,
}

describe('GroupPosts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('visar inlägg med avsändare, text och social rad', async () => {
    ;(getGroupPosts as jest.Mock).mockResolvedValue([POST])
    render(<GroupPosts group={group} me="u1" isOwner={false} />)
    expect(await screen.findByText('Grymt jobbat allihop!')).toBeOnTheScreen()
    expect(screen.getByText('Anna Andersson')).toBeOnTheScreen()
    expect(screen.getByTestId('gpLike-p1')).toBeOnTheScreen()
    expect(screen.getByTestId('gpComments-p1')).toBeOnTheScreen()
  })

  it('pratbubblan öppnar samma diskussionssida som passen', async () => {
    const { router } = require('expo-router')
    ;(getGroupPosts as jest.Mock).mockResolvedValue([POST])
    render(<GroupPosts group={group} me="u1" isOwner={false} />)
    fireEvent.press(await screen.findByTestId('gpComments-p1'))
    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/(app)/post',
      params: expect.objectContaining({ postKey: 'grp-p1', ownerId: 'u2' }),
    }))
  })

  it('fäst inlägg ligger överst med markering', async () => {
    const older = { ...POST, id: 'p0', body: 'Gammalt men fäst', pinned: true,
      created_at: new Date(Date.now() - 86_400_000).toISOString() }
    ;(getGroupPosts as jest.Mock).mockResolvedValue([POST, older])
    render(<GroupPosts group={group} me="u1" isOwner={false} />)
    expect(await screen.findByText('Fäst inlägg')).toBeOnTheScreen()
    // Det fästa inlägget renderas före det nyare
    const pinned = screen.getByText('Gammalt men fäst')
    const newer = screen.getByText('Grymt jobbat allihop!')
    expect(pinned).toBeOnTheScreen()
    expect(newer).toBeOnTheScreen()
  })

  it('composern publicerar och tömmer utkastet', async () => {
    render(<GroupPosts group={group} me="u1" isOwner={false} />)
    const input = await screen.findByTestId('postDraft')
    fireEvent.changeText(input, 'Vi kör imorgon 07:00')
    fireEvent.press(screen.getByTestId('postSend'))
    await waitFor(() => expect(createGroupPost).toHaveBeenCalledWith(
      'g1', 'Vi kör imorgon 07:00', { imageUri: null }))
  })

  it('endast-skaparen-läget gömmer composern för medlemmar', async () => {
    render(<GroupPosts group={{ ...group, only_owner_posts: true }} me="u1" isOwner={false} />)
    expect(await screen.findByText('Bara skaparen kan skriva inlägg i den här gruppen.')).toBeOnTheScreen()
    expect(screen.queryByTestId('postDraft')).toBeNull()
  })
})
