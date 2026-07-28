import { render, screen, fireEvent, act, within } from '@testing-library/react-native'
import { setLanguage } from '@/lib/i18n'
import { EXERCISE_INFO } from '@/lib/exerciseInfo'
import { ExercisePickerSheet } from '../ExercisePickerSheet'
import type { Exercise } from '@/services/exercises'

jest.mock('@/lib/supabase', () => ({ supabase: {
  from: jest.fn(),
  auth: { getSession: jest.fn() },
  storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://test/${p}` } }) }) },
} }))
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}))

const ex = (id: string, name: string, image_path: string | null = null): Exercise => ({
  id, name, description: null, category: 'strength', difficulty: 'beginner', video_url: null, image_path,
})

// Rodd → övre rygg/trapezius, Marklyft → nedre rygg m.m., Bänkpress → bröst
const EXERCISES = [
  ex('e1', 'Rodd med skivstång'),
  ex('e2', 'Marklyft'),
  ex('e3', 'Bänkpress', 'bankpress.gif'),
  ex('e4', 'Lutande bänkpress'),
  ex('e5', 'Sidolyft'),
  ex('e6', 'Bakre deltalyft'),
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

describe('ExercisePickerSheet — infobladet', () => {
  afterEach(async () => {
    await act(async () => { await setLanguage('sv') })
  })

  it('långtryck på en övning öppnar infobladet med svenska steg', () => {
    mount()
    fireEvent(screen.getByText('Bänkpress'), 'longPress')

    expect(screen.getByTestId('exerciseInfoSheet')).toBeOnTheScreen()
    expect(screen.getByText('GENOMFÖRANDE')).toBeOnTheScreen()
    expect(screen.getByText(EXERCISE_INFO['Bänkpress'].steps[0].sv)).toBeOnTheScreen()
    // Muskelchipen letas inuti bladet, gruppnamnet bakom modalen heter likadant
    expect(within(screen.getByTestId('exerciseInfoSheet')).getByText(EXERCISE_INFO['Bänkpress'].target)).toBeOnTheScreen()
  })

  it('tryck på GIF-plattan öppnar också infobladet', () => {
    mount()
    expect(screen.queryByTestId('exerciseInfoSheet')).toBeNull()
    fireEvent.press(screen.getByTestId('exerciseImage-e3'))
    expect(screen.getByTestId('exerciseInfoSheet')).toBeOnTheScreen()
  })

  it('på engelska visas de engelska originalstegen', async () => {
    await act(async () => { await setLanguage('en') })
    mount()
    fireEvent(screen.getByText('Bench press'), 'longPress')

    expect(screen.getByText('INSTRUCTIONS')).toBeOnTheScreen()
    expect(screen.getByText(EXERCISE_INFO['Bänkpress'].steps[0].en)).toBeOnTheScreen()
  })
})

describe('ExercisePickerSheet — delmuskelfiltret', () => {
  it('alla övningar visas direkt, muskelknappen filtrerar till gruppen', () => {
    mount()
    // Hela biblioteket syns utan filter
    expect(screen.getByText('Bänkpress')).toBeOnTheScreen()
    expect(screen.getByText('Rodd med skivstång')).toBeOnTheScreen()

    fireEvent.press(screen.getByTestId('muscleFilter'))
    expect(screen.getByText('Alla muskler')).toBeOnTheScreen()
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
    fireEvent.press(screen.getByTestId('muscleFilter'))
    fireEvent.press(screen.getByText('Rygg'))

    fireEvent.press(screen.getByTestId('subMuscle-lower-back'))
    expect(screen.getByText('Marklyft')).toBeOnTheScreen()
    expect(screen.queryByText('Rodd med skivstång')).toBeNull()

    fireEvent.press(screen.getByTestId('subMuscle-all'))
    expect(screen.getByText('Rodd med skivstång')).toBeOnTheScreen()
  })

  it('Bröst delas i övre, mellersta och nedre via övningsnamnet', () => {
    mount()
    fireEvent.press(screen.getByTestId('muscleFilter'))
    fireEvent.press(screen.getByText('Bröst'))
    expect(screen.getByText('Bänkpress')).toBeOnTheScreen()
    // Övning med foto visar bilden, övning utan behåller ikonen
    expect(screen.getByTestId('exerciseImage-e3')).toBeOnTheScreen()
    expect(screen.queryByTestId('exerciseImage-e4')).toBeNull()
    expect(screen.getByText('Lutande bänkpress')).toBeOnTheScreen()

    fireEvent.press(screen.getByTestId('subMuscle-upper-chest'))
    expect(screen.getByText('Lutande bänkpress')).toBeOnTheScreen()
    expect(screen.queryByText('Bänkpress')).toBeNull()

    fireEvent.press(screen.getByTestId('subMuscle-mid-chest'))
    expect(screen.getByText('Bänkpress')).toBeOnTheScreen()
    expect(screen.queryByText('Lutande bänkpress')).toBeNull()
  })

  it('Axlar delas i främre, mellersta och bakre delta', () => {
    mount()
    fireEvent.press(screen.getByTestId('muscleFilter'))
    fireEvent.press(screen.getByText('Axlar'))
    expect(screen.getByText('Sidolyft')).toBeOnTheScreen()
    expect(screen.getByText('Bakre deltalyft')).toBeOnTheScreen()

    fireEvent.press(screen.getByTestId('subMuscle-rear-delts'))
    expect(screen.getByText('Bakre deltalyft')).toBeOnTheScreen()
    expect(screen.queryByText('Sidolyft')).toBeNull()

    fireEvent.press(screen.getByTestId('subMuscle-side-delts'))
    expect(screen.getByText('Sidolyft')).toBeOnTheScreen()
    expect(screen.queryByText('Bakre deltalyft')).toBeNull()
  })

})
