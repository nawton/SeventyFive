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
import { getProfile } from '@/services/profile'
import {
  getOrCreateTodayLog,
  getOrCreateTaskCompletions,
  setTaskCompleted,
  markDayCompleted,
  markDayFailed,
  type TaskItem,
} from '@/services/dailyLog'
import { FailModal } from '@/components/FailModal'
import { ORANGE, GREEN, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import type { TaskType } from '@/types/database'

const TASK_ICONS: Record<TaskType, React.ComponentProps<typeof Ionicons>['name']> = {
  workout:  'barbell-outline',
  diet:     'restaurant-outline',
  water:    'water-outline',
  reading:  'book-outline',
  photo:    'camera-outline',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeroCard({
  currentDay,
  levelName,
  completedCount,
  total,
  allDone,
}: {
  currentDay: number
  levelName: string
  completedCount: number
  total: number
  allDone: boolean
}) {
  const challengePct = Math.round((currentDay / 75) * 100)

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTop}>
        <View>
          <Text style={styles.heroLabel}>DAG</Text>
          <View style={styles.heroDayRow}>
            <Text style={styles.heroDayNum}>{currentDay}</Text>
            <Text style={styles.heroDayOf}>/75</Text>
          </View>
        </View>
        <View style={styles.heroRight}>
          {levelName ? (
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{levelName.toUpperCase()}</Text>
            </View>
          ) : null}
          <Text style={styles.heroChallengePct}>{challengePct}%</Text>
        </View>
      </View>

      <View style={styles.heroBar}>
        <View style={[styles.heroBarFill, { width: `${challengePct}%` }]} />
      </View>

      <View style={styles.heroFooter}>
        <View style={[styles.heroStatusDot, {
          backgroundColor: allDone ? GREEN : completedCount > 0 ? ORANGE : BORDER,
        }]} />
        <Text style={styles.heroFooterText}>
          {allDone
            ? 'Alla uppgifter klara idag'
            : `${completedCount} av ${total} uppgifter klara`}
        </Text>
        {allDone && <Ionicons name="checkmark-circle" size={15} color={GREEN} />}
      </View>
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
      {task.completed && <View style={styles.taskAccent} />}
      <View style={[styles.taskIcon, task.completed && styles.taskIconDone]}>
        <Ionicons name={icon} size={20} color={task.completed ? ORANGE : TEXT_SECONDARY} />
      </View>
      <View style={styles.taskText}>
        <Text style={[styles.taskLabel, task.completed && styles.taskLabelDone]}>
          {task.name}
        </Text>
        {task.description && (
          <Text style={styles.taskDescription} numberOfLines={1}>
            {task.description}
          </Text>
        )}
      </View>
      <View style={[styles.checkbox, task.completed && styles.checkboxDone]}>
        {task.completed && <Ionicons name="checkmark" size={13} color="#000" />}
      </View>
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const [userName, setUserName] = useState('')
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [currentDay, setCurrentDay] = useState(1)
  const [levelName, setLevelName] = useState('')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [dailyLogId, setDailyLogId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [failModalVisible, setFailModalVisible] = useState(false)
  const [dayFailed, setDayFailed] = useState(false)

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.replace('/(auth)/welcome'); return }

      const profile = await getProfile(user.id)
      setUserName(profile?.name || user.email?.split('@')[0] || 'Nawton')
      if (profile?.avatar_url) setUserAvatar(profile.avatar_url)

      const challenge = await getActiveChallenge(user.id)
      if (!challenge) { router.replace('/(auth)/quiz'); return }

      const day = calculateCurrentDay(challenge.start_date)
      setCurrentDay(day)
      setLevelName(challenge.challenge_levels?.display_name ?? '')

      const log = await getOrCreateTodayLog(challenge.id, user.id, day)
      setDailyLogId(log.id)
      if (log.status === 'failed') setDayFailed(true)

      const completions = await getOrCreateTaskCompletions(log.id, challenge.level_id)
      setTasks(completions)
    } finally {
      setLoading(false)
    }
  }

  async function toggleTask(task: TaskItem) {
    const updated = !task.completed
    setTasks((prev) =>
      prev.map((t) => t.completionId === task.completionId ? { ...t, completed: updated } : t)
    )
    try {
      await setTaskCompleted(task.completionId, updated)
      const allDone = tasks.every((t) =>
        t.completionId === task.completionId ? updated : t.completed
      )
      if (allDone && dailyLogId) await markDayCompleted(dailyLogId)
    } catch {
      setTasks((prev) =>
        prev.map((t) => t.completionId === task.completionId ? { ...t, completed: task.completed } : t)
      )
    }
  }

  async function handleFail(reason: string) {
    if (!dailyLogId) return
    try {
      await markDayFailed(dailyLogId, reason)
      setDayFailed(true)
      setFailModalVisible(false)
    } catch {
      // modal förblir öppen
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
            <Text style={styles.greetingSubtitle}>Håll i — du klarar det.</Text>
          </View>
          <View style={styles.avatar}>
            {userAvatar && !userAvatar.startsWith('http') ? (
              <Text style={styles.avatarEmoji}>{userAvatar}</Text>
            ) : (
              <Text style={styles.avatarText}>{userName[0]?.toUpperCase()}</Text>
            )}
          </View>
        </View>

        {/* Hero card */}
        <HeroCard
          currentDay={currentDay}
          levelName={levelName}
          completedCount={completedCount}
          total={tasks.length}
          allDone={allDone}
        />

        {/* Task section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>DAGENS UPPGIFTER</Text>
          <Text style={styles.sectionCount}>{completedCount}/{tasks.length}</Text>
        </View>

        <View style={styles.taskList}>
          {tasks.map((task) => (
            <TaskCard
              key={task.completionId}
              task={task}
              onToggle={() => toggleTask(task)}
            />
          ))}
        </View>

        {/* Fail / done */}
        {!dayFailed && !allDone && (
          <TouchableOpacity
            style={styles.failButton}
            onPress={() => setFailModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.failButtonText}>Rapportera dag missad</Text>
          </TouchableOpacity>
        )}
        {dayFailed && (
          <Text style={styles.dayFailedText}>Dagen är rapporterad som missad.</Text>
        )}

      </ScrollView>

      <FailModal
        visible={failModalVisible}
        onClose={() => setFailModalVisible(false)}
        onConfirm={handleFail}
      />
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
    paddingBottom: 40,
    gap: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: '700',
  },
  greetingSubtitle: {
    color: TEXT_SECONDARY,
    fontSize: 13,
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
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
  avatarEmoji: {
    fontSize: 22,
  },

  // Hero card
  heroCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 14,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  heroDayRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  heroDayNum: {
    color: TEXT_PRIMARY,
    fontSize: 64,
    fontWeight: '800',
    lineHeight: 64,
  },
  heroDayOf: {
    color: TEXT_SECONDARY,
    fontSize: 22,
    fontWeight: '600',
    paddingBottom: 10,
  },
  heroRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  levelBadge: {
    backgroundColor: ORANGE + '20',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: ORANGE + '50',
  },
  levelBadgeText: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroChallengePct: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '500',
  },
  heroBar: {
    height: 4,
    backgroundColor: BORDER,
    borderRadius: 2,
    overflow: 'hidden',
  },
  heroBarFill: {
    height: '100%',
    backgroundColor: ORANGE,
    borderRadius: 2,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  heroFooterText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    flex: 1,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: -8,
  },
  sectionTitle: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  sectionCount: {
    color: ORANGE,
    fontSize: 13,
    fontWeight: '700',
  },

  // Task list
  taskList: {
    gap: 8,
  },
  taskCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  taskCardDone: {
    borderColor: ORANGE + '35',
    backgroundColor: '#1D1A14',
  },
  taskAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: ORANGE,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  taskIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskIconDone: {
    backgroundColor: ORANGE + '18',
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
    fontSize: 12,
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

  // Fail
  failButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5393530',
    marginTop: 4,
  },
  failButtonText: {
    color: '#E53935',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  dayFailedText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
  },
})
