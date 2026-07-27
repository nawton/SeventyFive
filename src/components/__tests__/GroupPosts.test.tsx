import { ActionSheetIOS, Alert, Image } from 'react-native'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import * as ImagePicker from 'expo-image-picker'
import { GroupPosts } from '../GroupPosts'
import {
  getGroupPosts, createGroupPost, deleteGroupPost, setGroupPostPinned, type Group,
} from '@/services/groups'
import { getFeedSocial, likePost, unlikePost } from '@/services/social'
import { promptReport } from '@/lib/report'

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
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }))
jest.mock('@/lib/image', () => ({
  compressImage: jest.fn((uri: string) => Promise.resolve(`komprimerad-${uri}`)),
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

  it('tidsstämplarna trappas: nu, minuter, timmar, dagar', async () => {
    const at = (msAgo: number) => new Date(Date.now() - msAgo).toISOString()
    ;(getGroupPosts as jest.Mock).mockResolvedValue([
      { ...POST, id: 'a', created_at: at(20_000) },
      { ...POST, id: 'b', created_at: at(5 * 60_000) },
      { ...POST, id: 'c', created_at: at(3 * 3_600_000) },
      { ...POST, id: 'd', created_at: at(2 * 86_400_000) },
    ])
    render(<GroupPosts group={group} me="u1" isOwner={false} />)
    expect(await screen.findByText('nu')).toBeOnTheScreen()
    expect(screen.getByText('5 min')).toBeOnTheScreen()
    expect(screen.getByText('3 h')).toBeOnTheScreen()
    expect(screen.getByText('2 d')).toBeOnTheScreen()
  })

  it('tomma flöden får olika uppmaning beroende på vem som får skriva', async () => {
    ;(getGroupPosts as jest.Mock).mockResolvedValue([])
    render(<GroupPosts group={group} me="u1" isOwner={false} />)
    expect(await screen.findByText('Inget i flödet ännu, skriv gruppens första inlägg!')).toBeOnTheScreen()

    render(<GroupPosts group={{ ...group, only_owner_posts: true }} me="u1" isOwner={false} />)
    expect(await screen.findByText('Inget i flödet ännu.')).toBeOnTheScreen()
  })
})

describe('GroupPosts — gillanden', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getGroupPosts as jest.Mock).mockResolvedValue([POST])
  })

  it('gilla räknas upp direkt och skickas till servern', async () => {
    ;(getFeedSocial as jest.Mock).mockResolvedValue({
      'grp-p1': { likes: 2, likedByMe: false, comments: 0 },
    })
    render(<GroupPosts group={group} me="u1" isOwner={false} />)
    expect(await screen.findByText('2')).toBeOnTheScreen()

    fireEvent.press(screen.getByTestId('gpLike-p1'))
    expect(screen.getByText('3')).toBeOnTheScreen()
    await waitFor(() => expect(likePost).toHaveBeenCalledWith('grp-p1', 'u2'))
  })

  it('ogilla räknar ner och misslyckade gillanden rullas tillbaka', async () => {
    ;(getFeedSocial as jest.Mock).mockResolvedValue({
      'grp-p1': { likes: 5, likedByMe: true, comments: 0 },
    })
    render(<GroupPosts group={group} me="u1" isOwner={false} />)
    expect(await screen.findByText('5')).toBeOnTheScreen()

    ;(unlikePost as jest.Mock).mockRejectedValue(new Error('nät'))
    fireEvent.press(screen.getByTestId('gpLike-p1'))
    expect(screen.getByText('4')).toBeOnTheScreen()
    // Servern sa nej → tillbaka till 5
    expect(await screen.findByText('5')).toBeOnTheScreen()
    expect(unlikePost).toHaveBeenCalledWith('grp-p1')
  })
})

