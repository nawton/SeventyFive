import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { TEXT_SECONDARY, useThemeStrings } from '@/lib/theme'

// =============================================================================
// SEGMENTVÄLJAREN — helrund pill med solid accenttumme och vit text på
// den aktiva fliken, samma utseende i hela appen och i båda temalägena.
// Tap för att byta, eller dra: tummen följer fingret och fjädrar fast på
// närmaste läge när du släpper.
// =============================================================================

const SEG_SPRING = { damping: 17, stiffness: 240, mass: 0.8 } as const

export function GlassSegment<T extends string>({
  value, options, onChange,
}: {
  value: T
  options: Array<{ key: T; label: string }>
  onChange: (v: T) => void
  /** Kvar för bakåtkompatibilitet — tummen är alltid accentfärgad numera */
  tint?: string | null
}) {
  const T = useThemeStrings()
  const light = T.TEXT_PRIMARY !== '#FFFFFF'
  const onAccent = light ? '#FFFFFF' : '#000000'
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
    .withTestId('glassSegPan')
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .onStart(() => { runOnJS(beginDrag)() })
    .onUpdate(e => {
      if (slotW <= 0) return
      pos.value = Math.min(n - 1, Math.max(0, e.x / slotW - 0.5))
    })
    .onEnd((e, success) => {
      // Avbruten gest (t.ex. när en scroll tar över) ska inte byta flik —
      // onFinalize fjädrar då tillbaka tummen via abortDrag
      if (!success || slotW <= 0) return
      const i = Math.min(n - 1, Math.max(0, Math.round(e.x / slotW - 0.5)))
      pos.value = withSpring(i, SEG_SPRING)
      runOnJS(commitIdx)(i)
    })
    .onFinalize(() => { runOnJS(abortDrag)() })

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[s.segTrack, { backgroundColor: light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.09)' }]}
        testID="glassSegTrack"
        onLayout={e => setSegW(e.nativeEvent.layout.width - 8)}
      >
        {segW > 0 && (
          <Animated.View
            style={[s.segThumb, { backgroundColor: T.ACCENT, width: slotW }, thumbStyle]}
          />
        )}
        {options.map(o => (
          <TouchableOpacity key={o.key} style={s.segBtn} onPress={() => choose(o.key)} activeOpacity={0.8}>
            <Text style={[s.segText, value === o.key && { color: onAccent, fontWeight: '700' as const }]}>
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
    flexDirection: 'row', height: 48,
    borderRadius: 999, padding: 4,
  },
  segThumb: {
    position: 'absolute', left: 4, top: 4, bottom: 4,
    borderRadius: 999,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segText: { color: TEXT_SECONDARY, fontSize: 15, fontWeight: '600' },
})
