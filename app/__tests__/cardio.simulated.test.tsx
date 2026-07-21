import { render, screen, fireEvent, act } from '@testing-library/react-native'
import CardioScreen from '../cardio'
import { useLocalSearchParams, router } from 'expo-router'
import * as Speech from 'expo-speech'
import { saveCardioWorkout } from '@/services/workouts'
import type { RunSegment } from '@/lib/runProgression'

// =============================================================================
// SIMULERAD LÖPRUNDA — kör GPS-vyns spårningsloop i jest med fejkade
// klocktick och GPS-fixar. Testar det som annars kräver asfalt: distans-
// ackumulering, kilometersplittar, autopausen och intervallguidningen live.
// Fysiken: varje simulerad sekund = ett klocktick + ett GPS-fix N meter norrut.
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
  watchPositionAsync: jest.fn(async (_opts: unknown, cb: typeof gpsCb) => {
    gpsCb = cb
    return { remove: jest.fn() }
  }),
  Accuracy: { High: 4, BestForNavigation: 6 },
}))
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }))
jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => {} }))
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(), notificationAsync: jest.fn(), selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}))

// ─── Simulatorn ──────────────────────────────────────────────────────────────

const DEG_PER_M = 1 / 111190   // en meter norrut i latitudgrader
let lat = 59.33

/** Startar skärmen och tar sig genom 3-2-1-nedräkningen till 'running'. */
async function startRun(params: Record<string, string>) {
  ;(useLocalSearchParams as jest.Mock).mockReturnValue(params)
  render(<CardioScreen />)
  fireEvent.press(await screen.findByText('Start'))
  await act(async () => { jest.advanceTimersByTime(3000) })
  expect(gpsCb).not.toBeNull()
  fix(0) // första fixen sätter bara startpositionen
}

/** Ett GPS-fix `meters` norr om senaste positionen. */
function fix(meters: number, accuracy = 5) {
  lat += meters * DEG_PER_M
  act(() => { gpsCb!({ coords: { latitude: lat, longitude: 18.07, accuracy } }) })
}

/** En klocksekund utan rörelse. */
function second(n = 1) {
  act(() => { jest.advanceTimersByTime(n * 1000) })
}

/** Spring: en sekund + `mps` meter per varv. */
function run(seconds: number, mps: number) {
  for (let i = 0; i < seconds; i++) { second(); fix(mps) }
}

/** Stå still: klockan tickar och GPS:en fortsätter fixa på samma plats. */
function standStill(seconds: number) {
  for (let i = 0; i < seconds; i++) { second(); fix(0) }
}

const spoken = () => (Speech.speak as jest.Mock).mock.calls.map(c => c[0] as string).join(' | ')

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  gpsCb = null
  lat = 59.33
})
afterEach(() => {
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
})

// ─── Fri runda ───────────────────────────────────────────────────────────────

describe('simulerad fri runda', () => {
  it('klockan tickar och kilometersplitten triggas med rätt tempo', async () => {
    await startRun({ name: 'running' })
    expect(spoken()).toContain('Löpning startad')

    run(100, 5)                                   // 100 s à 5 m/s = 500 m
    expect(screen.getAllByText('00:01:40').length).toBeGreaterThan(0)

    run(100, 5)                                   // totalt 1000 m på 200 s
    // Splittoasten: 1 km på 3:20
    expect(await screen.findByText('1 km  3:20 /km')).toBeOnTheScreen()
    expect(spoken()).toContain('Kilometer 1')
  })

  it('distansmålet annonseras när det nås — en gång', async () => {
    await startRun({ name: 'running', goalKm: '0.50' })
    expect(spoken()).toContain('Mål: 0,5 kilometer')
    run(100, 5)                                   // 500 m
    expect(spoken()).toContain('Distansmålet är uppnått')
    const count = (Speech.speak as jest.Mock).mock.calls
      .filter(c => (c[0] as string).includes('Distansmålet')).length
    run(20, 5)
    const after = (Speech.speak as jest.Mock).mock.calls
      .filter(c => (c[0] as string).includes('Distansmålet')).length
    expect(after).toBe(count)                     // inte en gång till
  })

  it('oprecisa GPS-fixar (>30 m) räknas inte in i distansen', async () => {
    await startRun({ name: 'running' })
    run(60, 5)                                    // 300 m med bra signal
    for (let i = 0; i < 40; i++) { second(); fix(5, 80) }  // 200 m skräpfixar — ska ignoreras

    fireEvent.press(screen.getByText('Pausa'))
    fireEvent.press(screen.getByText('Avsluta'))
    fireEvent.press(await screen.findByText('Hoppa över'))
    fireEvent.press(screen.getByText('Spara & avsluta'))
    await act(async () => {})

    const sent = (saveCardioWorkout as jest.Mock).mock.calls[0][0]
    expect(sent.distanceKm).toBeCloseTo(0.3, 2)   // bara de riktiga 300 metrarna
  })

  it('hela varvet: spara passet skickar rätt data till tjänsten', async () => {
    await startRun({ name: 'running' })
    run(200, 5)                                   // 1 km på 3:20

    fireEvent.press(screen.getByText('Pausa'))
    fireEvent.press(screen.getByText('Avsluta'))
    expect(await screen.findByText('Träning klar!')).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Hoppa över'))       // betygslagret
    fireEvent.press(screen.getByText('Spara & avsluta'))
    await act(async () => {})

    expect(saveCardioWorkout).toHaveBeenCalledTimes(1)
    const sent = (saveCardioWorkout as jest.Mock).mock.calls[0][0]
    expect(sent.userId).toBe('u1')
    expect(sent.type).toBe('running')
    expect(sent.distanceKm).toBeCloseTo(1.0, 2)
    expect(sent.durationSeconds).toBe(200)
    expect(sent.splits).toEqual([{ label: '1 km', paceSec: 200 }])
    expect(sent.intervals).toBeUndefined()                // fri runda — inga intervaller
    expect(router.back).toHaveBeenCalled()
  })
})

