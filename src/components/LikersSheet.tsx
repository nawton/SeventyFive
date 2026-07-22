import { useEffect } from 'react'
import {
  View, Text, StyleSheet, Modal, Pressable, FlatList, TouchableOpacity,
  useWindowDimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated'
import type { FollowProfile } from '@/services/follows'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { BG, BORDER, ORANGE, RED, TEXT_PRIMARY, DIVIDER } from '@/lib/theme'

// =============================================================================
// GILLARLISTAN — dragbar bottom sheet (Strava-stil): öppnar till halva
// skärmen, dras upp för helskärm eller ner för att stängas. Snäpper till
// närmaste läge när fingret släpper.
// =============================================================================

const SPRING = { damping: 20, stiffness: 220, mass: 0.8 } as const

export function LikersSheet({ likers, count, onClose, onPressPerson }: {
  /** null = stängd */
  likers: FollowProfile[] | null
  count: number
  onClose: () => void
  onPressPerson?: (person: FollowProfile) => void
}) {
  const { height: screenH } = useWindowDimensions()
  const FULL_TOP = screenH * 0.10
  const HALF_TOP = screenH * 0.48
  const CLOSED   = screenH

  const translateY = useSharedValue(CLOSED)
  const startY = useSharedValue(CLOSED)
  const open = likers !== null

  useEffect(() => {
    translateY.value = open ? withSpring(HALF_TOP, SPRING) : CLOSED
  }, [open, HALF_TOP])

  function requestClose() {
    onClose()
  }

  const closeAnimated = () => {
    'worklet'
    translateY.value = withTiming(CLOSED, { duration: 180 }, finished => {
      if (finished) runOnJS(requestClose)()
    })
  }

  // Dra i arket: följer fingret mellan helskärm och botten, snäpper vid släpp
  const pan = Gesture.Pan()
    .onStart(() => { startY.value = translateY.value })
    .onUpdate(e => {
      translateY.value = Math.min(CLOSED, Math.max(FULL_TOP, startY.value + e.translationY))
    })
    .onEnd(e => {
      if (e.velocityY > 900 || translateY.value > (HALF_TOP + CLOSED) / 2) {
        closeAnimated()
      } else if (e.velocityY < -900 || translateY.value < (FULL_TOP + HALF_TOP) / 2) {
        translateY.value = withSpring(FULL_TOP, SPRING)
      } else {
        translateY.value = withSpring(HALF_TOP, SPRING)
      }
    })

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  if (!open) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <GestureDetector gesture={pan}>
          <Animated.View style={[s.sheet, { height: screenH }, sheetStyle]}>
            <View style={s.handle} />
            {/* Flik-rubrik som förlagan: antal + hjärta med orange underlinje */}
            <View style={s.headerRow}>
              <View style={s.headerTab}>
                <View style={s.headerTabInner}>
                  <Text style={s.headerCount}>{count}</Text>
                  {/* Rött hjärta — samma gillafärg som i flödet och trådarna */}
                  <Ionicons name="heart" size={20} color={RED} />
                </View>
                <View style={s.headerUnderline} />
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} testID="likersClose">
                <Ionicons name="close" size={24} color={TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={likers ?? []}
              keyExtractor={p => p.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.row}
                  activeOpacity={0.7}
                  onPress={() => onPressPerson?.(item)}
                  disabled={!onPressPerson}
                >
                  <FeedAvatar
                    url={item.avatar_url}
                    fallback={(item.name ?? '?').charAt(0).toUpperCase()}
                    size={46}
                  />
                  <Text style={s.rowName} numberOfLines={1}>{item.name ?? 'Namnlös'}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={s.rowDivider} />}
              contentContainerStyle={s.listContent}
              showsVerticalScrollIndicator={false}
            />
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, top: 0,
    backgroundColor: BG,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderWidth: 1, borderColor: BORDER,
  },
  handle: {
    alignSelf: 'center', width: 44, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 10,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DIVIDER,
  },
  headerTab: { alignItems: 'center', gap: 10 },
  headerTabInner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6 },
  headerCount: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '800' },
  headerUnderline: {
    alignSelf: 'stretch', height: 3, borderRadius: 2, backgroundColor: ORANGE,
  },
  listContent: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 60 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  rowName: { flex: 1, color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: DIVIDER, marginLeft: 60 },
})
