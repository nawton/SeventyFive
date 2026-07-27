import { generateScheduleFromWizard } from '../scheduleGenerator'
import { createWorkoutSession } from '../workoutSchedule'
import { setFiveKTime, setRaceDate } from '@/lib/prefs'
import { supabase } from '@/lib/supabase'
import { installTables } from '@/testUtils/supabaseChain'
import type { WizardResult } from '@/components/ScheduleWizard'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('@/lib/prefs', () => ({
  setFiveKTime: jest.fn().mockResolvedValue(undefined),
  setRaceDate: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('../workoutSchedule', () => ({
  createWorkoutSession: jest.fn().mockResolvedValue({ id: 's' }),
}))

const createMock = createWorkoutSession as jest.Mock

const WIZARD: WizardResult = {
  goal: 'strength' as WizardResult['goal'],
  runDistance: '5k' as WizardResult['runDistance'],
  musclePlan: 'balanced' as WizardResult['musclePlan'],
  focusGroups: [],
  weekdays: [1, 3, 5],
  limitations: [],
  runExperience: null,
  fiveKTimeSec: null,
  raceDate: null,
}

/** Namn + veckodag för varje skapat pass, i anropsordning */
const createdSessions = () =>
  createMock.mock.calls.map(c => ({ name: c[1] as string, weekdays: c[2] as number[] }))

beforeEach(() => {
  jest.clearAllMocks()
  createMock.mockResolvedValue({ id: 's' })
  installTables(supabase.from as jest.Mock, { workout_sessions: { error: null } })
})

describe('styrkeplanen', () => {
  it('tre dagar ger klassisk tredelad split på de valda dagarna', async () => {
    const count = await generateScheduleFromWizard('u1', WIZARD)
    expect(count).toBe(3)
    expect(createdSessions()).toEqual([
      { name: 'Bröst & Triceps', weekdays: [1] },
      { name: 'Rygg & Biceps', weekdays: [3] },
      { name: 'Ben & Mage', weekdays: [5] },
    ])
    // Styrkepass skapas som gym utan cardiotyp
    expect(createMock.mock.calls[0][5]).toBe('gym')
    expect(setFiveKTime).not.toHaveBeenCalled()
    expect(setRaceDate).not.toHaveBeenCalled()
  })

  it('en dag ger helkropp, sju dagar täcker varje muskelgrupp', async () => {
    await generateScheduleFromWizard('u1', { ...WIZARD, weekdays: [4] })
    expect(createdSessions()).toEqual([{ name: 'Helkropp', weekdays: [4] }])

    createMock.mockClear()
    await generateScheduleFromWizard('u1', { ...WIZARD, weekdays: [1, 2, 3, 4, 5, 6, 7] })
    expect(createdSessions().map(s => s.name)).toEqual([
      'Bröst', 'Rygg', 'Ben', 'Axlar', 'Armar', 'Mage', 'Helkropp',
    ])
  })

  it('utan valda dagar faller planen tillbaka på mån/ons/fre', async () => {
    await generateScheduleFromWizard('u1', { ...WIZARD, weekdays: [] })
    expect(createdSessions().map(s => s.weekdays)).toEqual([[1], [3], [5]])
  })

  it('fokusgruppen sorteras först när splitten redan täcker den', async () => {
    // Tvådagarssplitten: Underkropp & Mage täcker core → ingen ersättning,
    // men fokusdagen ska ligga först i veckan
    await generateScheduleFromWizard('u1', {
      ...WIZARD,
      weekdays: [2, 6],
      musclePlan: 'focus' as WizardResult['musclePlan'],
      focusGroups: ['core'],
    })
    expect(createdSessions().map(s => s.name)).toEqual(['Underkropp & Mage', 'Överkropp'])
  })

  it('otäckt fokusgrupp byter ut en dag och hamnar först', async () => {
    // Tredagarssplitten saknar axlar → sista icke-fokusdagen ersätts med Axlar
    await generateScheduleFromWizard('u1', {
      ...WIZARD,
      musclePlan: 'focus' as WizardResult['musclePlan'],
      focusGroups: ['shoulders'],
    })
    const names = createdSessions().map(s => s.name)
    expect(names[0]).toBe('Axlar')
    expect(names).toHaveLength(3)
  })

  it('knäbesvär byter ut belastande övningar och städar dubbletter', async () => {
    await generateScheduleFromWizard('u1', {
      ...WIZARD,
      weekdays: [1],
      limitations: ['knee'] as WizardResult['limitations'],
    })
    const exercises = (createMock.mock.calls[0][3] as Array<{ exercise_name: string }>)
      .map(e => e.exercise_name)
    expect(exercises).not.toContain('Knäböj')
    expect(exercises).not.toContain('Utfall')
    // Inga dubbletter även om två byten landar på samma övning
    expect(new Set(exercises).size).toBe(exercises.length)
  })

  it('ett enskilt misslyckat pass fäller inte resten men rapporteras', async () => {
    createMock
      .mockResolvedValueOnce({ id: 's1' })
      .mockRejectedValueOnce(new Error('databasen sa nej'))
      .mockResolvedValueOnce({ id: 's3' })
    await expect(generateScheduleFromWizard('u1', WIZARD))
      .rejects.toThrow(/1 av 3 pass.*Rygg & Biceps: databasen sa nej/s)
    // Alla tre försöken gjordes trots felet i mitten
    expect(createMock).toHaveBeenCalledTimes(3)
  })
})

describe('löpplanens kringtjänster', () => {
  const RUN: WizardResult = {
    ...WIZARD,
    goal: 'running' as WizardResult['goal'],
    runExperience: 'beginner' as WizardResult['runExperience'],
    fiveKTimeSec: 1500,
    raceDate: '2026-10-03',
  }

  it('sparar testtiden och tävlingsdatumet, städar gamla tävlingsdagar och skapar RACE DAY', async () => {
    await generateScheduleFromWizard('u1', RUN)
    expect(setFiveKTime).toHaveBeenCalledWith(1500)
    expect(setRaceDate).toHaveBeenCalledWith('2026-10-03')
    // Tävlingsdagen skapas som ett cardio-engångspass
    const raceCall = createMock.mock.calls.find(c => String(c[1]).startsWith('ONCE:2026-10-03:Tävlingsdag'))
    expect(raceCall).toBeTruthy()
    expect(raceCall![5]).toBe('cardio')
  })

  it('utan lopp rensas gammalt tävlingsdatum och ingen RACE DAY skapas', async () => {
    await generateScheduleFromWizard('u1', { ...RUN, fiveKTimeSec: null, raceDate: null })
    expect(setFiveKTime).not.toHaveBeenCalled()
    expect(setRaceDate).toHaveBeenCalledWith(null)
    expect(createMock.mock.calls.some(c => String(c[1]).includes('Tävlingsdag'))).toBe(false)
  })

  it('en misslyckad tävlingsdag fäller inte schemat', async () => {
    createMock.mockImplementation(async (_u: string, name: string) => {
      if (String(name).includes('Tävlingsdag')) throw new Error('nej')
      return { id: 's' }
    })
    await expect(generateScheduleFromWizard('u1', RUN)).resolves.toBe(3)
  })
})