describe('väggklockstid — telefonen i fickan', () => {
  it('tappade timer-tick hinner ikapp: klockan visar verklig tid', async () => {
    await startRun({ name: 'running' })
    run(30, 5)                                    // 30 s normal löpning
    expect(screen.getAllByText('00:00:30').length).toBeGreaterThan(0)

    // Skärmen låses: JS-timers pausas i 60 s men väggklockan går vidare.
    // setSystemTime flyttar Date.now() utan att fyra av intervall-tick.
    act(() => { jest.setSystemTime(Date.now() + 60_000) })
    fix(50)                                       // GPS:en vaknar med ett hopp
    second()                                      // första ticken efter uppvaknandet
    // Tick-räkning hade visat 00:00:31 — väggklockan visar de verkliga ~91
    expect(screen.getAllByText('00:01:31').length).toBeGreaterThan(0)
  })

  it('manuell paus räknar inte väggtid', async () => {
    await startRun({ name: 'running' })
    run(20, 5)
    fireEvent.press(screen.getByText('Pausa'))
    act(() => { jest.setSystemTime(Date.now() + 120_000) })   // 2 min paus
    fireEvent.press(screen.getByText('Återuppta'))
    await act(async () => {})
    run(10, 5)
    expect(screen.getAllByText('00:00:30').length).toBeGreaterThan(0)
  })
})

// ─── Autopaus ────────────────────────────────────────────────────────────────

describe('simulerad autopaus', () => {
  it('5 s stillastående fryser klockan; rörelse släpper direkt', async () => {
    await startRun({ name: 'running' })
    run(30, 2)                                    // 60 m — förbi 20 m-spärren

    standStill(6)                                 // rödljus
    expect(screen.getAllByText('AUTOPAUS').length).toBeGreaterThan(0)
    expect(spoken()).toContain('Autopaus')

    const frozen = screen.getAllByText(/^00:00:/)[0].props.children as string
    standStill(10)                                // klockan ska stå still
    expect(screen.getAllByText(frozen).length).toBeGreaterThan(0)

    fix(5)                                        // springer igen
    expect(screen.queryByText('AUTOPAUS')).toBeNull()
    expect(spoken()).toContain('Återupptar')
  })

  it('triggar inte innan rundan kommit igång', async () => {
    await startRun({ name: 'running' })
    standStill(10)                                // står vid startlinjen
    expect(screen.queryByText('AUTOPAUS')).toBeNull()
  })

  it('triggar inte när GPS-signalen är borta', async () => {
    await startRun({ name: 'running' })
    run(30, 2)                                    // 60 m
    second(10)                                    // tunnel: inga fixar alls
    // Utan fixar blir signalen -1 efter 8 s — autopausen ska avstå
    expect(screen.queryByText('AUTOPAUS')).toBeNull()
  })
})

// ─── Guidat pass ─────────────────────────────────────────────────────────────

// Miniatyrpass med samma form som buildRunSegments ger — korta distanser
// så simuleringen är snabb men träffar varje övergångstyp
const SEGS: RunSegment[] = [
  { kind: 'warmup', distanceM: 100, label: 'Uppvärmning' },
  { kind: 'work', distanceM: 100, label: 'Intervall 1 av 2', paceSecLo: 280, paceSecHi: 300 },
  { kind: 'rest', durationS: 8, label: 'Vila' },
  { kind: 'work', distanceM: 100, label: 'Intervall 2 av 2', paceSecLo: 280, paceSecHi: 300 },
  { kind: 'cooldown', distanceM: 100, label: 'Nedvarvning' },
]

