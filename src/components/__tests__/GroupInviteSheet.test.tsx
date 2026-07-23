import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { GroupInviteSheet } from '../GroupInviteSheet'
import { inviteToGroup, type Group, type GroupMember } from '@/services/groups'

jest.mock('@/services/follows', () => ({
  getFollowLists: jest.fn().mockResolvedValue({
    followers: [
      { id: 'f1', name: 'Anna Andersson', avatar_url: null },
      { id: 'f2', name: 'Johan Berg', avatar_url: null },
      { id: 'f3', name: 'Sara Lindqvist', avatar_url: null },
    ],
    following: [],
  }),
}))
jest.mock('@/services/groups', () => ({
  inviteToGroup: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }))

const group = { id: 'g1', name: 'Löparligan', description: '', is_private: false } as Group
const members: GroupMember[] = [
  { id: 'f1', name: 'Anna Andersson', avatar_url: null, role: 'member', status: 'accepted', notifyPosts: 'all' },
  { id: 'f3', name: 'Sara Lindqvist', avatar_url: null, role: 'member', status: 'invited', notifyPosts: 'all' },
]

function mount(onInvited = jest.fn(), onClose = jest.fn()) {
  render(
    <GroupInviteSheet
      visible userId="u1" group={group} members={members}
      onClose={onClose} onInvited={onInvited}
    />,
  )
  return { onInvited, onClose }
}

describe('GroupInviteSheet', () => {
  it('redan medlemmar visar Deltar och inbjudna visar Inbjuden', async () => {
    mount()
    await screen.findByText('Anna Andersson')
    expect(screen.getByText('Deltar')).toBeOnTheScreen()
    expect(screen.getByText('Inbjuden')).toBeOnTheScreen()
  })

  it('valda följare bjuds in och vyn stängs', async () => {
    const { onInvited, onClose } = mount()
    await screen.findByText('Johan Berg')
    fireEvent.press(screen.getByTestId('invite-f2'))
    fireEvent.press(screen.getByTestId('inviteSend'))
    await waitFor(() => expect(inviteToGroup).toHaveBeenCalledWith('g1', ['f2']))
    expect(onInvited).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('sökning filtrerar listan', async () => {
    mount()
    await screen.findByText('Johan Berg')
    fireEvent.changeText(screen.getByTestId('inviteSearch'), 'johan')
    expect(screen.queryByText('Anna Andersson')).toBeNull()
    expect(screen.getByText('Johan Berg')).toBeOnTheScreen()
  })
})
