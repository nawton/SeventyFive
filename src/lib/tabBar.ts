import { useCallback, useRef } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { makeMutable, withTiming } from 'react-native-reanimated'
import AsyncStorage from '@react-native-async-storage/async-storage'

// =============================================================================
// Tabbarens minimering: 0 = full storlek, 1 = förminskad.
// Flikskärmarnas scroll skriver hit; GlassTabBar i (app)/_layout läser.
// Kan slås av/på under Inställningar → Anpassning (avstängd som standard).
// =============================================================================

export const tabBarShrink = makeMutable(0)

const KEY = 'tabBarShrinkEnabled'
let enabled = false
AsyncStorage.getItem(KEY).then(v => { enabled = v === '1' }).catch(() => {})

export async function getTabBarShrinkEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1'
  } catch {
    return false
  }
}

export function setTabBarShrinkEnabled(v: boolean): void {
  enabled = v
  if (!v) tabBarShrink.value = withTiming(0, { duration: 200 })
  AsyncStorage.setItem(KEY, v ? '1' : '0').catch(() => {})
}

/** Koppla på en scrollvy: scroll ner → pillen krymper, scroll upp/toppen → full storlek */
export function useTabBarShrinkOnScroll() {
  const lastY = useRef(0)
  return useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!enabled) return
    const y  = e.nativeEvent.contentOffset.y
    const dy = y - lastY.current
    lastY.current = y
    if (y <= 24) {
      tabBarShrink.value = withTiming(0, { duration: 240 })
      return
    }
    if (dy > 4)       tabBarShrink.value = withTiming(1, { duration: 240 })
    else if (dy < -4) tabBarShrink.value = withTiming(0, { duration: 240 })
  }, [])
}
