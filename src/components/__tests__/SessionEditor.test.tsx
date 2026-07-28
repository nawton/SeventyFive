import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { SessionEditor } from '../SessionEditor'
import { EXERCISE_INFO } from '@/lib/exerciseInfo'
import type { Exercise } from '@/services/exercises'
import type { WorkoutSession } from '@/services/workoutSchedule'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn() },
  storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://test/${p}` } }) }) },
} }))
jest.mock('@/services/workoutSchedule', () => ({
  createWorkoutSession: jest.fn().mockResolvedValue(undefined),
  updateWorkoutSession: jest.fn().mockResolvedValue(undefined),
  deleteWorkoutSession: jest.fn().mockResolvedValue(undefined),
}))
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

describe('SessionEditor — spara och redigera', () => {
  beforeEach(() => jest.clearAllMocks())

  it('befintligt pass sparas via updateWorkoutSession med set och reps', async () => {
    const { updateWorkoutSession } = jest.requireMock('@/services/workoutSchedule')
    const onSaved = jest.fn()
    render(
      <SessionEditor
        visible
        session={SESSION}
        exercises={EXERCISES}
        onClose={jest.fn()}
        onSaved={onSaved}
        userId="u1"
      />,
    )
    fireEvent.press(screen.getByText('Spara pass'))
    await waitFor(() => expect(updateWorkoutSession).toHaveBeenCalled())
    const [id, name, weekdays, exList] = updateWorkoutSession.mock.calls[0]
    expect(id).toBe('s1')
    expect(name).toBe('Bröstpass')
    expect(weekdays).toEqual([1])
    expect(exList).toEqual([
      { exercise_name: 'Bänkpress', sets: 3, reps: '10' },
      { exercise_name: 'Min egen övning', sets: 3, reps: '10' },
    ])
    expect(onSaved).toHaveBeenCalled()
  })

  it('övning utan set stoppas med tydligt felmeddelande', async () => {
    const { Alert } = jest.requireActual('react-native')
    const spy = jest.spyOn(Alert, 'alert')
    const { updateWorkoutSession } = jest.requireMock('@/services/workoutSchedule')
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
    // Töm första övningens set
    fireEvent.changeText(screen.getAllByPlaceholderText('Set')[0], '')
    fireEvent.press(screen.getByText('Spara pass'))
    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(spy.mock.calls.at(-1)?.[0]).toBe('Ange set och reps')
    expect(updateWorkoutSession).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('borttagning bekräftas och går via deleteWorkoutSession', async () => {
    const { Alert } = jest.requireActual('react-native')
    const spy = jest.spyOn(Alert, 'alert')
    const { deleteWorkoutSession } = jest.requireMock('@/services/workoutSchedule')
    const onSaved = jest.fn()
    render(
      <SessionEditor
        visible
        session={SESSION}
        exercises={EXERCISES}
        onClose={jest.fn()}
        onSaved={onSaved}
        userId="u1"
      />,
    )
    fireEvent.press(screen.getByText('icon:trash-outline'))
    const ask = spy.mock.calls.at(-1)
    expect(ask?.[0]).toBe('Ta bort pass')
    await waitFor(async () => { await ask?.[2]?.find((b: { text: string }) => b.text === 'Ta bort')?.onPress?.() })
    await waitFor(() => expect(deleteWorkoutSession).toHaveBeenCalledWith('s1'))
    spy.mockRestore()
  })
})

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
