import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { RestartPromptModal } from '../RestartPromptModal'

function mount(allowContinue: boolean, onRestart = jest.fn(async () => {}), onContinue = jest.fn(async () => {})) {
  render(
    <RestartPromptModal
      visible
      variant="missed"
      missedDays={[12]}
      allowContinue={allowContinue}
      onRestart={onRestart}
      onContinue={onContinue}
    />,
  )
  return { onRestart, onContinue }
}

describe('RestartPromptModal', () => {
  it('Normal får fortsätta ändå', async () => {
    const { onContinue } = mount(true)
    expect(screen.getByText('Du missade dag 12')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Fortsätt ändå'))
    await waitFor(() => expect(onContinue).toHaveBeenCalled())
  })

  it('Hard och Extreme har ingen väg förbi omstarten, men datan är trygg', async () => {
    const { onRestart, onContinue } = mount(false)
    expect(screen.queryByText('Fortsätt ändå')).toBeNull()
    // Texten förklarar att pass och rekord finns kvar
    expect(screen.getByText(/dina pass och rekord finns kvar/)).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Starta om från dag 1'))
    await waitFor(() => expect(onRestart).toHaveBeenCalled())
    expect(onContinue).not.toHaveBeenCalled()
  })
})
