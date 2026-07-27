import { render, screen, fireEvent, act } from '@testing-library/react-native'
import { GroupSearchSheet } from '../GroupSearchSheet'
import { searchGroups, type Group } from '@/services/groups'

const mockScanProps = { current: null as Record<string, any> | null }

jest.mock('@/services/groups', () => ({ searchGroups: jest.fn() }))
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }))
jest.mock('@/components/GroupScanSheet', () => ({
  GroupScanSheet: (props: Record<string, unknown>) => { mockScanProps.current = props; return null },
}))

const searchMock = searchGroups as jest.Mock

const RESULTS = [
  { id: 'g1', name: 'Team Sthlm', is_private: false, memberCount: 3, location: 'Stockholm', avatar_url: null },
  { id: 'g2', name: 'Team Norr', is_private: true, memberCount: 0, location: null, avatar_url: null },
  { id: 'g3', name: 'Team Duo', is_private: true, memberCount: 1, location: null, avatar_url: null },
]

function mount(onOpenGroup = jest.fn()) {
  render(<GroupSearchSheet visible onClose={jest.fn()} onOpenGroup={onOpenGroup} />)
  return onOpenGroup
}

async function type(text: string) {
  fireEvent.changeText(screen.getByTestId('groupSearchInput'), text)
  await act(async () => { jest.advanceTimersByTime(260) })
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockScanProps.current = null
  searchMock.mockResolvedValue(RESULTS)
})

afterEach(() => jest.useRealTimers())

describe('GroupSearchSheet', () => {
  it('söker först från två tecken, efter skrivpausen', async () => {
    mount()
    await type('t')
    expect(searchMock).not.toHaveBeenCalled()

    fireEvent.changeText(screen.getByTestId('groupSearchInput'), 'te')
    fireEvent.changeText(screen.getByTestId('groupSearchInput'), 'team')
    await act(async () => { jest.advanceTimersByTime(260) })
    // Debouncen slår ihop tangenttryckningarna till en enda sökning
    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(searchMock).toHaveBeenCalledWith('team')
  })

  it('träffarna visar medlemsantal, men privata gruppers dolda antal blir bara Privat', async () => {
    const onOpenGroup = mount()
    await type('team')

    expect(screen.getByText('3 medlemmar · Stockholm')).toBeOnTheScreen()
    expect(screen.getByText('Privat')).toBeOnTheScreen()
    expect(screen.getByText('1 medlem · Privat')).toBeOnTheScreen()

    fireEvent.press(screen.getByTestId('found-g1'))
    expect(onOpenGroup).toHaveBeenCalledWith(RESULTS[0])
  })

  it('inga träffar ger ett tydligt tomläge, och sökfel blir tomt istället för krasch', async () => {
    mount()
    searchMock.mockResolvedValue([])
    await type('zzz')
    expect(screen.getByText('Inga grupper matchade "zzz".')).toBeOnTheScreen()

    searchMock.mockRejectedValue(new Error('nät'))
    await type('nätfel')
    expect(screen.getByText('Inga grupper matchade "nätfel".')).toBeOnTheScreen()
  })

  it('QR-raden öppnar skannern och en hittad grupp öppnas direkt', async () => {
    const onOpenGroup = mount()
    expect(mockScanProps.current?.visible).toBe(false)

    fireEvent.press(screen.getByTestId('scanGroup'))
    expect(mockScanProps.current?.visible).toBe(true)

    act(() => { mockScanProps.current!.onFound(RESULTS[0] as unknown as Group) })
    expect(onOpenGroup).toHaveBeenCalledWith(RESULTS[0])
    expect(mockScanProps.current?.visible).toBe(false)
  })
})
