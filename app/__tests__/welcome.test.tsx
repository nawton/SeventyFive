import { render, screen, fireEvent } from '@testing-library/react-native'
import Welcome from '../(auth)/welcome'
import { router } from 'expo-router'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }))

function next(times = 1) {
  for (let i = 0; i < times; i++) fireEvent.press(screen.getByTestId('storyNext'))
}

beforeEach(() => jest.clearAllMocks())

describe('Welcome — onboardingen', () => {
  it('sida 1: välkomnar med brandmarket, utan tillbaka- eller kontoknappar', () => {
    render(<Welcome />)
    expect(screen.getByText('Välkommen till SeventyFive')).toBeOnTheScreen()
    expect(screen.getByText('Din resa börjar här.')).toBeOnTheScreen()
    expect(screen.getByText('75')).toBeOnTheScreen()
    expect(screen.getByTestId('welcomeContinue')).toBeOnTheScreen()
    expect(screen.queryByTestId('welcomeBack')).toBeNull()
    expect(screen.queryByTestId('welcomeRegister')).toBeNull()
  })

  it('Nästa, tryckhalvorna och tillbaka-knappen navigerar', () => {
    render(<Welcome />)
    fireEvent.press(screen.getByTestId('welcomeContinue'))
    expect(screen.getByText('Vad är en 75 challenge?')).toBeOnTheScreen()
    expect(screen.getByText('Håll din kost')).toBeOnTheScreen()

    next()
    expect(screen.getByText('Planera ditt schema och dina pass')).toBeOnTheScreen()

    fireEvent.press(screen.getByTestId('welcomeBack'))
    expect(screen.getByText('Vad är en 75 challenge?')).toBeOnTheScreen()

    fireEvent.press(screen.getByTestId('storyPrev'))
    expect(screen.getByText('Välkommen till SeventyFive')).toBeOnTheScreen()
  })

  it('schemat och statistiken visar sina mockups', () => {
    render(<Welcome />)
    next(2)
    expect(screen.getByText('Onsdag')).toBeOnTheScreen()
    expect(screen.getByText('Underkropp')).toBeOnTheScreen()
    expect(screen.getByText('IDAG')).toBeOnTheScreen()

    next()
    expect(screen.getByText('Följ dina pass och se din utveckling')).toBeOnTheScreen()
    expect(screen.getByText('12 dagar i rad')).toBeOnTheScreen()
    expect(screen.getByText('Veckans pass')).toBeOnTheScreen()
  })

  it('Hoppa över går direkt till sista sidan med kontoknapparna', () => {
    render(<Welcome />)
    fireEvent.press(screen.getByTestId('welcomeSkip'))
    expect(screen.getByText('Utvecklas tillsammans med andra')).toBeOnTheScreen()
    expect(screen.getByText('Löpargruppen')).toBeOnTheScreen()
    expect(screen.queryByTestId('welcomeSkip')).toBeNull()
    expect(screen.queryByTestId('welcomeContinue')).toBeNull()

    fireEvent.press(screen.getByTestId('welcomeRegister'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(auth)/login', params: { mode: 'register' },
    })
    fireEvent.press(screen.getByTestId('welcomeLogin'))
    expect(router.push).toHaveBeenCalledWith('/(auth)/login')
  })

  it('stängning utan Fortsätt sparar inte den valda dagen', () => {
    render(<Welcome />)
    next(4)
    fireEvent.press(screen.getByText('Jag har redan börjat, välj dag'))
    fireEvent.press(screen.getByText('55'))
    expect(screen.getByText('Fortsätt från dag 55')).toBeOnTheScreen()

    // Tryck utanför stänger och kastar valet
    fireEvent.press(screen.getByTestId('dayBackdrop'))
    expect(screen.queryByText('Vilken dag är du på?')).toBeNull()
    expect(router.push).not.toHaveBeenCalled()

    // Nästa öppning börjar om från dag 1
    fireEvent.press(screen.getByText('Jag har redan börjat, välj dag'))
    expect(screen.getByText('Fortsätt från dag 1')).toBeOnTheScreen()
  })

  it('dagväljaren skickar med startdagen till inloggningen', () => {
    render(<Welcome />)
    next(4)
    fireEvent.press(screen.getByText('Jag har redan börjat, välj dag'))
    expect(screen.getByText('Vilken dag är du på?')).toBeOnTheScreen()

    fireEvent.press(screen.getByText('55'))
    fireEvent.press(screen.getByText('Fortsätt från dag 55'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(auth)/login', params: { startDay: '55' },
    })
  })
})
