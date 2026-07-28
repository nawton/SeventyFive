import { Alert } from 'react-native'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native'
import { DayWorkoutsModal } from '../stats/DayWorkoutsModal'
import { getTasksForDay, updateDayTasks, type DaySummary, type TaskItem } from '@/services/dailyLog'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() }, channel: jest.fn(), removeChannel: jest.fn() },
}))
jest.mock('@/services/dailyLog', () => ({
  getTasksForDay: jest.fn(),
  updateDayTasks: jest.fn(),
}))

const tasksMock = getTasksForDay as jest.Mock
const updateMock = updateDayTasks as jest.Mock

const TASKS: TaskItem[] = [
  { completionId: 'a', templateId: 't1', name: 'Träna 45 min', description: null, type: 'workout', completed: true, targetValue: null, unit: null, details: null, icon: null },
  { completionId: 'b', templateId: 't2', name: 'Läs 10 sidor', description: null, type: 'reading', completed: false, targetValue: null, unit: null, details: null, icon: null },
]

const DAY: DaySummary = { dayNumber: 5, status: 'failed' }

function mount(onTasksChanged = jest.fn()) {
  render(
    <DayWorkoutsModal
      day={DAY}
      startDate="2026-07-01"
      challengeId="c1"
      workouts={[]}
      strengthWorkouts={[]}
      completedSessions={[]}
      onClose={jest.fn()}
      onSelectWorkout={jest.fn()}
      onTasksChanged={onTasksChanged}
    />,
  )
  return onTasksChanged
}

beforeEach(() => {
  jest.clearAllMocks()
  tasksMock.mockResolvedValue(TASKS)
  updateMock.mockResolvedValue('completed')
})

describe('DayWorkoutsModal — efterhandsredigering', () => {
  it('uppgiftskortet visas med Redigera och kan inte längre svepas bort', async () => {
    mount()
    expect(await screen.findByText('Dagens uppgifter')).toBeOnTheScreen()
    expect(screen.getByText('1 av 2')).toBeOnTheScreen()
    expect(screen.getByTestId('tasksEdit')).toBeOnTheScreen()
  })

  it('Redigera kräver ärlighetsbekräftelsen innan läget öppnas', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mount()
    fireEvent.press(await screen.findByTestId('tasksEdit'))

    const [title, message, buttons] = alertSpy.mock.calls[0]
    expect(title).toBe('Ändra i efterhand?')
    expect(message).toMatch(/bara dig det påverkar/)
    expect(screen.queryByTestId('tasksSave')).toBeNull()

    act(() => {
      (buttons as Array<{ text: string; onPress?: () => void }>)
        .find(b => b.text === 'Jag är säker')!.onPress!()
    })
    expect(screen.getByTestId('tasksSave')).toBeOnTheScreen()
    alertSpy.mockRestore()
  })

  it('ibockad glömd uppgift sparas, dagen blir klarad och skalet laddar om', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const onTasksChanged = mount()

    fireEvent.press(await screen.findByTestId('tasksEdit'))
    act(() => {
      (alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>)
        .find(b => b.text === 'Jag är säker')!.onPress!()
    })

    // Bocka i den glömda uppgiften och spara
    fireEvent.press(screen.getByTestId('taskToggle-1'))
    fireEvent.press(screen.getByTestId('tasksSave'))

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('c1', 5, '2026-07-05', [
      { completionId: 'a', templateId: 't1', completed: true },
      { completionId: 'b', templateId: 't2', completed: true },
    ]))
    expect(onTasksChanged).toHaveBeenCalled()
    // Positiva beskedet när dagen gick från failad till klarad
    expect(alertSpy.mock.calls.some(c => c[0] === 'Snyggt!')).toBe(true)
    expect(screen.getByText('2 av 2')).toBeOnTheScreen()
    alertSpy.mockRestore()
  })

  it('Avbryt lämnar redigeringen utan att spara', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mount()
    fireEvent.press(await screen.findByTestId('tasksEdit'))
    act(() => {
      (alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>)
        .find(b => b.text === 'Jag är säker')!.onPress!()
    })
    fireEvent.press(screen.getByTestId('taskToggle-1'))
    fireEvent.press(screen.getByText('Avbryt'))

    expect(updateMock).not.toHaveBeenCalled()
    expect(screen.getByText('1 av 2')).toBeOnTheScreen()
    alertSpy.mockRestore()
  })
})
