import { useCallback, useRef } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { makeMutable, withTiming } from 'react-native-reanimated'

// =============================================================================
// Tabbarens minimering: 0 = full storlek, 1 = förminskad.
// Flikskärmarnas scroll skriver hit; GlassTabBar i (app)/_layout läser.
// =============================================================================

export const tabBarShrink = makeMutable(0)

/** Koppla på en scrollvy: scroll ner → pillen krymper, scroll upp/toppen → full storlek */
export function useTabBarShrinkOnScroll() {
  const lastY = useRef(0)
  return useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
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
