import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActionSheetIOS, Platform } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { ORANGE, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import type { StrengthWorkout } from '@/services/workouts'

const GREEN        = '#4CAF50'
const SCREEN_W     = Dimensions.get('window').width
const SNAP_OPEN    = 82
const FULL_THRESHOLD = Math.round(SCREEN_W * 0.54)
const BTN_H        = 52
const BTN_MIN_W    = BTN_H
const BTN_MAX_W    = 170
const BTN_R_PAD    = 12
const SP           = { damping: 22, stiffness: 180, mass: 1 } as const

export function LoggedWorkoutRow({
  workout,
  onRemove,
  onEdit,
}: {
  workout:  StrengthWorkout
  onRemove: () => void
  onEdit:   () => void
}) {
  const tx       = useSharedValue(0)
  const isOpen   = useSharedValue(0)
  const overFull = useSharedValue(0)
  const maxH     = useSharedValue(200)
  const opac     = useSharedValue(1)
  const marg     = useSharedValue(8)

  function doRemove() {
    maxH.value = withTiming(0, { duration: 260 })
    opac.value = withTiming(0, { duration: 180 })
    marg.value = withTiming(0, { duration: 260 }, () => runOnJS(onRemove)())
  }

  function haptSnap() { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) }
  function haptFull() { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy) }

  function showOptions() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title:                workout.name,
          options:              ['Avbryt', 'Ändra övning', 'Ta bort övning'],
          destructiveButtonIndex: 2,
          cancelButtonIndex:    0,
        },
        i => {
          if (i === 1) onEdit()
          if (i === 2) setTimeout(doRemove, 60)
        },
      )
    }
  }

  const panGesture = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onUpdate(e => {
      tx.value = Math.min(0, e.translationX + (isOpen.value ? -SNAP_OPEN : 0))
      const nowOver = Math.abs(tx.value) >= FULL_THRESHOLD ? 1 : 0
      if (nowOver !== overFull.value) {
        overFull.value = nowOver
        if (nowOver === 1) runOnJS(haptFull)()
      }
    })
    .onEnd(() => {
      const absX = Math.abs(tx.value)
      if (absX >= FULL_THRESHOLD * 0.88) {
        runOnJS(doRemove)()
        tx.value     = withSpring(0, SP)
        isOpen.value = 0
      } else if (tx.value > -(SNAP_OPEN * 0.45)) {
        tx.value     = withSpring(0, SP)
        isOpen.value = 0
      } else {
        if (isOpen.value === 0) runOnJS(haptSnap)()
        tx.value     = withSpring(-SNAP_OPEN, SP)
        isOpen.value = 1
      }
      overFull.value = 0
    })

  const gesture = Gesture.Race(
    panGesture,
    Gesture.LongPress().minDuration(370).onStart(() => runOnJS(showOptions)()),
  )

  const wrapStyle = useAnimatedStyle(() => ({
    maxHeight:    maxH.value,
    opacity:      opac.value,
    marginBottom: marg.value,
    overflow:     'hidden' as const,
  }))

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }))

  const btnStyle = useAnimatedStyle(() => {
    const dist = Math.abs(tx.value)
    const w = dist <= SNAP_OPEN
      ? interpolate(dist, [0, SNAP_OPEN], [0, BTN_MIN_W], 'clamp')
      : interpolate(dist, [SNAP_OPEN, FULL_THRESHOLD], [BTN_MIN_W, BTN_MAX_W], 'clamp')
    return {
      width:        w,
      height:       BTN_H,
      borderRadius: BTN_H / 2,
      overflow:     'hidden' as const,
      opacity:      interpolate(dist, [0, SNAP_OPEN * 0.25], [0, 1], 'clamp'),
      backgroundColor: ORANGE,
    }
  })

  const labelWrapStyle = useAnimatedStyle(() => ({
    width: interpolate(
      Math.abs(tx.value),
      [SNAP_OPEN + 14, SNAP_OPEN + 60],
      [0, 68],
      'clamp',
    ),
    opacity: interpolate(
      Math.abs(tx.value),
      [SNAP_OPEN + 14, SNAP_OPEN + 56],
      [0, 1],
      'clamp',
    ),
    overflow: 'hidden' as const,
  }))

  const totalReps = workout.data.sets.reduce((s, r) => s + r.reps, 0)

  return (
    <Animated.View style={wrapStyle}>
      <View style={r.container}>

        {/* Action button behind card */}
        <View style={r.btnArea}>
          <TouchableOpacity onPress={doRemove} activeOpacity={0.9}>
            <Animated.View style={[r.btn, btnStyle]}>
              <Ionicons name="arrow-undo" size={18} color="#fff" />
              <Animated.View style={labelWrapStyle}>
                <Text style={r.btnLabel}>Ångra</Text>
              </Animated.View>
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Main card */}
        <GestureDetector gesture={gesture}>
          <Animated.View style={[r.row, cardStyle]}>
            <View style={r.bar} />
            <TouchableOpacity style={r.text} onPress={onEdit} activeOpacity={0.65}>
              <Text style={r.name}>{workout.name}</Text>
              <Text style={r.meta}>
                {workout.data.sets.length} set{totalReps > 0 ? ` · ${totalReps} reps` : ''}
              </Text>
            </TouchableOpacity>
            <View style={r.ringWrap}>
              <View style={r.ring}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            </View>
          </Animated.View>
        </GestureDetector>

      </View>
    </Animated.View>
  )
}

const r = StyleSheet.create({
  container: { overflow: 'hidden' },
  btnArea: {
    position:       'absolute',
    right:          BTN_R_PAD,
    top:            0,
    bottom:         0,
    justifyContent: 'center',
    alignItems:     'flex-end',
  },
  btn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
  },
  btnLabel: {
    color:      '#fff',
    fontSize:   14,
    fontWeight: '700',
    marginLeft: 4,
  },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     GREEN + '45',
    backgroundColor: '#0B2418',
    overflow:        'hidden',
    minHeight:       62,
  },
  bar:      { width: 3, alignSelf: 'stretch', backgroundColor: GREEN },
  text:     { flex: 1, paddingVertical: 13, paddingHorizontal: 14 },
  name:     { color: TEXT_SECONDARY, fontSize: 15, fontWeight: '600', textDecorationLine: 'line-through' },
  meta:     { color: TEXT_SECONDARY, fontSize: 12, marginTop: 3 },
  ringWrap: { paddingRight: 14, paddingLeft: 4 },
  ring: {
    width:           34,
    height:          34,
    borderRadius:    17,
    borderWidth:     2,
    borderColor:     GREEN,
    backgroundColor: GREEN,
    alignItems:      'center',
    justifyContent:  'center',
  },
})
