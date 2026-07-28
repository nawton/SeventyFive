import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { FailModal } from '../FailModal'

function mount(onConfirm = jest.fn(async () => {}), onClose = jest.fn()) {
  render(<FailModal visible onClose={onClose} onConfirm={onConfirm} />)
  return { onConfirm, onClose }
}

describe('FailModal', () => {
  it('kräver både ursäkt och plan innan dagen kan rapporteras', () => {
    const { onConfirm } = mount()
    expect(screen.getByText('Rapportera dagen som missad')).toBeOnTheScreen()
    // Ingen låtsascoach längre
    expect(screen.queryByText(/coach/i)).toBeNull()

    fireEvent.press(screen.getByTestId('failSubmit'))
    expect(onConfirm).not.toHaveBeenCalled()

    // Bara ursäkt räcker inte — planen är kravet
    fireEvent.changeText(screen.getByTestId('failExcuse'), 'Somnade i soffan')
    fireEvent.press(screen.getByTestId('failSubmit'))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('med plan sparas rapporten och arket stängs', async () => {
    const { onConfirm, onClose } = mount()
    fireEvent.changeText(screen.getByTestId('failExcuse'), 'Somnade i soffan')
    fireEvent.changeText(screen.getByTestId('failPlan'), 'Tränar direkt efter jobbet')
    fireEvent.press(screen.getByTestId('failSubmit'))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(
      'Somnade i soffan · Plan: Tränar direkt efter jobbet',
    ))
    expect(onClose).toHaveBeenCalled()
  })

  it('misslyckad sparning lämnar arket öppet för nytt försök', async () => {
    const { onClose } = mount(jest.fn(async () => { throw new Error('nät') }))
    fireEvent.changeText(screen.getByTestId('failExcuse'), 'x')
    fireEvent.changeText(screen.getByTestId('failPlan'), 'y')
    fireEvent.press(screen.getByTestId('failSubmit'))

    await waitFor(() => expect(screen.getByTestId('failSubmit')).toBeOnTheScreen())
    expect(onClose).not.toHaveBeenCalled()
  })

  it('bakgrund och Avbryt stänger utan att rapportera', () => {
    const { onConfirm, onClose } = mount()
    fireEvent.press(screen.getByTestId('failBackdrop'))
    fireEvent.press(screen.getByText('Avbryt'))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
