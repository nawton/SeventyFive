import { useCallback, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getExercises, type Exercise } from '@/services/exercises'
import {
  getWorkoutSessions,
  deleteSessionWithSkips,
  dateForWeekday,
  type WorkoutSession,
} from '@/services/workoutSchedule'
import { SessionEditor, WEEKDAYS } from '@/components/SessionEditor'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

// ── Constants ─────────────────────────────────────────────────────────────────

const { width: SW } = Dimensions.get('window')
const PAD      = 16
const GAP      = 10
const CARD_W   = (SW - PAD * 2 - GAP) / 2

const DAY_SHORT = ['MÅN', 'TIS', 'ONS', 'TOR', 'FRE', 'LÖR', 'SÖN']
const DAY_FULL  = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag']

function todayWeekday(): number {
  const d = new Date().getDay()
  return d === 0 ? 7 : d
}

function dateForDay(dayNum: number): Date {
  return new Date(dateForWeekday(dayNum) + 'T12:00:00')
}

function displayName(s: WorkoutSession): string {
  if (s.name.startsWith('ONCE:')) return s.name.split(':').slice(2).join(':')
  return s.name
}

// ── DayCard ───────────────────────────────────────────────────────────────────

function DayCard({
  dayNum,
  daySessions,
  isToday,
  onPress,
  onLongPress,
}: {
  dayNum:      number
  daySessions: WorkoutSession[]
  isToday:     boolean
  onPress:     () => void
  onLongPress: () => void
}) {
  const hasSession    = daySessions.length > 0
  const exerciseCount = daySessions.reduce((n, s) => n + s.exercises.length, 0)
  const multiPass     = daySessions.length > 1

  return (
    <TouchableOpacity
      style={[
        s.dayCard,
        hasSession && s.dayCardActive,
        isToday   && s.dayCardToday,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.82}
    >
      {/* Day label */}
      <View style={s.cardTop}>
        <Text style={[s.dayShort, isToday && s.dayShortToday]}>
          {DAY_SHORT[dayNum - 1]}
        </Text>
        {isToday && <View style={s.todayDot} />}
      </View>

      {hasSession ? (
        <>
          <Text style={s.sessionLabel} numberOfLines={2}>
            {displayName(daySessions[0])}
          </Text>
          <View style={s.cardBottom}>
            {daySessions[0].session_type === 'cardio' ? (
              <Ionicons
                name={
                  daySessions[0].cardio_type === 'cycling'  ? 'bicycle-outline' :
                  daySessions[0].cardio_type === 'walking'  ? 'walk-outline'    :
                  daySessions[0].cardio_type === 'interval' ? 'flash-outline'   :
                  'fitness-outline'
                }
                size={13}
                color={ORANGE}
              />
            ) : (
              <Text style={s.metaText}>
                {exerciseCount} övn{multiPass ? ` · ${daySessions.length} pass` : ''}
              </Text>
            )}
            <View style={[s.activeDot, multiPass && s.activeDotMulti]} />
          </View>
        </>
      ) : (
        <>
          <Text style={s.restLabel}>Vilodag</Text>
          <View style={s.addCircle}>
            <Ionicons name="add" size={14} color={ORANGE} />
          </View>
        </>
      )}
    </TouchableOpacity>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ManageSessionsScreen() {
  const [sessions, setSessions]           = useState<WorkoutSession[]>([])
  const [exercises, setExercises]         = useState<Exercise[]>([])
  const [userId, setUserId]               = useState<string | null>(null)
  const [editorVisible, setEditorVisible] = useState(false)
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null)
  const [editorInitialDate, setEditorInitialDate] = useState<Date | undefined>()

  const todayDay = todayWeekday()

  async function loadData(uid: string) {
    try {
      const [sess, exs] = await Promise.all([
        getWorkoutSessions(uid),
        getExercises().catch(() => [] as Exercise[]),
      ])
      setSessions(sess.filter(s => s.weekdays.length > 0))
      setExercises(exs)
    } catch {
      setSessions([])
    }
  }

  useFocusEffect(useCallback(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      loadData(user.id)
    })
  }, []))

  function sessionsForDay(dayNum: number): WorkoutSession[] {
    return sessions.filter(s => s.weekdays.includes(dayNum))
  }

  function openCreate(dayNum: number) {
    setEditingSession(null)
    setEditorInitialDate(dateForDay(dayNum))
    setEditorVisible(true)
  }

  function openEdit(session: WorkoutSession) {
    setEditingSession(session)
    setEditorInitialDate(undefined)
    setEditorVisible(true)
  }

  function handleDayPress(dayNum: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const daySessions = sessionsForDay(dayNum)

    if (daySessions.length === 0) {
      openCreate(dayNum)
      return
    }
    if (daySessions.length === 1) {
      openEdit(daySessions[0])
      return
    }

    // Multiple sessions — let user pick
    const options = ['Avbryt', ...daySessions.map(displayName), '+ Nytt pass']
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: DAY_FULL[dayNum - 1], options, cancelButtonIndex: 0 },
        i => {
          if (i === 0) return
          if (i === daySessions.length + 1) { openCreate(dayNum); return }
          openEdit(daySessions[i - 1])
        },
      )
    } else {
      Alert.alert(DAY_FULL[dayNum - 1], 'Välj pass att redigera', [
        ...daySessions.map(s => ({ text: displayName(s), onPress: () => openEdit(s) })),
        { text: '+ Nytt pass', onPress: () => openCreate(dayNum) },
        { text: 'Avbryt', style: 'cancel' as const },
      ])
    }
  }

  function handleDayLongPress(dayNum: number) {
    const daySessions = sessionsForDay(dayNum)
    if (daySessions.length === 0) { openCreate(dayNum); return }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const options = ['Avbryt', ...daySessions.map(s => `Ta bort "${displayName(s)}"`), '+ Nytt pass']
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: DAY_FULL[dayNum - 1],
          options,
          destructiveButtonIndex: daySessions.map((_, i) => i + 1),
          cancelButtonIndex: 0,
        },
        i => {
          if (i === 0) return
          if (i === daySessions.length + 1) { openCreate(dayNum); return }
          const sess = daySessions[i - 1]
          if (userId) {
            deleteSessionWithSkips(userId, sess.id)
              .catch(() => Alert.alert('Kunde inte ta bort passet', 'Kontrollera din anslutning och försök igen.'))
              .finally(() => loadData(userId!))
          }
        },
      )
    } else {
      Alert.alert(DAY_FULL[dayNum - 1], 'Välj åtgärd', [
        ...daySessions.map(sess => ({
          text: `Ta bort "${displayName(sess)}"`,
          style: 'destructive' as const,
          onPress: () => {
            if (userId) {
              deleteSessionWithSkips(userId, sess.id)
                .catch(() => Alert.alert('Kunde inte ta bort passet', 'Kontrollera din anslutning och försök igen.'))
                .finally(() => loadData(userId!))
            }
          },
        })),
        { text: '+ Nytt pass', onPress: () => openCreate(dayNum) },
        { text: 'Avbryt', style: 'cancel' as const },
      ])
    }
  }

  const totalSessions  = sessions.length
  const scheduledDays  = new Set(sessions.flatMap(s => s.weekdays)).size

  return (
    <SafeAreaView style={s.screen} edges={['top']}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.navigate('/(app)/add')}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={s.titleWrap} pointerEvents="none">
          <Text style={s.title}>Veckoschemma</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Summary strip */}
        {totalSessions > 0 && (
          <Animated.View entering={FadeInDown.duration(350)} style={s.summaryRow}>
            <View style={s.summaryChip}>
              <Ionicons name="barbell-outline" size={13} color={ORANGE} />
              <Text style={s.summaryText}>{totalSessions} pass</Text>
            </View>
            <View style={s.summaryChip}>
              <Ionicons name="calendar-outline" size={13} color={ORANGE} />
              <Text style={s.summaryText}>{scheduledDays} dagar/vecka</Text>
            </View>
          </Animated.View>
        )}

        {/* Week grid */}
        <View style={s.grid}>
          {[1, 2, 3, 4, 5, 6, 7].map((dayNum, i) => (
            <Animated.View
              key={dayNum}
              entering={FadeInDown.delay(i * 45).duration(350)}
              style={dayNum === 7 ? s.lastCard : undefined}
            >
              <DayCard
                dayNum={dayNum}
                daySessions={sessionsForDay(dayNum)}
                isToday={dayNum === todayDay}
                onPress={() => handleDayPress(dayNum)}
                onLongPress={() => handleDayLongPress(dayNum)}
              />
            </Animated.View>
          ))}
        </View>

        <Text style={s.hint}>Tryck på en dag för att redigera · Håll in för att ta bort</Text>

      </ScrollView>

      {userId && (
        <SessionEditor
          visible={editorVisible}
          session={editingSession}
          exercises={exercises}
          userId={userId}
          initialDate={editorInitialDate}
          onClose={() => setEditorVisible(false)}
          onSaved={() => { if (userId) loadData(userId) }}
        />
      )}
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  titleWrap: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center', height: 56,
  },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  scroll: { padding: PAD, paddingBottom: 60 },

  // Summary
  summaryRow: {
    flexDirection: 'row', gap: 8, marginBottom: 16,
  },
  summaryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ORANGE + '12',
    borderWidth: 1, borderColor: ORANGE + '25',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
  },
  summaryText: { color: ORANGE, fontSize: 12, fontWeight: '600' },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  lastCard: { width: CARD_W },

  // Day card
  dayCard: {
    width: CARD_W,
    minHeight: 120,
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    gap: 6,
    justifyContent: 'space-between',
  },
  dayCardActive: {
    borderColor: ORANGE + '45',
    backgroundColor: '#1A1510',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  dayCardToday: {
    borderColor: ORANGE + '70',
    shadowOpacity: 0.25,
  },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayShort: {
    color: TEXT_SECONDARY,
    fontSize: 11, fontWeight: '800',
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  dayShortToday: { color: ORANGE },
  todayDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: ORANGE,
  },

  sessionLabel: {
    color: TEXT_PRIMARY, fontSize: 14,
    fontWeight: '700', lineHeight: 18,
    flex: 1,
  },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaText:   { color: TEXT_SECONDARY, fontSize: 11 },
  activeDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: ORANGE,
  },
  activeDotMulti: { backgroundColor: '#AB47BC' },

  restLabel: { color: '#333', fontSize: 13, fontWeight: '500', flex: 1 },
  addCircle: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1, borderColor: ORANGE + '40',
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-end',
  },

  hint: {
    color: '#2A2A2C', fontSize: 11,
    textAlign: 'center', marginTop: 20,
  },
})
