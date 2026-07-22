import { DynamicColorIOS, Platform, type ColorValue } from 'react-native'

// =============================================================================
// Tema: mörkt är appens standard (exakt samma värden som alltid), ljust är
// Runkeeper-inspirerat — text direkt på ljus botten, vita ytor och tunna
// linjer istället för markerade block. Färgerna är iOS-dynamiska: hela appen
// byter live när Appearance.setColorScheme växlas (se src/lib/themeMode.ts),
// utan att skärmarnas statiska StyleSheets behöver byggas om.
// =============================================================================

/** Råa strängvärden — för de få ställen som kräver riktiga strängar
    (reanimated interpolateColor, gradienter). Övriga använder konstanterna. */
export const THEME_DARK = {
  BG: '#0A0A0C',
  CARD: '#1C1C1E',
  BORDER: '#2C2C2E',
  TEXT_PRIMARY: '#FFFFFF',
  TEXT_SECONDARY: '#888888',
  DIVIDER: 'rgba(255,255,255,0.10)',
} as const

export const THEME_LIGHT = {
  BG: '#F5F5F7',
  CARD: '#FFFFFF',
  BORDER: '#E5E5EA',
  TEXT_PRIMARY: '#111214',
  TEXT_SECONDARY: '#75777D',
  DIVIDER: 'rgba(0,0,0,0.08)',
} as const

const dyn = (dark: string, light: string): ColorValue =>
  Platform.OS === 'ios' ? DynamicColorIOS({ dark, light }) : dark

// Accenter är samma i båda lägena — de alfa-konkateneras (ORANGE + '1A')
// och måste därför förbli vanliga strängar
export const ORANGE = '#FFA817'
export const GREEN  = '#3BE862'
export const RED    = '#FF3B4A'

export const BG             = dyn(THEME_DARK.BG, THEME_LIGHT.BG)
export const CARD           = dyn(THEME_DARK.CARD, THEME_LIGHT.CARD)
export const BORDER         = dyn(THEME_DARK.BORDER, THEME_LIGHT.BORDER)
export const TEXT_PRIMARY   = dyn(THEME_DARK.TEXT_PRIMARY, THEME_LIGHT.TEXT_PRIMARY)
export const TEXT_SECONDARY = dyn(THEME_DARK.TEXT_SECONDARY, THEME_LIGHT.TEXT_SECONDARY)
/** Tunna radavdelare — vit-genomskinlig i mörkt, svart-genomskinlig i ljust */
export const DIVIDER        = dyn(THEME_DARK.DIVIDER, THEME_LIGHT.DIVIDER)
/** Inaktiv tabbikon i glaspillen */
export const TAB_INACTIVE   = dyn('rgba(255,255,255,0.55)', 'rgba(60,60,67,0.55)')
/** Dragbubblan i tabbpillen */
export const GLASS_KNOB     = dyn('rgba(255,255,255,0.14)', 'rgba(0,0,0,0.07)')
/** Tabbpillens täckande fallback när liquid glass saknas */
export const BAR_FALLBACK   = dyn('rgba(22,22,24,0.96)', 'rgba(248,248,250,0.97)')
/** Nästan täckande bakgrundsslöja (GPS-överlägg m.m.) */
export const BG_OVERLAY     = dyn('rgba(10,10,12,0.95)', 'rgba(245,245,247,0.95)')

// Rundad sifferfont (SF Rounded-känsla) — laddas i app/_layout.tsx
export const NUM_FONT      = 'Nunito_700Bold'
export const NUM_FONT_SEMI = 'Nunito_600SemiBold'

/** Cardions accentfärg — GPS-skärmen, schemakorten och detaljvyerna delar den */
export const CARDIO_BLUE = '#3FA7FF'
/** Turkos-mint — premiumytornas accent (Runna-inspirerad) */
export const MINT = '#4ED9C4'
