import { useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, runOnJS,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ORANGE, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { toLocalDateString, parseLocalDate } from '@/lib/date'
import type { DaySummary } from '@/services/dailyLog'
import type { CardioWorkout, StrengthWorkout } from '@/services/workouts'
import type { CompletedSessionItem } from '@/services/workoutSchedule'

const SCREEN_HEIGHT = Dimensions.get('window').height
const SHEET_PARTIAL = SCREEN_HEIGHT * 0.44
const SHEET_SP      = { damping: 26, stiffness: 260, mass: 1 } as const

const EXERCISE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  running:  'fitness-outline',
  cycling:  'bicycle-outline',
  interval: 'flash-outline',
  walking:  'walk-outline',
}

function fmtTime(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function dayDate(startDate: string, dayNumber: number): Date {
  const d = parseLocalDate(startDate)
  d.setDate(d.getDate() + dayNumber - 1)
  return d
}

export function DayWorkoutsModal({ day, startDate, workouts, strengthWorkouts, completedSessions, onClose, onSelectWorkout }: {
  day: DaySummary
  startDate: string
  workouts: CardioWorkout[]
  strengthWorkouts: StrengthWorkout[]
  completedSessions?: CompletedSessionItem[]
  onClose: () => void
  onSelectWorkout: (w: CardioWorkout) => void
}) {
  const insets    = useSafeAreaInsets()
  const FULL_TOP  = insets.top + 8
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
      const belowPartial = Math.max(0, sheetTop.value - SHEET_PARTIAL)
      backdropAnim.value = Math.max(0, 1 - belowPartial / (SCREEN_HEIGHT - SHEET_PARTIAL))
    })
    .onEnd(e => {
      const base   = snapState.value === 1 ? FULL_TOP : SHEET_PARTIAL
      const endPos = base + e.translationY
      if (e.velocityY < -600 || endPos < SHEET_PARTIAL * 0.45) {
        sheetTop.value     = withSpring(FULL_TOP, SHEET_SP)
        backdropAnim.value = withTiming(1, { duration: 200 })
        snapState.value    = 1
      } else if (snapState.value === 0 && (e.velocityY > 600 || endPos > SHEET_PARTIAL + 100)) {
        sheetTop.value     = withTiming(SCREEN_HEIGHT, { duration: 280 }, () => runOnJS(onClose)())
        backdropAnim.value = withTiming(0, { duration: 230 })
      } else if (snapState.value === 1 && (e.velocityY > 400 || endPos > SHEET_PARTIAL * 0.55)) {
        sheetTop.value     = withSpring(SHEET_PARTIAL, SHEET_SP)
        backdropAnim.value = withTiming(1, { duration: 200 })
        snapState.value    = 0
      } else {
        sheetTop.value     = withSpring(base, SHEET_SP)
        backdropAnim.value = withTiming(1, { duration: 200 })
      }
    })

  const sheetStyle    = useAnimatedStyle(() => ({ top: sheetTop.value }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropAnim.value }))

  const date    = dayDate(startDate, day.dayNumber)
  const dateIso = toLocalDateString(date)
  const dateStr = date.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })

  const dayCardio   = workouts.filter(w => sameDay(new Date(w.created_at), date))
  const dayStrength = strengthWorkouts.filter(w => {
    const wd = w.data.workout_date
    return wd ? wd === dateIso : sameDay(new Date(w.created_at), date)
  })
  // Avbockade schemapass. GPS-avbockade cardiopass (med distans) hoppas över —
  // de visas redan som tappbara pass i Cardio-sektionen.
  const daySessions = (completedSessions ?? []).filter(c =>
    c.completedDate === dateIso && !(c.sessionType === 'cardio' && c.distanceKm != null)
  )
  const hasAny = dayCardio.length > 0 || dayStrength.length > 0 || daySessions.length > 0

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }, backdropStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={dismiss} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[s.sheet, sheetStyle]}>
        <GestureDetector gesture={panGesture}>
          <View style={s.dragArea}>
            <View style={s.handle} />
            <Text style={s.title} numberOfLines={1}>{dateStr}</Text>
            <Text style={s.sub}>Dag {day.dayNumber}</Text>
          </View>
        </GestureDetector>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {!hasAny ? (
            <View style={s.empty}>
              <Ionicons name="fitness-outline" size={28} color="rgba(255,255,255,0.2)" />
              <Text style={s.emptyText}>Inga träningar sparade</Text>
            </View>
          ) : (
            <>
              {daySessions.length > 0 && (
                <>
                  {(dayStrength.length > 0 || dayCardio.length > 0) && <Text style={s.section}>Schemapass</Text>}
                  {daySessions.map((c, i) => {
                    const last = i === daySessions.length - 1 && dayStrength.length === 0 && dayCardio.length === 0
                    return (
                      <View key={c.id} style={[s.item, !last && s.itemBorder]}>
                        <View style={s.itemIcon}>
                          <Ionicons
                            name={c.sessionType === 'cardio'
                              ? (EXERCISE_ICONS[c.cardioType ?? ''] ?? 'fitness-outline')
                              : 'barbell-outline'}
                            size={18}
                            color={ORANGE}
                          />
                        </View>
                        <View style={s.itemBody}>
                          <Text style={s.itemName}>{c.name}</Text>
                          <View style={s.itemMeta}>
                            {c.sessionType === 'gym' && c.exerciseNames.length > 0 ? (
                              <Text style={s.itemStat} numberOfLines={1}>
                                {c.exerciseNames.length} övningar · {c.exerciseNames.slice(0, 3).join(', ')}{c.exerciseNames.length > 3 ? ' …' : ''}
                              </Text>
                            ) : (
                              <Text style={s.itemStat}>Avklarat pass</Text>
                            )}
                          </View>
                        </View>
                        <Ionicons name="checkmark-circle" size={18} color="#4CAF50" style={{ alignSelf: 'center' }} />
                      </View>
                    )
                  })}
                </>
              )}

              {dayStrength.length > 0 && (
                <>
                  {(dayCardio.length > 0 || daySessions.length > 0) && (
                    <Text style={[s.section, daySessions.length > 0 && { marginTop: 12 }]}>Styrka</Text>
                  )}
                  {dayStrength.map((w, i) => {
                    const totalReps = w.data.sets.reduce((sum, r) => sum + r.reps, 0)
                    const last = i === dayStrength.length - 1 && dayCardio.length === 0
                    return (
                      <View key={w.id} style={[s.item, !last && s.itemBorder]}>
                        <View style={s.itemIcon}>
                          <Ionicons name="barbell-outline" size={18} color={ORANGE} />
                        </View>
                        <View style={s.itemBody}>
                          <Text style={s.itemName}>{w.name}</Text>
                          <View style={s.itemMeta}>
                            <Text style={s.itemStat}>{w.data.sets.length} set</Text>
                            {totalReps > 0 && (
                              <>
                                <Text style={s.itemDot}>·</Text>
                                <Text style={s.itemStat}>{totalReps} reps</Text>
                              </>
                            )}
                          </View>
                        </View>
                      </View>
                    )
                  })}
                </>
              )}

              {dayCardio.length > 0 && (
                <>
                  {(dayStrength.length > 0 || daySessions.length > 0) && (
                    <Text style={[s.section, { marginTop: 12 }]}>Cardio</Text>
                  )}
                  {dayCardio.map((w, i) => (
                    <TouchableOpacity
                      key={w.id}
                      style={[s.item, i < dayCardio.length - 1 && s.itemBorder]}
                      onPress={() => { dismiss(); setTimeout(() => onSelectWorkout(w), 300) }}
                      activeOpacity={0.7}
                    >
                      <View style={s.itemIcon}>
                        <Ionicons name={EXERCISE_ICONS[w.data.type] ?? 'fitness-outline'} size={18} color={ORANGE} />
                      </View>
                      <View style={s.itemBody}>
                        <Text style={s.itemName}>{w.name}</Text>
                        <View style={s.itemMeta}>
                          <Text style={s.itemStat}>{w.data.distance_km.toFixed(2)} km</Text>
                          <Text style={s.itemDot}>·</Text>
                          <Text style={s.itemStat}>{fmtTime(w.data.duration_seconds)}</Text>
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

const s = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: CARD,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderBottomWidth: 0, borderColor: BORDER,
    overflow: 'hidden',
  },
  dragArea: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
  handle:   { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  title:    { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700', textTransform: 'capitalize' },
  sub:      { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
  scroll:   { paddingHorizontal: 20, paddingBottom: 40 },
  section:  { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  empty:    { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyText:{ color: TEXT_SECONDARY, fontSize: 14 },
  item:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  itemBorder:{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  itemIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center' },
  itemBody: { flex: 1, gap: 4 },
  itemName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemStat: { color: TEXT_SECONDARY, fontSize: 13 },
  itemDot:  { color: 'rgba(255,255,255,0.15)', fontSize: 13 },
})
