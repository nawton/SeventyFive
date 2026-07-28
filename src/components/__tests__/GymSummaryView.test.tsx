import { render, screen } from '@testing-library/react-native'
import { GymSummaryView } from '../stats/GymSummaryView'
import type { StrengthWorkout } from '@/services/strengthWorkouts'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn() },
  storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://test/${p}` } }) }) },
} }))
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}))

const W: StrengthWorkout = {
  id: 'w1', name: 'Gympass', created_at: '2026-07-27T10:00:00Z',
  data: {
    exercise_name: 'Bänkpress',
    sets: [{ reps: 10, weight_kg: 60 }, { reps: 8, weight_kg: 70 }, { reps: 6, weight_kg: 0 }],
    workout_date: '2026-07-27',
  },
} as StrengthWorkout

describe('GymSummaryView — set-tabellen', () => {
  it('övningen visas med tabellrubrik, viktrader och reps-fallback utan vikt', () => {
    render(
      <GymSummaryView
        name="Gympass"
        dateLabel="måndag 27 juli"
        logged={[W]}
        plannedNames={[]}
        onClose={jest.fn()}
      />,
    )

    expect(screen.getByText('Bänkpress')).toBeOnTheScreen()
    expect(screen.getByText('VIKT & REPS')).toBeOnTheScreen()
    expect(screen.getByText('60 kg × 10')).toBeOnTheScreen()
    expect(screen.getByText('70 kg × 8')).toBeOnTheScreen()
    expect(screen.getByText('6 reps')).toBeOnTheScreen()
    expect(screen.getByText('topp 70 kg')).toBeOnTheScreen()
  })
})
