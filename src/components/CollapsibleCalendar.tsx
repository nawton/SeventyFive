import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native'
import Svg, { Circle as SvgCircle } from 'react-native-svg'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, interpolate, runOnJS, Easing,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT_SEMI, CARDIO_BLUE, useThemeStrings, ACCENT } from '@/lib/theme'
import { toLocalDateString } from '@/lib/date'
import { planEndDateStr, type WorkoutSession } from '@/services/workoutSchedule'

const GREEN       = '#3BE862'
const SCREEN_W    = Dimensions.get('window').width
// Kompakta höjder — kalendern ska ta så lite plats som möjligt från passlistan
const ROW_H   = 46    // height of one week row
const HEADER_H = 38   // month title + nav
const LABELS_H = 22   // day-of-week labels
const LEGEND_H = 20   // förklaring av typprickarna (bara i utfällt läge)
const HANDLE_H = 22   // drag handle area
const WEEK_CONTENT_H  = ROW_H                  // 1 row
const MONTH_CONTENT_H = ROW_H * 6              // max 6 rows
const COLLAPSED_H = HEADER_H + LABELS_H + WEEK_CONTENT_H + HANDLE_H
const EXPANDED_H  = HEADER_H + LABELS_H + MONTH_CONTENT_H + LEGEND_H + HANDLE_H

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

// ── Dagcell — memoiserad med primitiva props så att ett dagbyte bara ritar om
//    de två celler som faktiskt ändrats (gamla + nya valet), inte alla ~150 ──

const CalDayCell = memo(function CalDayCell({
  dateMs, dayNum, isToday, isSel, allDone, hasGym, hasCardio, onPressDate,
}: {
  dateMs: number
  dayNum: number
  isToday: boolean
  isSel: boolean
  allDone: boolean
  hasGym: boolean
  hasCardio: boolean
  onPressDate: (ms: number) => void
}) {
  return (
    <TouchableOpacity style={s.cell} onPress={() => onPressDate(dateMs)} activeOpacity={0.7}>
      <View style={s.cellInner}>
        {/* Bara den gröna klart-ringen visas — ingen orange progress-ring */}
        {allDone && (
          <Svg width={36} height={36} style={StyleSheet.absoluteFillObject}>
            <SvgCircle
              cx={18} cy={18} r={15}
              stroke={isSel ? '#fff' : GREEN}
              strokeWidth={2.5}
              fill="none"
            />
          </Svg>
        )}
        <View style={[
          s.circle,
          // Dagens orange ring döljs när dagen är klar — då är den bara grön
          isToday && !isSel && !allDone && s.circleToday,
          isSel && s.circleSel,
        ]}>
          <Text style={[
            s.dateNum,
            isToday && !isSel && s.dateNumToday,
            isSel && s.dateNumSel,
          ]}>
            {dayNum}
          </Text>
        </View>
      </View>
      {/* Typindikatorer (Runna-stil): orange = gym, blå = kondition */}
      {(hasGym || hasCardio) && (
        <View style={s.dotRow}>
          {hasGym    && <View style={[s.dot, { backgroundColor: ACCENT }]} />}
          {hasCardio && <View style={[s.dot, { backgroundColor: CARDIO_BLUE }]} />}
        </View>
      )}
    </TouchableOpacity>
  )
})

// ── Component ────────────────────────────────────────────────────────────────

