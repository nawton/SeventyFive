import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

// ─── Types ───────────────────────────────────────────────────────────────────

type TaskId = 'workout1' | 'workout2' | 'diet' | 'water' | 'reading' | 'photo'

interface Task {
  id: TaskId
  label: string
  description: string
  icon: React.ComponentProps<typeof Ionicons>['name']
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ORANGE = '#FF8F00'
const BG = '#111111'
const CARD = '#1C1C1E'
const BORDER = '#2C2C2E'
const TEXT_PRIMARY = '#FFFFFF'
const TEXT_SECONDARY = '#888888'

const TASKS: Task[] = [
  {
    id: 'workout1',
    label: 'Träningspass 1',
    description: '45 min – valfri träning',
    icon: 'barbell-outline',
  },
  {
    id: 'workout2',
    label: 'Träningspass 2',
    description: '45 min – utomhus promenad/löpning',
    icon: 'walk-outline',
  },
  {
    id: 'diet',
    label: 'Följ kosten',
    description: 'Inga fuskmat idag',
    icon: 'restaurant-outline',
  },
  {
    id: 'water',
    label: '4 liter vatten',
    description: 'Håll dig hydrerad hela dagen',
    icon: 'water-outline',
  },
  {
    id: 'reading',
    label: '10 sidor läsning',
    description: 'Fackbok eller självutveckling',
    icon: 'book-outline',
  },
  {
    id: 'photo',
    label: 'Progressfoto',
    description: 'Ta dagens foto',
    icon: 'camera-outline',
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const percent = total === 0 ? 0 : (completed / total) * 100
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${percent}%` }]} />
    </View>
  )
}

function TaskItem({
  task,
  done,
  onToggle,
}: {
  task: Task
  done: boolean
  onToggle: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.taskCard, done && styles.taskCardDone]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.taskIcon}>
        <Ionicons name={task.icon} size={22} color={done ? ORANGE : TEXT_SECONDARY} />
      </View>
      <View style={styles.taskText}>
        <Text style={[styles.taskLabel, done && styles.taskLabelDone]}>{task.label}</Text>
        <Text style={styles.taskDescription}>{task.description}</Text>
      </View>
      <View style={[styles.checkbox, done && styles.checkboxDone]}>
        {done && <Ionicons name="checkmark" size={16} color="#000000" />}
      </View>
    </TouchableOpacity>
  )
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const [completed, setCompleted] = useState<Set<TaskId>>(new Set())

  // Hardkodad för nu – ersätts med riktig data från Supabase
  const currentDay = 1
  const totalDays = 75
  const userName = 'Nawton'

  function toggleTask(id: TaskId) {
    setCompleted((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const completedCount = completed.size
  const allDone = completedCount === TASKS.length

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
            <Text style={styles.dayLabel}>Dag {currentDay} av {totalDays}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userName[0]}</Text>
          </View>
        </View>

        {/* Progress card */}
        <View style={styles.card}>
          <View style={styles.progressHeader}>
            <Text style={styles.cardTitle}>Dagens framsteg</Text>
            <Text style={styles.progressCount}>
              {completedCount}/{TASKS.length}
            </Text>
          </View>
          <ProgressBar completed={completedCount} total={TASKS.length} />
          {allDone && (
            <Text style={styles.allDoneText}>Dagen klar! Bra jobbat.</Text>
          )}
        </View>

        {/* Task list */}
        <Text style={styles.sectionTitle}>Dagens uppgifter</Text>
        <View style={styles.taskList}>
          {TASKS.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              done={completed.has(task.id)}
              onToggle={() => toggleTask(task.id)}
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
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
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

  // Card
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

  // Section
  sectionTitle: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Tasks
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
