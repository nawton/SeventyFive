import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { SessionFullscreen } from '../SessionFullscreen'
import { EXERCISE_INFO } from '@/lib/exerciseInfo'
import type { Exercise } from '@/services/exercises'
import type { WorkoutSession } from '@/services/workoutSchedule'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn() },
  storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://test/${p}` } }) }) },
} }))
jest.mock('@/services/workouts', () => ({
  saveStrengthWorkout: jest.fn().mockResolvedValue('w-saved-1'),
  getStrengthWorkouts: jest.fn().mockResolvedValue([]),
  updateStrengthWorkoutSets: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/services/gymPassMeta', () => ({
  savePassMeta: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}))
jest.mock('@/lib/image', () => ({ compressImage: jest.fn(async (uri: string) => uri) }))
jest.mock('@/services/personalRecords', () => ({
  getPersonalRecords: jest.fn().mockResolvedValue([]),
  findNewPR: jest.fn(),
}))
jest.mock('@/services/workoutSchedule', () => ({
  completeExercise: jest.fn().mockResolvedValue(undefined),
  updateSessionExercise: jest.fn().mockResolvedValue(undefined),
  addSingleExerciseToSession: jest.fn().mockResolvedValue(undefined),
  deleteSessionExercise: jest.fn().mockResolvedValue(undefined),
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

function mountView(overrides: Partial<React.ComponentProps<typeof SessionFullscreen>> = {}) {
  const onComplete = jest.fn()
  const onClose = jest.fn()
  render(
    <SessionFullscreen
      visible
      session={SESSION}
      isCompleted={false}
      exercisesList={EXERCISES}
      date="2026-07-28"
      userId="u1"
      onComplete={onComplete}
      onUncomplete={jest.fn()}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { onComplete, onClose }
}

describe('SessionFullscreen — slutförandeflödet', () => {
  beforeEach(() => jest.clearAllMocks())

  it('ifyllda set sparas med pass-nyckel, betyg och granskning innan stängning', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert')
    const { saveStrengthWorkout } = jest.requireMock('@/services/workouts')
    const { completeExercise } = jest.requireMock('@/services/workoutSchedule')
    const { onComplete, onClose } = mountView()
    await waitFor(() => expect(screen.getByText('Chin-ups')).toBeOnTheScreen())

    fireEvent.press(screen.getByText('Starta'))
    // startPass sätter started asynkront via prefs
    await waitFor(() => expect(screen.getByText('Slutför')).toBeOnTheScreen())
    // Fyll första övningens första set (reps-fältet har planerade reps som platshållare)
    fireEvent.changeText(screen.getAllByPlaceholderText('10')[0], '8')

    fireEvent.press(screen.getByText('Slutför'))
    const confirm = alertSpy.mock.calls.at(-1)
    expect(confirm?.[0]).toBe('Är du klar med passet?')
    await act(async () => { confirm?.[2]?.find(b => b.text === 'Slutför')?.onPress?.() })

    // Raden sparades med nyckel som skiljer passet från andra samma dag
    await waitFor(() => expect(saveStrengthWorkout).toHaveBeenCalled())
    const payload = saveStrengthWorkout.mock.calls[0][0]
    expect(payload).toMatchObject({
      userId: 'u1', exerciseName: 'Chin-ups', workoutDate: '2026-07-28',
      sets: [{ reps: 8, weight_kg: 0 }],
    })
    expect(payload.passKey).toMatch(/^s1:2026-07-28:\d+$/)
    expect(completeExercise).toHaveBeenCalledWith('x1', 'u1', '2026-07-28')

    // Betyget → hoppa över → granskningen visas med sparade setet
    await waitFor(() => expect(screen.getByText('Betygsätt din\nansträngning')).toBeOnTheScreen())
    fireEvent.press(screen.getByText('Hoppa över'))
    await waitFor(() => expect(screen.getByTestId('passReviewSheet')).toBeOnTheScreen())
    expect(screen.getByText('8')).toBeOnTheScreen()

    // Klar utan text → ingenting sparas i metan, vyn stängs och passet markeras
    fireEvent.press(screen.getByTestId('reviewSave'))
    await waitFor(() => expect(onComplete).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('utan ifyllda set loggas de planerade platshållarseten åt en', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert')
    const { saveStrengthWorkout } = jest.requireMock('@/services/workouts')
    const { onComplete } = mountView()
    await waitFor(() => expect(screen.getByText('Chin-ups')).toBeOnTheScreen())

    fireEvent.press(screen.getByText('Starta'))
    await waitFor(() => expect(screen.getByText('Slutför')).toBeOnTheScreen())
    fireEvent.press(screen.getByText('Slutför'))
    const ask = alertSpy.mock.calls.at(-1)
    expect(ask?.[0]).toBe('Inga set ifyllda')
    expect(ask?.[1]).toContain('planerade seten')
    await act(async () => { ask?.[2]?.find(b => b.text === 'Markera klart')?.onPress?.() })

    // Planerade 3×10 sparas för båda övningarna
    await waitFor(() => expect(saveStrengthWorkout).toHaveBeenCalledTimes(2))
    expect(saveStrengthWorkout.mock.calls[0][0].sets).toEqual([
      { reps: 10, weight_kg: 0 }, { reps: 10, weight_kg: 0 }, { reps: 10, weight_kg: 0 },
    ])

    await waitFor(() => expect(screen.getByText('Betygsätt din\nansträngning')).toBeOnTheScreen())
    fireEvent.press(screen.getByText('Hoppa över'))
    await waitFor(() => expect(screen.getByTestId('passReviewSheet')).toBeOnTheScreen())
    // Granskningen visar de loggade platshållarseten
    expect(screen.getAllByText('10  ·  10  ·  10').length).toBeGreaterThan(0)

    fireEvent.press(screen.getByTestId('reviewSave'))
    await waitFor(() => expect(onComplete).toHaveBeenCalled())
    alertSpy.mockRestore()
  })
})

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
