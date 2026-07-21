import { render, screen } from '@testing-library/react-native'
import CardioSummaryScreen from '../cardio-summary'
import { useLocalSearchParams } from 'expo-router'
import { getCardioWorkoutById, getCardioWorkoutByDate } from '@/services/workouts'
import type { CardioWorkout } from '@/services/cardioWorkouts'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }) },
  },
}))
jest.mock('@/services/workouts', () => ({
  getCardioWorkoutById: jest.fn().mockResolvedValue(null),
  getCardioWorkoutByDate: jest.fn().mockResolvedValue(null),
  deleteCardioWorkout: jest.fn().mockResolvedValue(true),
  updateCardioEffort: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/services/profile', () => ({ getProfile: jest.fn().mockResolvedValue(null) }))
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}))

const WORKOUT: CardioWorkout = {
  id: 'w1',
  name: 'Morgonrunda',
  created_at: '2026-07-20T07:00:00Z',
  data: {
    category: 'cardio', type: 'running',
    distance_km: 6, duration_seconds: 1980, calories: 400,
    splits: [{ label: '1 km', paceSec: 330 }],
  },
}

function renderWith(params: Record<string, string>) {
  ;(useLocalSearchParams as jest.Mock).mockReturnValue(params)
  return render(<CardioSummaryScreen />)
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getCardioWorkoutById as jest.Mock).mockResolvedValue(null)
  ;(getCardioWorkoutByDate as jest.Mock).mockResolvedValue(null)
})

describe('cardio-summary — historikdetaljen', () => {
  it('hämtar via id och renderar summeringsvyn', async () => {
    ;(getCardioWorkoutById as jest.Mock).mockResolvedValue(WORKOUT)
    renderWith({ workoutId: 'w1', name: 'Morgonrunda', cardioType: 'running' })
    expect(await screen.findByText('Morgonrunda')).toBeOnTheScreen()
    expect(screen.getByText('6.00')).toBeOnTheScreen()
    expect(screen.getByText('33:00')).toBeOnTheScreen()
    expect(screen.getByText('Kilometersplittar')).toBeOnTheScreen()
    expect(getCardioWorkoutById).toHaveBeenCalledWith('u1', 'w1')
    expect(getCardioWorkoutByDate).not.toHaveBeenCalled()
  })

  it('utan id: slår upp på typ + datum (schemapass)', async () => {
    ;(getCardioWorkoutByDate as jest.Mock).mockResolvedValue(WORKOUT)
    renderWith({ cardioType: 'running', date: '2026-07-20' })
    // Utan name-param blir rubriken passtypens etikett
    expect(await screen.findByText('Löpning')).toBeOnTheScreen()
    expect(screen.getByText(/måndag 20 juli/)).toBeOnTheScreen()
    expect(getCardioWorkoutByDate).toHaveBeenCalledWith('u1', 'running', '2026-07-20')
  })

  it('pass som inte hittas ger tomt läge — ingen krasch', async () => {
    renderWith({ workoutId: 'saknas' })
    expect(await screen.findByText('Kunde inte hitta det sparade passet.')).toBeOnTheScreen()
  })

  it('radering kräver bekräftelse och går tillbaka efteråt', async () => {
    const { Alert } = require('react-native')
    const { router } = require('expo-router')
    const { deleteCardioWorkout } = require('@/services/workouts')
    const alertSpy = jest.spyOn(Alert, 'alert')
    ;(getCardioWorkoutById as jest.Mock).mockResolvedValue(WORKOUT)
    renderWith({ workoutId: 'w1', name: 'Morgonrunda' })
    await screen.findByText('Morgonrunda')

    const { fireEvent } = require('@testing-library/react-native')
    fireEvent.press(screen.getByText('glassbtn:trash-outline'))
    expect(alertSpy).toHaveBeenCalledWith('Radera träning', expect.any(String), expect.any(Array))

    // Bekräfta via dialogens Radera-knapp
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[]
    const radera = buttons.find(b => b.text === 'Radera')!
    await radera.onPress!()
    expect(deleteCardioWorkout).toHaveBeenCalledWith('w1')
    expect(router.back).toHaveBeenCalled()
  })

  it('utloggad: laddningen avslutas i tomt läge', async () => {
    const { supabase } = require('@/lib/supabase')
    ;(supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({ data: { session: null } })
    renderWith({ workoutId: 'w1' })
    expect(await screen.findByText('Kunde inte hitta det sparade passet.')).toBeOnTheScreen()
    expect(getCardioWorkoutById).not.toHaveBeenCalled()
  })
})
