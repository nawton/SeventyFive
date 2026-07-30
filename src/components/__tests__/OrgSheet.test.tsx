import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { OrgSheet } from '../OrgSheet'

jest.mock('@/services/organizations', () => ({
  createOrganization: jest.fn().mockResolvedValue({ id: 'o1', name: 'Växjö LK', join_code: 'ABC123' }),
  joinOrganizationByCode: jest.fn().mockResolvedValue({ id: 'o2', name: 'Kalmar RF' }),
}))
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}))

describe('OrgSheet', () => {
  beforeEach(() => jest.clearAllMocks())

  it('join: koden versaliseras, rensas och skickas vid Gå med', async () => {
    const { joinOrganizationByCode } = jest.requireMock('@/services/organizations')
    const onDone = jest.fn()
    render(<OrgSheet visible mode="join" userId="u1" onClose={jest.fn()} onDone={onDone} />)

    const input = screen.getByTestId('orgCodeInput')
    fireEvent.changeText(input, 'ab c1-23')
    expect(input.props.value).toBe('ABC123')

    fireEvent.press(screen.getByTestId('orgSubmit'))
    await waitFor(() => expect(joinOrganizationByCode).toHaveBeenCalledWith('ABC123'))
    expect(onDone).toHaveBeenCalledWith({ id: 'o2', name: 'Kalmar RF' })
  })

  it('join: knappen är avstängd tills koden har sex tecken', () => {
    const { joinOrganizationByCode } = jest.requireMock('@/services/organizations')
    render(<OrgSheet visible mode="join" userId="u1" onClose={jest.fn()} onDone={jest.fn()} />)
    fireEvent.changeText(screen.getByTestId('orgCodeInput'), 'ABC')
    fireEvent.press(screen.getByTestId('orgSubmit'))
    expect(joinOrganizationByCode).not.toHaveBeenCalled()
  })

  it('create: namn och beskrivning skickas och skaparen får föreningen tillbaka', async () => {
    const { createOrganization } = jest.requireMock('@/services/organizations')
    const onDone = jest.fn()
    render(<OrgSheet visible mode="create" userId="u1" onClose={jest.fn()} onDone={onDone} />)

    fireEvent.changeText(screen.getByTestId('orgNameInput'), 'Växjö LK')
    fireEvent.changeText(screen.getByTestId('orgDescInput'), 'Torsdagar 18:00')
    fireEvent.press(screen.getByTestId('orgSubmit'))
    await waitFor(() => expect(createOrganization).toHaveBeenCalledWith('u1', 'Växjö LK', 'Torsdagar 18:00'))
    expect(onDone).toHaveBeenCalled()
  })
})
