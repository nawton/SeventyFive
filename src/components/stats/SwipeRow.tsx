import { View, Text, TouchableOpacity, Alert } from 'react-native'
import { Ionicons } from '@/components/Icon'
import * as Haptics from 'expo-haptics'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue, useAnimatedStyle, interpolate, runOnJS, Extrapolation,
  withTiming, withSpring,
} from 'react-native-reanimated'
import { s, SWIPE_SNAP_OPEN, SWIPE_FULL, SWIPE_BTN_H, SWIPE_BTN_MAX_W, SWIPE_SP } from './statsShared'

// Svep vänster på en rad: kort svep fäller ut soptunnan, drar man hela
// vägen utlöses samma bekräftelse — samma tvåstegssystem som schemasidan.
export function SwipeRow({ children, name, onDelete, pagerRef }: {
  children: React.ReactNode
  /** Passnamnet — används i bekräftelserutan */
  name: string
  onDelete: () => void
  /** Flik-pagern måste vänta på radsvepet — annars byter man sida i stället */
  pagerRef?: React.RefObject<unknown>
}) {
  const tx       = useSharedValue(0)
  const startTx  = useSharedValue(0)
  const isOpen   = useSharedValue(0)
  const overFull = useSharedValue(0)

  function haptSnap() { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}) }
  function haptFull() { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}) }

  function requestDelete() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    Alert.alert('Vill du verkligen ta bort?', `"${name}" tas bort permanent. Det går inte att ångra.`, [
      {
        text: 'Avbryt', style: 'cancel',
        onPress: () => { tx.value = withSpring(0, SWIPE_SP); isOpen.value = 0 },
      },
      { text: 'Ta bort', style: 'destructive', onPress: onDelete },
    ])
  }

  let pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onBegin(() => { startTx.value = tx.value })
    .onUpdate(e => {
      const raw = startTx.value + e.translationX
      if (raw >= 0) { tx.value = 0; return }
      // Motstånd bortom full-tröskeln
      tx.value = raw < -SWIPE_FULL
        ? -SWIPE_FULL - (Math.abs(raw) - SWIPE_FULL) * 0.18
        : raw
      const nowOver = Math.abs(tx.value) >= SWIPE_FULL ? 1 : 0
      if (nowOver !== overFull.value) {
        overFull.value = nowOver
        if (nowOver === 1) runOnJS(haptFull)()
      }
    })
    .onEnd(() => {
      const absX = Math.abs(tx.value)
      if (absX >= SWIPE_FULL * 0.88) {
        // Full svep → samma bekräftelse som knappen, raden stannar öppen
        tx.value = withSpring(-SWIPE_SNAP_OPEN, SWIPE_SP)
        isOpen.value = 1
        runOnJS(requestDelete)()
      } else if (tx.value > -(SWIPE_SNAP_OPEN * 0.45)) {
        tx.value = withSpring(0, SWIPE_SP)
        isOpen.value = 0
      } else {
        if (isOpen.value === 0) runOnJS(haptSnap)()
        tx.value = withSpring(-SWIPE_SNAP_OPEN, SWIPE_SP)
        isOpen.value = 1
      }
      overFull.value = 0
    })
  if (pagerRef) pan = pan.blocksExternalGesture(pagerRef as never)

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }))

  // Cirkel → pill: bredden växer med draget, höjden är låst
  const btnStyle = useAnimatedStyle(() => {
    const dist = Math.abs(tx.value)
    const w = dist <= SWIPE_SNAP_OPEN
      ? interpolate(dist, [0, SWIPE_SNAP_OPEN], [0, SWIPE_BTN_H], Extrapolation.CLAMP)
      : interpolate(dist, [SWIPE_SNAP_OPEN, SWIPE_FULL], [SWIPE_BTN_H, SWIPE_BTN_MAX_W], Extrapolation.CLAMP)
    return {
      width: w,
      opacity: interpolate(dist, [0, SWIPE_SNAP_OPEN * 0.25], [0, 1], Extrapolation.CLAMP),
    }
  })

  const labelWrapStyle = useAnimatedStyle(() => ({
    width: interpolate(Math.abs(tx.value), [SWIPE_SNAP_OPEN + 14, SWIPE_SNAP_OPEN + 60], [0, 78], Extrapolation.CLAMP),
    opacity: interpolate(Math.abs(tx.value), [SWIPE_SNAP_OPEN + 14, SWIPE_SNAP_OPEN + 56], [0, 1], Extrapolation.CLAMP),
    overflow: 'hidden' as const,
  }))

  return (
    <View style={{ overflow: 'hidden' }}>
      <View style={s.swipeBtnArea}>
        <TouchableOpacity onPress={requestDelete} activeOpacity={0.78}>
          <Animated.View style={[s.swipeBtn, btnStyle]}>
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Animated.View style={labelWrapStyle}>
              <Text style={s.swipeBtnLabel} numberOfLines={1}>Ta bort</Text>
            </Animated.View>
          </Animated.View>
        </TouchableOpacity>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  )
}

