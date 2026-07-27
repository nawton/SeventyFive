import { render, screen, fireEvent } from '@testing-library/react-native'
import Welcome from '../(auth)/welcome'
import { router } from 'expo-router'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }))

function next(times = 1) {
  for (let i = 0; i < times; i++) fireEvent.press(screen.getByTestId('storyNext'))
}

beforeEach(() => jest.clearAllMocks())

describe('Welcome — story-bläddringen', () => {
  it('startar på brand-sliden utan inloggningsknappar', () => {
    render(<Welcome />)
    expect(screen.getByText('SeventyFive')).toBeOnTheScreen()
    expect(screen.getByText('75 dagar. 5 uppgifter. Inga undantag.')).toBeOnTheScreen()
    expect(screen.queryByTestId('welcomeRegister')).toBeNull()
  })

  it('höger sida bläddrar framåt, vänster bakåt', () => {
    render(<Welcome />)
    next()
    expect(screen.getByText('Fem uppgifter, varje dag')).toBeOnTheScreen()
    expect(screen.getByText('Läs 10 sidor')).toBeOnTheScreen()

    fireEvent.press(screen.getByTestId('storyPrev'))
    expect(screen.getByText('75 dagar. 5 uppgifter. Inga undantag.')).toBeOnTheScreen()

    // Bakåt från första sliden stannar kvar
    fireEvent.press(screen.getByTestId('storyPrev'))
    expect(screen.getByText('SeventyFive')).toBeOnTheScreen()
  })

  it('alla fem slides nås i ordning med sina mockkort, sista stannar', () => {
    render(<Welcome />)
    next(2)
    expect(screen.getByText('Ditt schema, dina pass')).toBeOnTheScreen()
    expect(screen.getByText('Bröst & Triceps')).toBeOnTheScreen()
    expect(screen.getByText('Bänkpress')).toBeOnTheScreen()
    next()
    expect(screen.getByText('Följ dina framsteg')).toBeOnTheScreen()
    expect(screen.getByText('Platina')).toBeOnTheScreen()
    next()
    expect(screen.getByText('Kör tillsammans')).toBeOnTheScreen()
    expect(screen.getByText('Elin Berg')).toBeOnTheScreen()

    // Framåt på sista sliden gör ingenting
    next()
    expect(screen.getByText('Kör tillsammans')).toBeOnTheScreen()
  })

  it('sista sliden leder till registrering respektive inloggning', () => {
    render(<Welcome />)
    next(4)

    fireEvent.press(screen.getByTestId('welcomeRegister'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(auth)/login', params: { mode: 'register' },
    })

    fireEvent.press(screen.getByTestId('welcomeLogin'))
    expect(router.push).toHaveBeenCalledWith('/(auth)/login')
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
