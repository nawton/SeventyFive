import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence, withSpring,
} from 'react-native-reanimated'
import type { TaskItem } from '@/services/dailyLog'
import type { TaskType } from '@/types/database'
import { BORDER, CARD, useThemeStrings, ACCENT } from '@/lib/theme'

const { width: SW } = Dimensions.get('window')

const CARD_BG     = CARD
const CARD_BORDER = BORDER

export const TASK_GAP = 10
export const TASK_W   = (SW - 40 - TASK_GAP) / 2

export const TASK_COLORS: Record<TaskType, string> = {
  workout: '#FFA817',
  water:   '#00BCD4',
  diet:    '#66BB6A',
  reading: '#AB47BC',
  photo:   '#EC407A',
  custom:  '#9B6DFF',
}

export const TASK_ICONS: Record<TaskType, React.ComponentProps<typeof Ionicons>['name']> = {
  workout: 'barbell-outline',
  diet:    'restaurant-outline',
  water:   'water-outline',
  reading: 'book-outline',
  photo:   'camera-outline',
  custom:  'checkmark-circle-outline',
}

export function TaskGridCard({ task, onPress, counter, metaLabel, fullWidth }: {
  task: TaskItem
  onPress: () => void
  /** Glas-räknare med synliga −/+ knappar och progress-bar */
  counter?: { value: number; goal: number; unit: string; onPlus: () => void; onMinus: () => void }
  /** Liten metatext under namnet, t.ex. "12 sidor · Atomic Habits" */
  metaLabel?: string
  /** Sträcker kortet till full rad-bredd (foto-uppgiften under griden) */
  fullWidth?: boolean
}) {
  const T = useThemeStrings()
  const color = TASK_COLORS[task.type] ?? T.ACCENT
  const icon  = TASK_ICONS[task.type]  ?? 'checkmark-outline'
  const scale = useSharedValue(1)

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  function handlePress() {
    scale.value = withSequence(
      withTiming(0.92, { duration: 80 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    )
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress()
  }

  return (
    <Animated.View style={[aStyle, { width: fullWidth ? SW - 40 : TASK_W }]}>
      <TouchableOpacity
        style={[
          s.taskCard,
          task.completed && {
            borderColor: color + '45',
            backgroundColor: color + '0E',
          },
        ]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        {task.completed && (
          <View style={[s.taskSidebar, { backgroundColor: color }]} />
        )}
        <View style={s.taskCardTop}>
          <View style={[s.taskIconBox, { backgroundColor: color + '1C' }]}>
            <Ionicons name={icon} size={17} color={color} />
          </View>
          <View style={[s.taskCheck, task.completed && { backgroundColor: color, borderColor: color }]}>
            {task.completed && <Ionicons name="checkmark" size={10} color="#000" />}
          </View>
        </View>
        <View style={s.taskBody}>
          <Text
            style={[s.taskName, task.completed && s.taskNameDone]}
            numberOfLines={metaLabel || counter ? 1 : 2}
          >
            {task.name}
          </Text>
          {counter && (
            <>
              <View style={s.taskBar}>
                <View style={[
                  s.taskBarFill,
                  {
                    width: `${Math.round(Math.min(1, counter.value / counter.goal) * 100)}%` as any,
                    backgroundColor: color,
                  },
                ]} />
              </View>
              <View style={s.counterRow}>
                <TouchableOpacity
                  style={[s.counterBtn, counter.value === 0 && s.counterBtnDim]}
                  onPress={counter.onMinus}
                  disabled={counter.value === 0}
                  hitSlop={8}
                >
                  <Ionicons name="remove" size={15} color={counter.value === 0 ? '#2A2A2E' : color} />
                </TouchableOpacity>
                <Text style={[s.counterLabel, task.completed && { color }]}>
                  {counter.value}/{counter.goal} {counter.unit}
                </Text>
                <TouchableOpacity
                  style={[s.counterBtn, { backgroundColor: color }]}
                  onPress={counter.onPlus}
                  hitSlop={8}
                >
                  <Ionicons name="add" size={15} color="#000" />
                </TouchableOpacity>
              </View>
            </>
          )}
          {metaLabel && (
            <Text style={s.taskMeta} numberOfLines={1}>{metaLabel}</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  taskCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: CARD_BORDER,
    // Fast höjd så alla kort i rutnätet är lika stora oavsett innehåll
    // (vattenkortet har räknare + progress-bar, övriga bara namn)
    overflow: 'hidden', height: 134, gap: 10,
  },
  taskSidebar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
    borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
  },
  taskCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  taskBody: { gap: 6, flex: 1, justifyContent: 'flex-start' },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  counterBtn: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1.5, borderColor: '#2A2A2E',
    alignItems: 'center', justifyContent: 'center',
  },
  counterBtnDim: { opacity: 0.4 },
  counterLabel: { color: '#8A8A90', fontSize: 12, fontWeight: '700' },
  taskBar: {
    height: 3, backgroundColor: BORDER,
    borderRadius: 2, overflow: 'hidden',
  },
  taskBarFill: { height: '100%', borderRadius: 2 },
  taskMeta: { color: '#4A4A50', fontSize: 11, fontWeight: '600' },
  taskIconBox: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  taskCheck: {
    width: 21, height: 21, borderRadius: 11,
    borderWidth: 1.5, borderColor: '#2A2A2E',
    alignItems: 'center', justifyContent: 'center',
  },
  taskName: {
    color: '#BBBBBB', fontSize: 13, fontWeight: '600', lineHeight: 18,
  },
  taskNameDone: { color: '#3A3A40' },
})
