import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getVoiceCues, setVoiceCues,
  getVoiceSettings, setVoiceSettings, DEFAULT_VOICE_SETTINGS,
  getRestSeconds, setRestSeconds,
  getExerciseRestSeconds, setExerciseRestSeconds,
  getCardioGoal, setCardioGoal,
  getFiveKTime, setFiveKTime,
  getOrInitPassStart, getPassStart, clearPassStart,
  setPassDuration, getPassDuration,
  setPassEffort, getPassEffort,
  getDefaultMapStyle, setDefaultMapStyle,
  setPassDraft, getPassDraft, clearPassDraft,
  getLastMapCoord, setLastMapCoord,
  getRaceDate, setRaceDate,
  getBodyWeightKg, setBodyWeightKg,
  getNotifSeenAt, setNotifSeenAt,
} from '../prefs'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'))

beforeEach(async () => {
  await AsyncStorage.clear()
})

describe('röstguidning', () => {
  it('är på som standard och kommer ihåg av-läget', async () => {
    expect(await getVoiceCues()).toBe(true)
    await setVoiceCues(false)
    expect(await getVoiceCues()).toBe(false)
    await setVoiceCues(true)
    expect(await getVoiceCues()).toBe(true)
  })

  it('faller tillbaka på standard när lagringen strular', async () => {
    // OBS: implementationen måste läggas tillbaka efteråt — mockRestore på
    // en ren jest.fn lämnar den tom och sänker resten av sviten
    const original = AsyncStorage.getItem
    ;(AsyncStorage as { getItem: unknown }).getItem = jest.fn().mockRejectedValue(new Error('nere'))
    expect(await getVoiceCues()).toBe(true)
    expect(await getVoiceSettings()).toEqual(DEFAULT_VOICE_SETTINGS)
    ;(AsyncStorage as { getItem: unknown }).getItem = original
  })

  it('inställningarna sparas och trasig JSON ger standardvärden', async () => {
    await setVoiceSettings({ distEvery: 2, timeEvery: 5, say: { ...DEFAULT_VOICE_SETTINGS.say, curPace: true } })
    const v = await getVoiceSettings()
    expect(v.distEvery).toBe(2)
    expect(v.timeEvery).toBe(5)
    expect(v.say.curPace).toBe(true)

    await AsyncStorage.setItem('voiceSettings', 'inte json')
    expect(await getVoiceSettings()).toEqual(DEFAULT_VOICE_SETTINGS)
  })

  it('halvgamla sparade inställningar fylls ut med standard för nya fält', async () => {
    await AsyncStorage.setItem('voiceSettings', JSON.stringify({ distEvery: '3', say: { time: false } }))
    const v = await getVoiceSettings()
    expect(v.distEvery).toBe(3)
    expect(v.timeEvery).toBe(0)
    expect(v.say.time).toBe(false)
    expect(v.say.intervals).toBe(true)   // nytt fält får standardvärdet
  })
})

describe('vilotimers', () => {
  it('har vettiga standarder och sparar giltiga värden', async () => {
    expect(await getRestSeconds()).toBe(90)
    expect(await getExerciseRestSeconds()).toBe(180)
    await setRestSeconds(60)
    await setExerciseRestSeconds(120)
    expect(await getRestSeconds()).toBe(60)
    expect(await getExerciseRestSeconds()).toBe(120)
  })

  it('skräpvärden i lagringen ger standarden', async () => {
    await AsyncStorage.setItem('restTimerSeconds', 'abc')
    await AsyncStorage.setItem('restExerciseSeconds', '-5')
    expect(await getRestSeconds()).toBe(90)
    expect(await getExerciseRestSeconds()).toBe(180)
  })
})

describe('cardiomål och 5 km-tid', () => {
  it('mål sparas per passtyp', async () => {
    expect(await getCardioGoal('running')).toBeNull()
    await setCardioGoal('running', { km: 5, min: 30 })
    await setCardioGoal('cycling', { km: 20, min: 0 })
    expect(await getCardioGoal('running')).toEqual({ km: 5, min: 30 })
    expect(await getCardioGoal('cycling')).toEqual({ km: 20, min: 0 })
  })

  it('5 km-tiden kräver ett positivt tal', async () => {
    expect(await getFiveKTime()).toBeNull()
    await setFiveKTime(1500)
    expect(await getFiveKTime()).toBe(1500)
    await AsyncStorage.setItem('fiveKTimeSec', '0')
    expect(await getFiveKTime()).toBeNull()
  })
})

