import { useState, useEffect, memo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Svg, { Circle as SvgCircle } from 'react-native-svg'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, interpolate, runOnJS,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { toLocalDateString } from '@/lib/date'
import type { WorkoutSession } from '@/services/workoutSchedule'

const GREEN   = '#4CAF50'
// Kompakta höjder — kalendern ska ta så lite plats som möjligt från passlistan
const ROW_H   = 46    // height of one week row
const HEADER_H = 38   // month title + nav
const LABELS_H = 22   // day-of-week labels
const HANDLE_H = 22   // drag handle area
const WEEK_CONTENT_H  = ROW_H                  // 1 row
const MONTH_CONTENT_H = ROW_H * 6              // max 6 rows
const COLLAPSED_H = HEADER_H + LABELS_H + WEEK_CONTENT_H + HANDLE_H
const EXPANDED_H  = HEADER_H + LABELS_H + MONTH_CONTENT_H + HANDLE_H

const SP = { damping: 28, stiffness: 280, mass: 1 } as const

const MONTH_NAMES = [
  'Januari','Februari','Mars','April','Maj','Juni',
  'Juli','Augusti','September','Oktober','November','December',
]
const DAY_LABELS = ['M','T','O','T','F','L','S']

// ── Date helpers ─────────────────────────────────────────────────────────────

function toWeekday(d: Date): number {
  const day = d.getDay()
  return day === 0 ? 7 : day   // 1=Mon … 7=Sun
}

function sameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
}

function mondayOf(d: Date): Date {
  const out = new Date(d)
  out.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  out.setHours(0, 0, 0, 0)
  return out
}

