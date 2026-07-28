import { render, screen, fireEvent } from '@testing-library/react-native'
import QuizScreen from '../(auth)/quiz'
import { router, useLocalSearchParams } from 'expo-router'
import { getBodyGender, setBodyGender } from '@/lib/bodyGender'

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
    expect(screen.getByText('STEG 1 AV 5')).toBeOnTheScreen()
    expect(screen.getByText('Vad är ditt varför?')).toBeOnTheScreen()
    expect(screen.queryByTestId('onbBack')).toBeNull()
  })

  it('utan val är Nästa låst, med val går man vidare och kan backa med svaret kvar', () => {
    render(<QuizScreen />)
    fireEvent.press(screen.getByText('Nästa'))
    expect(screen.getByText('Vad är ditt varför?')).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Förändra min kropp'))
    fireEvent.press(screen.getByText('Nästa'))
    expect(screen.getByText('STEG 2 AV 5')).toBeOnTheScreen()
    expect(screen.getByText('Vad är ditt huvudmål?')).toBeOnTheScreen()

    // Tillbaka till steg 1 — svaret är kvar och man kan gå fram igen
    fireEvent.press(screen.getByTestId('onbBack'))
    expect(screen.getByText('Vad är ditt varför?')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Nästa'))
    expect(screen.getByText('Vad är ditt huvudmål?')).toBeOnTheScreen()
  })

  it('steg 3 väljer kroppsmodell och skickar sen allt vidare till nivåvalet', () => {
    paramsMock.mockReturnValue({ startDay: '42' })
    render(<QuizScreen />)
    fireEvent.press(screen.getByText('Bryta dåliga vanor'))
    fireEvent.press(screen.getByText('Nästa'))
    fireEvent.press(screen.getByText('Bygga muskler'))
    fireEvent.press(screen.getByText('Nästa'))

    // Kroppsvalet: båda figurerna visas, inget förvalt, knappen låst utan val
    expect(screen.getByText('STEG 3 AV 5')).toBeOnTheScreen()
    expect(screen.getByText('Vem ska visas i muskelvyerna?')).toBeOnTheScreen()
    expect(screen.getByTestId('bodyChoice-male')).toBeOnTheScreen()
    expect(screen.getByTestId('bodyChoice-female')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Välj nivå'))
    expect(router.push).not.toHaveBeenCalled()

    fireEvent.press(screen.getByTestId('bodyChoice-female'))
    fireEvent.press(screen.getByText('Välj nivå'))

    expect(getBodyGender()).toBe('female')
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(auth)/recommendation',
      params: { why: 'habits', goal: 'muscle', startDay: '42' },
    })
    setBodyGender('male')
  })
})
