import { useEffect } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'

import { BG, CARD, BORDER, ORANGE, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

const GREEN = '#3BE862'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  completedDays: number
  levelName: string
  onNewChallenge: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VictoryModal({ visible, completedDays, levelName, onNewChallenge }: Props) {
  const scale   = useSharedValue(0.4)
  const opacity = useSharedValue(0)

  useEffect(() => {
    if (!visible) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    scale.value   = withSpring(1, { damping: 10, stiffness: 120 })
    opacity.value = withDelay(300, withTiming(1, { duration: 600 }))
  }, [visible])

  const numberStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const restStyle   = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onNewChallenge}>
      <View style={styles.screen}>
        <LinearGradient
          colors={['rgba(255,143,0,0.18)', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
          pointerEvents="none"
        />

        <View style={styles.container}>
          <Animated.Text style={[styles.bigNumber, numberStyle]}>75</Animated.Text>

          <Animated.View style={[styles.rest, restStyle]}>
            <Text style={styles.title}>Du klarade utmaningen</Text>
            <Text style={styles.subtitle}>
              75 dagar. Varje dag räknades — och du räknade dem alla.
            </Text>

            <View style={styles.statsCard}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Nivå</Text>
                <Text style={styles.statValue}>{levelName || 'SeventyFive'}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Klara dagar</Text>
                <Text style={[styles.statValue, { color: GREEN }]}>{completedDays}/75</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.newChallengeButton}
              onPress={onNewChallenge}
              activeOpacity={0.8}
            >
              <Text style={styles.newChallengeText}>Starta en ny utmaning</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bigNumber: {
    color: ORANGE,
    fontSize: 120,
    fontWeight: '800',
    letterSpacing: -4,
    textShadowColor: 'rgba(255,143,0,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  rest: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  statsCard: {
    alignSelf: 'stretch',
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    gap: 14,
    marginTop: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statDivider: {
    height: 1,
    backgroundColor: BORDER,
  },
  statLabel: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  statValue: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '700',
  },
  newChallengeButton: {
    alignSelf: 'stretch',
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  newChallengeText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
})
