import React, { useRef } from 'react'
import {
  View,
  Text,
  Alert,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  type ViewStyle,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import Animated, { type AnimatedStyle } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { WorkoutSection } from '@/components/WorkoutSection'
import { WEEKDAYS } from '@/components/SessionEditor'
import { scaledReps } from '@/lib/progression'
import { weekdayOf } from '@/lib/date'
import { isoDate, todayMidnight, indexToDate, DAY_SHORT } from '@/lib/scheduleDates'
import { ORANGE, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import type { WorkoutSession } from '@/services/workoutSchedule'
import type { Exercise } from '@/services/exercises'
import type { CardioWorkout, StrengthWorkout } from '@/services/workouts'
import { TAB_CONTENT_PAD } from '@/lib/glass'
import { useTabBarShrinkOnScroll } from '@/lib/tabBar'

const SCREEN_W = Dimensions.get('window').width

// Stabila tomma referenser — annars bryts React.memo av nya objekt varje render
export const EMPTY_CHECKED: Record<string, boolean> = {}
export const EMPTY_COMPLETED = new Set<string>()
export const EMPTY_CARDIO_STATS: Record<string, { distanceKm: number; durationSeconds: number }> = {}
export const EMPTY_CARDIO_LOGS: CardioWorkout[] = []
export const EMPTY_LOGGED: StrengthWorkout[] = []

export interface DayPageApi {
  /** Dra-ner på dagsidan → hämta om schemat (spinnern visas ovanför pagern) */
  pullRefresh:      () => void
  toggleCheck:      (exId: string, date: string) => void
  deleteExercise:   (sessionId: string, exId: string, date: string) => void
  sessionLongPress: (s: WorkoutSession, displayName: string) => void
  setPickerSession: (s: WorkoutSession) => void
  complete:         (sessionId: string, date: string) => void
  uncomplete:       (sessionId: string, date: string) => void
  openEditor:       (s: WorkoutSession | null) => void
  openFullscreen:   (s: WorkoutSession, date: string) => void
}

// ── DayPage ───────────────────────────────────────────────────────────────────
// Memoiserad dagsida: en ibockning eller ett dagbyte ritar bara om den sida
// vars props faktiskt ändrats — inte alla monterade sidor i pagern.

export const DayPage = React.memo(function DayPage({
  idx, sessions, exercises, checked, completed, cardioStats, cardioLogs, logged, progress, userId, dayAnimStyle, api,
}: {
  idx: number
  sessions: WorkoutSession[]
  exercises: Exercise[]
  checked: Record<string, boolean>
  progress: Record<string, number>
  completed: Set<string>
  cardioStats: Record<string, { distanceKm: number; durationSeconds: number }>
  cardioLogs: CardioWorkout[]
  logged: StrengthWorkout[]
  userId: string | null
  dayAnimStyle: AnimatedStyle<ViewStyle>
  api: DayPageApi
}) {
          const onScrollShrink = useTabBarShrinkOnScroll()
          const pullArmed = useRef(true)
          function onPageScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
            onScrollShrink(e)
            const y = e.nativeEvent.contentOffset.y
            if (y >= 0) pullArmed.current = true
            if (y < -70 && pullArmed.current) {
              pullArmed.current = false
              api.pullRefresh()
            }
          }

          const date       = indexToDate(idx)
          const weekday    = weekdayOf(date)
          const dateStr    = isoDate(date)
          const todayMs    = todayMidnight().getTime()
          const isToday    = date.getTime() === todayMs
          const isPast     = date.getTime() < todayMs
          const skipPrefix = `SKIP:${dateStr}:`
          const skipIds    = sessions
            .filter(s => s.name.startsWith(skipPrefix))
            .map(s => s.name.slice(skipPrefix.length))
          const daySessions = sessions.filter(s => {
            if (s.name.startsWith('SKIP:')) return false
            if (skipIds.includes(s.id))     return false
            return (
              s.weekdays.includes(weekday) ||
              (s.weekdays.length === 0 && s.name === dateStr) ||
              (s.weekdays.length === 0 && s.name.startsWith(`ONCE:${dateStr}:`))
            )
          })
          function sessionDisplayName(s: WorkoutSession): string {
            if (s.name.startsWith('ONCE:')) return s.name.split(':').slice(2).join(':')
            if (s.name === dateStr) return 'Loggat idag'
            return s.name
          }
          const scheduledSessions = daySessions.filter(s => s.weekdays.length > 0 || s.name.startsWith(`ONCE:${dateStr}:`))
          const quickLogSession   = daySessions.find(s => s.weekdays.length === 0 && s.name === dateStr)
          const dayLabel          = isToday ? 'IDAG' : DAY_SHORT[weekday - 1]
          // GPS-avklarade schemapass sparar OCKSÅ ett historikpass — filtrera bort
          // loggar som matchar en avklarning (typ + distans + tid) så samma
          // löpning inte visas som två kort
          const visibleCardioLogs = cardioLogs.filter(w => !daySessions.some(s => {
            if (s.session_type !== 'cardio' || !completed.has(s.id)) return false
            const st = cardioStats[s.id]
            return !!st
              && s.cardio_type === w.data.type
              && Math.abs(st.distanceKm - w.data.distance_km) < 0.01
              && Math.abs(st.durationSeconds - w.data.duration_seconds) <= 2
          }))
          return (
            <ScrollView
              style={{ width: SCREEN_W }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scroll}
              onScroll={onPageScroll}
              scrollEventThrottle={16}
            >
              {/* Day header */}
              <Animated.View style={[styles.dayHeader, dayAnimStyle]}>
                <Text style={styles.dayName}>{dayLabel}</Text>
                {daySessions.length + visibleCardioLogs.length > 0 && (
                  <Text style={styles.daySubtitle}>
                    {daySessions.length + visibleCardioLogs.length} pass · {daySessions.reduce((a, s) => a + s.exercises.length, 0)} övningar
                  </Text>
                )}
              </Animated.View>

              {/* Sessions */}
              {sessions.filter(s => !s.name.startsWith('SKIP:')).length === 0 && cardioLogs.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="barbell-outline" size={32} color={ORANGE} />
                  </View>
                  <Text style={styles.emptyTitle}>Bygg ditt schema</Text>
                  <Text style={styles.emptyText}>Skapa pass och lägg till övningar för varje dag</Text>
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => api.openEditor(null)} activeOpacity={0.8}>
                    <Ionicons name="add" size={16} color="#000" />
                    <Text style={styles.emptyBtnText}>Skapa första passet</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.sectionList}>
                  {scheduledSessions.length === 0 && visibleCardioLogs.length === 0 ? (
                    <View style={styles.restState}>
                      <Ionicons name="moon-outline" size={40} color={BORDER} />
                      <Text style={styles.restTitle}>Vilodag</Text>
                      <Text style={styles.restText}>Inget pass schemalagt {isToday ? 'idag' : WEEKDAYS[weekday - 1].toLowerCase()}</Text>
                      <TouchableOpacity style={styles.restAddBtn} onPress={() => api.openEditor(null)} activeOpacity={0.8}>
                        <Ionicons name="add" size={14} color={ORANGE} />
                        <Text style={styles.restAddText}>Lägg till pass</Text>
                      </TouchableOpacity>
                    </View>
                  ) : scheduledSessions.map(s => {
                    const isCompleted = completed.has(s.id)
                    // Progression: skala reps utifrån antal genomföranden av övningen
                    const scaled = s.exercises.map(ex => {
                      const { reps, progressed } = scaledReps(ex.reps, progress[ex.id] ?? 0)
                      return { ex: progressed ? { ...ex, reps } : ex, progressed }
                    })
                    const displaySession = { ...s, name: sessionDisplayName(s), exercises: scaled.map(x => x.ex) }
                    // Faktisk statistik för avklarade gympass (från loggade set)
                    const gymStats = (s.session_type !== 'cardio' && isCompleted) ? (() => {
                      const names = new Set(s.exercises.map(ex => ex.exercise_name))
                      const wos = logged.filter(w => names.has(w.data.exercise_name))
                      if (wos.length === 0) return undefined
                      const setCount = wos.reduce((a, w) => a + w.data.sets.length, 0)
                      const volumeKg = wos.reduce((a, w) => a + w.data.sets.reduce((x, st) => x + (st.weight_kg || 0) * (st.reps || 0), 0), 0)
                      return { sets: setCount, volumeKg }
                    })() : undefined
                    return (
                    <WorkoutSection
                      key={s.id}
                      session={displaySession}
                      progressedIds={new Set(scaled.filter(x => x.progressed).map(x => x.ex.id))}
                      checked={checked}
                      isCompleted={isCompleted}
                      onDeleteExercise={(exId) => api.deleteExercise(s.id, exId, dateStr)}
                      onLongPress={() => api.sessionLongPress(s, sessionDisplayName(s))}
                      onAddExercise={!isPast ? () => api.setPickerSession(s) : undefined}
                      onOpenFullscreen={s.session_type !== 'cardio' ? () => api.openFullscreen(displaySession, dateStr) : undefined}
                      gymStats={gymStats}
                      onStartCardioSession={s.session_type === 'cardio'
                        ? () => {
                            if (!isToday && !isPast) {
                              Alert.alert('Framtida pass', 'Du kan starta passet först på passdagen.')
                              return
                            }
                            router.push({ pathname: '/cardio-session', params: {
                            sessionId: s.id,
                            name: sessionDisplayName(s),
                            cardioType: s.cardio_type ?? 'running',
                            notes: s.notes ?? '',
                            date: dateStr,
                          } })
                          }
                        : undefined}
                      cardioStats={s.session_type === 'cardio' ? cardioStats[s.id] : undefined}
                      onViewCardioSummary={s.session_type === 'cardio' && isCompleted && cardioStats[s.id]
                        ? () => router.push({ pathname: '/cardio-summary', params: {
                            name: sessionDisplayName(s),
                            cardioType: s.cardio_type ?? 'running',
                            date: dateStr,
                          } })
                        : undefined}
                      onComplete={() => api.complete(s.id, dateStr)}
                      onUncomplete={() => api.uncomplete(s.id, dateStr)}
                    />
                  )})}

                  {/* Quick-log section */}
                  {quickLogSession && (
                    <WorkoutSection
                      key={quickLogSession.id}
                      session={{ ...quickLogSession, name: 'Loggat idag' }}
                      checked={checked}
                      isCompleted={false}
                      isQuickLog
                      onDeleteExercise={(exId) => api.deleteExercise(quickLogSession.id, exId, dateStr)}
                      onOpenFullscreen={() => api.openFullscreen({ ...quickLogSession, name: 'Loggat idag' }, dateStr)}
                      onComplete={() => {}}
                      onUncomplete={() => {}}
                      onLongPress={() => api.sessionLongPress(quickLogSession, 'Loggat idag')}
                    />
                  )}

                  {/* Loggade cardio-pass — samma kortdesign som schemalagda pass
                      (namn + collapse + statistik + Visa pass) */}
                  {visibleCardioLogs.map(w => (
                    <WorkoutSection
                      key={`cardio-${w.id}`}
                      session={{
                        id: `cardiolog:${w.id}`, user_id: userId ?? '',
                        name: w.name, weekdays: [], sort_order: 0,
                        created_at: w.created_at, notes: null,
                        session_type: 'cardio', cardio_type: w.data.type,
                        exercises: [],
                      }}
                      checked={EMPTY_CHECKED}
                      isCompleted
                      cardioStats={{ distanceKm: w.data.distance_km, durationSeconds: w.data.duration_seconds }}
                      onViewCardioSummary={() => router.push({ pathname: '/cardio-summary', params: { name: w.name, cardioType: w.data.type, date: dateStr, workoutId: w.id } })}
                      onDeleteExercise={() => {}}
                      onComplete={() => {}}
                      onUncomplete={() => {}}
                    />
                  ))}

                </View>
              )}
            </ScrollView>
          )
})

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { paddingBottom: 150 + TAB_CONTENT_PAD },

  dayHeader: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  dayName:     { color: TEXT_PRIMARY, fontSize: 26, fontWeight: '800' },
  daySubtitle: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 4 },

  sectionList: { paddingHorizontal: 16 },

  emptyState: { alignItems: 'center', paddingVertical: 52, paddingHorizontal: 32, gap: 8 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: ORANGE + '18',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyTitle:   { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '700' },
  emptyText:    { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ORANGE, borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 11, marginTop: 8,
  },
  emptyBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },

  restState:  { alignItems: 'center', paddingVertical: 48, gap: 6 },
  restTitle:  { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '700', marginTop: 8 },
  restText:   { color: TEXT_SECONDARY, fontSize: 14 },
  restAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, borderWidth: 1, borderColor: ORANGE + '60',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9,
  },
  restAddText: { color: ORANGE, fontSize: 14, fontWeight: '600' },
})
