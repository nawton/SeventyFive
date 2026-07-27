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
  it('startar på brand-sliden med uppgiftskortet och vägarna in synliga', () => {
    render(<Welcome />)
    expect(screen.getByText('SeventyFive')).toBeOnTheScreen()
    expect(screen.getByText('75 dagar som\nförändrar allt.')).toBeOnTheScreen()
    // Mockkortet visar dagen i utmaningen
    expect(screen.getByText('Dagens uppgifter')).toBeOnTheScreen()
    // Skapa konto/Logga in ligger kvar på alla slides, som i förlagan
    expect(screen.getByTestId('welcomeRegister')).toBeOnTheScreen()
    expect(screen.getByTestId('welcomeLogin')).toBeOnTheScreen()
  })

  it('höger sida bläddrar framåt, vänster bakåt', () => {
    render(<Welcome />)
    next()
    expect(screen.getByText('Fem uppgifter,\nvarje dag.')).toBeOnTheScreen()
    expect(screen.getByText('Läs 10 sidor')).toBeOnTheScreen()

    fireEvent.press(screen.getByTestId('storyPrev'))
    expect(screen.getByText('75 dagar som\nförändrar allt.')).toBeOnTheScreen()

    // Bakåt från första sliden stannar kvar
    fireEvent.press(screen.getByTestId('storyPrev'))
    expect(screen.getByText('75 dagar som\nförändrar allt.')).toBeOnTheScreen()
  })

  it('alla fem slides nås i ordning med sina mockkort, sista stannar', () => {
    render(<Welcome />)
    next(2)
    expect(screen.getByText('En träningsplan\nbyggd för dig.')).toBeOnTheScreen()
    expect(screen.getByText('Vecka 3')).toBeOnTheScreen()
    expect(screen.getByText(/Bröst & Triceps/)).toBeOnTheScreen()
    next()
    expect(screen.getByText('Se dina framsteg\nsvart på vitt.')).toBeOnTheScreen()
    expect(screen.getByText('Platina')).toBeOnTheScreen()
    next()
    expect(screen.getByText('Allt är roligare\ntillsammans.')).toBeOnTheScreen()
    expect(screen.getByText('Elin Berg')).toBeOnTheScreen()

    // Framåt på sista sliden gör ingenting
    next()
    expect(screen.getByText('Allt är roligare\ntillsammans.')).toBeOnTheScreen()
  })

  it('Skapa konto och Logga in fungerar direkt från första sliden', () => {
    render(<Welcome />)
    fireEvent.press(screen.getByTestId('welcomeRegister'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(auth)/login', params: { mode: 'register' },
    })

    fireEvent.press(screen.getByTestId('welcomeLogin'))
    expect(router.push).toHaveBeenCalledWith('/(auth)/login')
  })

  it('dagväljaren skickar med startdagen till inloggningen', () => {
    render(<Welcome />)
    fireEvent.press(screen.getByText('Jag har redan börjat, välj dag'))
    expect(screen.getByText('Vilken dag är du på?')).toBeOnTheScreen()

    fireEvent.press(screen.getByText('55'))
    fireEvent.press(screen.getByText('Fortsätt från dag 55'))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(auth)/login', params: { startDay: '55' },
    })
  })
})
