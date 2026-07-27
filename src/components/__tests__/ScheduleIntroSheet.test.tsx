import { render, screen, fireEvent } from '@testing-library/react-native'
import { ScheduleIntroSheet } from '../ScheduleIntroSheet'

describe('ScheduleIntroSheet', () => {
  it('dold när schemat finns eller skylten redan stängts', () => {
    const view = render(
      <ScheduleIntroSheet visible={false} onCreate={jest.fn()} onDismiss={jest.fn()} />,
    )
    expect(view.toJSON()).toBeNull()
  })

  it('visar rubriken, förklaringen och båda vägarna vidare', () => {
    render(<ScheduleIntroSheet visible onCreate={jest.fn()} onDismiss={jest.fn()} />)
    expect(screen.getByText('Skapa ditt schema')).toBeOnTheScreen()
    expect(screen.getByText('Skapa schema')).toBeOnTheScreen()
    expect(screen.getByText('Nej tack, visa inte igen')).toBeOnTheScreen()
  })

  it('skapa-knappen startar guiden', () => {
    const onCreate = jest.fn()
    render(<ScheduleIntroSheet visible onCreate={onCreate} onDismiss={jest.fn()} />)
    fireEvent.press(screen.getByTestId('scheduleIntroCreate'))
    expect(onCreate).toHaveBeenCalled()
  })

  it('nej tack och bakgrunden stänger för alltid', () => {
    const onDismiss = jest.fn()
    render(<ScheduleIntroSheet visible onCreate={jest.fn()} onDismiss={onDismiss} />)

    fireEvent.press(screen.getByTestId('scheduleIntroDismiss'))
    expect(onDismiss).toHaveBeenCalledTimes(1)

    fireEvent.press(screen.getByTestId('scheduleIntroBackdrop'))
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })
})