describe('simulerat guidat pass', () => {
  it('bannern följer segmenten och rösten guidar övergångarna', async () => {
    await startRun({ name: 'interval', segments: JSON.stringify(SEGS) })
    expect(spoken()).toContain('Uppvärmning')
    expect(screen.getAllByText('Uppvärmning').length).toBeGreaterThan(0)
    expect(screen.getAllByText('100 m kvar').length).toBeGreaterThan(0)

    run(10, 5)                                    // 50 m in i värmningen
    expect(screen.getAllByText('50 m kvar').length).toBeGreaterThan(0)

    run(10, 5)                                    // värmning klar
    expect(spoken()).toContain('Intervall 1 av 2')
    expect(screen.getAllByText('Intervall 1 av 2').length).toBeGreaterThan(0)

    run(20, 5)                                    // intervall 1 klar → vila
    expect(screen.getAllByText('Vila').length).toBeGreaterThan(0)
    expect(spoken()).toContain('Vila 8')

    standStill(8)                                 // vilan räknar ner på klockan
    expect(spoken()).toContain('redo')            // 10 s-varningen (fyras direkt: 8 ≤ 10)
    expect(screen.getAllByText('Intervall 2 av 2').length).toBeGreaterThan(0)

    run(20, 5)                                    // intervall 2 klar → nedvarvning
    expect(screen.getAllByText('Nedvarvning').length).toBeGreaterThan(0)
    run(20, 5)                                    // allt klart
    expect(screen.getAllByText('Passet klart').length).toBeGreaterThan(0)
    expect(spoken()).toContain('Passet är klart')
  })

  it('guidningen hörs även när huvudrösten är AV', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage')
    await AsyncStorage.setItem('cardioVoiceCues', 'off')   // km-rapporter tystade
    await startRun({ name: 'interval', segments: JSON.stringify(SEGS) })
    run(20, 5)                                    // värmning klar → intervall 1
    expect(spoken()).toContain('Intervall 1 av 2')
    await AsyncStorage.removeItem('cardioVoiceCues')
  })

  it('intervallguidningens egen toggle tystar bara guidningen', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage')
    await AsyncStorage.setItem('voiceSettings', JSON.stringify({
      distEvery: 1, timeEvery: 0,
      say: { time: true, distance: true, avgPace: true, curPace: false, splitPace: true, summary: true, intervals: false },
    }))
    await startRun({ name: 'interval', segments: JSON.stringify(SEGS) })
    run(20, 5)                                    // värmning klar — tyst övergång
    expect(spoken()).not.toContain('Intervall 1 av 2')
    expect(screen.getAllByText('Intervall 1 av 2').length).toBeGreaterThan(0) // bannern guidar ändå
    await AsyncStorage.removeItem('voiceSettings')
  })

  it('autopausen håller tassarna borta från vilans nedräkning', async () => {
    await startRun({ name: 'interval', segments: JSON.stringify(SEGS) })
    run(20, 5)                                    // värmning klar
    run(20, 5)                                    // intervall 1 klar → vila
    standStill(7)                                 // still i vilan — mer än 5 s
    // Tidssegment: klockan MÅSTE ticka vidare, ingen autopaus
    expect(screen.queryByText('AUTOPAUS')).toBeNull()
    expect(screen.getAllByText('Intervall 2 av 2').length).toBeGreaterThan(0) // vilan löpte ut
  })

  it('summeringen visar facit och sparar per-intervall-resultaten', async () => {
    await startRun({ name: 'interval', segments: JSON.stringify(SEGS) })
    run(20, 5); run(20, 5); standStill(8); run(20, 5); run(20, 5)

    fireEvent.press(screen.getByText('Pausa'))
    fireEvent.press(screen.getByText('Avsluta'))
    expect(await screen.findByText('Träning klar!')).toBeOnTheScreen()
    expect(screen.getByText('Alla 2 intervaller avklarade!')).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Hoppa över'))
    fireEvent.press(screen.getByText('Spara & avsluta'))
    await act(async () => {})

    const sent = (saveCardioWorkout as jest.Mock).mock.calls[0][0]
    expect(sent.intervalsPlanned).toBe(2)
    expect(sent.intervals).toHaveLength(2)
    expect(sent.intervals[0]).toMatchObject({ label: 'Intervall 1 av 2', distanceM: 100 })
    expect(sent.intervals[1]).toMatchObject({ label: 'Intervall 2 av 2', distanceM: 100 })
  })
})
