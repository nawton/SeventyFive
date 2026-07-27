import { useEffect } from 'react'
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@/components/Icon'
import { TEXT_SECONDARY, useThemeStrings } from '@/lib/theme'

// =============================================================================
// SCHEMAINTRO — slide-up som visas på träningssidan så länge schema saknas.
// Dra ner eller tryck utanför stänger bara för stunden — skylten kommer
// tillbaka nästa besök. Enda permanenta vägen bort är "Nej tack, visa inte
// igen"-knappen (wizarden nås alltid via inställningarna).
// =============================================================================

const SPRING = { damping: 20, stiffness: 220, mass: 0.8 } as const
const SLIDE = 440

export function ScheduleIntroSheet({ visible, onCreate, onClose, onNeverShow }: {
  visible: boolean
  /** Öppna schemaguiden */
  onCreate: () => void
  /** Dra ner eller tryck utanför — stängd för stunden, tillbaka nästa besök */
  onClose: () => void
  /** "Nej tack, visa inte igen" — tystad för alltid */
  onNeverShow: () => void
}) {
  const T = useThemeStrings()
  const insets = useSafeAreaInsets()
  const light = T.TEXT_PRIMARY !== '#FFFFFF'

  const ty = useSharedValue(SLIDE)
  useEffect(() => {
    if (visible) {
      ty.value = SLIDE
      ty.value = withSpring(0, SPRING)
    }
  }, [visible])

  // Dra i arket: följer fingret nedåt, snäpper tillbaka eller stängs vid släpp
  const pan = Gesture.Pan()
    .onUpdate(e => {
      ty.value = e.translationY > 0 ? e.translationY : e.translationY * 0.15
    })
    .onEnd(e => {
      if (e.translationY > 90 || e.velocityY > 600) {
        ty.value = withTiming(SLIDE, { duration: 200 }, finished => {
          if (finished) runOnJS(onClose)()
        })
      } else {
        ty.value = withSpring(0, SPRING)
      }
    })

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }))

  if (!visible) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={s.backdrop} onPress={onClose} testID="scheduleIntroBackdrop" />
        <GestureDetector gesture={pan}>
          <Animated.View style={[
            s.sheet,
            { backgroundColor: T.BG, borderColor: T.BORDER, paddingBottom: 20 + insets.bottom },
            sheetStyle,
          ]}>
            <View style={s.handle} />
            <View style={[s.iconCircle, { backgroundColor: T.ACCENT }]}>
              <Ionicons name="calendar" size={26} color={light ? '#FFFFFF' : '#000000'} />
            </View>
            <Text style={[s.title, { color: T.TEXT_PRIMARY }]}>Skapa ditt schema</Text>
            <Text style={s.body}>
              Kom igång med ett anpassat träningsprogram. Svara på några frågor
              så bygger vi veckans pass åt dig.
            </Text>

            <TouchableOpacity
              style={[s.createBtn, { backgroundColor: T.ACCENT }]}
              onPress={onCreate}
              activeOpacity={0.85}
              testID="scheduleIntroCreate"
            >
              <Text style={[s.createText, { color: light ? '#FFFFFF' : '#000000' }]}>Skapa schema</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onNeverShow}
              hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
              activeOpacity={0.7}
              testID="scheduleIntroNeverShow"
            >
              <Text style={s.dismissText}>Nej tack, visa inte igen</Text>
            </TouchableOpacity>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1,
    paddingHorizontal: 24, paddingTop: 10, alignItems: 'center',
  },
  handle: {
    width: 44, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.45)', marginBottom: 18,
  },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  title: { fontSize: 20, fontWeight: '800' },
  body: {
    color: TEXT_SECONDARY, fontSize: 14, lineHeight: 21,
    textAlign: 'center', marginTop: 8, marginBottom: 20,
  },
  createBtn: {
    alignSelf: 'stretch', borderRadius: 999,
    paddingVertical: 15, alignItems: 'center',
  },
  createText: { fontSize: 16, fontWeight: '700' },
  dismissText: {
    color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600',
    marginTop: 16, marginBottom: 2,
  },
})
