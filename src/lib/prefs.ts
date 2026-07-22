import AsyncStorage from '@react-native-async-storage/async-storage'

// =============================================================================
// KONDITIONSINSTÄLLNINGAR
// Små visningsval som sparas lokalt på enheten.
// =============================================================================

// Röstguidning under passet (talade kilometersplittar, mål m.m.) — på som standard
const VOICE_KEY = 'cardioVoiceCues'

export async function getVoiceCues(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(VOICE_KEY)) !== 'off'
  } catch {
    return true
  }
}

export async function setVoiceCues(on: boolean): Promise<void> {
  await AsyncStorage.setItem(VOICE_KEY, on ? 'on' : 'off').catch(() => {})
}

// Röstguidningens fulla inställningar — hur ofta och vilken statistik som
// läses upp. På/av-flaggan bor kvar i voiceCues så Anpassning är i synk.
export interface VoiceSettings {
  /** Läs upp var N:e kilometer — 0 = av */
  distEvery: number
  /** Läs upp var N:e minut — 0 = av */
  timeEvery: number
  say: {
    time: boolean
    distance: boolean
    avgPace: boolean
    curPace: boolean
    splitPace: boolean
    summary: boolean
    /** Intervallguidningens röst (segmentbyten, vila) — oberoende av
        huvudtogglen: man kan slippa km-rapporter men ändå höra guidningen */
    intervals: boolean
  }
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  distEvery: 1,
  timeEvery: 0,
  say: { time: true, distance: true, avgPace: true, curPace: false, splitPace: true, summary: true, intervals: true },
}

export async function getVoiceSettings(): Promise<VoiceSettings> {
  try {
    const raw = await AsyncStorage.getItem('voiceSettings')
    if (!raw) return DEFAULT_VOICE_SETTINGS
    const v = JSON.parse(raw)
    return {
      distEvery: Number(v.distEvery) || 0,
      timeEvery: Number(v.timeEvery) || 0,
      say: { ...DEFAULT_VOICE_SETTINGS.say, ...(v.say ?? {}) },
    }
  } catch {
    return DEFAULT_VOICE_SETTINGS
  }
}

export async function setVoiceSettings(v: VoiceSettings): Promise<void> {
  await AsyncStorage.setItem('voiceSettings', JSON.stringify(v)).catch(() => {})
}

// Vilotimerns senast valda längd (sekunder) — förvalet i övningsloggen
const REST_KEY = 'restTimerSeconds'

export async function getRestSeconds(): Promise<number> {
  try {
    const v = parseInt((await AsyncStorage.getItem(REST_KEY)) ?? '', 10)
    return Number.isFinite(v) && v > 0 ? v : 90
  } catch {
    return 90
  }
}

export async function setRestSeconds(secs: number): Promise<void> {
  await AsyncStorage.setItem(REST_KEY, String(secs)).catch(() => {})
}

// Vilotid mellan ÖVNINGAR — startar när sista setet i en övning bockas av
const EXREST_KEY = 'restExerciseSeconds'

export async function getExerciseRestSeconds(): Promise<number> {
  try {
    const v = parseInt((await AsyncStorage.getItem(EXREST_KEY)) ?? '', 10)
    return Number.isFinite(v) && v > 0 ? v : 180
  } catch {
    return 180
  }
}

export async function setExerciseRestSeconds(secs: number): Promise<void> {
  await AsyncStorage.setItem(EXREST_KEY, String(secs)).catch(() => {})
}

// Senast satta cardiomål per passtyp — förifylls nästa gång
export async function getCardioGoal(type: string): Promise<{ km: number; min: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(`cardioGoal:${type}`)
    if (!raw) return null
    const v = JSON.parse(raw)
    return { km: Number(v.km) || 0, min: Number(v.min) || 0 }
  } catch {
    return null
  }
}

export async function setCardioGoal(type: string, goal: { km: number; min: number }): Promise<void> {
  await AsyncStorage.setItem(`cardioGoal:${type}`, JSON.stringify(goal)).catch(() => {})
}

