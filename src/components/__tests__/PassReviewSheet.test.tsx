import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { State, type PanGesture } from 'react-native-gesture-handler'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'
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

describe('PassReviewSheet — foto', () => {
  it('nekad åtkomst förklaras, avbrutet val gör inget, valt foto kan tas bort', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert')
    const picker = jest.requireMock('expo-image-picker')
    render(
      <PassReviewSheet workoutDate="2026-07-28" durationS={null} effort={null} entries={ENTRIES} onDone={jest.fn()} />,
    )

    picker.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({ status: 'denied' })
    fireEvent.press(screen.getByTestId('addPhoto'))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Åtkomst nekad', expect.any(String)))

    // Avbrutet bibliotek lämnar allt orört
    fireEvent.press(screen.getByTestId('addPhoto'))
    await waitFor(() => expect(picker.launchImageLibraryAsync).toHaveBeenCalled())
    expect(screen.queryByTestId('removePhoto')).toBeNull()

    // Valt foto komprimeras, visas och kan tas bort med krysset
    picker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false, assets: [{ uri: 'file://foto.jpg', width: 3000 }],
    })
    fireEvent.press(screen.getByTestId('addPhoto'))
    await waitFor(() => expect(screen.getByTestId('removePhoto')).toBeOnTheScreen())
    fireEvent.press(screen.getByTestId('removePhoto'))
    expect(screen.queryByTestId('removePhoto')).toBeNull()
    alertSpy.mockRestore()
  })

  it('misslyckad uppladdning förklaras och går att försöka igen', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert')
    const onDone = jest.fn()
    render(
      <PassReviewSheet workoutDate="2026-07-28" passKey="k1" durationS={null} effort={null} entries={ENTRIES} onDone={onDone} />,
    )

    saveMock.mockRejectedValueOnce(new Error('nätfel'))
    fireEvent.changeText(screen.getByTestId('reviewTitle'), 'Push')
    fireEvent.press(screen.getByTestId('reviewSave'))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Kunde inte spara', expect.any(String)))
    expect(onDone).not.toHaveBeenCalled()

    fireEvent.press(screen.getByTestId('reviewSave'))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(saveMock).toHaveBeenLastCalledWith({
      workoutDate: '2026-07-28', passKey: 'k1', title: 'Push', note: '', photoUri: null,
    })
    alertSpy.mockRestore()
  })
})

describe('PassReviewSheet — redigeringsbladet', () => {
  it('utan giltiga set stängs redigeringen utan att spara', async () => {
    render(
      <PassReviewSheet workoutDate="2026-07-28" durationS={null} effort={null} entries={ENTRIES} onDone={jest.fn()} />,
    )
    fireEvent.press(screen.getByTestId('reviewEx-1'))
    fireEvent.changeText(screen.getByTestId('editReps-0'), '')
    fireEvent.press(screen.getByTestId('editSave'))
    await waitFor(() => expect(screen.queryByTestId('editSave')).toBeNull())
    expect(updateStrengthWorkoutSets).not.toHaveBeenCalled()
  })

  it('misslyckad ändring förklaras och bladet ligger kvar', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert')
    ;(updateStrengthWorkoutSets as jest.Mock).mockRejectedValueOnce(new Error('nätfel'))
    render(
      <PassReviewSheet workoutDate="2026-07-28" durationS={null} effort={null} entries={ENTRIES} onDone={jest.fn()} />,
    )
    fireEvent.press(screen.getByTestId('reviewEx-1'))
    fireEvent.press(screen.getByTestId('editSave'))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Något gick fel', expect.any(String)))
    expect(screen.getByTestId('editSave')).toBeOnTheScreen()
    alertSpy.mockRestore()
  })

  it('övning utan workoutId går inte att redigera', () => {
    render(
      <PassReviewSheet
        workoutDate="2026-07-28" durationS={null} effort={null}
        entries={[{ name: 'Plankan', workoutId: null, sets: [{ reps: 1, weightKg: 0 }] }]}
        onDone={jest.fn()}
      />,
    )
    fireEvent.press(screen.getByTestId('reviewEx-0'))
    expect(screen.queryByTestId('editSave')).toBeNull()
  })

  it('bladet kan dras ner för att stängas, liten dragning studsar tillbaka', async () => {
    render(
      <PassReviewSheet workoutDate="2026-07-28" durationS={null} effort={null} entries={ENTRIES} onDone={jest.fn()} />,
    )
    fireEvent.press(screen.getByTestId('reviewEx-0'))
    expect(screen.getByTestId('editSave')).toBeOnTheScreen()

    fireGestureHandler<PanGesture>(getByGestureTestId('reviewEditPan'), [
      { state: State.BEGAN, translationY: 0 },
      { state: State.ACTIVE, translationY: -20 },   // uppåt bromsas med gummiband
      { state: State.ACTIVE, translationY: 30 },
      { state: State.END, translationY: 30, velocityY: 0 },
    ])
    expect(screen.getByTestId('editSave')).toBeOnTheScreen()

    fireGestureHandler<PanGesture>(getByGestureTestId('reviewEditPan'), [
      { state: State.BEGAN, translationY: 0 },
      { state: State.ACTIVE, translationY: 200 },
      { state: State.END, translationY: 200, velocityY: 900 },
    ])
    await waitFor(() => expect(screen.queryByTestId('editSave')).toBeNull())
  })

  it('backdroppen stänger redigeringen', async () => {
    render(
      <PassReviewSheet workoutDate="2026-07-28" durationS={null} effort={null} entries={ENTRIES} onDone={jest.fn()} />,
    )
    fireEvent.press(screen.getByTestId('reviewEx-0'))
    fireEvent.press(screen.getByTestId('editBackdrop'))
    await waitFor(() => expect(screen.queryByTestId('editSave')).toBeNull())
  })
})
