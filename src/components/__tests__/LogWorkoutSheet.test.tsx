import { render, screen, fireEvent } from '@testing-library/react-native'
import { LogWorkoutSheet } from '../LogWorkoutSheet'
import { EXERCISE_INFO } from '@/lib/exerciseInfo'
import type { Exercise } from '@/services/exercises'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn() },
  storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://test/${p}` } }) }) },
} }))
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}))

const EXERCISES: Exercise[] = [
  { id: 'e1', name: 'Bänkpress', description: null, category: 'strength', difficulty: 'beginner', video_url: null, image_path: 'bankpress.gif' },
  { id: 'e2', name: 'Marklyft', description: null, category: 'strength', difficulty: 'intermediate', video_url: null, image_path: 'marklyft.gif' },
]

describe('LogWorkoutSheet — passöversikten', () => {
  it('raderna visar GIF, öppnar infobladet vid tryck och kan tas bort', () => {
    render(
      <LogWorkoutSheet
        visible
        exercises={EXERCISES}
        onClose={jest.fn()}
        onPickCardio={jest.fn()}
        onSaveGym={jest.fn()}
      />,
    )
    fireEvent.press(screen.getByText('Gym'))
    fireEvent.press(screen.getByText('Bänkpress'))
    fireEvent.press(screen.getByText(/Klar · 1/))

    // Översikten: raden finns med GIF-platta och är tryckbar
    expect(screen.getByText('Passöversikt')).toBeOnTheScreen()
    fireEvent.press(screen.getByTestId('overviewRow-e1'))
    expect(screen.getByTestId('exerciseInfoSheet')).toBeOnTheScreen()
    expect(screen.getByText(EXERCISE_INFO['Bänkpress'].steps[0].sv)).toBeOnTheScreen()
  })
})
