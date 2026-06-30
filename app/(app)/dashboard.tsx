import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  Easing,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
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
import type { TaskType } from '@/types/database'

const { width: SW } = Dimensions.get('window')

const ORANGE    = '#FF8F00'
const SCENE_BG  = '#0A0A0B'
const CARD_BG   = '#131315'
const CARD_BORDER = '#1E1E21'
const TASK_GAP  = 10
const TASK_W    = (SW - 40 - TASK_GAP) / 2

// ── Ring constants ─────────────────────────────────────────────────────────────
const R_SIZE   = 118
const R_STROKE = 9
const R_RADIUS = (R_SIZE - R_STROKE) / 2
const R_CIRCUM = 2 * Math.PI * R_RADIUS

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// ── Per-type config ────────────────────────────────────────────────────────────
const TASK_COLORS: Record<TaskType, string> = {
  workout: '#FF8F00',
  water:   '#00BCD4',
  diet:    '#66BB6A',
  reading: '#AB47BC',
  photo:   '#EC407A',
}

const TASK_ICONS: Record<TaskType, React.ComponentProps<typeof Ionicons>['name']> = {
  workout: 'barbell-outline',
  diet:    'restaurant-outline',
  water:   'water-outline',
  reading: 'book-outline',
  photo:   'camera-outline',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 5)  return 'God natt'
  if (h < 12) return 'God morgon'
  if (h < 17) return 'God eftermiddag'
  if (h < 21) return 'God kväll'
  return 'God natt'
}

function getSubtitle(completed: number, total: number): string {
  if (total > 0 && completed === total) return 'Alla uppgifter klara — grym prestation!'
  const h = new Date().getHours()
  if (h >= 21) return 'Sista chansen idag — kör hårt.'
  if (h < 12)  return 'Dags att sätta igång.'
  return 'Håll i — du klarar det.'
}

// ── Progress Ring ──────────────────────────────────────────────────────────────
function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const progress   = useSharedValue(0)
  const isComplete = total > 0 && completed === total
  const ringColor  = isComplete ? '#4CAF50' : ORANGE

  useEffect(() => {
    progress.value = withTiming(
      total > 0 ? completed / total : 0,
      { duration: 1000, easing: Easing.out(Easing.cubic) }
    )
  }, [completed, total])

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: R_CIRCUM * (1 - progress.value),
  }))

  return (
    <View style={[s.ringWrap, { shadowColor: ringColor }]}>
      <Svg
        width={R_SIZE}
        height={R_SIZE}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={R_SIZE / 2} cy={R_SIZE / 2} r={R_RADIUS}
          stroke="#1E1E21" strokeWidth={R_STROKE} fill="none"
        />
        <AnimatedCircle
          cx={R_SIZE / 2} cy={R_SIZE / 2} r={R_RADIUS}
          stroke={ringColor} strokeWidth={R_STROKE} fill="none"
          strokeDasharray={`${R_CIRCUM}`}
          animatedProps={arcProps}
          strokeLinecap="round"
        />
      </Svg>
      <View style={s.ringCenter}>
        <Text style={[s.ringNum, { color: ringColor }]}>{completed}</Text>
        <Text style={s.ringDenom}>/{total}</Text>
        <Text style={s.ringLabel}>KLART</Text>
      </View>
    </View>
  )
}

