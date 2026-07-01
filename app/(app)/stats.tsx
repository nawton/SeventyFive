import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import WebView from 'react-native-webview'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '@/lib/supabase'
import { getActiveChallenge, calculateCurrentDay } from '@/services/challenge'
import { getAllDays, type DaySummary } from '@/services/dailyLog'
import Body from 'react-native-body-highlighter'
import { getMusclesForName, type Slug } from '@/lib/muscles'
import { getCardioWorkouts, deleteCardioWorkout, getStrengthWorkouts, type CardioWorkout, type StrengthWorkout } from '@/services/workouts'
import { useFocusEffect } from 'expo-router'
import { ORANGE, GREEN, RED, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

const COLUMNS       = 7
const SCREEN_WIDTH  = Dimensions.get('window').width
const SCREEN_HEIGHT = Dimensions.get('window').height
const SHEET_PARTIAL = SCREEN_HEIGHT * 0.44  // top offset when partial (~56 % height)
const SHEET_SP      = { damping: 26, stiffness: 260, mass: 1 } as const
const GRID_PADDING = 20
const GAP          = 6
const SQUARE_SIZE  = Math.floor((SCREEN_WIDTH - GRID_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS)

const MONTHS_SV = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December']
const WEEKDAY_SHORT = ['MÅN','TIS','ONS','TOR','FRE','LÖR','SÖN']
const CAL_GAP  = 4
const CAL_SIZE = Math.floor((SCREEN_WIDTH - GRID_PADDING * 2 - 40 - CAL_GAP * 6) / 7)

function getChallengeDay(date: Date, startDate: string): number | null {
  const start = new Date(startDate); start.setHours(0,0,0,0)
  const d     = new Date(date);      d.setHours(0,0,0,0)
  const diff  = Math.round((d.getTime() - start.getTime()) / 86400000)
  return diff >= 0 && diff < 75 ? diff + 1 : null
}

function buildCalendarCells(year: number, month: number): Date[] {
  const firstDay   = new Date(year, month, 1)
  const offset     = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays   = new Date(year, month, 0).getDate()
  const cells: Date[] = []
  for (let i = offset - 1; i >= 0; i--)      cells.push(new Date(year, month - 1, prevDays - i))
  for (let d = 1; d <= daysInMonth; d++)       cells.push(new Date(year, month, d))
  const rem = (7 - (cells.length % 7)) % 7
  for (let d = 1; d <= rem; d++)               cells.push(new Date(year, month + 1, d))
  return cells
}

function CalendarView({ days, startDate, currentDay, onPressDay }: {
  days: DaySummary[]; startDate: string | null
  currentDay: number; onPressDay: (d: DaySummary) => void
}) {
  const init = startDate ? new Date(startDate) : new Date()
  const [view, setView] = useState(new Date(init.getFullYear(), init.getMonth(), 1))
  const yr = view.getFullYear(); const mo = view.getMonth()
  const cells = buildCalendarCells(yr, mo)
  const today = new Date()

  return (
    <View style={styles.calCard}>
      {/* Month navigation */}
      <View style={styles.calHeader}>
        <TouchableOpacity style={styles.calNavBtn} onPress={() => setView(new Date(yr, mo - 1, 1))} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.calMonthLabel}>{MONTHS_SV[mo]} {yr}</Text>
        <TouchableOpacity style={styles.calNavBtn} onPress={() => setView(new Date(yr, mo + 1, 1))} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={20} color={TEXT_PRIMARY} />
        </TouchableOpacity>
      </View>

      {/* Weekday headers */}
      <View style={styles.calWeekRow}>
        {WEEKDAY_SHORT.map(d => (
          <View key={d} style={styles.calWeekCell}>
            <Text style={styles.calWeekLabel}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <View style={styles.calGrid}>
        {cells.map((date, i) => {
          const isCurrentMonth = date.getMonth() === mo
          const challengeDay   = startDate ? getChallengeDay(date, startDate) : null
          const summary        = challengeDay ? days[challengeDay - 1] : null
          const isToday        = sameDay(date, today)
          const isChallengeDay = !!summary

          const isPending = summary?.status === 'pending'
          const isFuture  = summary?.status === 'future'

          // Pending: ring only, future: subtle fill, completed/failed: status color
          const bgColor = isFuture
            ? 'rgba(255,255,255,0.07)'
            : summary && !isPending
              ? DAY_COLORS[summary.status]
              : 'transparent'

          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.calDay,
                { backgroundColor: bgColor },
                isPending && styles.calDayPending,
                isToday && !isPending && styles.calDayTodayRing,
              ]}
              onPress={() => summary && summary.status !== 'future' ? onPressDay(summary) : undefined}
              activeOpacity={summary && summary.status !== 'future' ? 0.75 : 1}
            >
              <Text style={[
                styles.calDayText,
                summary && !isFuture && !isPending && { fontWeight: '700' },
                isPending && styles.calDayTextPending,
              ]}>
                {date.getDate()}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <Legend />
    </View>
  )
}

const DAY_COLORS: Record<DaySummary['status'], string> = {
  completed: GREEN,
  failed:    RED,
  pending:   ORANGE,
  future:    'rgba(255,255,255,0.08)',
}

const EXERCISE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  running:  'fitness-outline',
  cycling:  'bicycle-outline',
  interval: 'flash-outline',
  walking:  'walk-outline',
}

// ─── Glass button ─────────────────────────────────────────────────────────────

function GlassBtn({
  icon, size = 20, color = TEXT_PRIMARY, style, onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  size?: number; color?: string; style?: object; onPress?: () => void
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={style}>
      <BlurView intensity={24} tint="dark" style={styles.glassBtn}>
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.glassBtnBorder} />
        <Ionicons name={icon} size={size} color={color} />
      </BlurView>
    </TouchableOpacity>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtPace(secsPerKm: number): string {
  const m = Math.floor(secsPerKm / 60)
  const s = Math.floor(secsPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - y.getTime()) / 86400000) + 1) / 7)
}

function weeklyKmData(workouts: CardioWorkout[]): { label: string; km: number }[] {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const ref = new Date(now)
    ref.setDate(now.getDate() - (5 - i) * 7)
    const wn = isoWeek(ref)
    const yr = ref.getFullYear()
    const km = workouts
      .filter(w => { const d = new Date(w.created_at); return isoWeek(d) === wn && d.getFullYear() === yr })
      .reduce((s, w) => s + w.data.distance_km, 0)
    return { label: `V${wn}`, km }
  })
}

