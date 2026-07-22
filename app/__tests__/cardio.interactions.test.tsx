import { render, screen, fireEvent, act } from '@testing-library/react-native'
import { Alert } from 'react-native'
import CardioScreen from '../cardio'
import { useLocalSearchParams, router } from 'expo-router'
import { saveCardioWorkout } from '@/services/workouts'
import { completeCardioSession } from '@/services/workoutSchedule'
import * as Location from 'expo-location'
import type { RunSegment } from '@/lib/runProgression'

// =============================================================================
// GPS-VYNS INTERAKTIONER OCH FELVÄGAR — modalerna på startvyn (mål, aktivitet,
// röst, kartval, infosheets) och alla sätt sparandet kan gå snett.
// Samma simulator-scaffolding som cardio.simulated.test.tsx.
// =============================================================================

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }),
    },
  },
}))
jest.mock('@/services/workouts', () => ({ saveCardioWorkout: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/services/workoutSchedule', () => ({ completeCardioSession: jest.fn().mockResolvedValue(undefined) }))
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}))

let gpsCb: ((loc: { coords: { latitude: number; longitude: number; accuracy: number } }) => void) | null = null
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getLastKnownPositionAsync: jest.fn().mockResolvedValue(null),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 59.33, longitude: 18.07 } }),
  watchHeadingAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  watchPositionAsync: jest.fn(async (_o: unknown, cb: typeof gpsCb) => { gpsCb = cb; return { remove: jest.fn() } }),
  Accuracy: { High: 4, BestForNavigation: 6 },
}))
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }))
jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => {} }))
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(), notificationAsync: jest.fn(), selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}))

const DEG_PER_M = 1 / 111190
let lat = 59.33
const alertSpy = jest.spyOn(Alert, 'alert')

async function renderIdle(params: Record<string, string> = { name: 'running' }) {
  ;(useLocalSearchParams as jest.Mock).mockReturnValue(params)
  render(<CardioScreen />)
  await screen.findByText('Start')
}

async function startRun(params: Record<string, string> = { name: 'running' }) {
  await renderIdle(params)
  fireEvent.press(screen.getByText('Start'))
  await act(async () => { jest.advanceTimersByTime(3000) })
  fix(0)
}

function fix(meters: number, accuracy = 5) {
  lat += meters * DEG_PER_M
  act(() => { gpsCb!({ coords: { latitude: lat, longitude: 18.07, accuracy } }) })
}
function run(seconds: number, mps: number) {
  for (let i = 0; i < seconds; i++) {
    act(() => { jest.advanceTimersByTime(1000) })
    fix(mps)
  }
}
async function finishToSummary() {
  fireEvent.press(screen.getByText('Pausa'))
  fireEvent.press(screen.getByText('Avsluta'))
  fireEvent.press(await screen.findByText('Hoppa över'))
}

beforeEach(async () => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  gpsCb = null
  lat = 59.33
  // Inställningar (röst av, kartval …) får inte läcka mellan testerna
  const AsyncStorage = require('@react-native-async-storage/async-storage')
  await AsyncStorage.clear()
})
afterEach(() => {
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
})

// ─── Modalerna på startvyn ───────────────────────────────────────────────────

describe('målmodalen', () => {
  it('sätter distans + tid via reglagen och visar målet i cellen', async () => {
    await renderIdle()
    fireEvent.press(screen.getByText('Mål'))
    expect(await screen.findByText('Sätt mål')).toBeOnTheScreen()

    const switches = screen.getAllByRole('switch')
    fireEvent(switches[0], 'valueChange', true)     // distans på → 5 km
    fireEvent(switches[1], 'valueChange', true)     // tid på → 30 min
    fireEvent.press(screen.getByText('Spara mål'))

    expect(screen.getByText('5 km · 30 min')).toBeOnTheScreen()
  })

  it('stepperknapparna justerar målet i halvkilometrar och femminuterssteg', async () => {
    await renderIdle()
    fireEvent.press(screen.getByText('Mål'))
    await screen.findByText('Sätt mål')
    const switches = screen.getAllByRole('switch')
    fireEvent(switches[0], 'valueChange', true)     // 5 km
    fireEvent(switches[1], 'valueChange', true)     // 30 min

    const plus  = screen.getAllByText('icon:add')
    const minus = screen.getAllByText('icon:remove')
    fireEvent.press(plus[0])                        // 5 → 5,5 km
    fireEvent.press(minus[1])                       // 30 → 25 min
    expect(screen.getByText('5,5')).toBeOnTheScreen()
    expect(screen.getByText('25')).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Spara mål'))
    expect(screen.getByText('5,5 km · 25 min')).toBeOnTheScreen()
  })

  it('Inget mål nollställer', async () => {
    await renderIdle({ name: 'running', goalKm: '10.00' })
    expect(await screen.findByText('10 km')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('10 km'))
    fireEvent.press(await screen.findByText('Inget mål'))
    expect(screen.getByText('Inget')).toBeOnTheScreen()
  })
})

