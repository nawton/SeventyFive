import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { GroupPosts } from '../GroupPosts'
import { getGroupPosts, createGroupPost, type Group } from '@/services/groups'

jest.mock('@/services/groups', () => ({
  getGroupPosts: jest.fn().mockResolvedValue([]),
  createGroupPost: jest.fn().mockResolvedValue(undefined),
  deleteGroupPost: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/report', () => ({ promptReport: jest.fn() }))
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }))
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react')
    useEffect(cb, [cb])
  },
}))

const group = { id: 'g1', name: 'Löparligan', only_owner_posts: false } as Group

describe('GroupPosts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('visar inlägg med avsändare och text', async () => {
    ;(getGroupPosts as jest.Mock).mockResolvedValue([{
      id: 'p1', group_id: 'g1', author_id: 'u2', body: 'Grymt jobbat allihop!',
      image_url: null, reply_to: null,
      created_at: new Date().toISOString(), authorName: 'Anna Andersson', authorAvatar: null,
    }])
    render(<GroupPosts group={group} me="u1" isOwner={false} />)
    expect(await screen.findByText('Grymt jobbat allihop!')).toBeOnTheScreen()
    expect(screen.getByText('Anna Andersson')).toBeOnTheScreen()
  })

  it('composern publicerar och tömmer utkastet', async () => {
    render(<GroupPosts group={group} me="u1" isOwner={false} />)
    const input = await screen.findByTestId('postDraft')
    fireEvent.changeText(input, 'Vi kör imorgon 07:00')
    fireEvent.press(screen.getByTestId('postSend'))
    await waitFor(() => expect(createGroupPost).toHaveBeenCalledWith(
      'g1', 'Vi kör imorgon 07:00', { replyTo: null, imageUri: null }))
  })

  it('endast-skaparen-läget gömmer composern för medlemmar', async () => {
    render(<GroupPosts group={{ ...group, only_owner_posts: true }} me="u1" isOwner={false} />)
    expect(await screen.findByText('Bara skaparen kan skriva inlägg i den här gruppen.')).toBeOnTheScreen()
    expect(screen.queryByTestId('postDraft')).toBeNull()
  })
})