describe('passets tidtagning', () => {
  it('getOrInitPassStart sätter starttiden en gång och behåller den', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000)
    expect(await getPassStart('gym:2026-07-27')).toBeNull()
    const first = await getOrInitPassStart('gym:2026-07-27')
    expect(first).toBe(1700000000000)
    nowSpy.mockReturnValue(1700000099000)
    expect(await getOrInitPassStart('gym:2026-07-27')).toBe(1700000000000)
    expect(await getPassStart('gym:2026-07-27')).toBe(1700000000000)
    nowSpy.mockRestore()
  })

  it('clearPassStart nollställer och duration/effort validerar', async () => {
    await getOrInitPassStart('p1')
    await clearPassStart('p1')
    expect(await getPassStart('p1')).toBeNull()

    await setPassDuration('p1', 3600)
    expect(await getPassDuration('p1')).toBe(3600)
    expect(await getPassDuration('okänt')).toBeNull()

    await setPassEffort('p1', 7)
    expect(await getPassEffort('p1')).toBe(7)
    await AsyncStorage.setItem('passEffort:p1', '11')   // utanför RPE-skalan
    expect(await getPassEffort('p1')).toBeNull()
  })
})

describe('kartval och utkast', () => {
  it('kartstilen valideras mot de kända värdena', async () => {
    expect(await getDefaultMapStyle()).toBe('standard')
    await setDefaultMapStyle('dark')
    expect(await getDefaultMapStyle()).toBe('dark')
    await AsyncStorage.setItem('defaultMapStyle', 'neon')
    expect(await getDefaultMapStyle()).toBe('standard')
  })

  it('utkastet överlever rundresan och kan rensas', async () => {
    await setPassDraft('p1', { rows: [{ reps: '8', kg: '60' }] })
    expect(await getPassDraft('p1')).toEqual({ rows: [{ reps: '8', kg: '60' }] })
    await clearPassDraft('p1')
    expect(await getPassDraft('p1')).toBeNull()
  })

  it('kartpositionen kräver riktiga koordinater', async () => {
    expect(await getLastMapCoord()).toBeNull()
    await setLastMapCoord({ latitude: 59.33, longitude: 18.06 })
    expect(await getLastMapCoord()).toEqual({ latitude: 59.33, longitude: 18.06 })
    await AsyncStorage.setItem('lastMapCoord', JSON.stringify({ latitude: 'x' }))
    expect(await getLastMapCoord()).toBeNull()
  })
})

describe('tävlingsdatum, kroppsvikt och notismärke', () => {
  it('tävlingsdatumet valideras som YYYY-MM-DD och kan tas bort', async () => {
    await setRaceDate('2026-09-12')
    expect(await getRaceDate()).toBe('2026-09-12')
    await setRaceDate(null)
    expect(await getRaceDate()).toBeNull()
    await AsyncStorage.setItem('raceDate', '12/09/2026')
    expect(await getRaceDate()).toBeNull()
  })

  it('kroppsvikten avrundas och håller sig inom rimliga gränser', async () => {
    expect(await getBodyWeightKg()).toBe(75)
    await setBodyWeightKg(82.6)
    expect(await getBodyWeightKg()).toBe(83)
    await setBodyWeightKg(20)     // orimligt lågt, ignoreras
    expect(await getBodyWeightKg()).toBe(83)
    await setBodyWeightKg(NaN)
    expect(await getBodyWeightKg()).toBe(83)
  })

  it('notismärket sparar tidpunkten rakt av', async () => {
    expect(await getNotifSeenAt()).toBeNull()
    await setNotifSeenAt('2026-07-27T10:00:00Z')
    expect(await getNotifSeenAt()).toBe('2026-07-27T10:00:00Z')
  })
})
