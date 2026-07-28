import { render, screen, fireEvent } from '@testing-library/react-native'
import { SessionEditor } from '../SessionEditor'
import { EXERCISE_INFO } from '@/lib/exerciseInfo'
import type { Exercise } from '@/services/exercises'
import type { WorkoutSession } from '@/services/workoutSchedule'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn() },
  storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://test/${p}` } }) }) },
} }))
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}))

const EXERCISES: Exercise[] = [
  { id: 'e1', name: 'Bänkpress', description: null, category: 'strength', difficulty: 'beginner', video_url: null, image_path: 'bankpress.gif' },
  { id: 'e2', name: 'Min egen övning', description: null, category: 'strength', difficulty: 'beginner', video_url: null, image_path: null },
]

const SESSION: WorkoutSession = {
  id: 's1', user_id: 'u1', name: 'Bröstpass', weekdays: [1], sort_order: 0,
  created_at: '2026-07-01', notes: null, session_type: 'gym', cardio_type: null,
  exercises: [
    { id: 'x1', session_id: 's1', exercise_name: 'Bänkpress', sets: 3, reps: '10', sort_order: 0 },
    { id: 'x2', session_id: 's1', exercise_name: 'Min egen övning', sets: 3, reps: '10', sort_order: 1 },
  ],
}

describe('SessionEditor — infoknappen per övning', () => {
  it('biblioteksövningar har infoknapp som öppnar infobladet, egna utan info saknar den', () => {
    render(
      <SessionEditor
        visible
        session={SESSION}
        exercises={EXERCISES}
        onClose={jest.fn()}
        onSaved={jest.fn()}
        userId="u1"
      />,
    )

    expect(screen.getByText('Bänkpress')).toBeOnTheScreen()
    // Bara övningen med info/bild får knappen
    expect(screen.getByTestId('exerciseInfoBtn-x1')).toBeOnTheScreen()
    expect(screen.queryByTestId('exerciseInfoBtn-x2')).toBeNull()

    fireEvent.press(screen.getByTestId('exerciseInfoBtn-x1'))
    expect(screen.getByTestId('exerciseInfoSheet')).toBeOnTheScreen()
    expect(screen.getByText('GENOMFÖRANDE')).toBeOnTheScreen()
    expect(screen.getByText(EXERCISE_INFO['Bänkpress'].steps[0].sv)).toBeOnTheScreen()
  })
})
