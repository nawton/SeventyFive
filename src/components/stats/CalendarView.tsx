import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal, ScrollView, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import Animated, {
  runOnJS, useSharedValue, useAnimatedStyle, withTiming, interpolate, Extrapolation, Easing,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { ORANGE, GREEN, RED, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { parseLocalDate } from '@/lib/date'
import type { DaySummary } from '@/services/dailyLog'
import type { CardioWorkout, StrengthWorkout } from '@/services/workouts'
import type { CompletedSessionItem } from '@/services/workoutSchedule'
import { deleteCardioWorkout } from '@/services/workouts'
import type { UnitSystem } from '@/lib/units'
import { DayWorkoutsModal } from './DayWorkoutsModal'
import { CardioSummaryView } from '@/components/CardioSummaryView'
import { GlassCircleButton } from '@/components/GlassButton'

const SCREEN_WIDTH = Dimensions.get('window').width
const GRID_PADDING = 20
const CAL_GAP      = 4
const CAL_SIZE     = Math.floor((SCREEN_WIDTH - GRID_PADDING * 2 - 40 - CAL_GAP * 6) / 7)

const MONTHS_SV     = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December']
const WEEKDAY_SHORT = ['MÅN','TIS','ONS','TOR','FRE','LÖR','SÖN']

export const DAY_COLORS: Record<DaySummary['status'], string> = {
  completed: GREEN,
  failed:    RED,
  pending:   ORANGE,
  future:    'rgba(255,255,255,0.08)',
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function getChallengeDay(date: Date, startDate: string): number | null {
  const start = parseLocalDate(startDate)
  const d     = new Date(date);      d.setHours(0, 0, 0, 0)
  const diff  = Math.round((d.getTime() - start.getTime()) / 86400000)
  return diff >= 0 && diff < 75 ? diff + 1 : null
}

// Bara månadens egna dagar — start/slut fylls med tomma celler så t.ex.
// juni aldrig visar 1–5 juli i sista raden
function buildCalendarCells(year: number, month: number): Array<Date | null> {
  const firstDay    = new Date(year, month, 1)
  const offset      = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<Date | null> = []
  for (let i = 0; i < offset; i++)       cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  const rem = (7 - (cells.length % 7)) % 7
  for (let i = 0; i < rem; i++)          cells.push(null)
  return cells
}

function Legend() {
  const items = [
    { color: GREEN,                    label: 'Klar' },
    { color: RED,                      label: 'Missad' },
    { color: ORANGE,                   label: 'Pågående' },
    { color: 'rgba(255,255,255,0.18)', label: 'Framtid' },
  ]
  return (
    <View style={s.legend}>
      {items.map(item => (
        <View key={item.label} style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: item.color }]} />
          <Text style={s.legendLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  )
}

export function CalendarView({
  days, startDate, currentDay, onPressDay, gestureRef,
  workouts = [], strengthWorkouts = [], completedSessions = [],
  unit = 'metric', avatarUrl = null, onDeleteWorkout, challengeId = null,
}: {
  days: DaySummary[]
  startDate: string | null
  currentDay: number
  challengeId?: string | null
  onPressDay: (d: DaySummary) => void
  /** Skickas till omgivande pagers waitFor så månadssvepet vinner över flikbytet */
  gestureRef?: React.MutableRefObject<GestureType | undefined>
  // För att kunna öppna dagsvyn och passdetaljen INUTI helskärmskalendern
  workouts?: CardioWorkout[]
  strengthWorkouts?: StrengthWorkout[]
  completedSessions?: CompletedSessionItem[]
  unit?: UnitSystem
  avatarUrl?: string | null
  onDeleteWorkout?: (id: string) => void
}) {
  const init  = startDate ? parseLocalDate(startDate) : new Date()
  const [view, setView] = useState(new Date(init.getFullYear(), init.getMonth(), 1))
  const yr    = view.getFullYear()
  const mo    = view.getMonth()
  const cells = buildCalendarCells(yr, mo)
  const today = new Date()

  const [yearOpen, setYearOpen] = useState(false)
  // Dagsvy + passdetalj som lager INUTI helskärmskalendern (så de stackar rätt)
  const [fsDay, setFsDay] = useState<DaySummary | null>(null)
  const [fsWorkout, setFsWorkout] = useState<CardioWorkout | null>(null)

  function deleteFsWorkout() {
    const w = fsWorkout
    if (!w) return
    Alert.alert('Radera träning', 'Det här går inte att ångra.', [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Radera', style: 'destructive', onPress: async () => {
        await deleteCardioWorkout(w.id).catch(() => {})
        onDeleteWorkout?.(w.id)
        setFsWorkout(null)
      } },
    ])
  }

  // Mjuk övergång: rutnätet glider ut åt svepets håll, månaden byts, glider in
  const slide = useSharedValue(0)
  const gridAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.value }],
    opacity: interpolate(Math.abs(slide.value), [0, 40], [1, 0.2], Extrapolation.CLAMP),
  }))

  function applyMonth(dir: number) {
    setView(v => new Date(v.getFullYear(), v.getMonth() + dir, 1))
  }

  function changeMonth(dir: number) {
    Haptics.selectionAsync()
    slide.value = withTiming(-dir * 40, { duration: 110, easing: Easing.in(Easing.quad) }, finished => {
      if (finished) {
        runOnJS(applyMonth)(dir)
        slide.value = dir * 40
        slide.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.quad) })
      }
    })
  }

  // Alla månader som utmaningen spänner över (start → dag 75)
  const challengeMonths: Array<{ year: number; month: number }> = []
  if (startDate) {
    const start = parseLocalDate(startDate)
    const end   = new Date(start); end.setDate(end.getDate() + 74)
    const cur   = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cur <= end) {
      challengeMonths.push({ year: cur.getFullYear(), month: cur.getMonth() })
      cur.setMonth(cur.getMonth() + 1)
    }
  }

  // Svep vänster = nästa månad, höger = föregående
  let monthSwipe = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-15, 15])
    .onEnd(e => {
      if (Math.abs(e.translationX) > 40 || Math.abs(e.velocityX) > 500) {
        runOnJS(changeMonth)(e.translationX < 0 ? 1 : -1)
      }
    })
  if (gestureRef) monthSwipe = monthSwipe.withRef(gestureRef)

  return (
    <GestureDetector gesture={monthSwipe}>
    <View style={s.calCard}>
      <View style={s.calHeader}>
        <TouchableOpacity style={s.calNavBtn} onPress={() => setView(new Date(yr, mo - 1, 1))} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.calMonthBtn}
          onPress={() => { Haptics.selectionAsync(); setYearOpen(true) }}
          activeOpacity={0.7}
        >
          <Text style={s.calMonthLabel}>{MONTHS_SV[mo]} {yr}</Text>
          <Ionicons name="chevron-down" size={14} color={TEXT_SECONDARY} />
        </TouchableOpacity>
        <TouchableOpacity style={s.calNavBtn} onPress={() => setView(new Date(yr, mo + 1, 1))} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={20} color={TEXT_PRIMARY} />
        </TouchableOpacity>
      </View>

      <View style={s.calWeekRow}>
        {WEEKDAY_SHORT.map(d => (
          <View key={d} style={s.calWeekCell}>
            <Text style={s.calWeekLabel}>{d}</Text>
          </View>
        ))}
      </View>

      <Animated.View style={[s.calGrid, gridAnimStyle]}>
        {cells.map((date, i) => {
          if (!date) return <View key={i} style={s.calDay} />
          const challengeDay = startDate ? getChallengeDay(date, startDate) : null
          const summary      = challengeDay ? days[challengeDay - 1] : null
          const isToday      = sameDay(date, today)
          const isPending    = summary?.status === 'pending'
          const isFuture     = summary?.status === 'future'

          const bgColor = isFuture
            ? 'rgba(255,255,255,0.07)'
            : summary && !isPending
              ? DAY_COLORS[summary.status]
              : 'transparent'

          return (
            <TouchableOpacity
              key={i}
              style={[
                s.calDay,
                { backgroundColor: bgColor },
                isPending && s.calDayPending,
                isToday && !isPending && s.calDayTodayRing,
              ]}
              onPress={() => summary && summary.status !== 'future' ? onPressDay(summary) : undefined}
              activeOpacity={summary && summary.status !== 'future' ? 0.75 : 1}
            >
              <Text style={[
                s.calDayText,
                summary && !isFuture && !isPending && { fontWeight: '700' },
                isPending && s.calDayTextPending,
              ]}>
                {date.getDate()}
              </Text>
            </TouchableOpacity>
          )
        })}
      </Animated.View>

      <Legend />

      {/* ── Helskärmsöversikt: alla utmaningens månader med en ring per dag ── */}
      <Modal visible={yearOpen} animationType="slide" onRequestClose={() => setYearOpen(false)}>
        <View style={s.fullScreen}>
          <View style={s.fullInner}>
          <View style={s.fullHeader}>
            <Text style={s.fullTitle}>Hela utmaningen</Text>
            <GlassCircleButton
              icon="close" size={38} iconColor={TEXT_PRIMARY}
              onPress={() => setYearOpen(false)} fallbackStyle={s.yearClose}
            />
          </View>

          {/* Fast veckodagsrad */}
          <View style={s.fullWeekRow}>
            {['M','T','O','T','F','L','S'].map((d, i) => (
              <Text key={i} style={s.fullWeekLabel}>{d}</Text>
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.fullScroll}>
            {challengeMonths.map(({ year, month }) => (
              <View key={`${year}-${month}`} style={s.fullMonth}>
                <Text style={s.fullMonthTitle}>{MONTHS_SV[month]} {year !== new Date().getFullYear() ? year : ''}</Text>
                <View style={s.fullGrid}>
                  {buildCalendarCells(year, month).map((date, i) => {
                    if (!date) return <View key={i} style={s.fullDay} />
                    const cd      = startDate ? getChallengeDay(date, startDate) : null
                    const sum     = cd ? days[cd - 1] : null
                    const isToday = sameDay(date, today)
                    const ringColor = sum
                      ? sum.status === 'completed' ? GREEN
                        : sum.status === 'failed'  ? RED
                        : sum.status === 'pending' ? ORANGE
                        : 'rgba(255,255,255,0.12)'
                      : 'transparent'
                    const tappable = !!sum && sum.status !== 'future'
                    return (
                      <TouchableOpacity
                        key={i}
                        style={s.fullDay}
                        disabled={!tappable}
                        activeOpacity={0.7}
                        // Öppnar dagsvyn som ett lager INUTI helskärmskalendern,
                        // så man stannar kvar i översikten när den stängs
                        onPress={() => { if (sum) { Haptics.selectionAsync(); setFsDay(sum) } }}
                      >
                        <View style={[s.fullDayNum, isToday && s.fullDayNumToday]}>
                          <Text style={[s.fullDayNumText, !sum && { color: 'rgba(255,255,255,0.25)' }, isToday && { color: '#000', fontWeight: '800' }]}>
                            {date.getDate()}
                          </Text>
                        </View>
                        <View style={[
                          s.fullRing,
                          { borderColor: ringColor },
                          sum?.status === 'completed' && { backgroundColor: GREEN + '2A' },
                          sum?.status === 'failed'    && { backgroundColor: RED + '1E' },
                        ]}>
                          {sum?.status === 'completed' && <Ionicons name="checkmark" size={13} color={GREEN} />}
                          {sum?.status === 'failed'    && <Ionicons name="close" size={12} color={RED} />}
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            ))}
            <Legend />
          </ScrollView>
          </View>

          {/* Dagsvy — lager ovanpå helskärmskalendern */}
          {fsDay && startDate && (
            <View style={StyleSheet.absoluteFill}>
              <DayWorkoutsModal
                day={fsDay}
                startDate={startDate}
                challengeId={challengeId}
                workouts={workouts}
                strengthWorkouts={strengthWorkouts}
                completedSessions={completedSessions}
                unit={unit}
                onClose={() => setFsDay(null)}
                onSelectWorkout={setFsWorkout}
              />
            </View>
          )}

          {/* Passdetalj — lager ovanpå dagsvyn */}
          {fsWorkout && (
            <View style={StyleSheet.absoluteFill}>
              <CardioSummaryView
                workout={fsWorkout}
                title={fsWorkout.name}
                dateLabel={new Date(fsWorkout.created_at).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                avatarUrl={avatarUrl}
                unit={unit}
                onClose={() => setFsWorkout(null)}
                onDelete={deleteFsWorkout}
              />
            </View>
          )}
        </View>
      </Modal>
    </View>
    </GestureDetector>
  )
}

const s = StyleSheet.create({
  calCard: {
    backgroundColor: CARD, borderRadius: 20,
    padding: 20, gap: 16,
  },
  calHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calNavBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  calMonthBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 8 },
  calMonthLabel: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  // Helskärmsöversikt (Apple Fitness-stil)
  fullScreen: { flex: 1, backgroundColor: '#0E0E10' },
  fullInner:  { flex: 1, paddingTop: 60 },
  fullHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
  },
  fullTitle: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800' },
  yearClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  fullWeekRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  fullWeekLabel: {
    flex: 1, textAlign: 'center',
    color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600',
  },
  fullScroll:     { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48, gap: 28 },
  fullMonth:      { gap: 10 },
  fullMonthTitle: { color: TEXT_PRIMARY, fontSize: 24, fontWeight: '800', paddingLeft: 4 },
  fullGrid:       { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  fullDay: {
    width: `${100 / 7}%` as never,
    alignItems: 'center', gap: 5,
  },
  fullDayNum: {
    minWidth: 26, height: 22, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  fullDayNumToday: { backgroundColor: ORANGE },
  fullDayNumText:  { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  fullRing: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  calWeekRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  calWeekCell:   { width: CAL_SIZE, alignItems: 'center' },
  calWeekLabel:  { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  calGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: CAL_GAP },
  calDay: {
    width: CAL_SIZE, height: CAL_SIZE, borderRadius: CAL_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  calDayPending:     { borderWidth: 2, borderColor: ORANGE },
  calDayTodayRing:   { borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  calDayText:        { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '500' },
  calDayTextPending: { color: '#fff', fontWeight: '800' },

  legend:      { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { color: TEXT_SECONDARY, fontSize: 12 },
})
