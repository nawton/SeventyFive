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
  useColorScheme,
} from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { useFocusEffect, router } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getExercises, type Exercise } from '@/services/exercises'
import {
  getWorkoutSessions,
  deleteSessionWithSkips,
  deleteRepeatingSessions,
  dateForWeekday,
  PLAN_WEEKS,
  type WorkoutSession,
} from '@/services/workoutSchedule'
import { ScheduleWizard } from '@/components/ScheduleWizard'
import { generateScheduleFromWizard } from '@/services/scheduleGenerator'
import { SessionEditor } from '@/components/SessionEditor'
import { GlassCircleButton } from '@/components/GlassButton'
import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, CARDIO_BLUE, ACCENT, accentAlpha, CARD_BORDER } from '@/lib/theme'

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

// Typikon per pass — samma färgspråk som passkorten (orange gym, blå kondition)
function sessionIcon(sess: WorkoutSession): {
  name: React.ComponentProps<typeof Ionicons>['name']
  color: import('react-native').ColorValue
} {
  if (sess.session_type !== 'cardio') return { name: 'barbell-outline', color: ACCENT }
  switch (sess.cardio_type) {
    case 'cycling':  return { name: 'bicycle-outline', color: CARDIO_BLUE }
    case 'walking':  return { name: 'walk-outline',    color: CARDIO_BLUE }
    case 'interval': return { name: 'flash-outline',   color: CARDIO_BLUE }
    default:         return { name: 'fitness-outline', color: CARDIO_BLUE }
  }
}

