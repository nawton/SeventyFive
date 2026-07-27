import { Alert, Modal } from 'react-native'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { GroupScanSheet } from '../GroupScanSheet'
import { groupQrValue } from '@/lib/groupQr'
import { getGroup, type Group } from '@/services/groups'

const mockCam = {
  permission: { granted: true } as { granted: boolean } | null,
  request: jest.fn(),
  lastProps: null as Record<string, any> | null,
}

jest.mock('expo-camera', () => ({
  CameraView: (props: Record<string, unknown>) => { mockCam.lastProps = props; return null },
  useCameraPermissions: () => [mockCam.permission, mockCam.request],
}))
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }))
jest.mock('@/services/groups', () => ({ getGroup: jest.fn() }))

const getGroupMock = getGroup as jest.Mock
const GROUP_ID = '123e4567-e89b-12d3-a456-426614174000'
const group = { id: GROUP_ID, name: 'Team Sthlm' } as Group

async function scan(data: string) {
  await act(async () => { mockCam.lastProps!.onBarcodeScanned({ data }) })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCam.permission = { granted: true }
  mockCam.lastProps = null
})

describe('GroupScanSheet', () => {
  it('meddelar via onDismissed när modalen är helt nedtagen', () => {
    const onDismissed = jest.fn()
    render(<GroupScanSheet visible onClose={jest.fn()} onFound={jest.fn()} onDismissed={onDismissed} />)
    fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss')
    expect(onDismissed).toHaveBeenCalled()
  })

  it('utan kameratillstånd: förklaring och knapp som frågar om åtkomst', () => {
    mockCam.permission = null
    render(<GroupScanSheet visible onClose={jest.fn()} onFound={jest.fn()} />)
    expect(screen.getByText('Kameran behöver åtkomst')).toBeOnTheScreen()
    fireEvent.press(screen.getByTestId('scanPermission'))
    expect(mockCam.request).toHaveBeenCalled()
  })

  it('en giltig gruppkod hämtar gruppen och lämnar över den', async () => {
    const onFound = jest.fn()
    getGroupMock.mockResolvedValue(group)
    render(<GroupScanSheet visible onClose={jest.fn()} onFound={onFound} />)

    expect(mockCam.lastProps?.barcodeScannerSettings).toEqual({ barcodeTypes: ['qr'] })
    await scan(groupQrValue(GROUP_ID))

    expect(getGroupMock).toHaveBeenCalledWith(GROUP_ID)
    expect(onFound).toHaveBeenCalledWith(group)
    expect(Haptics.selectionAsync).toHaveBeenCalled()
  })

  it('koder som inte är gruppkoder ignoreras tyst', async () => {
    render(<GroupScanSheet visible onClose={jest.fn()} onFound={jest.fn()} />)
    await scan('https://example.com/nagot-helt-annat')
    expect(getGroupMock).not.toHaveBeenCalled()
  })

  it('raderad grupp ger besked, och OK låser upp skannern igen', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    getGroupMock.mockRejectedValueOnce(new Error('finns inte'))
    const onFound = jest.fn()
    render(<GroupScanSheet visible onClose={jest.fn()} onFound={onFound} />)

    await scan(groupQrValue(GROUP_ID))
    expect(onFound).not.toHaveBeenCalled()
    expect(alertSpy).toHaveBeenCalledWith('Ingen grupp hittades', expect.any(String), expect.any(Array))

    // Skannern är spärrad tills beskedet kvitterats
    await scan(groupQrValue(GROUP_ID))
    expect(getGroupMock).toHaveBeenCalledTimes(1)

    const okButton = (alertSpy.mock.calls[0][2] as Array<{ onPress: () => void }>)[0]
    act(() => okButton.onPress())
    getGroupMock.mockResolvedValue(group)
    await scan(groupQrValue(GROUP_ID))
    expect(onFound).toHaveBeenCalledWith(group)
    alertSpy.mockRestore()
  })

  it('visar Hämtar gruppen medan uppslaget pågår och släpper inte in dubbelskanningar', async () => {
    let resolveLookup!: (g: Group) => void
    getGroupMock.mockReturnValue(new Promise<Group>(res => { resolveLookup = res }))
    const onFound = jest.fn()
    render(<GroupScanSheet visible onClose={jest.fn()} onFound={onFound} />)

    await scan(groupQrValue(GROUP_ID))
    await scan(groupQrValue(GROUP_ID))
    expect(getGroupMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Hämtar gruppen …')).toBeOnTheScreen()

    await act(async () => resolveLookup(group))
    await waitFor(() => expect(onFound).toHaveBeenCalledWith(group))
  })
})
