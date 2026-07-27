import { Alert } from 'react-native'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import RecommendationScreen from '../(auth)/recommendation'
import { acceptChallenge } from '@/services/challenge'
import { router, useLocalSearchParams } from 'expo-router'

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({ why: 'w', goal: 'g' })),
}))
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn().mockResolvedValue({
    data: { session: { user: { id: 'u1' } } },
  }) } },
}))
jest.mock('@/services/challenge', () => ({ acceptChallenge: jest.fn().mockResolvedValue(undefined) }))

const paramsMock = useLocalSearchParams as jest.Mock
const acceptMock = acceptChallenge as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  paramsMock.mockReturnValue({ why: 'w', goal: 'g' })
})

describe('RecommendationScreen', () => {
  it('rådet om Normal och jämförelsen visas, utan rekommendationsbadge', () => {
    render(<RecommendationScreen />)
    expect(screen.getByText(/det bästa valet/)).toBeOnTheScreen()
    expect(screen.queryByText('REKOMMENDERAD')).toBeNull()
    expect(screen.getByText('Jämför nivåerna')).toBeOnTheScreen()
    // Exakt samma stats som hemsidans jämförelsetabell
    expect(screen.getByText('4 pass/vecka')).toBeOnTheScreen()
    expect(screen.getByText('1 pass/dag, ett utomhus')).toBeOnTheScreen()
    expect(screen.getByText('2 pass/dag')).toBeOnTheScreen()
    expect(screen.getByText('Nej, 1 dags marginal/vecka')).toBeOnTheScreen()
    expect(screen.getByText('Inga vilodagar')).toBeOnTheScreen()
    // Vald nivå (Normal) visar sina regler, de andra är hopfällda
    expect(screen.getByText('4 träningspass i veckan')).toBeOnTheScreen()
    expect(screen.getByText('En dags marginal per vecka')).toBeOnTheScreen()
    expect(screen.queryByText('Kall dusch varje morgon')).toBeNull()
  })

  it('kortvalet fäller ut den valda nivåns regler', () => {
    render(<RecommendationScreen />)
    fireEvent.press(screen.getByTestId('level-extreme'))
    expect(screen.getByText('Kall dusch varje morgon')).toBeOnTheScreen()
    expect(screen.queryByText('4 träningspass i veckan')).toBeNull()
  })

  it('texten under knappen följer den valda nivåns konsekvenser', () => {
    render(<RecommendationScreen />)
    // Normal har marginal, ingen omstart
    expect(screen.getByText(/en dags marginal per vecka/)).toBeOnTheScreen()

    fireEvent.press(screen.getByTestId('level-hard'))
    expect(screen.getByText(/börjar utmaningen om från dag 1/)).toBeOnTheScreen()
    expect(screen.queryByText(/en dags marginal per vecka/)).toBeNull()

    fireEvent.press(screen.getByTestId('level-extreme'))
    expect(screen.getByText(/utan undantag/)).toBeOnTheScreen()
  })

  it('Normal accepteras direkt utan extra bekräftelse', async () => {
    render(<RecommendationScreen />)
    fireEvent.press(screen.getByText('Acceptera utmaningen: Normal'))
    await waitFor(() => expect(acceptMock).toHaveBeenCalledWith(
      'u1', 'normal', { why: 'w', goal: 'g', pressure: 'normal' }, 1,
    ))
    expect(router.replace).toHaveBeenCalledWith('/(auth)/setup-schedule')
  })

  it('tuffare nivåer kräver bekräftelse, med Normal som utväg', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    render(<RecommendationScreen />)
    fireEvent.press(screen.getByTestId('level-hard'))
    fireEvent.press(screen.getByText('Acceptera utmaningen: Hard'))

    expect(acceptMock).not.toHaveBeenCalled()
    const [title, , buttons] = alertSpy.mock.calls[0]
    expect(title).toBe('Säker på Hard?')

    // "Byt till Normal" ändrar valet utan att spara
    act(() => {
      (buttons as Array<{ text: string; onPress?: () => void }>)
        .find(b => b.text === 'Byt till Normal')!.onPress!()
    })
    expect(screen.getByText('Acceptera utmaningen: Normal')).toBeOnTheScreen()
    expect(acceptMock).not.toHaveBeenCalled()

    // Kör Hard efter ny bekräftelse sparar hard-nivån
    fireEvent.press(screen.getByTestId('level-hard'))
    fireEvent.press(screen.getByText('Acceptera utmaningen: Hard'))
    const [, , buttons2] = alertSpy.mock.calls[1]
    act(() => {
      (buttons2 as Array<{ text: string; onPress?: () => void }>)
        .find(b => b.text === 'Kör Hard')!.onPress!()
    })
    await waitFor(() => expect(acceptMock).toHaveBeenCalledWith(
      'u1', 'hard', expect.any(Object), 1,
    ))
    alertSpy.mockRestore()
  })

  it('startdagen följer med och nivåvalet blir pressvärdet i quizsvaren', async () => {
    paramsMock.mockReturnValue({ why: 'w', goal: 'g', startDay: '42' })
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    render(<RecommendationScreen />)

    // Normal är alltid förvald — quizet frågar inte längre hur hårt man vill ha det
    expect(screen.getByText('4 träningspass i veckan')).toBeOnTheScreen()
    expect(screen.getByText(/Du startar på dag 42/)).toBeOnTheScreen()

    fireEvent.press(screen.getByTestId('level-extreme'))
    fireEvent.press(screen.getByText('Acceptera utmaningen: Extreme'))
    const [, , buttons] = alertSpy.mock.calls[0]
    act(() => {
      (buttons as Array<{ text: string; onPress?: () => void }>)
        .find(b => b.text === 'Kör Extreme')!.onPress!()
    })
    await waitFor(() => expect(acceptMock).toHaveBeenCalledWith(
      'u1', 'extreme', { why: 'w', goal: 'g', pressure: 'extreme' }, 42,
    ))
    alertSpy.mockRestore()
  })
})
