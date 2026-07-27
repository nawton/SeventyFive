import { render, screen, fireEvent } from '@testing-library/react-native'
import Welcome from '../(auth)/welcome'
import { router } from 'expo-router'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }))

function next(times = 1) {
  for (let i = 0; i < times; i++) fireEvent.press(screen.getByTestId('storyNext'))
}

beforeEach(() => jest.clearAllMocks())

describe('Welcome — immersiva onboardingen', () => {
  it('startar på brand-sliden med Fortsätt men utan kontoknappar', () => {
    render(<Welcome />)
    expect(screen.getByText('SeventyFive')).toBeOnTheScreen()
    expect(screen.getByText('75')).toBeOnTheScreen()
    expect(screen.getByText('75 dagar. 5 uppgifter. Inga undantag.')).toBeOnTheScreen()
    expect(screen.getByTestId('welcomeContinue')).toBeOnTheScreen()
    expect(screen.queryByTestId('welcomeRegister')).toBeNull()
  })

  it('höger sida och Fortsätt bläddrar framåt, vänster bakåt', () => {
    render(<Welcome />)
    next()
    expect(screen.getByText('Fem uppgifter,\nvarje dag')).toBeOnTheScreen()

    fireEvent.press(screen.getByTestId('welcomeContinue'))
    expect(screen.getByText('Ditt schema,\ndina pass')).toBeOnTheScreen()

    fireEvent.press(screen.getByTestId('storyPrev'))
    expect(screen.getByText('Fem uppgifter,\nvarje dag')).toBeOnTheScreen()

    // Bakåt från första sliden stannar kvar
    fireEvent.press(screen.getByTestId('storyPrev'))
    fireEvent.press(screen.getByTestId('storyPrev'))
    expect(screen.getByText('SeventyFive')).toBeOnTheScreen()
  })

  it('alla fem slides nås i ordning med sina heroes, sista stannar', () => {
    render(<Welcome />)
    next(3)
    expect(screen.getByText('Följ dina\nframsteg')).toBeOnTheScreen()
    expect(screen.getByText('Platina')).toBeOnTheScreen()
    expect(screen.getByText('18 av 26')).toBeOnTheScreen()
    next()
    expect(screen.getByText('Kör\ntillsammans')).toBeOnTheScreen()
    expect(screen.getByText('Team Sthlm · 8 medlemmar')).toBeOnTheScreen()

    // Framåt på sista sliden gör ingenting, och Fortsätt är utbytt
    next()
    expect(screen.getByText('Kör\ntillsammans')).toBeOnTheScreen()
    expect(screen.queryByTestId('welcomeContinue')).toBeNull()
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
