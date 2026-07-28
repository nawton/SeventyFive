import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { SessionFullscreen } from '../SessionFullscreen'
import { EXERCISE_INFO } from '@/lib/exerciseInfo'
import type { Exercise } from '@/services/exercises'
import type { WorkoutSession } from '@/services/workoutSchedule'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn() },
  storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://test/${p}` } }) }) },
} }))
jest.mock('@/services/workouts', () => ({
  saveStrengthWorkout: jest.fn(),
  getStrengthWorkouts: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/services/personalRecords', () => ({
  getPersonalRecords: jest.fn().mockResolvedValue([]),
  findNewPR: jest.fn(),
}))
jest.mock('@/services/workoutSchedule', () => ({
  completeExercise: jest.fn(),
  updateSessionExercise: jest.fn(),
  addSingleExerciseToSession: jest.fn(),
  deleteSessionExercise: jest.fn(),
}))
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}))

const EXERCISES: Exercise[] = [
  { id: 'e1', name: 'Chin-ups', description: null, category: 'strength', difficulty: 'beginner', video_url: null, image_path: 'chin-ups.gif' },
  { id: 'e2', name: 'Okänd specialövning', description: null, category: 'strength', difficulty: 'beginner', video_url: null, image_path: null },
]

const SESSION: WorkoutSession = {
  id: 's1', user_id: 'u1', name: 'Gympass', weekdays: [1], sort_order: 0,
  created_at: '2026-07-01', notes: null, session_type: 'gym', cardio_type: null,
  exercises: [
    { id: 'x1', session_id: 's1', exercise_name: 'Chin-ups', sets: 3, reps: '10', sort_order: 0 },
    { id: 'x2', session_id: 's1', exercise_name: 'Okänd specialövning', sets: 3, reps: '10', sort_order: 1 },
  ],
}

describe('SessionFullscreen — infoknappen vid övningsrubriken', () => {
  it('biblioteksövningen öppnar infobladet, okänd övning saknar knapp', async () => {
    render(
      <SessionFullscreen
        visible
        session={SESSION}
        isCompleted={false}
        exercisesList={EXERCISES}
        date="2026-07-28"
        userId="u1"
        onComplete={jest.fn()}
        onUncomplete={jest.fn()}
        onClose={jest.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByText('Chin-ups')).toBeOnTheScreen())
    expect(screen.getByTestId('exerciseInfoBtn-x1')).toBeOnTheScreen()
    expect(screen.queryByTestId('exerciseInfoBtn-x2')).toBeNull()

    fireEvent.press(screen.getByTestId('exerciseInfoBtn-x1'))
    expect(screen.getByTestId('exerciseInfoSheet')).toBeOnTheScreen()
    expect(screen.getByText('GENOMFÖRANDE')).toBeOnTheScreen()
    expect(screen.getByText(EXERCISE_INFO['Chin-ups'].steps[0].sv)).toBeOnTheScreen()
  })
})
