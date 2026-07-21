import { render, screen, fireEvent, act } from '@testing-library/react-native'
import CardioSessionScreen from '../cardio-session'
import { useLocalSearchParams, router } from 'expo-router'
import { getCardioWorkouts } from '@/services/workouts'
import type { CardioWorkout } from '@/services/cardioWorkouts'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }) },
  },
}))
jest.mock('@/services/workouts', () => ({ getCardioWorkouts: jest.fn().mockResolvedValue([]) }))
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}))
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(), selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}))

const LAST_RUN: CardioWorkout = {
  id: 'w1',
  name: 'Löpning',
  created_at: '2026-07-18T08:00:00Z',
  data: { category: 'cardio', type: 'running', distance_km: 8.4, duration_seconds: 2940, calories: 500 },
}

function renderWith(params: Record<string, string> = { cardioType: 'running' }) {
  ;(useLocalSearchParams as jest.Mock).mockReturnValue(params)
  return render(<CardioSessionScreen />)
}

function lastReplaceParams(): Record<string, string> {
  const calls = (router.replace as jest.Mock).mock.calls
  return calls[calls.length - 1][0].params
}

beforeEach(async () => {
  jest.clearAllMocks()
  ;(getCardioWorkouts as jest.Mock).mockResolvedValue([])   // tom historik som default
  const AsyncStorage = require('@react-native-async-storage/async-storage')
  await AsyncStorage.clear()
})

describe('cardio-session — fri runda-förberedelsen', () => {
  it('visar passtyp, målsektion och startknapp', async () => {
    renderWith({ cardioType: 'running', name: 'Kvällsrunda' })
    expect(await screen.findByText('Kvällsrunda')).toBeOnTheScreen()
    expect(screen.getByText('MÅL FÖR PASSET')).toBeOnTheScreen()
    expect(screen.getByText('Starta löpning')).toBeOnTheScreen()
  })

  it('förvalsknapparna sätter distansmålet som följer med till GPS-vyn', async () => {
    renderWith()
    fireEvent.press(await screen.findByText('5'))       // preset 5 km
    fireEvent.press(screen.getByText('Starta löpning'))
    const sent = lastReplaceParams()
    expect(sent.goalKm).toBe('5.00')
    expect(sent.name).toBe('running')
  })

  it('egen inmatning: distans skrivs i vald enhet och sparas i km', async () => {
    renderWith()
    fireEvent.press((await screen.findAllByText('Egen'))[0])
    const input = await screen.findByDisplayValue('')
    fireEvent.changeText(input, '7,5')
    fireEvent.press(screen.getByText('Spara'))
    fireEvent.press(screen.getByText('Starta löpning'))
    expect(lastReplaceParams().goalKm).toBe('7.50')
  })

  it('tidsförval följer med som goalMin', async () => {
    renderWith()
    fireEvent.press(await screen.findByText('30'))
    fireEvent.press(screen.getByText('Starta löpning'))
    expect(lastReplaceParams().goalMin).toBe('30')
  })

  it('schemalagda pass skickar med sessionId och datum', async () => {
    renderWith({ cardioType: 'running', sessionId: 's1', date: '2026-07-20' })
    fireEvent.press(await screen.findByText('Starta löpning'))
    const sent = lastReplaceParams()
    expect(sent.sessionId).toBe('s1')
    expect(sent.sessionDate).toBe('2026-07-20')
  })

  it('visar senaste passet av samma typ', async () => {
    ;(getCardioWorkouts as jest.Mock).mockResolvedValue([LAST_RUN])
    renderWith()
    expect(await screen.findByText('SENAST DU SPRANG')).toBeOnTheScreen()
    expect(screen.getByText('8.40')).toBeOnTheScreen()
    expect(screen.getByText('49:00')).toBeOnTheScreen()
  })

  it('utan historik: uppmuntran istället för siffror', async () => {
    renderWith()
    expect(await screen.findByText(/Dags att sätta ribban/)).toBeOnTheScreen()
  })

  it('cykling får sin egen rubrik och startknapp', async () => {
    renderWith({ cardioType: 'cycling' })
    expect(await screen.findByText('Starta cykling')).toBeOnTheScreen()
    expect(screen.getByText('SENAST DU CYKLADE')).toBeOnTheScreen()
  })

  it('inställningarna byter enhet till miles och presets följer med', async () => {
    renderWith()
    fireEvent.press(await screen.findByText('glassbtn:settings-outline'))
    expect(await screen.findByText('ENHET')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Miles'))
    fireEvent.press(screen.getByText('Spara'))
    // Distansförvalen är 2/3/5 i miles-läget
    expect(await screen.findByText('2')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('2'))
    fireEvent.press(screen.getByText('Starta löpning'))
    // 2 mi lagras som km
    expect(parseFloat(lastReplaceParams().goalKm)).toBeCloseTo(3.22, 1)
  })
})
