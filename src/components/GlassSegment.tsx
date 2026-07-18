import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { GlassView } from 'expo-glass-effect'
import { LIQUID_GLASS } from '@/lib/glass'
import { ORANGE, TEXT_SECONDARY } from '@/lib/theme'

// =============================================================================
// GLASSLIDER — segmenterad kontroll med orange glastumme (fallback: solid).
// Tap för att byta, eller dra: tummen följer fingret och fjädrar fast på
// närmaste läge när du släpper. Används i Anpassning och på rekordsidan.
// =============================================================================

const SEG_SPRING = { damping: 17, stiffness: 240, mass: 0.8 } as const

// Glaset måste animeras direkt på den nativa vyn för att linsen ska följa med
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView)

export function GlassSegment<T extends string>({
  value, options, onChange,
}: {
  value: T
  options: Array<{ key: T; label: string }>
  onChange: (v: T) => void
}) {
  const n = options.length
  const [segW, setSegW] = useState(0)
  const slotW = segW / n
  const idx = Math.max(0, options.findIndex(o => o.key === value))
  const pos = useSharedValue(idx)
  const dragging = useRef(false)

  useEffect(() => {
    if (!dragging.current) pos.value = withSpring(idx, SEG_SPRING)
  }, [idx, slotW])

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value * slotW }],
  }))

  function choose(k: T) {
    if (k === value) return
    Haptics.selectionAsync()
    onChange(k)
  }

  function beginDrag() { dragging.current = true }

  function commitIdx(i: number) {
    dragging.current = false
    const opt = options[i]
    if (opt && opt.key !== value) {
      Haptics.selectionAsync()
      onChange(opt.key)
    }
  }

  function abortDrag() {
    if (!dragging.current) return
    dragging.current = false
    pos.value = withSpring(idx, SEG_SPRING)
  }

  // Tummen följer fingret fritt under drag och snäpper vid släpp
  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .onStart(() => { runOnJS(beginDrag)() })
    .onUpdate(e => {
      if (slotW <= 0) return
      pos.value = Math.min(n - 1, Math.max(0, e.x / slotW - 0.5))
    })
    .onEnd(e => {
      if (slotW <= 0) return
      const i = Math.min(n - 1, Math.max(0, Math.round(e.x / slotW - 0.5)))
      pos.value = withSpring(i, SEG_SPRING)
      runOnJS(commitIdx)(i)
    })
    .onFinalize(() => { runOnJS(abortDrag)() })

  return (
    <GestureDetector gesture={pan}>
      <View style={s.segTrack} onLayout={e => setSegW(e.nativeEvent.layout.width - 6)}>
        {segW > 0 && (LIQUID_GLASS ? (
          <AnimatedGlassView
            glassEffectStyle="regular"
            tintColor={ORANGE}
            style={[s.segThumb, s.segThumbGlass, { width: slotW }, thumbStyle]}
          />
        ) : (
          <Animated.View style={[s.segThumb, { width: slotW }, thumbStyle]} />
        ))}
        {options.map(o => (
          <TouchableOpacity key={o.key} style={s.segBtn} onPress={() => choose(o.key)} activeOpacity={0.8}>
            <Text style={[
              s.segText,
              value === o.key && (LIQUID_GLASS ? s.segTextActiveGlass : s.segTextActive),
            ]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </GestureDetector>
  )
}

const s = StyleSheet.create({
  segTrack: {
    flexDirection: 'row', height: 44,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 3,
  },
  segThumb: {
    position: 'absolute', left: 3, top: 3, bottom: 3,
    borderRadius: 11, backgroundColor: ORANGE,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  segThumbGlass: { backgroundColor: 'transparent', overflow: 'hidden', shadowOpacity: 0 },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segText: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600' },
  segTextActive: { color: '#000', fontWeight: '700' },
  segTextActiveGlass: { color: '#fff', fontWeight: '700' },
})
