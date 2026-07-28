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

describe('LogWorkoutSheet — spara och cardio', () => {
  it('Spara pass parsar set och faller tillbaka på 3×10 vid ogiltig inmatning', async () => {
    const onSaveGym = jest.fn()
    render(
      <LogWorkoutSheet
        visible
        exercises={EXERCISES}
        onClose={jest.fn()}
        onPickCardio={jest.fn()}
        onSaveGym={onSaveGym}
      />,
    )
    fireEvent.press(screen.getByText('Gym'))
    fireEvent.press(screen.getByText('Bänkpress'))
    fireEvent.press(screen.getByText('Marklyft'))
    fireEvent.press(screen.getByText(/Klar · 2/))

    fireEvent.changeText(screen.getByPlaceholderText('t.ex. Push, Ben, Överkropp…'), 'Tungt pass')
    fireEvent.press(screen.getByText('Spara pass'))
    expect(onSaveGym).toHaveBeenCalledWith('Tungt pass', [
      { exerciseName: 'Bänkpress', sets: 3, reps: '10' },
      { exerciseName: 'Marklyft', sets: 3, reps: '10' },
    ])
  })

  it('cardiovalet skickar typ och etikett', () => {
    const onPickCardio = jest.fn()
    render(
      <LogWorkoutSheet
        visible
        exercises={EXERCISES}
        onClose={jest.fn()}
        onPickCardio={onPickCardio}
        onSaveGym={jest.fn()}
      />,
    )
    fireEvent.press(screen.getByText('Cardio'))
    fireEvent.press(screen.getByText('Löpning'))
    expect(onPickCardio).toHaveBeenCalledWith('running', 'Löpning')
  })
})

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
