import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, runOnJS,
} from 'react-native-reanimated'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

// =============================================================================
// LIQUID GLASS-KNAPPAR
// Äkta Apple-glas (iOS 26+) via expo-glass-effect — systemet sköter
// skimret/bucklan vid tryck (isInteractive). På äldre iOS renderas
// `fallbackStyle` (default: vit cirkel). `draggable` = håll inne och dra:
// knappen följer fingret med fjädring och studsar tillbaka vid släpp.
// =============================================================================

const GLASS = isLiquidGlassAvailable()

const SPRING = { damping: 14, stiffness: 220, mass: 0.7 } as const

// Transformen måste ligga direkt på glasvyn — ligger den på en förälder
// följer bara innehållet (ikonen) med medan själva glaslinsen står kvar
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView)

function useGlassGesture(onPress?: () => void, draggable = false) {
  const tx    = useSharedValue(0)
  const ty    = useSharedValue(0)
  const scale = useSharedValue(1)

  function grabHaptic()    { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) }
  function releaseHaptic() { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }
  function press()         { onPress?.() }

  const tap = Gesture.Tap()
    .maxDuration(300)
    .onBegin(() => { scale.value = withSpring(0.96, SPRING) })
    .onEnd((_, ok) => { if (ok) runOnJS(press)() })
    .onFinalize(() => { scale.value = withSpring(1, SPRING) })

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
    .onEnd(() => { runOnJS(releaseHaptic)() })
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

  return { gesture, anim }
}

export function GlassCircleButton({
  icon, size = 44, iconColor, onPress, draggable = false, style, fallbackStyle, children,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name']
  size?: number
  /** Default: vit på glas, svart på fallback-cirkeln */
  iconColor?: string
  onPress?: () => void
  /** Håll inne + dra → knappen följer fingret, släpp → fjädrar tillbaka */
  draggable?: boolean
  style?: StyleProp<ViewStyle>
  /** Ersätter den vita standardcirkeln på iOS utan liquid glass */
  fallbackStyle?: StyleProp<ViewStyle>
  /** Eget innehåll istället för ikon (t.ex. kompassnålen) */
  children?: React.ReactNode
}) {
  const { gesture, anim } = useGlassGesture(onPress, draggable)
  const circle = { width: size, height: size, borderRadius: size / 2 }
  const content = children ?? (icon ? (
    <Ionicons name={icon} size={size * 0.45} color={iconColor ?? (GLASS ? '#fff' : '#000')} />
  ) : null)

  return (
    <GestureDetector gesture={gesture}>
      {GLASS ? (
        <AnimatedGlassView
          isInteractive={!draggable}
          glassEffectStyle="regular"
          colorScheme="dark"
          style={[s.center, circle, anim, style]}
        >
          {content}
        </AnimatedGlassView>
      ) : (
        <Animated.View style={[s.center, fallbackStyle ?? s.fallbackCircle, circle, anim, style]}>
          {content}
        </Animated.View>
      )}
    </GestureDetector>
  )
}

/** Glaspill med valfritt innehåll — t.ex. "Visa statistik"-kapseln över kartan */
export function GlassPill({
  children, onPress, draggable = false, style, fallbackStyle, tint,
}: {
  children: React.ReactNode
  onPress?: () => void
  draggable?: boolean
  /** Layout (padding, radie, riktning) — används i båda lägena */
  style?: StyleProp<ViewStyle>
  /** Bakgrund/skugga på iOS utan liquid glass */
  fallbackStyle?: StyleProp<ViewStyle>
  /** Färgton i glaset (t.ex. ORANGE för primärknappar) */
  tint?: string
}) {
  const { gesture, anim } = useGlassGesture(onPress, draggable)
  // Glaset ligger som bakgrundslager i en vanlig vy — då är HELA pillen
  // träffyta (den nativa glasvyn släpper annars bara igenom tryck på barnen)
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[s.pill, !GLASS && (fallbackStyle ?? s.fallbackPill), style, anim]}>
        {GLASS && (
          <GlassView
            glassEffectStyle="regular"
          colorScheme="dark"
            tintColor={tint}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}
        {children}
      </Animated.View>
    </GestureDetector>
  )
}

const s = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  fallbackCircle: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fallbackPill: {
    backgroundColor: 'rgba(20,20,22,0.94)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
})
