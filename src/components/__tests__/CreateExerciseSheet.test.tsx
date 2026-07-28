import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { CreateExerciseSheet } from '../CreateExerciseSheet'
import { createCustomExercise } from '@/services/exercises'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn() } } }))
jest.mock('@/services/exercises', () => {
  const actual = jest.requireActual('@/services/exercises')
  return {
    ...actual,
    createCustomExercise: jest.fn().mockResolvedValue({
      id: 'ex9', name: 'Landmine press', category: 'strength', user_id: 'u1',
    }),
  }
})
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}))

const createMock = createCustomExercise as jest.Mock

function mount(onCreated = jest.fn(), onClose = jest.fn()) {
  render(<CreateExerciseSheet visible onClose={onClose} onCreated={onCreated} />)
  return { onCreated, onClose }
}

beforeEach(() => jest.clearAllMocks())

describe('CreateExerciseSheet', () => {
  it('Spara är låst tills namn, utrustning, muskel och typ är valda', async () => {
    mount()
    expect(screen.getByText('Skapa övning')).toBeOnTheScreen()

    fireEvent.press(screen.getByTestId('createExerciseSave'))
    expect(createMock).not.toHaveBeenCalled()

    fireEvent.changeText(screen.getByTestId('exerciseName'), 'Landmine press')
    fireEvent.press(screen.getByTestId('createExerciseSave'))
    expect(createMock).not.toHaveBeenCalled()
  })

  it('undersidorna väljer utrustning, muskler och typ, och sparar allt', async () => {
    const { onCreated, onClose } = mount()
    fireEvent.changeText(screen.getByTestId('exerciseName'), 'Landmine press')

    // Utrustning
    fireEvent.press(screen.getByTestId('create-Utrustning'))
    expect(screen.getByText('Välj utrustning')).toBeOnTheScreen()
    fireEvent.press(screen.getByTestId('equipment-barbell'))
    expect(screen.getByText('Skivstång')).toBeOnTheScreen()   // valt värde på formuläret

    // Primär muskel
    fireEvent.press(screen.getByTestId('create-Primär muskelgrupp'))
    fireEvent.press(screen.getByTestId('muscle-chest'))

    // Fler muskler läggs till via plusknappen, flervalslista med Klar
    fireEvent.press(screen.getByTestId('addMuscle'))
    fireEvent.press(screen.getByTestId('other-deltoids'))
    fireEvent.press(screen.getByText('Klar'))
    // Vald muskel visas som chip och kan tas bort med krysset
    expect(screen.getByTestId('removeMuscle-deltoids')).toBeOnTheScreen()

    // Typ med exempel och badges
    fireEvent.press(screen.getByTestId('create-Övningstyp'))
    expect(screen.getByText('Kroppsvikt med vikt')).toBeOnTheScreen()
    expect(screen.getByText('+KG')).toBeOnTheScreen()
    fireEvent.press(screen.getByTestId('type-weight_reps'))

    fireEvent.press(screen.getByTestId('createExerciseSave'))
    await waitFor(() => expect(createMock).toHaveBeenCalledWith({
      name: 'Landmine press',
      equipment: 'barbell',
      primaryMuscle: 'chest',
      otherMuscles: ['deltoids'],
      exerciseType: 'weight_reps',
    }))
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'ex9' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('misslyckad sparning lämnar arket öppet', async () => {
    createMock.mockRejectedValueOnce(new Error('nät'))
    const { onClose } = mount()
    fireEvent.changeText(screen.getByTestId('exerciseName'), 'X')
    fireEvent.press(screen.getByTestId('create-Utrustning'))
    fireEvent.press(screen.getByTestId('equipment-none'))
    fireEvent.press(screen.getByTestId('create-Primär muskelgrupp'))
    fireEvent.press(screen.getByTestId('muscle-abs'))
    fireEvent.press(screen.getByTestId('create-Övningstyp'))
    fireEvent.press(screen.getByTestId('type-duration'))

    fireEvent.press(screen.getByTestId('createExerciseSave'))
    await waitFor(() => expect(createMock).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('createExerciseSave')).toBeOnTheScreen()
  })
})