function cardioLabel(type: string | null): string {
  switch (type) {
    case 'cycling':  return 'Cykling'
    case 'interval': return 'Intervall'
    case 'walking':  return 'Promenad'
    default:         return 'Löpning'
  }
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
  const firstCardio   = daySessions.find(x => x.session_type === 'cardio')
  // Accenttonad platta för dagar med pass — schemasträngar (ramar fryser
  // annars fel efter modalbesök)
  const light = useColorScheme() === 'light'
  const activeBg     = light ? '#EDF1FA' : '#1A1510'
  const activeBorder = light ? 'rgba(49,86,196,0.30)' : 'rgba(255,168,23,0.25)'
  const todayBorder  = light ? '#3156C4' : '#FFA817'

  return (
    <TouchableOpacity
      style={[
        s.dayCard,
        { borderColor: light ? 'transparent' : '#2C2C2E' },
        hasSession && { backgroundColor: activeBg, borderColor: activeBorder },
        isToday   && { borderColor: todayBorder },
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
          {/* Alla dagens pass med varsin typikon — inget göms bakom "· 2 pass" */}
          <View style={s.sessionList}>
            {daySessions.slice(0, 3).map(sess => {
              const icon = sessionIcon(sess)
              return (
                <View key={sess.id} style={s.sessionRow}>
                  <Ionicons name={icon.name} size={12} color={icon.color} />
                  <Text style={s.sessionLabel} numberOfLines={1}>{displayName(sess)}</Text>
                </View>
              )
            })}
            {daySessions.length > 3 && (
              <Text style={s.moreText}>+{daySessions.length - 3} pass till</Text>
            )}
          </View>
          <Text style={s.metaText}>
            {[
              exerciseCount > 0 && `${exerciseCount} övningar`,
              firstCardio && cardioLabel(firstCardio.cardio_type),
            ].filter(Boolean).join(' · ')}
          </Text>
        </>
      ) : (
        <>
          <Text style={s.restLabel}>Vilodag</Text>
          <View style={s.addCircle}>
            <Ionicons name="add" size={14} color={ACCENT} />
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
  const [wizardVisible, setWizardVisible] = useState(false)
  const [loaded, setLoaded]               = useState(false)

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
    } finally {
      setLoaded(true)
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

  // Löpplaner är tidsbegränsade (16 veckor) — visa när planen tar slut.
  // Gympass fortsätter tills vidare och behöver ingen skylt.
  const planEndLabel = (() => {
    const cardio = sessions.filter(s => s.session_type === 'cardio')
    if (cardio.length === 0) return null
    const newest = cardio.reduce((a, b) => (a.created_at > b.created_at ? a : b))
    const end = new Date(newest.created_at)
    end.setDate(end.getDate() + PLAN_WEEKS * 7)
    return end.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '')
  })()

  return (
    <SafeScreen style={s.screen} edges={['top']}>

      {/* Header — samma mönster som Rekord & medaljer */}
      <View style={s.header}>
        <GlassCircleButton
          icon="chevron-back" size={40} iconColor={TEXT_PRIMARY}
          onPress={() => router.navigate('/(app)/add')} fallbackStyle={s.iconBtn}
        />
        <Text style={s.title}>Veckoschema</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Summary strip */}
        {totalSessions > 0 && (
          <Animated.View entering={FadeInDown.duration(350)} style={s.summaryRow}>
            <View style={s.summaryChip}>
              <Ionicons name="barbell-outline" size={13} color={ACCENT} />
              <Text style={s.summaryText}>{totalSessions} pass</Text>
            </View>
            <View style={s.summaryChip}>
              <Ionicons name="calendar-outline" size={13} color={ACCENT} />
              <Text style={s.summaryText}>{scheduledDays} dagar/vecka</Text>
            </View>
            {planEndLabel && (
              <View style={[s.summaryChip, s.summaryChipBlue]}>
                <Ionicons name="flag-outline" size={13} color={CARDIO_BLUE} />
                <Text style={[s.summaryText, { color: CARDIO_BLUE }]}>Löpplan till {planEndLabel}</Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* CTA när inget schema finns */}
        {loaded && sessions.length === 0 && (
          <Animated.View entering={FadeInDown.duration(350)}>
            <TouchableOpacity
              style={s.ctaBanner}
              onPress={() => setWizardVisible(true)}
              activeOpacity={0.85}
            >
              <View style={s.ctaIcon}>
                <Ionicons name="calendar" size={22} color="#000" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.ctaTitle}>Inget schema ännu</Text>
                <Text style={s.ctaSub}>Tryck för att skapa ett anpassat träningsschema</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#000" />
            </TouchableOpacity>
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

      <ScheduleWizard
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        onFinish={async (result) => {
          setWizardVisible(false)
          if (!userId) return
          try {
            await deleteRepeatingSessions(userId)
            const count = await generateScheduleFromWizard(userId, result)
            await loadData(userId)
            Alert.alert('Schema skapat', `${count} pass har lagts till i ditt veckoschema.`)
          } catch (e: any) {
            Alert.alert('Kunde inte skapa schemat', e.message)
          }
        }}
      />
    </SafeScreen>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  scroll: { padding: PAD, paddingBottom: 60 },

  // Summary
  summaryRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16,
  },
  summaryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: accentAlpha('12'),
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
  },
  summaryChipBlue: { backgroundColor: CARDIO_BLUE + '14' },
  summaryText: { color: ACCENT, fontSize: 12, fontWeight: '600' },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  lastCard: { width: CARD_W },

  // Day card — ram istället för glow; idag markeras med orange ram
  dayCard: {
    width: CARD_W,
    minHeight: 120,
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 6,
    justifyContent: 'space-between',
  },
  // Färgerna sätts inline per schema — dagar med pass var hårdkodat mörka
  dayCardActive: {},
  dayCardToday: {},

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayShort: {
    color: TEXT_SECONDARY,
    fontSize: 11, fontWeight: '800',
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  dayShortToday: { color: ACCENT },
  todayDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: ACCENT,
  },

  sessionList: { flex: 1, gap: 5, justifyContent: 'center' },
  sessionRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sessionLabel: {
    color: TEXT_PRIMARY, fontSize: 14,
    fontWeight: '700', lineHeight: 18,
    flex: 1,
  },
  moreText: { color: TEXT_SECONDARY, fontSize: 11, marginLeft: 18 },
  metaText: { color: TEXT_SECONDARY, fontSize: 11 },

  restLabel: { color: 'rgba(255,255,255,0.28)', fontSize: 13, fontWeight: '500', flex: 1 },
  addCircle: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1, borderColor: accentAlpha('40'),
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-end',
  },

  hint: {
    color: 'rgba(255,255,255,0.30)', fontSize: 11,
    textAlign: 'center', marginTop: 20,
  },

  ctaBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: ACCENT, borderRadius: 16, padding: 14,
    marginBottom: 16,
  },
  ctaIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  ctaTitle: { color: '#000', fontSize: 15, fontWeight: '800' },
  ctaSub:   { color: 'rgba(0,0,0,0.6)', fontSize: 12, marginTop: 1 },
})
