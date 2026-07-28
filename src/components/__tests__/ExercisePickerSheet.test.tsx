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

const ex = (id: string, name: string, image_path: string | null = null, equipment: Exercise['equipment'] = 'barbell'): Exercise => ({
  id, name, description: null, category: 'strength', difficulty: 'beginner', video_url: null, image_path, equipment,
})

// Rodd → övre rygg/trapezius, Marklyft → nedre rygg m.m., Bänkpress → bröst
const EXERCISES = [
  ex('e1', 'Rodd med skivstång'),
  ex('e2', 'Marklyft'),
  ex('e3', 'Bänkpress', 'bankpress.gif'),
  ex('e4', 'Lutande bänkpress'),
  ex('e5', 'Sidolyft', null, 'dumbbell'),
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

describe('ExercisePickerSheet — vanliga övningar', () => {
  it('VANLIGA-sektionen ligger överst och försvinner vid sökning', () => {
    mount()
    expect(screen.getByText('VANLIGA')).toBeOnTheScreen()
    expect(screen.getByText('ALLA ÖVNINGAR')).toBeOnTheScreen()

    fireEvent.press(screen.getByTestId('muscleFilter'))
    fireEvent.press(screen.getByTestId('muscle-deltoids'))
    // Sidolyft är kuraterad som vanlig för axlar
    expect(screen.getByText('VANLIGA')).toBeOnTheScreen()
    expect(screen.getByText('Sidolyft')).toBeOnTheScreen()

    fireEvent.changeText(screen.getByPlaceholderText('Sök övning…'), 'sido')
    expect(screen.queryByText('VANLIGA')).toBeNull()
    expect(screen.getByText('Sidolyft')).toBeOnTheScreen()
  })
})

describe('ExercisePickerSheet — utrustningsfiltret', () => {
  it('filtrerar på redskap och kombineras med muskelfiltret', () => {
    mount()
    fireEvent.press(screen.getByTestId('equipFilter'))
    fireEvent.press(screen.getByTestId('equip-dumbbell'))

    expect(screen.getByText('Sidolyft')).toBeOnTheScreen()
    expect(screen.queryByText('Bänkpress')).toBeNull()

    // Tillbaka till all utrustning
    fireEvent.press(screen.getByTestId('equipFilter'))
    fireEvent.press(screen.getByTestId('equip-all'))
    expect(screen.getByText('Bänkpress')).toBeOnTheScreen()
  })
})

describe('ExercisePickerSheet — delmuskelfiltret', () => {
  it('alla övningar visas direkt, muskelraden filtrerar på muskeln', () => {
    mount()
    // Hela biblioteket syns utan filter
    expect(screen.getByText('Bänkpress')).toBeOnTheScreen()
    expect(screen.getByText('Rodd med skivstång')).toBeOnTheScreen()
    // Övning med foto visar bilden, övning utan behåller ikonen
    expect(screen.getByTestId('exerciseImage-e3')).toBeOnTheScreen()
    expect(screen.queryByTestId('exerciseImage-e4')).toBeNull()

    fireEvent.press(screen.getByTestId('muscleFilter'))
    expect(screen.getByText('Alla muskler')).toBeOnTheScreen()
    fireEvent.press(screen.getByTestId('muscle-upper-back'))

    expect(screen.getByText('Rodd med skivstång')).toBeOnTheScreen()
    expect(screen.queryByText('Bänkpress')).toBeNull()
  })

  it('muskelfiltret växlar och Alla muskler återställer', () => {
    mount()
    fireEvent.press(screen.getByTestId('muscleFilter'))
    fireEvent.press(screen.getByTestId('muscle-lower-back'))
    expect(screen.getByText('Marklyft')).toBeOnTheScreen()
    expect(screen.queryByText('Sidolyft')).toBeNull()

    fireEvent.press(screen.getByTestId('muscleFilter'))
    fireEvent.press(screen.getByTestId('muscle-deltoids'))
    expect(screen.getByText('Sidolyft')).toBeOnTheScreen()
    expect(screen.queryByText('Marklyft')).toBeNull()

    fireEvent.press(screen.getByTestId('muscleFilter'))
    fireEvent.press(screen.getByTestId('filterAll'))
    expect(screen.getByText('Marklyft')).toBeOnTheScreen()
    expect(screen.getByText('Sidolyft')).toBeOnTheScreen()
  })

})
