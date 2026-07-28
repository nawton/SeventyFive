import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { PassReviewSheet } from '../PassReviewSheet'
import { savePassMeta } from '@/services/gymPassMeta'
import { updateStrengthWorkoutSets } from '@/services/workouts'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn() } } }))
jest.mock('@/services/gymPassMeta', () => ({
  savePassMeta: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/services/workouts', () => ({
  updateStrengthWorkoutSets: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}))
jest.mock('@/lib/image', () => ({ compressImage: jest.fn(async (uri: string) => uri) }))

const saveMock = savePassMeta as jest.Mock

const ENTRIES = [
  { name: 'Bänkpress', workoutId: 'w1', sets: [{ reps: 10, weightKg: 60 }, { reps: 8, weightKg: 70 }] },
  { name: 'Knäböj', workoutId: 'w2', sets: [{ reps: 5, weightKg: 100 }] },
]

beforeEach(() => jest.clearAllMocks())

describe('PassReviewSheet', () => {
  it('visar siffrorna och övningarna, och sparar titel + kommentar med Klar', async () => {
    const onDone = jest.fn()
    render(
      <PassReviewSheet workoutDate="2026-07-28" durationS={3600} effort={4} entries={ENTRIES} onDone={onDone} />,
    )

    expect(screen.getByText('Bra jobbat!')).toBeOnTheScreen()
    expect(screen.getByText('Bänkpress')).toBeOnTheScreen()
    expect(screen.getByText('60×10  ·  70×8')).toBeOnTheScreen()
    expect(screen.getByText('Knäböj')).toBeOnTheScreen()

    fireEvent.changeText(screen.getByTestId('reviewTitle'), 'Tungt benpass')
    fireEvent.changeText(screen.getByTestId('reviewNote'), 'Sjukt bra pass')
    fireEvent.press(screen.getByTestId('reviewSave'))

    await waitFor(() => expect(saveMock).toHaveBeenCalledWith({
      workoutDate: '2026-07-28',
      title: 'Tungt benpass',
      note: 'Sjukt bra pass',
      photoUri: null,
    }))
    expect(onDone).toHaveBeenCalled()
  })

  it('tom Klar stänger utan att spara någonting', async () => {
    const onDone = jest.fn()
    render(
      <PassReviewSheet workoutDate="2026-07-28" durationS={null} effort={null} entries={ENTRIES} onDone={onDone} />,
    )
    fireEvent.press(screen.getByTestId('reviewSave'))
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect(saveMock).not.toHaveBeenCalled()
  })

  it('tryck på en övning öppnar redigeringen och sparar nya set', async () => {
    render(
      <PassReviewSheet workoutDate="2026-07-28" durationS={null} effort={null} entries={ENTRIES} onDone={jest.fn()} />,
    )
    fireEvent.press(screen.getByTestId('reviewEx-1'))
    // Knäböjens enda set förifyllt
    expect(screen.getByTestId('editReps-0').props.value).toBe('5')
    fireEvent.changeText(screen.getByTestId('editReps-0'), '8')
    fireEvent.changeText(screen.getByTestId('editKg-0'), '110')
    fireEvent.press(screen.getByTestId('editSave'))

    await waitFor(() => expect(updateStrengthWorkoutSets).toHaveBeenCalledWith('w2', [{ reps: 8, weight_kg: 110 }]))
    // Raden i granskningen uppdaterad
    expect(screen.getByText('110×8')).toBeOnTheScreen()
  })
})
