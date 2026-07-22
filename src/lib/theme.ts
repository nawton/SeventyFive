import { DynamicColorIOS, Platform, useColorScheme, type ColorValue } from 'react-native'

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
  ACCENT: '#FFA817',
} as const

export const THEME_LIGHT = {
  BG: '#F5F5F7',
  CARD: '#FFFFFF',
  BORDER: '#E5E5EA',
  TEXT_PRIMARY: '#111214',
  TEXT_SECONDARY: '#75777D',
  DIVIDER: 'rgba(0,0,0,0.08)',
  ACCENT: '#3156C4',
} as const

/** Temats råa strängfärger för AKTUELLT läge. Reanimated (Animated.View
    m.fl.) kraschar på dynamiska färgobjekt — animerade element måste få
    sina färger härifrån som inline-stil istället för från konstanterna. */
export function useThemeStrings() {
  return useColorScheme() === 'light' ? THEME_LIGHT : THEME_DARK
}

/** Kortens "chrome": 1px-ram i mörkt läge (designspråket), mjuk skugga i
    ljust. Som STRÄNGAR per schema — iOS fryser dynamiska färger i
    border/skugga (CGColor) när fönstertraits växlar (t.ex. efter modaler),
    så dynamiska konstanter är opålitliga just där. OBS: overflow 'hidden'
    på samma vy dödar skuggan — lägg chromet på en yttre wrapper då. */
export function useCardChrome() {
  const light = useColorScheme() === 'light'
  return light
    ? {
        shadowColor: '#101425', shadowOpacity: 0.07, shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 }, elevation: 2,
      } as const
    : { borderWidth: 1, borderColor: THEME_DARK.BORDER } as const
}

const dyn = (dark: string, light: string): ColorValue =>
  Platform.OS === 'ios' ? DynamicColorIOS({ dark, light }) : dark

// ORANGE är appens mörka accent som RÅ STRÄNG — behåller namnet för de få
// ställen som måste ha strängar (reanimated, gradienter). UI:t ska använda
// ACCENT: orange i mörkt läge, Runkeeper-blå i ljust.
export const ORANGE = '#FFA817'
export const GREEN  = '#3BE862'
export const RED    = '#FF3B4A'

/** Accentfärgen: orange i mörkt, marinblå i ljust läge */
export const ACCENT = Platform.OS === 'ios'
  ? DynamicColorIOS({ dark: THEME_DARK.ACCENT, light: THEME_LIGHT.ACCENT })
  : THEME_DARK.ACCENT

const ACCENT_DARK_RGB  = '255,168,23'   // #FFA817
const ACCENT_LIGHT_RGB = '49,86,196'    // #3156C4

/** Accent med alfa (ersätter ORANGE + '1A'-konkateneringarna — dynamiska
    färgobjekt går inte att strängkonkatenera) */
export function accentAlpha(hexAlpha: string): ColorValue {
  const a = Math.round((parseInt(hexAlpha, 16) / 255) * 1000) / 1000
  return Platform.OS === 'ios'
    ? DynamicColorIOS({
        dark: `rgba(${ACCENT_DARK_RGB},${a})`,
        light: `rgba(${ACCENT_LIGHT_RGB},${a})`,
      })
    : `rgba(${ACCENT_DARK_RGB},${a})`
}

export const BG             = dyn(THEME_DARK.BG, THEME_LIGHT.BG)
export const CARD           = dyn(THEME_DARK.CARD, THEME_LIGHT.CARD)
export const BORDER         = dyn(THEME_DARK.BORDER, THEME_LIGHT.BORDER)
export const TEXT_PRIMARY   = dyn(THEME_DARK.TEXT_PRIMARY, THEME_LIGHT.TEXT_PRIMARY)
export const TEXT_SECONDARY = dyn(THEME_DARK.TEXT_SECONDARY, THEME_LIGHT.TEXT_SECONDARY)
/** Tunna radavdelare — vit-genomskinlig i mörkt, svart-genomskinlig i ljust */
export const DIVIDER        = dyn(THEME_DARK.DIVIDER, THEME_LIGHT.DIVIDER)
/** Kortens YTTERRAM: syns i mörkt läge, försvinner helt i ljust — där ska
    block inte ha ram runt om, bara avdelare under raderna (Runkeeper) */
export const CARD_BORDER    = dyn(THEME_DARK.BORDER, 'transparent')
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
