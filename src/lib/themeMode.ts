import { Appearance } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

// =============================================================================
// Ljust/mörkt läge. Mörkt är standard oavsett systeminställning — appen är
// designad mörk och ljust läge är ett aktivt val. Växlingen sker via
// Appearance.setColorScheme som får alla DynamicColorIOS-färger i theme.ts
// att lösas om direkt, i hela appen.
// =============================================================================

export type ThemeMode = 'dark' | 'light'

const KEY = 'themeMode'

export async function getThemeMode(): Promise<ThemeMode> {
  try {
    const v = await AsyncStorage.getItem(KEY)
    return v === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function setThemeMode(mode: ThemeMode): void {
  Appearance.setColorScheme(mode)
  AsyncStorage.setItem(KEY, mode).catch(() => {})
}

/** Körs vid appstart: mörkt direkt (ingen ljus blink för systemljusa
    användare), sedan ev. sparat ljust val */
export function applyStoredTheme(): void {
  Appearance.setColorScheme('dark')
  getThemeMode().then(mode => {
    if (mode !== 'dark') Appearance.setColorScheme(mode)
  })
}
