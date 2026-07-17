import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { ORANGE, GREEN, RED, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { parseLocalDate } from '@/lib/date'
import type { DaySummary } from '@/services/dailyLog'

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

export function CalendarView({ days, startDate, currentDay, onPressDay, gestureRef }: {
  days: DaySummary[]
  startDate: string | null
  currentDay: number
  onPressDay: (d: DaySummary) => void
  /** Skickas till omgivande pagers waitFor så månadssvepet vinner över flikbytet */
  gestureRef?: React.MutableRefObject<GestureType | undefined>
}) {
  const init  = startDate ? parseLocalDate(startDate) : new Date()
  const [view, setView] = useState(new Date(init.getFullYear(), init.getMonth(), 1))
  const yr    = view.getFullYear()
  const mo    = view.getMonth()
  const cells = buildCalendarCells(yr, mo)
  const today = new Date()

  function changeMonth(dir: number) {
    Haptics.selectionAsync()
    setView(v => new Date(v.getFullYear(), v.getMonth() + dir, 1))
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
        <Text style={s.calMonthLabel}>{MONTHS_SV[mo]} {yr}</Text>
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

      <View style={s.calGrid}>
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
      </View>

      <Legend />
    </View>
    </GestureDetector>
  )
}

const s = StyleSheet.create({
  calCard: {
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER,
    padding: 20, gap: 16,
  },
  calHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calNavBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  calMonthLabel: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
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