describe('aktivitetsväljaren', () => {
  it('byter aktivitet', async () => {
    await renderIdle()
    fireEvent.press(screen.getByText('Löpning'))
    expect(await screen.findByText('Välj aktivitet')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Promenad'))
    // Sheeten stängs och cellen visar den nya aktiviteten
    expect(screen.queryByText('Välj aktivitet')).toBeNull()
    expect(screen.getByText('Promenad')).toBeOnTheScreen()
  })
})

describe('röstmodalen', () => {
  it('navigerar till frekvenssidan och ändrar inställningen', async () => {
    await renderIdle()
    fireEvent.press(screen.getByText('Röstguidning'))
    expect(await screen.findByText('Aktivera')).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Hur ofta?'))
    expect(await screen.findByText('kilometer')).toBeOnTheScreen()
    const switches = screen.getAllByRole('switch')
    fireEvent(switches[1], 'valueChange', true)      // tid på → var 5:e minut
    // Modalens tillbakapil är den sist renderade av skärmens chevron-ikoner
    const backs = screen.getAllByText('icon:chevron-back')
    fireEvent.press(backs[backs.length - 1])
    expect(await screen.findByText(/var 5:e minut/)).toBeOnTheScreen()
  })

  it('röstguidning kan stängas av helt', async () => {
    await renderIdle()
    fireEvent.press(screen.getByText('Röstguidning'))
    const switches = screen.getAllByRole('switch')
    fireEvent(switches[0], 'valueChange', false)
    fireEvent.press(screen.getByText('icon:close'))
    expect(await screen.findByText('Av')).toBeOnTheScreen()
  })
})

describe('kartvalet', () => {
  it('byter kartstil från cellen', async () => {
    await renderIdle()
    // Radetiketten och värdet heter båda Karta när standardkartan är vald
    const kartor = await screen.findAllByText('Karta')
    fireEvent.press(kartor[kartor.length - 1])
    expect(await screen.findByText('Välj karta')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Natt'))
    expect(screen.getAllByText('Natt').length).toBeGreaterThanOrEqual(1)
  })
})

describe('infosheets på guidade pass', () => {
  const SEGS: RunSegment[] = [
    { kind: 'warmup', distanceM: 1500, label: 'Uppvärmning' },
    { kind: 'work', distanceM: 1000, label: 'Intervall 1 av 2', paceSecLo: 280, paceSecHi: 300 },
    { kind: 'rest', durationS: 90, label: 'Vila' },
    { kind: 'work', distanceM: 1000, label: 'Intervall 2 av 2', paceSecLo: 280, paceSecHi: 300 },
    { kind: 'cooldown', distanceM: 1500, label: 'Nedvarvning' },
  ]

  it('Upplägg-cellen visar segmentlistan istället för målväljaren', async () => {
    await renderIdle({ name: 'interval', segments: JSON.stringify(SEGS) })
    fireEvent.press(screen.getByText('Upplägg'))
    expect(await screen.findByText('Passets upplägg')).toBeOnTheScreen()
    expect(screen.getAllByText('Uppvärmning').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Sätt mål')).toBeNull()
    fireEvent.press(screen.getByText('Jag är redo'))
  })

  it('Aktivitet-cellen visar instruktioner istället för väljaren', async () => {
    await renderIdle({ name: 'interval', segments: JSON.stringify(SEGS) })
    fireEvent.press(screen.getByText('Aktivitet'))
    expect(await screen.findByText(/hög fart med vila emellan/)).toBeOnTheScreen()
    expect(screen.queryByText('Välj aktivitet')).toBeNull()
    fireEvent.press(screen.getByText('Jag är redo'))
  })
})

// ─── Felvägar ────────────────────────────────────────────────────────────────

describe('felvägar', () => {
  it('nekad platsbehörighet ger tydligt besked', async () => {
    ;(Location.requestForegroundPermissionsAsync as jest.Mock)
      .mockResolvedValueOnce({ status: 'denied' })
    await renderIdle()
    expect(alertSpy).toHaveBeenCalledWith(
      'Platstjänster krävs', expect.any(String), expect.anything())
  })

  it('GPS-prenumeration som vägrar starta varnar men fäller inte passet', async () => {
    ;(Location.watchPositionAsync as jest.Mock)
      .mockRejectedValueOnce(new Error('nej'))
    await renderIdle()
    fireEvent.press(screen.getByText('Start'))
    await act(async () => { jest.advanceTimersByTime(3000) })
    expect(alertSpy).toHaveBeenCalledWith('GPS-problem', expect.any(String))
    // Klockan rullar ändå
    act(() => { jest.advanceTimersByTime(5000) })
    expect(screen.getAllByText('00:00:05').length).toBeGreaterThan(0)
  })

  it('misslyckad sparning behåller sammanfattningen så passet inte tappas', async () => {
    ;(saveCardioWorkout as jest.Mock).mockRejectedValueOnce(new Error('nätverk borta'))
    await startRun()
    run(60, 5)
    await finishToSummary()
    fireEvent.press(screen.getByText('Spara & avsluta'))
    await act(async () => {})

    expect(alertSpy).toHaveBeenCalledWith('Kunde inte spara passet', 'nätverk borta')
    expect(screen.getByText('Träning klar!')).toBeOnTheScreen()  // kvar — kan försöka igen
    expect(router.back).not.toHaveBeenCalled()

    // Andra försöket lyckas
    fireEvent.press(screen.getByText('Spara & avsluta'))
    await act(async () => {})
    expect(router.back).toHaveBeenCalled()
  })

  it('utloggad användare stoppas innan sparningen', async () => {
    const { supabase } = require('@/lib/supabase')
    ;(supabase.auth.getSession as jest.Mock)
      .mockResolvedValueOnce({ data: { session: null } })
    await startRun()
    run(30, 5)
    await finishToSummary()
    fireEvent.press(screen.getByText('Spara & avsluta'))
    await act(async () => {})
    expect(alertSpy).toHaveBeenCalledWith('Inte inloggad', expect.any(String))
    expect(saveCardioWorkout).not.toHaveBeenCalled()
  })

  it('schemalagt pass markeras som klart — och schemafel kastar inte bort passet', async () => {
    await startRun({ name: 'running', sessionId: 'sess-1', sessionDate: '2026-07-20' })
    run(30, 5)
    await finishToSummary()
    fireEvent.press(screen.getByText('Spara & avsluta'))
    await act(async () => {})
    expect(completeCardioSession).toHaveBeenCalledWith(
      'sess-1', 'u1', '2026-07-20', expect.any(Number), 30)
    expect(router.back).toHaveBeenCalled()

    // Nästa pass: schemamarkeringen fallerar → varna men gå vidare
    jest.clearAllMocks()
    ;(completeCardioSession as jest.Mock).mockRejectedValueOnce(new Error('RLS'))
    fireEvent.press(await screen.findByText('Start'))
    await act(async () => { jest.advanceTimersByTime(3000) })
    fix(0); run(30, 5)
    await finishToSummary()
    fireEvent.press(screen.getByText('Spara & avsluta'))
    await act(async () => {})
    expect(saveCardioWorkout).toHaveBeenCalled()
    expect(alertSpy).toHaveBeenCalledWith('Passet sparades', expect.stringContaining('RLS'))
    expect(router.back).toHaveBeenCalled()
  })

  it('Kasta träningen sparar ingenting', async () => {
    await startRun()
    run(30, 5)
    await finishToSummary()
    fireEvent.press(screen.getByText('Kasta träningen'))
    expect(saveCardioWorkout).not.toHaveBeenCalled()
    expect(router.back).toHaveBeenCalled()
  })
})

// ─── Övriga grenar ───────────────────────────────────────────────────────────

describe('avslut och mål', () => {
  it('påbörjad kilometer blir en egen splitrad vid sparning', async () => {
    await startRun()
    run(300, 5)                                     // 1,5 km på 5:00
    await finishToSummary()
    fireEvent.press(screen.getByText('Spara & avsluta'))
    await act(async () => {})
    const sent = (saveCardioWorkout as jest.Mock).mock.calls[0][0]
    expect(sent.splits).toEqual([
      { label: '1 km', paceSec: 200 },
      { label: '0,5 km', paceSec: 200 },
    ])
  })

  it('tidsmålet annonseras när minuterna är avklarade', async () => {
    const Speech = require('expo-speech')
    await startRun({ name: 'running', goalMin: '1' })
    run(61, 3)
    const all = (Speech.speak as jest.Mock).mock.calls.map((c: unknown[]) => c[0]).join(' | ')
    expect(all).toContain('Tidsmålet är uppnått')
  })
})