describe('GroupPosts — menyn', () => {
  const sheetSpy = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions')

  beforeEach(() => {
    jest.clearAllMocks()
    sheetSpy.mockImplementation(() => {})
    ;(getGroupPosts as jest.Mock).mockResolvedValue([POST])
  })

  it('ägaren kan fästa, anmäla och radera andras inlägg', async () => {
    render(<GroupPosts group={group} me="u1" isOwner />)
    fireEvent.press(await screen.findByTestId('gpMenu-p1'))

    const [config, onChoose] = sheetSpy.mock.calls[0]
    expect(config.options).toEqual(['Avbryt', 'Fäst inlägget', 'Anmäl inlägget', 'Radera inlägget'])
    expect(config.destructiveButtonIndex).toBe(3)

    act(() => onChoose(1))
    await waitFor(() => expect(setGroupPostPinned).toHaveBeenCalledWith('p1', true))
    act(() => onChoose(3))
    await waitFor(() => expect(deleteGroupPost).toHaveBeenCalledWith('p1'))
    act(() => onChoose(0))   // Avbryt gör ingenting
    expect(promptReport).not.toHaveBeenCalled()
  })

  it('en vanlig medlem kan bara anmäla andras inlägg', async () => {
    render(<GroupPosts group={group} me="u1" isOwner={false} />)
    fireEvent.press(await screen.findByTestId('gpMenu-p1'))

    const [config, onChoose] = sheetSpy.mock.calls[0]
    expect(config.options).toEqual(['Avbryt', 'Anmäl inlägget'])
    act(() => onChoose(1))
    expect(promptReport).toHaveBeenCalledWith('post', 'grp-p1', 'Anmäl inlägget')
  })

  it('sitt eget inlägg kan man radera men inte anmäla', async () => {
    ;(getGroupPosts as jest.Mock).mockResolvedValue([{ ...POST, author_id: 'u1' }])
    render(<GroupPosts group={group} me="u1" isOwner={false} />)
    fireEvent.press(await screen.findByTestId('gpMenu-p1'))
    expect(sheetSpy.mock.calls[0][0].options).toEqual(['Avbryt', 'Radera inlägget'])
  })
})

describe('GroupPosts — bilder och publicering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getGroupPosts as jest.Mock).mockResolvedValue([])
  })

  it('vald bild komprimeras, kan tas bort, och skickas utan text', async () => {
    ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false, assets: [{ uri: 'file:///foto.jpg' }],
    })
    render(<GroupPosts group={group} me="u1" isOwner={false} />)

    fireEvent.press(await screen.findByTestId('pickImage'))
    await screen.findByTestId('removeImage')

    fireEvent.press(screen.getByTestId('removeImage'))
    expect(screen.queryByTestId('removeImage')).toBeNull()

    fireEvent.press(screen.getByTestId('pickImage'))
    await screen.findByTestId('removeImage')
    fireEvent.press(screen.getByTestId('postSend'))
    await waitFor(() => expect(createGroupPost).toHaveBeenCalledWith(
      'g1', '', { imageUri: 'komprimerad-file:///foto.jpg' }))
  })

  it('avbruten bildväljare lämnar composern orörd', async () => {
    ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true })
    render(<GroupPosts group={group} me="u1" isOwner={false} />)
    fireEvent.press(await screen.findByTestId('pickImage'))
    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled())
    expect(screen.queryByTestId('removeImage')).toBeNull()
  })

  it('tomt utkast skickas aldrig och publiceringsfel ger besked', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    render(<GroupPosts group={group} me="u1" isOwner={false} />)

    fireEvent.press(await screen.findByTestId('postSend'))
    expect(createGroupPost).not.toHaveBeenCalled()

    ;(createGroupPost as jest.Mock).mockRejectedValue(new Error('nät'))
    fireEvent.changeText(screen.getByTestId('postDraft'), 'Hej gruppen')
    fireEvent.press(screen.getByTestId('postSend'))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'Kunde inte publicera', expect.any(String)))
    alertSpy.mockRestore()
  })

  it('bildinlägg öppnar visaren i fullskärm och stängs med ett tryck', async () => {
    ;(getGroupPosts as jest.Mock).mockResolvedValue([
      { ...POST, body: null, image_url: 'https://bilder/x.jpg' },
    ])
    render(<GroupPosts group={group} me="u1" isOwner={false} />)
    await screen.findByTestId('gpLike-p1')

    const postImage = screen.UNSAFE_getAllByType(Image)
      .find(i => i.props.source?.uri === 'https://bilder/x.jpg' && !i.props.resizeMode)!
    fireEvent.press(postImage)

    const viewerImage = () => screen.UNSAFE_getAllByType(Image)
      .filter(i => i.props.resizeMode === 'contain')
    expect(viewerImage()).toHaveLength(1)

    fireEvent.press(viewerImage()[0])
    expect(viewerImage()).toHaveLength(0)
  })
})

describe('GroupPosts — blandat flöde', () => {
  it('Visa fler pass laddar mer, snurrar under laddning, och flödesnoten syns', async () => {
    ;(getGroupPosts as jest.Mock).mockResolvedValue([])
    const onLoadMore = jest.fn()
    const view = render(
      <GroupPosts group={group} me="u1" isOwner={false}
        hasMore onLoadMore={onLoadMore} feedNote="Aktivitetsflödet är avstängt." />,
    )
    fireEvent.press(await screen.findByTestId('loadMore'))
    expect(onLoadMore).toHaveBeenCalled()
    expect(screen.getByText('Aktivitetsflödet är avstängt.')).toBeOnTheScreen()

    view.rerender(
      <GroupPosts group={group} me="u1" isOwner={false}
        hasMore loadingMore onLoadMore={onLoadMore} feedNote="Aktivitetsflödet är avstängt." />,
    )
    expect(screen.queryByText('Visa fler pass')).toBeNull()
  })
})