// Senaste 5 km-testtiden (sekunder) — sätts i schemaguiden och kan uppdateras
// under Anpassning; driver löpplanens tempoförslag
export async function getFiveKTime(): Promise<number | null> {
  try {
    const v = Number(await AsyncStorage.getItem('fiveKTimeSec'))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

export async function setFiveKTime(sec: number): Promise<void> {
  await AsyncStorage.setItem('fiveKTimeSec', String(sec)).catch(() => {})
}

// Passets starttid (per pass + dag) — så Tid-räknaren överlever att vyn stängs
export async function getOrInitPassStart(id: string): Promise<number> {
  const key = `passStart:${id}`
  try {
    const v = parseInt((await AsyncStorage.getItem(key)) ?? '', 10)
    if (Number.isFinite(v) && v > 0) return v
  } catch {}
  const now = Date.now()
  AsyncStorage.setItem(key, String(now)).catch(() => {})
  return now
}

/** Läser starttiden utan att sätta den — null om passet inte startats */
export async function getPassStart(id: string): Promise<number | null> {
  try {
    const v = parseInt((await AsyncStorage.getItem(`passStart:${id}`)) ?? '', 10)
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

export async function clearPassStart(id: string): Promise<void> {
  await AsyncStorage.removeItem(`passStart:${id}`).catch(() => {})
}

// Passets sluttid — visas statiskt när passet är avklarat
export async function setPassDuration(id: string, secs: number): Promise<void> {
  await AsyncStorage.setItem(`passDur:${id}`, String(secs)).catch(() => {})
}

export async function getPassDuration(id: string): Promise<number | null> {
  try {
    const v = parseInt((await AsyncStorage.getItem(`passDur:${id}`)) ?? '', 10)
    return Number.isFinite(v) && v >= 0 ? v : null
  } catch {
    return null
  }
}

// Upplevd ansträngning (RPE 1–10) för ett avklarat gympass — id = `${sessionId}:${date}`
export async function setPassEffort(id: string, effort: number): Promise<void> {
  await AsyncStorage.setItem(`passEffort:${id}`, String(effort)).catch(() => {})
}

export async function getPassEffort(id: string): Promise<number | null> {
  try {
    const v = parseInt((await AsyncStorage.getItem(`passEffort:${id}`)) ?? '', 10)
    return Number.isFinite(v) && v >= 1 && v <= 10 ? v : null
  } catch {
    return null
  }
}

// Standardkarta för GPS-skärmen och passdetaljen — väljs under Anpassning
export type MapStyleKey = 'standard' | 'satellite' | 'terrain' | 'dark'

export async function getDefaultMapStyle(): Promise<MapStyleKey> {
  try {
    const v = await AsyncStorage.getItem('defaultMapStyle')
    return (v === 'standard' || v === 'satellite' || v === 'terrain' || v === 'dark') ? v : 'satellite'
  } catch {
    return 'satellite'
  }
}

export async function setDefaultMapStyle(v: MapStyleKey): Promise<void> {
  await AsyncStorage.setItem('defaultMapStyle', v).catch(() => {})
}

// Utkast av passets set-logg (reps/kg per rad) — sparas medan man skriver så
// inget försvinner om appen stängs mitt i passet; rensas när passet slutförs
export async function setPassDraft(id: string, draft: unknown): Promise<void> {
  await AsyncStorage.setItem(`passDraft:${id}`, JSON.stringify(draft)).catch(() => {})
}

export async function getPassDraft<T>(id: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`passDraft:${id}`)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export async function clearPassDraft(id: string): Promise<void> {
  await AsyncStorage.removeItem(`passDraft:${id}`).catch(() => {})
}

// Senast kända kartposition — så GPS-skärmen öppnar inzoomad direkt i stället
// för att visa hela Sverige medan första fixen hämtas
export async function getLastMapCoord(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const raw = await AsyncStorage.getItem('lastMapCoord')
    if (!raw) return null
    const v = JSON.parse(raw)
    return Number.isFinite(v.latitude) && Number.isFinite(v.longitude) ? v : null
  } catch {
    return null
  }
}

export async function setLastMapCoord(c: { latitude: number; longitude: number }): Promise<void> {
  await AsyncStorage.setItem('lastMapCoord', JSON.stringify(c)).catch(() => {})
}

// Tävlingsdatum (YYYY-MM-DD) — löpplanens ankare. Sätts i schemaguiden och
// styr planens slut, nedtrappningen sista veckorna och RACE DAY i kalendern.
export async function getRaceDate(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem('raceDate')
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
  } catch {
    return null
  }
}

export async function setRaceDate(date: string | null): Promise<void> {
  if (date) await AsyncStorage.setItem('raceDate', date).catch(() => {})
  else await AsyncStorage.removeItem('raceDate').catch(() => {})
}

// Kroppsvikt (kg) — bara för kaloriberäkningen i cardio. Sätts i
// cardio-inställningarna; 75 kg tills användaren angett något.
export async function getBodyWeightKg(): Promise<number> {
  try {
    const v = Number(await AsyncStorage.getItem('bodyWeightKg'))
    return Number.isFinite(v) && v >= 30 && v <= 250 ? v : 75
  } catch {
    return 75
  }
}

export async function setBodyWeightKg(kg: number): Promise<void> {
  if (!Number.isFinite(kg) || kg < 30 || kg > 250) return
  await AsyncStorage.setItem('bodyWeightKg', String(Math.round(kg))).catch(() => {})
}

/** När notiscentret senast öppnades — badgen räknar bara nyare händelser */
export async function getNotifSeenAt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem('notifSeenAt')
  } catch {
    return null
  }
}

export async function setNotifSeenAt(iso: string): Promise<void> {
  await AsyncStorage.setItem('notifSeenAt', iso).catch(() => {})
}