function dayDate(startDate: string, dayNumber: number): Date {
  const d = new Date(startDate)
  d.setDate(d.getDate() + dayNumber - 1)
  return d
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function calculateStreak(days: DaySummary[], currentDay: number): number {
  let streak = 0
  for (let i = currentDay - 1; i >= 1; i--) {
    const day = days[i - 1]
    if (day?.status === 'completed') streak++
    else break
  }
  return streak
}


function buildRouteHtml(route: Array<[number, number]>): string {
  const coords = JSON.stringify(route)
  const start  = JSON.stringify(route[0])
  const end    = JSON.stringify(route[route.length - 1])
  return `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate-src.js"></script>
    <style>*{margin:0;padding:0}html,body,#map{width:100%;height:100%}.leaflet-control-attribution{display:none}</style>
  </head><body><div id="map"></div><script>
    var map=L.map('map',{zoomControl:false,attributionControl:false,rotate:true,touchRotate:true});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd'}).addTo(map);
    var line=L.polyline(${coords},{color:'#FF8F00',weight:4,lineCap:'round',lineJoin:'round'}).addTo(map);
    var si=L.divIcon({html:'<div style="width:12px;height:12px;background:#22C55E;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>',iconSize:[12,12],iconAnchor:[6,6],className:''});
    var ei=L.divIcon({html:'<div style="width:12px;height:12px;background:#FF8F00;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>',iconSize:[12,12],iconAnchor:[6,6],className:''});
    L.marker(${start},{icon:si}).addTo(map);
    L.marker(${end},{icon:ei}).addTo(map);
    map.fitBounds(line.getBounds(),{padding:[24,24]});
  </script></body></html>`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: {
  label: string; value: string | number
  icon: React.ComponentProps<typeof Ionicons>['name']; color: string
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function DaySquare({ day, currentDay, onPress }: {
  day: DaySummary; currentDay: number; onPress?: () => void
}) {
  const isToday = day.dayNumber === currentDay
  const color   = DAY_COLORS[day.status]

  const inner = (
    <View style={[styles.square, { backgroundColor: color }, isToday && styles.squareToday]}>
      <Text style={[styles.squareText, day.status === 'future' && styles.squareTextFuture]}>
        {day.dayNumber}
      </Text>
    </View>
  )

  return day.status !== 'future' && onPress
    ? <TouchableOpacity onPress={onPress} activeOpacity={0.75}>{inner}</TouchableOpacity>
    : inner
}

function Legend() {
  const items = [
    { color: GREEN,                    label: 'Klar' },
    { color: RED,                      label: 'Missad' },
    { color: ORANGE,                   label: 'Pågående' },
    { color: 'rgba(255,255,255,0.18)', label: 'Framtid' },
  ]
  return (
    <View style={styles.legend}>
      {items.map(item => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text style={styles.legendLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  )
}

function WeeklyGraph({ workouts }: { workouts: CardioWorkout[] }) {
  const data    = weeklyKmData(workouts)
  const maxKm   = Math.max(...data.map(d => d.km), 1)
  const CHART_H = 80
  const CHART_W = SCREEN_WIDTH - GRID_PADDING * 2 - 40

  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * CHART_W,
    y: CHART_H - (d.km / maxKm) * CHART_H,
    ...d,
  }))

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Km per vecka</Text>
      <View style={{ height: CHART_H + 28 }}>
        {pts.slice(0, -1).map((p, i) => {
          const q   = pts[i + 1]
          const dx  = q.x - p.x
          const dy  = q.y - p.y
          const len = Math.sqrt(dx * dx + dy * dy)
          const deg = Math.atan2(dy, dx) * (180 / Math.PI)
          return (
            <View key={`l${i}`} style={{
              position: 'absolute',
              left: (p.x + q.x) / 2 - len / 2,
              top:  (p.y + q.y) / 2 - 1.5,
              width: len, height: 3, borderRadius: 2,
              backgroundColor: ORANGE,
              transform: [{ rotate: `${deg}deg` }],
            }} />
          )
        })}
        {pts.map((p, i) => p.km > 0 && (
          <Text key={`km${i}`} style={{
            position: 'absolute', left: p.x - 20, top: p.y - 18,
            width: 40, textAlign: 'center',
            color: TEXT_SECONDARY, fontSize: 9, fontWeight: '600',
          }}>
            {p.km.toFixed(1)}
          </Text>
        ))}
        {pts.map((p, i) => (
          <View key={`d${i}`} style={{
            position: 'absolute', left: p.x - 5, top: p.y - 5,
            width: 10, height: 10, borderRadius: 5,
            backgroundColor: p.km > 0 ? ORANGE : 'rgba(255,255,255,0.15)',
            borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
          }} />
        ))}
        {pts.map((p, i) => (
          <Text key={`w${i}`} style={{
            position: 'absolute', left: p.x - 15, top: CHART_H + 10,
            width: 30, textAlign: 'center',
            color: TEXT_SECONDARY, fontSize: 10, fontWeight: '500',
          }}>
            {data[i].label}
          </Text>
        ))}
      </View>
    </View>
  )
}

function WorkoutRow({ workout, last, onPress }: {
  workout: CardioWorkout; last: boolean; onPress: () => void
}) {
  const d    = workout.data
  const pace = d.distance_km > 0.1
    ? fmtPace(d.duration_seconds / d.distance_km) + ' /km' : null
  const date = new Date(workout.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })

  return (
    <TouchableOpacity
      style={[styles.workoutRow, !last && styles.workoutRowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.workoutRowIcon}>
        <Ionicons name={EXERCISE_ICONS[d.type] ?? 'fitness-outline'} size={18} color={ORANGE} />
      </View>
      <View style={styles.workoutRowBody}>
        <View style={styles.workoutRowTop}>
          <Text style={styles.workoutRowName}>{workout.name}</Text>
          <Text style={styles.workoutRowDate}>{date}</Text>
        </View>
        <View style={styles.workoutRowMeta}>
          <Text style={styles.workoutRowStat}>{d.distance_km.toFixed(2)} km</Text>
          <Text style={styles.workoutRowDot}>·</Text>
          <Text style={styles.workoutRowStat}>{fmtTime(d.duration_seconds)}</Text>
          {pace && (
            <>
              <Text style={styles.workoutRowDot}>·</Text>
              <Text style={[styles.workoutRowStat, { color: ORANGE }]}>{pace}</Text>
            </>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" style={{ alignSelf: 'center' }} />
    </TouchableOpacity>
  )
}

// ─── Day workouts modal ───────────────────────────────────────────────────────

function DayWorkoutsModal({ day, startDate, workouts, strengthWorkouts, onClose, onSelectWorkout }: {
  day: DaySummary; startDate: string
  workouts: CardioWorkout[]; strengthWorkouts: StrengthWorkout[]
  onClose: () => void; onSelectWorkout: (w: CardioWorkout) => void
}) {
  const insets = useSafeAreaInsets()
  // Min top = safe area so sheet never hides behind Dynamic Island / notch
  const FULL_TOP = insets.top + 8

  // 0 = partial, 1 = fullscreen
  const snapState    = useSharedValue(0)
  const sheetTop     = useSharedValue(SCREEN_HEIGHT)
  const backdropAnim = useSharedValue(0)

  useEffect(() => {
    sheetTop.value     = withSpring(SHEET_PARTIAL, SHEET_SP)
    backdropAnim.value = withTiming(1, { duration: 260 })
  }, [])

  function dismiss() {
    sheetTop.value     = withTiming(SCREEN_HEIGHT, { duration: 300 }, () => runOnJS(onClose)())
    backdropAnim.value = withTiming(0, { duration: 250 })
  }

  const panGesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate(e => {
      const base = snapState.value === 1 ? FULL_TOP : SHEET_PARTIAL
      sheetTop.value = Math.max(FULL_TOP, Math.min(SCREEN_HEIGHT, base + e.translationY))
      // Backdrop only fades when below partial (closing direction)
      const belowPartial = Math.max(0, sheetTop.value - SHEET_PARTIAL)
      backdropAnim.value = Math.max(0, 1 - belowPartial / (SCREEN_HEIGHT - SHEET_PARTIAL))
    })
    .onEnd(e => {
      const base   = snapState.value === 1 ? FULL_TOP : SHEET_PARTIAL
      const endPos = base + e.translationY

      if (e.velocityY < -600 || endPos < SHEET_PARTIAL * 0.45) {
        // Snap to fullscreen
        sheetTop.value     = withSpring(FULL_TOP, SHEET_SP)
        backdropAnim.value = withTiming(1, { duration: 200 })
        snapState.value    = 1
      } else if (snapState.value === 0 && (e.velocityY > 600 || endPos > SHEET_PARTIAL + 100)) {
        // Dismiss from partial
        sheetTop.value     = withTiming(SCREEN_HEIGHT, { duration: 280 }, () => runOnJS(onClose)())
        backdropAnim.value = withTiming(0, { duration: 230 })
      } else if (snapState.value === 1 && (e.velocityY > 400 || endPos > SHEET_PARTIAL * 0.55)) {
        // Collapse from fullscreen → partial
        sheetTop.value     = withSpring(SHEET_PARTIAL, SHEET_SP)
        backdropAnim.value = withTiming(1, { duration: 200 })
        snapState.value    = 0
      } else {
        // Snap back to current state
        sheetTop.value     = withSpring(base, SHEET_SP)
        backdropAnim.value = withTiming(1, { duration: 200 })
      }
    })

  const sheetStyle    = useAnimatedStyle(() => ({ top: sheetTop.value }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropAnim.value }))

  const date    = dayDate(startDate, day.dayNumber)
  const dateIso = date.toISOString().split('T')[0]
  const dateStr = date.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })

  const dayCardio   = workouts.filter(w => sameDay(new Date(w.created_at), date))
  const dayStrength = strengthWorkouts.filter(w => {
    const wd = w.data.workout_date
    return wd ? wd === dateIso : sameDay(new Date(w.created_at), date)
  })
  const hasAny = dayCardio.length > 0 || dayStrength.length > 0

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }, backdropStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={dismiss} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.dayModalSheet, sheetStyle]}>
        {/* Drag handle – only this area captures vertical gestures */}
        <GestureDetector gesture={panGesture}>
          <View style={styles.dayModalDragArea}>
            <View style={styles.dayModalHandle} />
            <Text style={styles.dayModalTitle} numberOfLines={1}>{dateStr}</Text>
            <Text style={styles.dayModalSub}>Dag {day.dayNumber}</Text>
          </View>
        </GestureDetector>

        <ScrollView
          contentContainerStyle={styles.dayModalScroll}
          showsVerticalScrollIndicator={false}
        >
          {!hasAny ? (
            <View style={styles.dayModalEmpty}>
              <Ionicons name="fitness-outline" size={28} color="rgba(255,255,255,0.2)" />
              <Text style={styles.dayModalEmptyText}>Inga träningar sparade</Text>
            </View>
          ) : (
            <>
              {/* Styrka */}
              {dayStrength.length > 0 && (
                <>
                  {dayCardio.length > 0 && (
                    <Text style={styles.dayModalSection}>Styrka</Text>
                  )}
                  {dayStrength.map((w, i) => {
                    const totalReps = w.data.sets.reduce((s, r) => s + r.reps, 0)
                    const last = i === dayStrength.length - 1 && dayCardio.length === 0
                    return (
                      <View
                        key={w.id}
                        style={[styles.dayModalItem, !last && styles.dayModalItemBorder]}
                      >
                        <View style={styles.workoutRowIcon}>
                          <Ionicons name="barbell-outline" size={18} color={ORANGE} />
                        </View>
                        <View style={styles.workoutRowBody}>
                          <Text style={styles.workoutRowName}>{w.name}</Text>
                          <View style={styles.workoutRowMeta}>
                            <Text style={styles.workoutRowStat}>{w.data.sets.length} set</Text>
                            {totalReps > 0 && (
                              <>
                                <Text style={styles.workoutRowDot}>·</Text>
                                <Text style={styles.workoutRowStat}>{totalReps} reps</Text>
                              </>
                            )}
                          </View>
                        </View>
                      </View>
                    )
                  })}
                </>
              )}

              {/* Cardio */}
              {dayCardio.length > 0 && (
                <>
                  {dayStrength.length > 0 && (
                    <Text style={[styles.dayModalSection, { marginTop: 12 }]}>Cardio</Text>
                  )}
                  {dayCardio.map((w, i) => (
                    <TouchableOpacity
                      key={w.id}
                      style={[styles.dayModalItem, i < dayCardio.length - 1 && styles.dayModalItemBorder]}
                      onPress={() => { dismiss(); setTimeout(() => onSelectWorkout(w), 300) }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.workoutRowIcon}>
                        <Ionicons name={EXERCISE_ICONS[w.data.type] ?? 'fitness-outline'} size={18} color={ORANGE} />
                      </View>
                      <View style={styles.workoutRowBody}>
                        <Text style={styles.workoutRowName}>{w.name}</Text>
                        <View style={styles.workoutRowMeta}>
                          <Text style={styles.workoutRowStat}>{w.data.distance_km.toFixed(2)} km</Text>
                          <Text style={styles.workoutRowDot}>·</Text>
                          <Text style={styles.workoutRowStat}>{fmtTime(w.data.duration_seconds)}</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" style={{ alignSelf: 'center' }} />
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  )
}

// ─── Workout detail ───────────────────────────────────────────────────────────

function WorkoutDetail({ workout, allWorkouts, onClose, onDeleted }: {
  workout: CardioWorkout; allWorkouts: CardioWorkout[]
  onClose: () => void; onDeleted: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [mapFullscreen, setMapFullscreen] = useState(false)
  const insets = useSafeAreaInsets()
  const d = workout.data

  const date    = new Date(workout.created_at)
  const dateStr = date.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })

  const paceSecPerKm = d.distance_km > 0.1 ? d.duration_seconds / d.distance_km : 0
  const speedKmH     = d.duration_seconds > 0 ? (d.distance_km / d.duration_seconds) * 3600 : 0

  const others        = allWorkouts.filter(w => w.id !== workout.id)
  const bestDistOther = others.length > 0 ? Math.max(...others.map(w => w.data.distance_km)) : 0
  const bestPaceOther = others.length > 0
    ? Math.min(...others.filter(w => w.data.distance_km > 0.1).map(w => w.data.duration_seconds / w.data.distance_km), Infinity)
    : Infinity
  const isPRDist = d.distance_km > 0.1 && d.distance_km > bestDistOther && others.length > 0
  const isPRPace = paceSecPerKm > 0 && paceSecPerKm < bestPaceOther && others.length > 0

  const stats = [
    { label: 'Distans',   value: d.distance_km.toFixed(2), unit: 'km',    icon: 'map-outline' as const,         color: ORANGE },
    { label: 'Tid',       value: fmtTime(d.duration_seconds), unit: '',   icon: 'time-outline' as const,        color: '#4A90D9' },
    { label: 'Tempo',     value: paceSecPerKm > 0 ? fmtPace(paceSecPerKm) : '--:--', unit: 'min/km', icon: 'stopwatch-outline' as const, color: GREEN },
    { label: 'Hastighet', value: speedKmH.toFixed(1), unit: 'km/h',       icon: 'speedometer-outline' as const, color: '#7C5CBF' },
    { label: 'Kalorier',  value: String(d.calories), unit: 'kcal',         icon: 'flame-outline' as const,       color: '#FF6B35' },
  ]

  function confirmDelete() {
    Alert.alert('Radera träning', 'Det här går inte att ångra.', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Radera', style: 'destructive',
        onPress: async () => {
          setDeleting(true)
          await deleteCardioWorkout(workout.id)
          onDeleted(workout.id)
          onClose()
        },
      },
    ])
  }

  return (
    <View style={styles.detailScreen}>
      {/* Header */}
      <SafeAreaView edges={['top']}>
        <View style={styles.detailHeader}>
          <GlassBtn icon="close" onPress={onClose} />
          <Text style={styles.detailHeaderTitle}>Träningsdetaljer</Text>
          <GlassBtn icon="trash-outline" color={RED} onPress={confirmDelete} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>

        {/* PR badges */}
        {(isPRDist || isPRPace) && (
          <View style={styles.prRow}>
            {isPRDist && (
              <View style={styles.prBadge}>
                <Text style={styles.prBadgeText}>🏆 Distansrekord</Text>
              </View>
            )}
            {isPRPace && (
              <View style={styles.prBadge}>
                <Text style={styles.prBadgeText}>⚡ Temporekord</Text>
              </View>
            )}
          </View>
        )}

        {/* Hero */}
        <View style={styles.detailHero}>
          <View style={styles.detailHeroIcon}>
            <Ionicons name={EXERCISE_ICONS[d.type] ?? 'fitness-outline'} size={36} color="#fff" />
          </View>
          <Text style={styles.detailName}>{workout.name}</Text>
          <Text style={styles.detailDate}>{dateStr}</Text>
          <Text style={styles.detailTime}>{timeStr}</Text>
        </View>

        {/* Route map */}
        {d.route && d.route.length > 1 && (
          <View style={styles.detailMapWrap}>
            <WebView
              source={{ html: buildRouteHtml(d.route) }}
              style={styles.detailMap}
              scrollEnabled={false}
              javaScriptEnabled
              originWhitelist={['*']}
            />
            <View style={styles.mapExpandBtnWrap}>
              <GlassBtn icon="expand-outline" size={18} onPress={() => setMapFullscreen(true)} />
            </View>
          </View>
        )}

        {/* Stat grid */}
        <View style={styles.detailGrid}>
          {stats.map(s => (
            <View key={s.label} style={styles.detailGridCell}>
              <View style={[styles.detailGridIcon, { backgroundColor: s.color + '22' }]}>
                <Ionicons name={s.icon} size={18} color={s.color} />
              </View>
              <Text style={[styles.detailGridValue, { color: s.color }]}>
                {s.value}
                {s.unit ? <Text style={styles.detailGridUnit}> {s.unit}</Text> : null}
              </Text>
              <Text style={styles.detailGridLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* Fullscreen map modal */}
      {d.route && d.route.length > 1 && (
        <Modal visible={mapFullscreen} animationType="fade" statusBarTranslucent>
          <View style={{ flex: 1 }}>
            <WebView
              source={{ html: buildRouteHtml(d.route) }}
              style={{ flex: 1 }}
              scrollEnabled={false}
              javaScriptEnabled
              originWhitelist={['*']}
            />
            <View style={[styles.mapFsCloseWrap, { top: insets.top + 8, right: 16 }]}>
              <GlassBtn icon="close" onPress={() => setMapFullscreen(false)} />
            </View>
          </View>
        </Modal>
      )}
    </View>
  )
}

type StatsTab = 'overview' | 'cardio' | 'styrka'

const TABS: Array<{ key: StatsTab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'overview', label: 'Översikt', icon: 'grid-outline' },
  { key: 'cardio',   label: 'Cardio',   icon: 'walk-outline' },
  { key: 'styrka',   label: 'Styrka',   icon: 'barbell-outline' },
]

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const [days, setDays]                       = useState<DaySummary[]>([])
  const [currentDay, setCurrentDay]           = useState(1)
  const [startDate, setStartDate]             = useState<string | null>(null)
  const [levelName, setLevelName]             = useState('')
  const [workouts, setWorkouts]               = useState<CardioWorkout[]>([])
  const [strengthWorkouts, setStrengthWorkouts] = useState<StrengthWorkout[]>([])
  const [bodyView, setBodyView]               = useState<'front' | 'back'>('front')
  const [selectedWorkout, setSelectedWorkout] = useState<CardioWorkout | null>(null)
  const [selectedDay, setSelectedDay]         = useState<DaySummary | null>(null)
  const [activeTab, setActiveTab]             = useState<StatsTab>('overview')
  const [loading, setLoading]                 = useState(true)

  useFocusEffect(useCallback(() => { loadStats() }, []))

  async function loadStats() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const [challenge, cardioWorkouts, strengthWos] = await Promise.all([
        getActiveChallenge(session.user.id),
        getCardioWorkouts(session.user.id),
        getStrengthWorkouts(session.user.id),
      ])
      setWorkouts(cardioWorkouts)
      setStrengthWorkouts(strengthWos)
      if (!challenge) return
      setStartDate(challenge.start_date)
      const day = calculateCurrentDay(challenge.start_date)
      setCurrentDay(day)
      setLevelName(challenge.challenge_levels?.display_name ?? '')
      const allDays = await getAllDays(challenge.id, day)
      setDays(allDays)
    } finally {
      setLoading(false)
    }
  }

  const muscleFreq = new Map<Slug, number>()
  for (const w of strengthWorkouts) {
    getMusclesForName(w.name).forEach(slug => {
      muscleFreq.set(slug, (muscleFreq.get(slug) || 0) + 1)
    })
  }
  const muscleData = Array.from(muscleFreq.entries()).map(([slug, count]) => ({
    slug,
    intensity: Math.min(count, 2) as 1 | 2,
  }))

  const completedDays = days.filter(d => d.status === 'completed').length
  const streak        = calculateStreak(days, currentDay)
  const totalKm       = workouts.reduce((s, w) => s + w.data.distance_km, 0)
  const totalCals     = workouts.reduce((s, w) => s + w.data.calories, 0)
  const bestPaceSec   = workouts
    .filter(w => w.data.distance_km > 0.1)
    .map(w => w.data.duration_seconds / w.data.distance_km)
    .reduce((best, p) => (p < best ? p : best), Infinity)
  const bestPace = bestPaceSec === Infinity ? '--:--' : fmtPace(bestPaceSec)

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: BG }]}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Framsteg</Text>
          <Text style={styles.subtitle}>{levelName}</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.key ? '#000' : TEXT_SECONDARY}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── ÖVERSIKT ── */}
        {activeTab === 'overview' && (
          <>
            <View style={styles.statsRow}>
              <StatCard label="Dag"     value={`${currentDay}/75`} icon="calendar-outline"        color={ORANGE} />
              <StatCard label="Klarade" value={completedDays}       icon="checkmark-circle-outline" color={GREEN} />
              <StatCard label="Streak"  value={`${streak}`}         icon="flame-outline"            color="#FF6B35" />
            </View>

            <CalendarView
              days={days}
              startDate={startDate}
              currentDay={currentDay}
              onPressDay={setSelectedDay}
            />

            <View style={styles.card}>
              <View style={styles.progressHeader}>
                <Text style={styles.cardTitle}>Total framgång</Text>
                <Text style={styles.progressPercent}>
                  {currentDay > 1 ? Math.round((completedDays / (currentDay - 1)) * 100) : 0}%
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${(completedDays / 75) * 100}%` }]} />
              </View>
              <Text style={styles.progressCaption}>{completedDays} av 75 dagar klarade</Text>
            </View>
          </>
        )}

        {/* ── CARDIO ── */}
        {activeTab === 'cardio' && (
          <>
            <View style={styles.workoutStatsRow}>
              {[
                { icon: 'map-outline' as const,      value: totalKm.toFixed(1),               label: 'km totalt',   color: ORANGE },
                { icon: 'flash-outline' as const,     value: totalCals.toLocaleString('sv-SE'), label: 'kcal',        color: '#7C5CBF' },
                { icon: 'stopwatch-outline' as const, value: bestPace,                          label: 'bästa tempo', color: GREEN },
              ].map(s => (
                <View key={s.label} style={styles.workoutStatCard}>
                  <Ionicons name={s.icon} size={18} color={s.color} />
                  <Text style={[styles.workoutStatValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.workoutStatLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            {workouts.length > 0 ? (
              <>
                <WeeklyGraph workouts={workouts} />
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Senaste träningar</Text>
                  <View>
                    {workouts.slice(0, 10).map((w, i) => (
                      <WorkoutRow
                        key={w.id}
                        workout={w}
                        last={i === Math.min(workouts.length, 10) - 1}
                        onPress={() => setSelectedWorkout(w)}
                      />
                    ))}
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.emptyWorkouts}>
                <Ionicons name="walk-outline" size={40} color="rgba(255,255,255,0.12)" />
                <Text style={styles.emptyWorkoutsText}>Inga cardio-pass sparade ännu</Text>
              </View>
            )}
          </>
        )}

        {/* ── STYRKA ── */}
        {activeTab === 'styrka' && (
          <>
            <View style={styles.workoutStatsRow}>
              <View style={styles.workoutStatCard}>
                <Ionicons name="barbell-outline" size={18} color={ORANGE} />
                <Text style={[styles.workoutStatValue, { color: ORANGE }]}>{strengthWorkouts.length}</Text>
                <Text style={styles.workoutStatLabel}>pass totalt</Text>
              </View>
              <View style={styles.workoutStatCard}>
                <Ionicons name="trophy-outline" size={18} color={GREEN} />
                <Text style={[styles.workoutStatValue, { color: GREEN }]}>
                  {strengthWorkouts.length > 0
                    ? Array.from(new Set(strengthWorkouts.map(w => w.name))).length
                    : 0}
                </Text>
                <Text style={styles.workoutStatLabel}>unika övningar</Text>
              </View>
              <View style={styles.workoutStatCard}>
                <Ionicons name="body-outline" size={18} color="#7C5CBF" />
                <Text style={[styles.workoutStatValue, { color: '#7C5CBF' }]}>{muscleFreq.size}</Text>
                <Text style={styles.workoutStatLabel}>muskelgrupper</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.muscleCardHeader}>
                <Text style={styles.cardTitle}>Tränade muskler</Text>
                <View style={styles.bodyToggle}>
                  {(['front', 'back'] as const).map(side => (
                    <TouchableOpacity
                      key={side}
                      style={[styles.bodyToggleBtn, bodyView === side && styles.bodyToggleBtnActive]}
                      onPress={() => setBodyView(side)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.bodyToggleText, bodyView === side && styles.bodyToggleTextActive]}>
                        {side === 'front' ? 'Fram' : 'Bak'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.bodyWrap}>
                <Body
                  data={muscleData}
                  side={bodyView}
                  gender="male"
                  scale={1.6}
                  colors={[ORANGE + 'AA', ORANGE]}
                  defaultFill="#2A2A2C"
                  border="rgba(255,255,255,0.10)"
                />
              </View>

              {strengthWorkouts.length === 0 && (
                <Text style={styles.muscleEmpty}>
                  Logga styrketräning för att se vilka muskler du tränat
                </Text>
              )}
            </View>

            {strengthWorkouts.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Senaste pass</Text>
                {strengthWorkouts.slice(0, 8).map((w, i) => {
                  const sets = w.data.sets.length
                  const totalReps = w.data.sets.reduce((s, r) => s + r.reps, 0)
                  const date = new Date(w.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
                  const last = i === Math.min(strengthWorkouts.length, 8) - 1
                  return (
                    <View key={w.id} style={[styles.workoutRow, !last && styles.workoutRowBorder]}>
                      <View style={styles.workoutRowIcon}>
                        <Ionicons name="barbell-outline" size={18} color={ORANGE} />
                      </View>
                      <View style={styles.workoutRowBody}>
                        <View style={styles.workoutRowTop}>
                          <Text style={styles.workoutRowName}>{w.name}</Text>
                          <Text style={styles.workoutRowDate}>{date}</Text>
                        </View>
                        <View style={styles.workoutRowMeta}>
                          <Text style={styles.workoutRowStat}>{sets} set</Text>
                          <Text style={styles.workoutRowDot}>·</Text>
                          <Text style={styles.workoutRowStat}>{totalReps} reps</Text>
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
          </>
        )}

      </ScrollView>

      {/* Day workouts modal */}
      <Modal visible={!!selectedDay} animationType="none" transparent onRequestClose={() => setSelectedDay(null)}>
        {selectedDay && startDate && (
          <DayWorkoutsModal
            day={selectedDay} startDate={startDate}
            workouts={workouts} strengthWorkouts={strengthWorkouts}
            onClose={() => setSelectedDay(null)} onSelectWorkout={setSelectedWorkout}
          />
        )}
      </Modal>

      {/* Workout detail modal */}
      <Modal visible={!!selectedWorkout} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedWorkout(null)}>
        {selectedWorkout && (
          <WorkoutDetail
            workout={selectedWorkout} allWorkouts={workouts}
            onClose={() => setSelectedWorkout(null)}
            onDeleted={id => setWorkouts(prev => prev.filter(w => w.id !== id))}
          />
        )}
      </Modal>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:   { paddingHorizontal: GRID_PADDING, paddingTop: 16, paddingBottom: 40, gap: 20 },
  header:   { paddingHorizontal: GRID_PADDING, paddingTop: 16, paddingBottom: 12 },
  title:    { color: TEXT_PRIMARY, fontSize: 28, fontWeight: '700' },
  subtitle: { color: TEXT_SECONDARY, fontSize: 14 },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: GRID_PADDING,
    marginBottom: 4,
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: ORANGE,
  },
  tabText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#000',
    fontWeight: '700',
  },

  // Glass button
  glassBtn: {
    width: 36, height: 36, borderRadius: 18,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  glassBtnBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },

  // Stats row
  statsRow:    { flexDirection: 'row', gap: 10 },
  statCard:    { flex: 1, backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 14, alignItems: 'center', gap: 6 },
  statIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue:   { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800' },
  statLabel:   { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '500' },

  // Card
  card:      { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 20, gap: 16 },
  cardTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },

  legend:      { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { color: TEXT_SECONDARY, fontSize: 12 },

  // Calendar
  calCard: {
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER,
    padding: 20, gap: 16,
  },
  calHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  calNavBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  calMonthLabel: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  calWeekRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  calWeekCell: { width: CAL_SIZE, alignItems: 'center' },
  calWeekLabel:{ color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  calGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: CAL_GAP },
  calDay: {
    width: CAL_SIZE, height: CAL_SIZE, borderRadius: CAL_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  calDayPending: {
    borderWidth: 2, borderColor: ORANGE,
  },
  calDayTodayRing: {
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  calDayText:        { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '500' },
  calDayTextOther:   { color: 'rgba(255,255,255,0.2)' },
  calDayTextPending: { color: '#fff', fontWeight: '800' },

  grid:             { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  square:           { width: SQUARE_SIZE, height: SQUARE_SIZE, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  squareToday:      { borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },
  squareText:       { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  squareTextFuture: { color: 'rgba(255,255,255,0.3)' },

  progressHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressPercent: { color: ORANGE, fontSize: 16, fontWeight: '700' },
  progressTrack:   { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  progressFill:    { height: '100%', backgroundColor: GREEN, borderRadius: 4 },
  progressCaption: { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: -8 },
  sectionTitle:  { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '700' },
  sectionSub:    { color: TEXT_SECONDARY, fontSize: 13 },

  workoutStatsRow:  { flexDirection: 'row', gap: 10 },
  workoutStatCard:  { flex: 1, backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 14, alignItems: 'center', gap: 6 },
  workoutStatValue: { fontSize: 20, fontWeight: '800' },
  workoutStatLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '500', textAlign: 'center' },

  // Workout list
  workoutRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  workoutRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  workoutRowIcon:   { width: 38, height: 38, borderRadius: 10, backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  workoutRowBody:   { flex: 1, gap: 4 },
  workoutRowTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  workoutRowName:   { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  workoutRowDate:   { color: TEXT_SECONDARY, fontSize: 12 },
  workoutRowMeta:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  workoutRowStat:   { color: TEXT_SECONDARY, fontSize: 13 },
  workoutRowDot:    { color: 'rgba(255,255,255,0.15)', fontSize: 13 },

  emptyWorkouts:     { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyWorkoutsText: { color: TEXT_SECONDARY, fontSize: 14 },

  // Day modal
  dayModalSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: CARD,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderBottomWidth: 0, borderColor: BORDER,
    overflow: 'hidden',
  },
  dayModalDragArea:  { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
  dayModalHandle:    { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  dayModalTitle:     { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700', textTransform: 'capitalize' },
  dayModalSub:       { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
  dayModalScroll:    { paddingHorizontal: 20, paddingBottom: 40 },
  dayModalSection:   { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  dayModalEmpty:     { alignItems: 'center', paddingVertical: 24, gap: 10 },
  dayModalEmptyText: { color: TEXT_SECONDARY, fontSize: 14 },
  dayModalItem:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  dayModalItemBorder:{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },

  // Detail
  detailScreen: { flex: 1, backgroundColor: BG },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  detailHeaderTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  detailScroll:      { padding: 20, gap: 20 },

  prRow:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  prBadge:    { backgroundColor: ORANGE + '22', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: ORANGE + '44' },
  prBadgeText:{ color: ORANGE, fontSize: 13, fontWeight: '700' },

  detailHero:     { alignItems: 'center', gap: 6, paddingVertical: 8 },
  detailHeroIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 18 },
  detailName:     { color: TEXT_PRIMARY, fontSize: 26, fontWeight: '800' },
  detailDate:     { color: TEXT_SECONDARY, fontSize: 14, textTransform: 'capitalize' },
  detailTime:     { color: TEXT_SECONDARY, fontSize: 13 },

  detailMapWrap:   { borderRadius: 20, overflow: 'hidden', height: 300, borderWidth: 1, borderColor: BORDER },
  detailMap:       { flex: 1, backgroundColor: '#f0ede8' },
  mapExpandBtnWrap:{ position: 'absolute', top: 12, right: 12 },

  detailGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  detailGridCell: { width: '47%', backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 6, alignItems: 'center' },
  detailGridIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  detailGridValue:{ fontSize: 22, fontWeight: '800' },
  detailGridUnit: { fontSize: 13, fontWeight: '500' },
  detailGridLabel:{ color: TEXT_SECONDARY, fontSize: 12, fontWeight: '500' },

  mapFsCloseWrap: { position: 'absolute' },

  // Muscle map
  muscleCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bodyToggle:       { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 3, gap: 2 },
  bodyToggleBtn:    { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  bodyToggleBtnActive: { backgroundColor: ORANGE },
  bodyToggleText:   { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  bodyToggleTextActive: { color: '#000' },
  bodyWrap:         { alignItems: 'center', paddingVertical: 8 },
  muscleEmpty:      { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', paddingBottom: 8 },
})
