import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

// =============================================================================
// Ruttfärgen på kartorna (livespårning, detaljvy, flödeskort, diskussion).
// Blå som standard; byts under Anpassning → Cardio. Enkel prenumeration så
// alla monterade kartor byter direkt när valet ändras.
// =============================================================================

export const ROUTE_COLORS = [
  { key: 'blue',   label: 'Blå',    hex: '#3FA7FF' },
  { key: 'orange', label: 'Orange', hex: '#FC4C02' },
  { key: 'red',    label: 'Röd',    hex: '#FF3B4A' },
  { key: 'green',  label: 'Grön',   hex: '#2EBF6B' },
  { key: 'purple', label: 'Lila',   hex: '#B45CFF' },
] as const

export type RouteColorKey = typeof ROUTE_COLORS[number]['key']

const KEY = 'routeColor'
const DEFAULT_HEX = ROUTE_COLORS[0].hex

let current: string = DEFAULT_HEX
let loaded = false
const subs = new Set<(hex: string) => void>()

function hexFor(key: string | null): string {
  return ROUTE_COLORS.find(c => c.key === key)?.hex ?? DEFAULT_HEX
}

export async function getRouteColorKey(): Promise<RouteColorKey> {
  try {
    const v = await AsyncStorage.getItem(KEY)
    return (ROUTE_COLORS.some(c => c.key === v) ? v : 'blue') as RouteColorKey
  } catch {
    return 'blue'
  }
}

export function setRouteColorKey(key: RouteColorKey): void {
  current = hexFor(key)
  loaded = true
  subs.forEach(f => f(current))
  AsyncStorage.setItem(KEY, key).catch(() => {})
}

/** Aktuell ruttfärg som hex — uppdateras live när valet ändras */
export function useRouteColor(): string {
  const [hex, setHex] = useState<string>(current)
  useEffect(() => {
    if (!loaded) {
      getRouteColorKey().then(k => {
        current = hexFor(k)
        loaded = true
        setHex(current)
      })
    }
    const f = (v: string) => setHex(v)
    subs.add(f)
    return () => { subs.delete(f) }
  }, [])
  return hex
}