// React.memo: kalendern gör sessionsfiltrering per cell (42 st) — den ska inte
// ritas om när t.ex. en övning bockas i (checkedByDate är inte ens en prop här)
export const CollapsibleCalendar = memo(function CollapsibleCalendar({
  sessions,
  completedByDate,
  selectedDate,
  onSelectDate,
  raceDate,
}: {
  sessions:         WorkoutSession[]
  completedByDate:  Record<string, Set<string>>
  selectedDate:     Date
  onSelectDate:     (date: Date) => void
  /** Tävlingsdatum — cardio-planen slutar dagen efter loppet */
  raceDate:         string | null
}) {
  const T = useThemeStrings()
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

  // Månadsrutnätet (126 celler) monteras först när användaren börjar öppna
  // kalendern — annars betalar varje dagbyte för celler som inte syns
  const [monthUI, setMonthUI] = useState(false)
  const monthUIRef = useRef(false)
  function mountMonth() {
    if (!monthUIRef.current) {
      monthUIRef.current = true
      setMonthUI(true)
    }
  }

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-15, 15])
    .onBegin(() => {
      startProg.value = progress.value
      runOnJS(mountMonth)()
    })
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

  // Horisontellt svep: äkta karusell — förra/nästa vecka (eller månad) ligger
  // bredvid och följer fingret medan man drar
  const slide = useSharedValue(0)

  function applySwipe(dir: number, open: boolean) {
    if (open) {
      // Månadssvep bläddrar bara vyn — vald dag ändras aldrig här.
      // Kollapsar man utan att välja är man kvar på dagen man var på.
      if (dir > 0) nextMonth()
      else prevMonth()
    } else {
      // Veckosvep: byt kalenderveckan FÖRST (lätt render), ladda den nya
      // dagen strax efter — då krockar inte pager-scrollen med animationen
      const d = new Date(selDate)
      d.setDate(d.getDate() + dir * 7)
      setSelDate(d)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
      setTimeout(() => onSelectDate(d), 120)
    }
  }

  // Nollställ glidningen FÖRST när nya innehållet är på plats i trädet —
  // annars blinkar det gamla till en frame
  useEffect(() => { slide.value = 0 }, [selDate, viewYear, viewMonth])

  function finishSwipe(dir: number, open: boolean) {
    Haptics.selectionAsync()
    // Glid hela vägen till grannsidan; statebytet + effekten ovan centrerar om
    slide.value = withTiming(-dir * SCREEN_W, { duration: 200, easing: Easing.out(Easing.quad) }, finished => {
      if (finished) runOnJS(applySwipe)(dir, open)
    })
  }

  const hSwipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-12, 12])
    .onUpdate(e => {
      // 1:1 med fingret — grannsidan syns direkt
      slide.value = Math.max(-SCREEN_W, Math.min(SCREEN_W, e.translationX))
    })
    .onEnd(e => {
      if (Math.abs(e.translationX) < SCREEN_W * 0.25 && Math.abs(e.velocityX) < 500) {
        slide.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) })
        return
      }
      const dir = e.translationX < 0 ? 1 : -1
      runOnJS(finishSwipe)(dir, isOpen.value)
    })
  const gestures = Gesture.Race(pan, hSwipe)

  // ── Animated styles ───────────────────────────────────────────────────────

  const containerStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [COLLAPSED_H, EXPANDED_H]),
  }))

  const monthGridStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.2, 0.7], [0, 1]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-8, 0]) },
      { translateX: slide.value },
    ],
  }))

  const weekRowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3], [1, 0]),
    transform: [{ translateX: slide.value }],
  }))

  // Förklaringen ska inte glida med i sidled — bara tona in med månadsvyn
  const legendStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.2, 0.7], [0, 1]),
  }))

  // ── Data helpers ─────────────────────────────────────────────────────────

  // Förberäknat index — karusellen renderar ~150 celler, så per-cell-filter
  // över alla sessioner gör kalendern laggig. Byggs om bara när sessions ändras.
  const sessionIndex = useMemo(() => {
    const byWeekday: WorkoutSession[][] = Array.from({ length: 8 }, () => [])
    const onceByDate = new Map<string, WorkoutSession[]>()
    const skipByDate = new Map<string, Set<string>>()
    // Aktivt datumintervall per pass, förberäknat som strängar — karusellen
    // renderar ~150 celler och Date-matte per cell och pass gör den laggig
    const rangeById = new Map<string, { start: string; end: string | null }>()
    for (const sess of sessions) {
      if (sess.weekdays.length > 0) {
        rangeById.set(sess.id, {
          start: toLocalDateString(new Date(sess.created_at)),
          end: sess.session_type === 'cardio' ? planEndDateStr(sess.created_at, raceDate) : null,
        })
      }
    }
    for (const sess of sessions) {
      if (sess.name.startsWith('SKIP:')) {
        // Format: SKIP:YYYY-MM-DD:sessionId
        const parts = sess.name.split(':')
        const date  = parts[1]
        const id    = parts.slice(2).join(':')
        if (!skipByDate.has(date)) skipByDate.set(date, new Set())
        skipByDate.get(date)!.add(id)
        continue
      }
      if (sess.weekdays.length === 0) {
        if (sess.name.startsWith('ONCE:')) {
          const date = sess.name.split(':')[1]
          if (!onceByDate.has(date)) onceByDate.set(date, [])
          onceByDate.get(date)!.push(sess)
        }
        continue
      }
      for (const wd of sess.weekdays) byWeekday[wd]?.push(sess)
    }
    return { byWeekday, onceByDate, skipByDate, rangeById }
  }, [sessions, raceDate])

  function sessionInfo(date: Date) {
    const wd      = toWeekday(date)
    const dateStr = toLocalDateString(date)
    const skips   = sessionIndex.skipByDate.get(dateStr)
    const inRange = (s: WorkoutSession) => {
      const r = sessionIndex.rangeById.get(s.id)
      return !r || (dateStr >= r.start && (r.end === null || dateStr < r.end))
    }
    const daySess = [
      ...sessionIndex.byWeekday[wd].filter(s => !skips?.has(s.id) && inRange(s)),
      ...(sessionIndex.onceByDate.get(dateStr) ?? []),
    ]
    if (daySess.length === 0) return { allDone: false, hasGym: false, hasCardio: false }
    const done      = completedByDate[dateStr] ?? new Set<string>()
    const allDone   = daySess.every(s => done.has(s.id))
    // Typindikatorer under datumet — orange = gym, blå = kondition
    const hasGym    = daySess.some(s => s.session_type !== 'cardio')
    const hasCardio = daySess.some(s => s.session_type === 'cardio')
    return { allDone, hasGym, hasCardio }
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

  // ── Week row dates — tre sidor (förra/nuvarande/nästa) för karusellen ────

  function weekFrom(offsetDays: number): Date[] {
    const start = mondayOf(selDate)
    start.setDate(start.getDate() + offsetDays)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }
  const weekPages = [weekFrom(-7), weekFrom(0), weekFrom(7)]

  const prevYM = viewMonth === 0  ? { y: viewYear - 1, m: 11 } : { y: viewYear, m: viewMonth - 1 }
  const nextYM = viewMonth === 11 ? { y: viewYear + 1, m: 0 }  : { y: viewYear, m: viewMonth + 1 }
  const monthPages = [
    buildMonthGrid(prevYM.y, prevYM.m),
    buildMonthGrid(viewYear, viewMonth),
    buildMonthGrid(nextYM.y, nextYM.m),
  ]

  // ── Day cell rendering ───────────────────────────────────────────────────

  // Stabil callback så CalDayCell:s memo håller mellan renders
  const selectDateRef = useRef(selectDate)
  selectDateRef.current = selectDate
  const onPressDate = useCallback((ms: number) => selectDateRef.current(new Date(ms)), [])

  function renderCell(date: Date | null, key: number) {
    if (!date) return <View key={key} style={s.cell} />
    const info = sessionInfo(date)
    return (
      <CalDayCell
        key={key}
        dateMs={date.getTime()}
        dayNum={date.getDate()}
        isToday={sameDay(date, today)}
        isSel={sameDay(date, selDate)}
        allDone={info.allDone}
        hasGym={info.hasGym}
        hasCardio={info.hasCardio}
        onPressDate={onPressDate}
      />
    )
  }

  return (
    <GestureDetector gesture={gestures}>
    <Animated.View style={[s.wrapper, { backgroundColor: T.BG, borderBottomColor: T.BORDER }, containerStyle]}>

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

      {/* Week row (collapsed view) — karusell: förra/nuvarande/nästa vecka */}
      <Animated.View style={[s.weekRowWrap, weekRowStyle]}>
        {weekPages.map((wk, pi) => (
          <View key={pi} style={s.weekPage}>
            {wk.map((d, i) => renderCell(d, i))}
          </View>
        ))}
      </Animated.View>

      {/* Month grid (expanded view) — karusell: förra/nuvarande/nästa månad.
          Monteras först när kalendern öppnas (126 celler är dyrt i onödan) */}
      <Animated.View style={[s.monthGrid, monthGridStyle]}>
        {monthUI && monthPages.map((grid, pi) => (
          <View key={pi} style={s.monthPage}>
            {grid.map((row, ri) => (
              <View key={ri} style={s.gridRow}>
                {row.map((d, di) => renderCell(d, di))}
              </View>
            ))}
          </View>
        ))}
      </Animated.View>

      {/* Förklaring — vad prickarna betyder (syns i utfällt läge) */}
      <Animated.View style={[s.legend, legendStyle]}>
        <View style={s.legendItem}>
          <View style={[s.dot, { backgroundColor: ACCENT }]} />
          <Text style={s.legendText}>Gym</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.dot, { backgroundColor: CARDIO_BLUE }]} />
          <Text style={s.legendText}>Kondition</Text>
        </View>
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
    borderBottomWidth: 1,
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

  // Karusellerna är tre skärmbredder breda med mittsidan centrerad
  weekRowWrap: {
    position: 'absolute',
    top: HEADER_H + LABELS_H,
    left: -SCREEN_W,
    width: SCREEN_W * 3,
    height: ROW_H,
    flexDirection: 'row',
  },
  weekPage: {
    width: SCREEN_W,
    flexDirection: 'row',
    paddingHorizontal: 8,
  },

  monthGrid: {
    position: 'absolute',
    top: HEADER_H + LABELS_H,
    left: -SCREEN_W,
    width: SCREEN_W * 3,
    flexDirection: 'row',
  },
  monthPage: {
    width: SCREEN_W,
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
    borderColor: ACCENT,
  },
  circleSel: {
    backgroundColor: ACCENT,
  },
  dateNum: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontFamily: NUM_FONT_SEMI,
  },
  dotRow: {
    position: 'absolute',
    bottom: 1,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 1.5,
  },
  dateNumToday: { color: ACCENT, fontWeight: '700' },
  dateNumSel:   { color: '#000', fontWeight: '700' },

  legend: {
    position: 'absolute',
    top: HEADER_H + LABELS_H + MONTH_CONTENT_H,
    left: 0, right: 0,
    height: LEGEND_H,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendText: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '600',
  },

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