function buildMonthGrid(year: number, month: number): Array<Array<Date | null>> {
  const first      = new Date(year, month, 1)
  const startPad   = (first.getDay() + 6) % 7  // Mon=0
  const daysInMon  = new Date(year, month + 1, 0).getDate()
  const cells: Array<Date | null> = [
    ...Array<null>(startPad).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => new Date(year, month, i + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const rows: Array<Array<Date | null>> = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  // Pad to always 6 rows so height is constant
  while (rows.length < 6) rows.push(Array(7).fill(null))
  return rows
}

// ── Component ────────────────────────────────────────────────────────────────

// React.memo: kalendern gör sessionsfiltrering per cell (42 st) — den ska inte
// ritas om när t.ex. en övning bockas i (checkedByDate är inte ens en prop här)
export const CollapsibleCalendar = memo(function CollapsibleCalendar({
  sessions,
  completedByDate,
  selectedDate,
  onSelectDate,
}: {
  sessions:         WorkoutSession[]
  completedByDate:  Record<string, Set<string>>
  selectedDate:     Date
  onSelectDate:     (date: Date) => void
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [selDate, setSelDate]     = useState<Date>(selectedDate)
  const [viewYear, setViewYear]   = useState(selectedDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth())

  // Sync internal selDate when pager changes date externally
  useEffect(() => {
    setSelDate(selectedDate)
    setViewYear(selectedDate.getFullYear())
    setViewMonth(selectedDate.getMonth())
  }, [selectedDate])

  const progress  = useSharedValue(0)   // 0 = collapsed, 1 = expanded
  const startProg = useSharedValue(0)
  const isOpen    = useSharedValue(false)

  // ── Gesture ───────────────────────────────────────────────────────────────

  function setOpen(v: boolean) { isOpen.value = v }

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-15, 15])
    .onBegin(() => { startProg.value = progress.value })
    .onUpdate(e => {
      const delta = e.translationY / (MONTH_CONTENT_H - WEEK_CONTENT_H)
      progress.value = Math.min(1, Math.max(0, startProg.value + delta))
    })
    .onEnd(e => {
      if (e.velocityY > 250 || progress.value > 0.4) {
        progress.value = withSpring(1, SP)
        runOnJS(setOpen)(true)
      } else {
        progress.value = withSpring(0, SP)
        runOnJS(setOpen)(false)
      }
    })

  // ── Animated styles ───────────────────────────────────────────────────────

  const containerStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [COLLAPSED_H, EXPANDED_H]),
  }))

  const monthGridStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(progress.value, [0.2, 0.7], [0, 1]),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [-8, 0]) }],
  }))

  const weekRowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3], [1, 0]),
  }))

  // ── Data helpers ─────────────────────────────────────────────────────────

  function sessionInfo(date: Date) {
    const wd      = toWeekday(date)
    const dateStr = toLocalDateString(date)
    const skipPfx = `SKIP:${dateStr}:`
    const skipIds = sessions
      .filter(s => s.name.startsWith(skipPfx))
      .map(s => s.name.slice(skipPfx.length))
    const daySess = sessions.filter(s =>
      !s.name.startsWith('SKIP:') &&
      !skipIds.includes(s.id) &&
      s.weekdays.includes(wd)
    )
    if (daySess.length === 0) return { pct: -1, allDone: false }
    const done      = completedByDate[dateStr] ?? new Set<string>()
    const doneCount = daySess.filter(s => done.has(s.id)).length
    const pct       = doneCount / daySess.length
    const allDone   = doneCount === daySess.length
    return { pct, allDone }
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  function selectDate(date: Date) {
    setSelDate(date)
    onSelectDate(date)
    setViewYear(date.getFullYear())
    setViewMonth(date.getMonth())
    if (isOpen.value) {
      progress.value = withSpring(0, SP)
      setOpen(false)
    }
  }

  // ── Month navigation ──────────────────────────────────────────────────────

  function prevMonth() {
    setViewMonth(m => {
      if (m === 0) { setViewYear(y => y - 1); return 11 }
      return m - 1
    })
  }

  function nextMonth() {
    setViewMonth(m => {
      if (m === 11) { setViewYear(y => y + 1); return 0 }
      return m + 1
    })
  }

  // ── Week row dates ────────────────────────────────────────────────────────

  const weekStart  = mondayOf(selDate)
  const weekDates  = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const monthGrid = buildMonthGrid(viewYear, viewMonth)

  // ── Day cell ─────────────────────────────────────────────────────────────

  function DayCell({ date }: { date: Date | null }) {
    if (!date) return <View style={s.cell} />
    const isTod   = sameDay(date, today)
    const isSel   = sameDay(date, selDate)
    const { pct, allDone } = sessionInfo(date)
    const hasSession = pct >= 0
    const arcColor   = allDone ? GREEN : ORANGE
    const R    = 15
    const CIRC = 2 * Math.PI * R

    return (
      <TouchableOpacity style={s.cell} onPress={() => selectDate(date)} activeOpacity={0.7}>
        <View style={s.cellInner}>
          {hasSession && (
            <Svg width={36} height={36} style={StyleSheet.absoluteFillObject}>
              {/* Track */}
              <SvgCircle
                cx={18} cy={18} r={R}
                stroke={isSel ? 'rgba(255,255,255,0.3)' : arcColor + '28'}
                strokeWidth={2}
                fill="none"
              />
              {/* Progress */}
              {pct > 0 && (
                <SvgCircle
                  cx={18} cy={18} r={R}
                  stroke={isSel ? '#fff' : arcColor}
                  strokeWidth={2.5}
                  fill="none"
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC * (1 - pct)}
                  strokeLinecap="round"
                  rotation={-90}
                  originX={18}
                  originY={18}
                />
              )}
            </Svg>
          )}
          <View style={[
            s.circle,
            isTod && !isSel && s.circleToday,
            isSel && s.circleSel,
          ]}>
            <Text style={[
              s.dateNum,
              isTod && !isSel && s.dateNumToday,
              isSel && s.dateNumSel,
            ]}>
              {date.getDate()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <GestureDetector gesture={pan}>
    <Animated.View style={[s.wrapper, containerStyle]}>

      {/* Month header */}
      <View style={s.monthHeader}>
        <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={18} color={TEXT_SECONDARY} />
        </TouchableOpacity>
        <Text style={s.monthTitle}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-forward" size={18} color={TEXT_SECONDARY} />
        </TouchableOpacity>
      </View>

      {/* Day-of-week labels */}
      <View style={s.labels}>
        {DAY_LABELS.map((l, i) => <Text key={i} style={s.label}>{l}</Text>)}
      </View>

      {/* Week row (collapsed view) */}
      <Animated.View style={[s.weekRowWrap, weekRowStyle]}>
        {weekDates.map((d, i) => <DayCell key={i} date={d} />)}
      </Animated.View>

      {/* Month grid (expanded view) */}
      <Animated.View style={[s.monthGrid, monthGridStyle]}>
        {monthGrid.map((row, ri) => (
          <View key={ri} style={s.gridRow}>
            {row.map((d, di) => <DayCell key={di} date={d} />)}
          </View>
        ))}
      </Animated.View>

      {/* Drag handle — visuell indikator; gesten gäller hela kalendern */}
      <View style={s.handleArea}>
        <View style={s.handle} />
      </View>

    </Animated.View>
    </GestureDetector>
  )
})

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  wrapper: {
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    overflow: 'hidden',
  },

  monthHeader: {
    height: HEADER_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  monthTitle: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },

  labels: {
    height: LABELS_H,
    flexDirection: 'row',
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  label: {
    flex: 1,
    textAlign: 'center',
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '600',
  },

  weekRowWrap: {
    position: 'absolute',
    top: HEADER_H + LABELS_H,
    left: 0, right: 0,
    height: ROW_H,
    flexDirection: 'row',
    paddingHorizontal: 8,
  },

  monthGrid: {
    position: 'absolute',
    top: HEADER_H + LABELS_H,
    left: 0, right: 0,
  },
  gridRow: {
    height: ROW_H,
    flexDirection: 'row',
    paddingHorizontal: 8,
  },

  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellInner: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 34, height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleToday: {
    borderWidth: 1.5,
    borderColor: ORANGE,
  },
  circleSel: {
    backgroundColor: ORANGE,
  },
  dateNum: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '500',
  },
  dateNumToday: { color: ORANGE, fontWeight: '700' },
  dateNumSel:   { color: '#000', fontWeight: '700' },

  handleArea: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: HANDLE_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 36, height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
})