// ── Task Grid Card ─────────────────────────────────────────────────────────────
function TaskGridCard({ task, onToggle }: { task: TaskItem; onToggle: () => void }) {
  const color = TASK_COLORS[task.type] ?? ORANGE
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
    onToggle()
  }

  return (
    <Animated.View style={[aStyle, { width: TASK_W }]}>
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
        <Text
          style={[s.taskName, task.completed && s.taskNameDone]}
          numberOfLines={2}
        >
          {task.name}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ── Dashboard Screen ───────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const [userName, setUserName]     = useState('')
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [currentDay, setCurrentDay] = useState(1)
  const [levelName, setLevelName]   = useState('')
  const [tasks, setTasks]           = useState<TaskItem[]>([])
  const [dailyLogId, setDailyLogId] = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [failVisible, setFailVisible] = useState(false)
  const [dayFailed, setDayFailed]   = useState(false)

  // ── 3D floating hero animation ──
  const tiltX = useSharedValue(0)
  const tiltY = useSharedValue(0)

  useEffect(() => {
    tiltY.value = withRepeat(
      withSequence(
        withTiming(-2.2, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
        withTiming(2.2,  { duration: 4200, easing: Easing.inOut(Easing.sin) })
      ), -1, true
    )
    tiltX.value = withRepeat(
      withSequence(
        withTiming(-1.2, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.2,  { duration: 6000, easing: Easing.inOut(Easing.sin) })
      ), -1, true
    )
  }, [])

  const heroAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateX: `${tiltX.value}deg` },
      { rotateY: `${tiltY.value}deg` },
    ],
  }))

  useEffect(() => { loadDashboard() }, [])

  useFocusEffect(useCallback(() => {
    if (loading) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      getProfile(session.user.id).then(p => {
        if (p?.name) setUserName(p.name)
        setUserAvatar(p?.avatar_url ?? null)
      })
    })
  }, [loading]))

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
    setTasks(prev =>
      prev.map(t => t.completionId === task.completionId ? { ...t, completed: updated } : t)
    )
    try {
      await setTaskCompleted(task.completionId, updated)
      const allDone = tasks.every(t =>
        t.completionId === task.completionId ? updated : t.completed
      )
      if (allDone && dailyLogId) {
        await markDayCompleted(dailyLogId)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    } catch {
      setTasks(prev =>
        prev.map(t => t.completionId === task.completionId ? { ...t, completed: task.completed } : t)
      )
    }
  }

  async function handleFail(reason: string) {
    if (!dailyLogId) return
    try {
      await markDayFailed(dailyLogId, reason)
      setDayFailed(true)
      setFailVisible(false)
    } catch { /* keep modal open */ }
  }

  const completedCount = tasks.filter(t => t.completed).length
  const allDone = tasks.length > 0 && completedCount === tasks.length
  const challengePct = Math.round((currentDay / 75) * 100)

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={s.screen}>

      {/* Atmospheric background glow */}
      <LinearGradient
        colors={['rgba(255,143,0,0.08)', 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
        pointerEvents="none"
      />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{getGreeting()}, {userName}</Text>
            <Text style={s.subtitle}>{getSubtitle(completedCount, tasks.length)}</Text>
          </View>
          <TouchableOpacity
            style={s.avatar}
            onPress={() => router.push('/(app)/settings')}
            activeOpacity={0.8}
          >
            {userAvatar?.startsWith('http') ? (
              <Image source={{ uri: userAvatar }} style={s.avatarImg} />
            ) : userAvatar ? (
              <Text style={s.avatarEmoji}>{userAvatar}</Text>
            ) : (
              <Text style={s.avatarText}>{userName[0]?.toUpperCase()}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Hero Card — 3D floating ── */}
        <Animated.View style={[s.heroOuter, heroAnimStyle]}>
          <LinearGradient
            colors={['#1C1915', '#0F0F11']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.heroCard}
          >
            <View style={s.heroLeft}>
              {levelName ? (
                <View style={s.levelBadge}>
                  <Text style={s.levelBadgeText}>{levelName.toUpperCase()}</Text>
                </View>
              ) : null}
              <Text style={s.dayLabel}>DAG</Text>
              <View style={s.dayRow}>
                <Text style={s.dayNum}>{currentDay}</Text>
                <Text style={s.dayOf}>/75</Text>
              </View>
              <View style={s.heroPctRow}>
                <Text style={s.heroPct}>{challengePct}%</Text>
                <Text style={s.heroPctSuffix}> av utmaningen</Text>
              </View>
              <View style={s.heroBar}>
                <View style={[s.heroBarFill, { width: `${challengePct}%` as any }]} />
              </View>
            </View>

            <View style={s.heroRight}>
              <ProgressRing completed={completedCount} total={tasks.length} />
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── Tasks section header ── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>DAGENS UPPGIFTER</Text>
          <View style={[s.countBadge, allDone && s.countBadgeDone]}>
            <Text style={[s.countText, allDone && s.countTextDone]}>
              {completedCount}/{tasks.length}
            </Text>
          </View>
        </View>

        {/* ── Task grid ── */}
        <View style={s.taskGrid}>
          {tasks.map(task => (
            <TaskGridCard
              key={task.completionId}
              task={task}
              onToggle={() => toggleTask(task)}
            />
          ))}
        </View>

        {/* ── Fail / done ── */}
        {!dayFailed && !allDone && (
          <TouchableOpacity
            style={s.failBtn}
            onPress={() => setFailVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={s.failBtnText}>Rapportera dag missad</Text>
          </TouchableOpacity>
        )}
        {dayFailed && (
          <Text style={s.dayFailedText}>Dagen är rapporterad som missad.</Text>
        )}

      </ScrollView>

      <FailModal
        visible={failVisible}
        onClose={() => setFailVisible(false)}
        onConfirm={handleFail}
      />
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: SCENE_BG },
  centered: { flex: 1, backgroundColor: SCENE_BG, alignItems: 'center', justifyContent: 'center' },
  scroll:   { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 56, gap: 20 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { color: '#FFFFFF', fontSize: 23, fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { color: '#4A4A50', fontSize: 13, marginTop: 3 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg:   { width: 44, height: 44, borderRadius: 22 },
  avatarText:  { color: '#000', fontSize: 18, fontWeight: '700' },
  avatarEmoji: { fontSize: 22 },

  // Hero outer wrapper (for shadow + tilt)
  heroOuter: {
    borderRadius: 22,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 12,
  },
  heroCard: {
    borderRadius: 22,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2720',
    overflow: 'hidden',
  },

  // Hero left
  heroLeft: { flex: 1, gap: 4 },
  levelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: ORANGE + '1F',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: ORANGE + '3C',
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  levelBadgeText: { color: ORANGE, fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
  dayLabel: { color: '#3A3A40', fontSize: 10, fontWeight: '700', letterSpacing: 3 },
  dayRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  dayNum:   { color: '#FFFFFF', fontSize: 70, fontWeight: '800', lineHeight: 72, letterSpacing: -3 },
  dayOf:    { color: '#3A3A40', fontSize: 22, fontWeight: '600', paddingBottom: 11 },
  heroPctRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  heroPct:      { color: ORANGE, fontSize: 13, fontWeight: '700' },
  heroPctSuffix: { color: '#3A3A40', fontSize: 12 },
  heroBar: {
    height: 3, backgroundColor: '#1E1E21',
    borderRadius: 2, overflow: 'hidden', marginTop: 6,
  },
  heroBarFill: { height: '100%', backgroundColor: ORANGE, borderRadius: 2 },

  // Hero right
  heroRight: { paddingLeft: 10 },

  // Ring
  ringWrap: {
    width: R_SIZE, height: R_SIZE,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
  },
  ringNum:   { fontSize: 26, fontWeight: '800', lineHeight: 30 },
  ringDenom: { color: '#3A3A40', fontSize: 12, fontWeight: '600' },
  ringLabel: { color: '#2E2E34', fontSize: 8, fontWeight: '700', letterSpacing: 1.5, marginTop: 2 },

  // Section row
  sectionRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: -4,
  },
  sectionTitle: { color: '#383840', fontSize: 11, fontWeight: '700', letterSpacing: 1.8 },
  countBadge: {
    backgroundColor: '#131315',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#1E1E21',
  },
  countBadgeDone: { backgroundColor: '#4CAF501A', borderColor: '#4CAF5035' },
  countText:     { color: '#444', fontSize: 12, fontWeight: '700' },
  countTextDone: { color: '#4CAF50' },

  // Task grid
  taskGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: TASK_GAP },
  taskCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: CARD_BORDER,
    overflow: 'hidden', minHeight: 108, gap: 10,
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

  // Fail
  failBtn: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#E5393520', marginTop: 4,
  },
  failBtnText:   { color: '#E53935', fontSize: 14, fontWeight: '600' },
  dayFailedText: { color: '#3A3A40', fontSize: 13, textAlign: 'center', paddingVertical: 8 },
})
