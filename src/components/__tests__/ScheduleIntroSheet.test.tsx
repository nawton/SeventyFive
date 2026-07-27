import { render, screen, fireEvent } from '@testing-library/react-native'
import { ScheduleIntroSheet } from '../ScheduleIntroSheet'

function mount(over: Partial<React.ComponentProps<typeof ScheduleIntroSheet>> = {}) {
  const props = {
    visible: true,
    onCreate: jest.fn(),
    onClose: jest.fn(),
    onNeverShow: jest.fn(),
    ...over,
  }
  const view = render(<ScheduleIntroSheet {...props} />)
  return { ...props, view }
}

describe('ScheduleIntroSheet', () => {
  it('dold när schemat finns eller skylten är tystad', () => {
    const { view } = mount({ visible: false })
    expect(view.toJSON()).toBeNull()
  })

  it('visar rubriken, förklaringen och båda vägarna vidare', () => {
    mount()
    expect(screen.getByText('Skapa ditt schema')).toBeOnTheScreen()
    expect(screen.getByText('Skapa schema')).toBeOnTheScreen()
    expect(screen.getByText('Nej tack, visa inte igen')).toBeOnTheScreen()
  })

  it('skapa-knappen startar guiden', () => {
    const { onCreate } = mount()
    fireEvent.press(screen.getByTestId('scheduleIntroCreate'))
    expect(onCreate).toHaveBeenCalled()
  })

  it('bakgrunden stänger bara för stunden, aldrig för alltid', () => {
    const { onClose, onNeverShow } = mount()
    fireEvent.press(screen.getByTestId('scheduleIntroBackdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onNeverShow).not.toHaveBeenCalled()
  })

  it('bara Nej tack-knappen tystar skylten för alltid', () => {
    const { onClose, onNeverShow } = mount()
    fireEvent.press(screen.getByTestId('scheduleIntroNeverShow'))
    expect(onNeverShow).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })
})
