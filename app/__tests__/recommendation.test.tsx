import { Alert } from 'react-native'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import RecommendationScreen from '../(auth)/recommendation'
import { acceptChallenge } from '@/services/challenge'
import { router, useLocalSearchParams } from 'expo-router'

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({ why: 'w', goal: 'g', pressure: 'normal' })),
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
  paramsMock.mockReturnValue({ why: 'w', goal: 'g', pressure: 'normal' })
})

describe('RecommendationScreen', () => {
  it('rådet om Normal, rekommendationsbadgen och jämförelsen visas', () => {
    render(<RecommendationScreen />)
    expect(screen.getByText(/det bästa valet/)).toBeOnTheScreen()
    expect(screen.getByText('REKOMMENDERAD')).toBeOnTheScreen()
    expect(screen.getByText('Jämför nivåerna')).toBeOnTheScreen()
    // Exakt samma stats som hemsidans jämförelsetabell
    expect(screen.getByText('4 pass/vecka')).toBeOnTheScreen()
    expect(screen.getByText('1 pass/dag, ett utomhus')).toBeOnTheScreen()
    expect(screen.getByText('2 pass/dag')).toBeOnTheScreen()
    expect(screen.getByText('Nej, 1 dags marginal/vecka')).toBeOnTheScreen()
    expect(screen.getByText('Inga vilodagar')).toBeOnTheScreen()
    // Vald nivå (Normal) visar sina regler, de andra är hopfällda
    expect(screen.getByText('1 träningspass per dag (45 min)')).toBeOnTheScreen()
    expect(screen.queryByText('Kall dusch varje morgon')).toBeNull()
  })

  it('kortvalet fäller ut den valda nivåns regler', () => {
    render(<RecommendationScreen />)
    fireEvent.press(screen.getByTestId('level-extreme'))
    expect(screen.getByText('Kall dusch varje morgon')).toBeOnTheScreen()
    expect(screen.queryByText('1 träningspass per dag (45 min)')).toBeNull()
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

  it('rekommendationen följer quizets press och startdagen följer med', async () => {
    paramsMock.mockReturnValue({ why: 'w', goal: 'g', pressure: 'extreme', startDay: '42' })
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    render(<RecommendationScreen />)

    // Extreme är förvald och rekommenderad
    expect(screen.getByText('Kall dusch varje morgon')).toBeOnTheScreen()
    expect(screen.getByText(/Du startar på dag 42/)).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Acceptera utmaningen: Extreme'))
    const [, , buttons] = alertSpy.mock.calls[0]
    act(() => {
      (buttons as Array<{ text: string; onPress?: () => void }>)
        .find(b => b.text === 'Kör Extreme')!.onPress!()
    })
    await waitFor(() => expect(acceptMock).toHaveBeenCalledWith(
      'u1', 'extreme', expect.any(Object), 42,
    ))
    alertSpy.mockRestore()
  })
})
