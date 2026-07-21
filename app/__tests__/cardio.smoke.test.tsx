import { render, screen } from '@testing-library/react-native'
import CardioScreen from '../cardio'
import { useLocalSearchParams } from 'expo-router'
import { buildRunSegments, parseRunTarget } from '@/lib/runProgression'

// =============================================================================
// RÖKTEST FÖR GPS-VYN — verifierar att skärmen MONTERAR i sina lägen (fri
// runda, guidat pass, trasiga params) utan att krascha och att idle-cellerna
// visar rätt sak. Själva spårningen (GPS, röst, autopaus) testas på asfalt —
// motorn bakom guidningen är redan enhetstestad i intervalEngine.test.ts.
// =============================================================================

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  },
}))
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}))
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getLastKnownPositionAsync: jest.fn().mockResolvedValue(null),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 59.33, longitude: 18.07 } }),
  watchHeadingAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  Accuracy: { High: 4, BestForNavigation: 6 },
}))
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }))
jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => {} }))
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(), notificationAsync: jest.fn(), selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}))

const INT_NOTES = 'Start 5×1000 m · +1 per vecka · max 8×1000 m · ca 4:55 /km'

function renderWith(params: Record<string, string>) {
  ;(useLocalSearchParams as jest.Mock).mockReturnValue(params)
  return render(<CardioScreen />)
}

beforeEach(() => jest.clearAllMocks())

describe('cardio — fri runda (idle)', () => {
  it('monterar med aktivitets-, mål- och röstceller', async () => {
    renderWith({ name: 'running' })
    expect(await screen.findByText('Aktivitet')).toBeOnTheScreen()
    expect(screen.getByText('Löpning')).toBeOnTheScreen()
    expect(screen.getByText('Mål')).toBeOnTheScreen()
    expect(screen.getByText('Inget')).toBeOnTheScreen()
    expect(screen.getByText('Röstguidning')).toBeOnTheScreen()
  })

  it('förifyllt mål från params visas i målcellen', async () => {
    renderWith({ name: 'running', goalKm: '10.00' })
    expect(await screen.findByText('10 km')).toBeOnTheScreen()
  })

  it('aktiviteten härleds ur namnet', async () => {
    renderWith({ name: 'cycling' })
    expect(await screen.findByText('Cykling')).toBeOnTheScreen()
  })
})

describe('cardio — guidat pass', () => {
  it('visar Upplägg med antal intervaller istället för mål', async () => {
    const segs = buildRunSegments('Intervaller', parseRunTarget(INT_NOTES, 0))
    renderWith({ name: 'interval', segments: JSON.stringify(segs) })
    expect(await screen.findByText('Upplägg')).toBeOnTheScreen()
    expect(screen.getByText('5 intervaller')).toBeOnTheScreen()
    expect(screen.queryByText('Mål')).toBeNull()
    expect(screen.getByText('Intervall')).toBeOnTheScreen()
  })

  it('tempopass med ett arbetssegment visar "Följer passet"', async () => {
    const segs = buildRunSegments('Tempopass',
      parseRunTarget('Start 5 km · +1 km per vecka · max 10 km i tempofart · ca 5:15–5:25 /km', 0))
    renderWith({ name: 'running', segments: JSON.stringify(segs) })
    expect(await screen.findByText('Följer passet')).toBeOnTheScreen()
  })
})

describe('cardio — trasiga segment-params kraschar aldrig', () => {
  it.each([
    ['ogiltig JSON', 'inte json alls'],
    ['fel form', JSON.stringify({ lol: true })],
    ['tom lista', JSON.stringify([])],
    ['segment utan distans/tid', JSON.stringify([{ kind: 'work', label: 'x' }, { kind: 'rest', label: 'y' }])],
  ])('%s → faller tillbaka till fri runda', async (_desc, bad) => {
    renderWith({ name: 'running', segments: bad })
    expect(await screen.findByText('Mål')).toBeOnTheScreen()
    expect(screen.queryByText('Upplägg')).toBeNull()
  })
})
