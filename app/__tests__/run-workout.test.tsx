import { render, screen, fireEvent } from '@testing-library/react-native'
import RunWorkoutScreen from '../run-workout'
import { router, useLocalSearchParams } from 'expo-router'
import type { RunSegment } from '@/lib/runProgression'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}))

const INT_NOTES   = 'Start 5×1000 m · +1 per vecka · max 8×1000 m · ca 4:55 /km'
const LONG_NOTES  = 'Start 10 km · +2 km per vecka · max 30 km · ca 6:00–6:30 /km'
const PLAIN_NOTES = '30–45 min i lugnt tempo · ca 6:00–6:30 /km'

function renderWith(params: Record<string, string>) {
  ;(useLocalSearchParams as jest.Mock).mockReturnValue(params)
  return render(<RunWorkoutScreen />)
}

function lastReplaceParams(): Record<string, string> {
  const calls = (router.replace as jest.Mock).mock.calls
  return calls[calls.length - 1][0].params
}

beforeEach(() => jest.clearAllMocks())

describe('run-workout — intervallpass', () => {
  const params = { name: 'Intervaller', cardioType: 'interval', notes: INT_NOTES, week: '0', date: '2026-07-20' }

  it('visar veckans mål, upplägget och infon', () => {
    renderWith(params)
    expect(screen.getByText('Vecka 1')).toBeOnTheScreen()
    expect(screen.getByText('5×1000 m')).toBeOnTheScreen()
    expect(screen.getByText('VÄRM UPP')).toBeOnTheScreen()
    expect(screen.getByText('PASS')).toBeOnTheScreen()
    expect(screen.getByText('VARVA NER')).toBeOnTheScreen()
    expect(screen.getByText('5×1000 m i hög fart')).toBeOnTheScreen()
    expect(screen.getAllByText('1,5 km lugn jogg')).toHaveLength(2)
    expect(screen.getByText(/höjer maxfart och flås/)).toBeOnTheScreen()
    expect(screen.getByText('≈ 45 min')).toBeOnTheScreen()
    expect(screen.getByText('4:55 /km')).toBeOnTheScreen()
  })

  it('progressionen syns: vecka 2 ger 6×1000 m', () => {
    renderWith({ ...params, week: '1' })
    expect(screen.getByText('Vecka 2')).toBeOnTheScreen()
    expect(screen.getByText('6×1000 m')).toBeOnTheScreen()
  })

  it('start skickar segmentupplägget — inte ett km-mål', () => {
    renderWith(params)
    fireEvent.press(screen.getByText('Starta passet'))
    const sent = lastReplaceParams()
    expect(sent.name).toBe('interval')
    expect(sent.goalKm).toBeUndefined()
    expect(sent.goalMin).toBeUndefined()
    const segs = JSON.parse(sent.segments) as RunSegment[]
    expect(segs).toHaveLength(11)  // värmning + 5×(arbete+vila) − sista vilan + nedvarvning
    expect(segs[0].kind).toBe('warmup')
    expect(segs[1]).toMatchObject({ kind: 'work', distanceM: 1000, label: 'Intervall 1 av 5' })
    expect(segs[segs.length - 1].kind).toBe('cooldown')
  })

  it('sessionId följer med till GPS-vyn när passet är schemalagt', () => {
    renderWith({ ...params, sessionId: 'abc-123' })
    fireEvent.press(screen.getByText('Starta passet'))
    const sent = lastReplaceParams()
    expect(sent.sessionId).toBe('abc-123')
    expect(sent.sessionDate).toBe('2026-07-20')
  })
})

describe('run-workout — långpass och återhämtning', () => {
  it('långpass: distansmål förifylls istället för guidning', () => {
    renderWith({ name: 'Långpass', cardioType: 'running', notes: LONG_NOTES, week: '0' })
    expect(screen.getByText('10 km')).toBeOnTheScreen()
    expect(screen.getByText('10 km i lugn, pratvänlig fart')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Starta passet'))
    const sent = lastReplaceParams()
    expect(sent.segments).toBeUndefined()
    expect(sent.goalKm).toBe('10.00')
  })

  it('cutback-veckan visar lugnare vecka-chipet och lägre mål', () => {
    renderWith({ name: 'Långpass', cardioType: 'running', notes: LONG_NOTES, week: '3' })
    expect(screen.getByText('Vecka 4')).toBeOnTheScreen()
    expect(screen.getByText('12 km')).toBeOnTheScreen()    // 0,75 × 16
    expect(screen.getByText('Lugnare vecka')).toBeOnTheScreen()
  })

  it('återhämtning: tidsmål från minutspannet', () => {
    renderWith({ name: 'Återhämtning', cardioType: 'running', notes: PLAIN_NOTES, week: '0' })
    expect(screen.getByText('30–45 min')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Starta passet'))
    const sent = lastReplaceParams()
    expect(sent.segments).toBeUndefined()
    expect(sent.goalKm).toBeUndefined()
    expect(sent.goalMin).toBe('45')
  })

  it('utan notes: renderar och startar en fri runda utan mål', () => {
    renderWith({ name: 'Löppass', cardioType: 'running' })
    fireEvent.press(screen.getByText('Starta passet'))
    const sent = lastReplaceParams()
    expect(sent.segments).toBeUndefined()
    expect(sent.goalKm).toBeUndefined()
    expect(sent.goalMin).toBeUndefined()
  })
})

describe('run-workout — enheter', () => {
  it('miles-läget konverterar mål, upplägg och tempo', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage')
    await AsyncStorage.setItem('unitSystem', 'imperial')
    renderWith({ name: 'Långpass', cardioType: 'running', notes: LONG_NOTES, week: '0' })
    expect(await screen.findByText('6,2 mi')).toBeOnTheScreen()
    expect(screen.getByText('6,2 mi i lugn, pratvänlig fart')).toBeOnTheScreen()
    expect(screen.getByText('9:39–10:28 /mi')).toBeOnTheScreen()
    await AsyncStorage.setItem('unitSystem', 'metric')
  })
})
