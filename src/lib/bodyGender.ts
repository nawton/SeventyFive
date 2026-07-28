import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

// =============================================================================
// KROPPSMODELL — vilken figur muskelvyerna ritar (muskelradarn, gymgrupperna,
// delmuskelfiltren, Skapa övning). Biblioteket har både man och kvinna med
// identiska muskel-slugs, så valet är rent visuellt och byts live.
// Samma mönster som språket i i18n.ts: modulvärde + prenumeranter.
// =============================================================================

export type BodyGender = 'male' | 'female'

const STORAGE_KEY = 'bodyGender'

let current: BodyGender = 'male'
const subs = new Set<() => void>()

export function getBodyGender(): BodyGender {
  return current
}

/** Läses vid appstart — prenumeranterna ritas om om ett sparat val fanns. */
export async function loadBodyGender(): Promise<BodyGender> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    if ((stored === 'male' || stored === 'female') && stored !== current) {
      current = stored
      subs.forEach(fn => fn())
    }
  } catch { /* man som standard */ }
  return current
}

export function setBodyGender(gender: BodyGender): void {
  if (gender === current) return
  current = gender
  subs.forEach(fn => fn())
  AsyncStorage.setItem(STORAGE_KEY, gender).catch(() => {})
}

/** Följ profilens kön som standard, men skriv aldrig över ett eget val
    (ett eget val i Allmänt ligger sparat, profilen sparas aldrig härifrån). */
export async function syncBodyGenderFromProfile(profileGender: string | null): Promise<void> {
  try {
    if (await AsyncStorage.getItem(STORAGE_KEY)) return
    const inferred: BodyGender | null =
      profileGender === 'Kvinna' ? 'female' : profileGender === 'Man' ? 'male' : null
    if (inferred && inferred !== current) {
      current = inferred
      subs.forEach(fn => fn())
    }
  } catch { /* behåll nuvarande */ }
}

/** Hook-varianten — komponenten ritas om när modellen byts. */
export function useBodyGender(): BodyGender {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = () => force(x => x + 1)
    subs.add(fn)
    return () => { subs.delete(fn) }
  }, [])
  return current
}
