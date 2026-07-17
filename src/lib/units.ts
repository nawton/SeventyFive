import AsyncStorage from '@react-native-async-storage/async-storage'

// =============================================================================
// ENHETER
// All lagring sker alltid i km — enheten styr bara visning och inmatning.
// =============================================================================

export type UnitSystem = 'metric' | 'imperial'

const KEY = 'unitSystem'
export const KM_PER_MILE = 1.60934

export async function getUnitSystem(): Promise<UnitSystem> {
  try {
    const v = await AsyncStorage.getItem(KEY)
    return v === 'imperial' ? 'imperial' : 'metric'
  } catch {
    return 'metric'
  }
}

export async function setUnitSystem(unit: UnitSystem): Promise<void> {
  await AsyncStorage.setItem(KEY, unit).catch(() => {})
}

/** km → visningsvärde i vald enhet */
export function toDisplayDistance(km: number, unit: UnitSystem): number {
  return unit === 'imperial' ? km / KM_PER_MILE : km
}

/** visningsvärde i vald enhet → km */
export function fromDisplayDistance(value: number, unit: UnitSystem): number {
  return unit === 'imperial' ? value * KM_PER_MILE : value
}

export function distanceUnitLabel(unit: UnitSystem): string {
  return unit === 'imperial' ? 'mi' : 'km'
}

/** sek/km → sek per vald enhet (för tempo) */
export function paceForUnit(secsPerKm: number, unit: UnitSystem): number {
  return unit === 'imperial' ? secsPerKm * KM_PER_MILE : secsPerKm
}
