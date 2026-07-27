import { render, screen, fireEvent } from '@testing-library/react-native'
import QuizScreen from '../(auth)/quiz'
import { router, useLocalSearchParams } from 'expo-router'

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}))

const paramsMock = useLocalSearchParams as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  paramsMock.mockReturnValue({})
})

describe('QuizScreen', () => {
  it('steg 1 saknar tillbaka-knapp: efter registreringen finns inget att backa till', () => {
    render(<QuizScreen />)
    expect(screen.getByText('STEG 1 AV 4')).toBeOnTheScreen()
    expect(screen.getByText('Vad är ditt varför?')).toBeOnTheScreen()
    expect(screen.queryByTestId('onbBack')).toBeNull()
  })

  it('utan val är Nästa låst, med val går man vidare och kan backa med svaret kvar', () => {
    render(<QuizScreen />)
    fireEvent.press(screen.getByText('Nästa'))
    expect(screen.getByText('Vad är ditt varför?')).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Förändra min kropp'))
    fireEvent.press(screen.getByText('Nästa'))
    expect(screen.getByText('STEG 2 AV 4')).toBeOnTheScreen()
    expect(screen.getByText('Vad är ditt huvudmål?')).toBeOnTheScreen()

    // Tillbaka till steg 1 — svaret är kvar och man kan gå fram igen
    fireEvent.press(screen.getByTestId('onbBack'))
    expect(screen.getByText('Vad är ditt varför?')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Nästa'))
    expect(screen.getByText('Vad är ditt huvudmål?')).toBeOnTheScreen()
  })

  it('sista frågan skickar svaren och startdagen vidare till nivåvalet', () => {
    paramsMock.mockReturnValue({ startDay: '42' })
    render(<QuizScreen />)
    fireEvent.press(screen.getByText('Bryta dåliga vanor'))
    fireEvent.press(screen.getByText('Nästa'))
    fireEvent.press(screen.getByText('Bygga muskler'))
    fireEvent.press(screen.getByText('Välj nivå'))

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(auth)/recommendation',
      params: { why: 'habits', goal: 'muscle', startDay: '42' },
    })
  })
})
