import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, runOnJS,
} from 'react-native-reanimated'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

// =============================================================================
// LIQUID GLASS-KNAPP
// Äkta Apple-glas (iOS 26+) via expo-glass-effect med isInteractive —
// systemet sköter skimret/bucklan vid tryck. På äldre iOS: vår vanliga
// vita cirkelknapp. `draggable` = håll inne och dra: knappen följer
// fingret med fjädring och studsar tillbaka när man släpper.
// =============================================================================

const GLASS = isLiquidGlassAvailable()

const SPRING = { damping: 14, stiffness: 220, mass: 0.7 } as const

export function GlassCircleButton({
  icon, size = 44, iconColor, onPress, draggable = false, style,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  size?: number
  /** Default: vit på glas, svart på fallback-cirkeln */
  iconColor?: string
  onPress?: () => void
  /** Håll inne + dra → knappen följer fingret, släpp → fjädrar tillbaka */
  draggable?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const tx    = useSharedValue(0)
  const ty    = useSharedValue(0)
  const scale = useSharedValue(1)

  function grabHaptic()    { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) }
  function releaseHaptic() { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }
  function press()         { onPress?.() }

  const tap = Gesture.Tap()
    .maxDuration(300)
    .onEnd((_, ok) => { if (ok) runOnJS(press)() })

  const drag = Gesture.Pan()
    .activateAfterLongPress(200)
    .onStart(() => {
      scale.value = withSpring(1.18, SPRING)
      runOnJS(grabHaptic)()
    })
    .onUpdate(e => {
      tx.value = e.translationX
      ty.value = e.translationY
    })
    .onEnd(() => {
      tx.value    = withSpring(0, SPRING)
      ty.value    = withSpring(0, SPRING)
      scale.value = withSpring(1, SPRING)
      runOnJS(releaseHaptic)()
    })
    .onFinalize(() => {
      tx.value    = withSpring(0, SPRING)
      ty.value    = withSpring(0, SPRING)
      scale.value = withSpring(1, SPRING)
    })

  const gesture = draggable ? Gesture.Race(drag, tap) : tap

  const anim = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }))

  const circle = { width: size, height: size, borderRadius: size / 2 }

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[anim, style]}>
        {GLASS ? (
          <GlassView
            isInteractive
            glassEffectStyle="regular"
            style={[s.glass, circle]}
          >
            <Ionicons name={icon} size={size * 0.45} color={iconColor ?? '#fff'} />
          </GlassView>
        ) : (
          <View style={[s.fallback, circle]}>
            <Ionicons name={icon} size={size * 0.45} color={iconColor ?? '#000'} />
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  )
}

const s = StyleSheet.create({
  glass: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
})
