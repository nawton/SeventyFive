import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native'
import SetupScheduleScreen from '../(auth)/setup-schedule'
import { generateScheduleFromWizard } from '@/services/scheduleGenerator'
import { router } from 'expo-router'

const mockWizardProps = { current: null as Record<string, any> | null }

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn().mockResolvedValue({
    data: { session: { user: { id: 'u1' } } },
  }) } },
}))
jest.mock('@/services/scheduleGenerator', () => ({
  generateScheduleFromWizard: jest.fn().mockResolvedValue(5),
}))
jest.mock('@/components/ScheduleWizard', () => ({
  ScheduleWizard: (props: Record<string, unknown>) => { mockWizardProps.current = props; return null },
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockWizardProps.current = null
})

describe('SetupScheduleScreen', () => {
  it('visar sista steget med de tre punkterna och stängd wizard', () => {
    render(<SetupScheduleScreen />)
    expect(screen.getByText('STEG 4 AV 4')).toBeOnTheScreen()
    expect(screen.getByText('Välj ditt mål')).toBeOnTheScreen()
    expect(screen.getByText('Veckan planeras åt dig')).toBeOnTheScreen()
    expect(screen.getByText('Färdiga pass')).toBeOnTheScreen()
    expect(mockWizardProps.current?.visible).toBe(false)
  })

  it('Bygg mitt schema öppnar wizarden, klart schema landar på hemskärmen', async () => {
    render(<SetupScheduleScreen />)
    fireEvent.press(screen.getByText('Bygg mitt schema'))
    expect(mockWizardProps.current?.visible).toBe(true)

    await act(async () => { mockWizardProps.current!.onFinish({ goal: 'muscle' }) })
    await waitFor(() => expect(generateScheduleFromWizard).toHaveBeenCalledWith('u1', { goal: 'muscle' }))
    expect(router.replace).toHaveBeenCalledWith('/(app)/dashboard')
  })

  it('hoppa över går direkt till hemskärmen utan schema', () => {
    render(<SetupScheduleScreen />)
    fireEvent.press(screen.getByText('Hoppa över, ställ in senare'))
    expect(router.replace).toHaveBeenCalledWith('/(app)/dashboard')
    expect(generateScheduleFromWizard).not.toHaveBeenCalled()
  })
})
