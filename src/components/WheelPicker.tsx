import { useRef } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedScrollHandler, useAnimatedStyle,
  interpolate, Extrapolation, runOnJS, type SharedValue,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { TEXT_PRIMARY, NUM_FONT } from '@/lib/theme'

// =============================================================================
// HJULVÄLJARE — iOS-pickerkänslan i ren JS (funkar i Expo Go): raderna skalar
// ner, tonas ut och tippar ju längre från mitten de är, med haptiskt tick vid
// varje snäpp. Används för födelsedatum, vikt och längd i profilinställningarna.
// =============================================================================

export const WHEEL_ITEM_H = 38
const VISIBLE = 5                       // udda antal — en rad i mitten
const WHEEL_H = WHEEL_ITEM_H * VISIBLE

function WheelRow({ label, index, scrollY }: { label: string; index: number; scrollY: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const dist = (scrollY.value - index * WHEEL_ITEM_H) / WHEEL_ITEM_H
    return {
      opacity: interpolate(Math.abs(dist), [0, 1, 2, 3], [1, 0.45, 0.22, 0.08], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(Math.abs(dist), [0, 2.5], [1, 0.78], Extrapolation.CLAMP) },
        { rotateX: `${interpolate(dist, [-2.5, 0, 2.5], [-38, 0, 38], Extrapolation.CLAMP)}deg` },
      ],
    }
  })
  return (
    <Animated.View style={[s.row, style]}>
      <Text style={s.rowText} numberOfLines={1}>{label}</Text>
    </Animated.View>
  )
}

export function WheelPicker({
  items,
  selectedIndex,
  onChange,
  width = 110,
}: {
  items: string[]
  selectedIndex: number
  onChange: (index: number) => void
  width?: number
}) {
  const scrollY = useSharedValue(selectedIndex * WHEEL_ITEM_H)
  const lastIdx = useRef(selectedIndex)

  function tick(idx: number) {
    if (idx !== lastIdx.current && idx >= 0 && idx < items.length) {
      lastIdx.current = idx
      Haptics.selectionAsync()
      onChange(idx)
    }
  }

  const onScroll = useAnimatedScrollHandler({
    onScroll: e => {
      scrollY.value = e.contentOffset.y
      runOnJS(tick)(Math.round(e.contentOffset.y / WHEEL_ITEM_H))
    },
  })

  return (
    <View style={[s.wheel, { width }]}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_H}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentOffset={{ x: 0, y: selectedIndex * WHEEL_ITEM_H }}
        contentContainerStyle={{ paddingVertical: (WHEEL_H - WHEEL_ITEM_H) / 2 }}
      >
        {items.map((label, i) => (
          <WheelRow key={i} label={label} index={i} scrollY={scrollY} />
        ))}
      </Animated.ScrollView>
      {/* Markering av mittraden */}
      <View pointerEvents="none" style={s.highlight} />
    </View>
  )
}

const s = StyleSheet.create({
  wheel: { height: WHEEL_H },
  row: { height: WHEEL_ITEM_H, alignItems: 'center', justifyContent: 'center' },
  rowText: { color: TEXT_PRIMARY, fontSize: 20, fontFamily: NUM_FONT, fontVariant: ['tabular-nums'] },
  highlight: {
    position: 'absolute', left: 0, right: 0,
    top: (WHEEL_H - WHEEL_ITEM_H) / 2, height: WHEEL_ITEM_H,
    borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)',
  },
})
