import AsyncStorage from '@react-native-async-storage/async-storage'

// =============================================================================
// KONDITIONSINSTÄLLNINGAR
// Små visningsval som sparas lokalt på enheten.
// =============================================================================

export type CardioStatsTheme = 'dark' | 'light'

const THEME_KEY = 'cardioStatsTheme'

export async function getCardioStatsTheme(): Promise<CardioStatsTheme> {
  try {
    const v = await AsyncStorage.getItem(THEME_KEY)
    return v === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export async function setCardioStatsTheme(theme: CardioStatsTheme): Promise<void> {
  await AsyncStorage.setItem(THEME_KEY, theme).catch(() => {})
}

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
