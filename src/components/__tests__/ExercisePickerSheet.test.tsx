import { render, screen, fireEvent } from '@testing-library/react-native'
import { ExercisePickerSheet } from '../ExercisePickerSheet'
import type { Exercise } from '@/services/exercises'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn() } } }))
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}))

const ex = (id: string, name: string): Exercise => ({
  id, name, description: null, category: 'strength', difficulty: 'beginner', video_url: null,
})

// Rodd → övre rygg/trapezius, Marklyft → nedre rygg m.m., Bänkpress → bröst
const EXERCISES = [
  ex('e1', 'Rodd med skivstång'),
  ex('e2', 'Marklyft'),
  ex('e3', 'Bänkpress'),
]

function mount() {
  render(
    <ExercisePickerSheet
      visible
      gymOnly
      exercises={EXERCISES}
      onSelect={jest.fn()}
      onClose={jest.fn()}
    />,
  )
}

describe('ExercisePickerSheet — delmuskelfiltret', () => {
  it('gruppen visar alla sina övningar som standard, med filterchips', () => {
    mount()
    fireEvent.press(screen.getByText('Rygg'))

    expect(screen.getByText('Rodd med skivstång')).toBeOnTheScreen()
    expect(screen.getByText('Marklyft')).toBeOnTheScreen()
    expect(screen.queryByText('Bänkpress')).toBeNull()

    expect(screen.getByTestId('subMuscle-all')).toBeOnTheScreen()
    expect(screen.getByTestId('subMuscle-upper-back')).toBeOnTheScreen()
    expect(screen.getByTestId('subMuscle-lower-back')).toBeOnTheScreen()
    expect(screen.getByTestId('subMuscle-trapezius')).toBeOnTheScreen()
  })

  it('delmuskelchipen filtrerar listan och Alla återställer', () => {
    mount()
    fireEvent.press(screen.getByText('Rygg'))

    fireEvent.press(screen.getByTestId('subMuscle-lower-back'))
    expect(screen.getByText('Marklyft')).toBeOnTheScreen()
    expect(screen.queryByText('Rodd med skivstång')).toBeNull()

    fireEvent.press(screen.getByTestId('subMuscle-all'))
    expect(screen.getByText('Rodd med skivstång')).toBeOnTheScreen()
  })

  it('grupper med en enda muskel visar inget filter', () => {
    mount()
    fireEvent.press(screen.getByText('Bröst'))
    expect(screen.getByText('Bänkpress')).toBeOnTheScreen()
    expect(screen.queryByTestId('subMuscle-all')).toBeNull()
  })

})
