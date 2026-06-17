import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { getActiveChallenge, calculateCurrentDay } from '@/services/challenge'
import {
  getOrCreateTodayLog,
  getOrCreateTaskCompletions,
  setTaskCompleted,
  markDayCompleted,
  type TaskItem,
} from '@/services/dailyLog'
import type { TaskType } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

const ORANGE = '#FF8F00'
const BG = '#111111'
const CARD = '#1C1C1E'
const BORDER = '#2C2C2E'
const TEXT_PRIMARY = '#FFFFFF'
const TEXT_SECONDARY = '#888888'

const TASK_ICONS: Record<TaskType, React.ComponentProps<typeof Ionicons>['name']> = {
  workout:  'barbell-outline',
  diet:     'restaurant-outline',
  water:    'water-outline',
  reading:  'book-outline',
  photo:    'camera-outline',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const percent = total === 0 ? 0 : (completed / total) * 100
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${percent}%` }]} />
    </View>
  )
}

function TaskCard({
  task,
  onToggle,
}: {
  task: TaskItem
  onToggle: () => void
}) {
  const icon = TASK_ICONS[task.type] ?? 'checkmark-circle-outline'
  return (
    <TouchableOpacity
      style={[styles.taskCard, task.completed && styles.taskCardDone]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.taskIcon}>
        <Ionicons name={icon} size={22} color={task.completed ? ORANGE : TEXT_SECONDARY} />
      </View>
      <View style={styles.taskText}>
        <Text style={[styles.taskLabel, task.completed && styles.taskLabelDone]}>
          {task.name}
        </Text>
        {task.description && (
          <Text style={styles.taskDescription}>{task.description}</Text>
        )}
      </View>
      <View style={[styles.checkbox, task.completed && styles.checkboxDone]}>
        {task.completed && <Ionicons name="checkmark" size={16} color="#000000" />}
      </View>
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const [userName, setUserName] = useState('')
  const [currentDay, setCurrentDay] = useState(1)
  const [levelName, setLevelName] = useState('')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [dailyLogId, setDailyLogId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/(auth)/welcome'); return }

      setUserName(user.email?.split('@')[0] ?? 'Nawton')

      const challenge = await getActiveChallenge(user.id)
      if (!challenge) { router.replace('/(auth)/quiz'); return }

      const day = calculateCurrentDay(challenge.start_date)
      setCurrentDay(day)
      setLevelName((challenge as any).challenge_levels?.display_name ?? '')

      const log = await getOrCreateTodayLog(challenge.id, user.id, day)
      setDailyLogId(log.id)

      const completions = await getOrCreateTaskCompletions(log.id, challenge.level_id)
      setTasks(completions)
    } finally {
      setLoading(false)
    }
  }

  async function toggleTask(task: TaskItem) {
    const updated = !task.completed

    // Optimistisk uppdatering — UI svarar direkt
    setTasks((prev) =>
      prev.map((t) => t.completionId === task.completionId ? { ...t, completed: updated } : t)
    )

    await setTaskCompleted(task.completionId, updated)

    // Om alla uppgifter är klara — markera dagen som avklarad
    const allDone = tasks.every((t) =>
      t.completionId === task.completionId ? updated : t.completed
    )
    if (allDone && dailyLogId) {
      await markDayCompleted(dailyLogId)
    }
  }

  const completedCount = tasks.filter((t) => t.completed).length
  const allDone = tasks.length > 0 && completedCount === tasks.length

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hej, {userName}</Text>
            <Text style={styles.dayLabel}>
              Dag {currentDay} av 75 · {levelName}
            </Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userName[0]?.toUpperCase()}</Text>
          </View>
        </View>

        {/* Progress card */}
        <View style={styles.card}>
          <View style={styles.progressHeader}>
            <Text style={styles.cardTitle}>Dagens framsteg</Text>
            <Text style={styles.progressCount}>
              {completedCount}/{tasks.length}
            </Text>
          </View>
          <ProgressBar completed={completedCount} total={tasks.length} />
          {allDone && (
            <Text style={styles.allDoneText}>Dagen klar! Bra jobbat.</Text>
          )}
        </View>

        {/* Task list */}
        <Text style={styles.sectionTitle}>Dagens uppgifter</Text>
        <View style={styles.taskList}>
          {tasks.map((task) => (
            <TaskCard
              key={task.completionId}
              task={task}
              onToggle={() => toggleTask(task)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  centered: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    color: TEXT_PRIMARY,
    fontSize: 26,
    fontWeight: '700',
  },
  dayLabel: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '600',
  },
  progressCount: {
    color: ORANGE,
    fontSize: 16,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    backgroundColor: BORDER,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ORANGE,
    borderRadius: 3,
  },
  allDoneText: {
    color: ORANGE,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionTitle: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  taskList: {
    gap: 10,
  },
  taskCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  taskCardDone: {
    borderColor: ORANGE + '40',
  },
  taskIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskText: {
    flex: 1,
    gap: 2,
  },
  taskLabel: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '600',
  },
  taskLabelDone: {
    color: TEXT_SECONDARY,
  },
  taskDescription: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
})
