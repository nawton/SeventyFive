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
