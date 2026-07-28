import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { EN } from './i18n/en'

// =============================================================================
// SPRÅK — svenska är källspråket och nyckeln. t('Svensk text') slår upp den
// engelska översättningen när engelska är valt, annars returneras texten
// orörd. Saknas en översättning faller den tillbaka på svenskan, så ett
// hål i ordboken kan aldrig krascha eller tomma ut ett UI.
//
// I komponenter: const t = useT()  →  ritas om när språket byts.
// Utanför komponenter (services, alerts i callbacks): importera t direkt.
// Platshållare: t('Dag {n} av 75', { n: 42 })
// =============================================================================

export type AppLanguage = 'sv' | 'en'

const STORAGE_KEY = 'appLanguage'

let current: AppLanguage = 'sv'
const subs = new Set<() => void>()

export function getLanguage(): AppLanguage {
  return current
}

/** Läses vid appstart — prenumeranterna ritas om om ett sparat val fanns. */
export async function loadLanguage(): Promise<AppLanguage> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    if ((stored === 'sv' || stored === 'en') && stored !== current) {
      current = stored
      subs.forEach(fn => fn())
    }
  } catch { /* svenska som standard */ }
  return current
}

export function setLanguage(lang: AppLanguage): void {
  if (lang === current) return
  current = lang
  subs.forEach(fn => fn())
  AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {})
}

/** Översätter en svensk text. {plats}-hållare ersätts med vars. */
export function t(sv: string, vars?: Record<string, string | number>): string {
  let out = current === 'en' ? (EN[sv] ?? sv) : sv
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      out = out.split(`{${key}}`).join(String(value))
    }
  }
  return out
}

/** Hook-varianten av t — komponenten ritas om när språket byts. */
export function useT(): typeof t {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = () => force(x => x + 1)
    subs.add(fn)
    return () => { subs.delete(fn) }
  }, [])
  return t
}

/** Datumlokal för toLocaleDateString m.m. — följer valt språk. */
export function dateLocale(): string {
  return current === 'en' ? 'en-GB' : 'sv-SE'
}
