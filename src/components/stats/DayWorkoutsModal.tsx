import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Modal, Alert } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, runOnJS,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Ionicons } from '@/components/Icon'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GREEN, RED, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT_SEMI, CARDIO_BLUE, DIVIDER, useThemeStrings, ACCENT, accentAlpha } from '@/lib/theme'
import { toLocalDateString, parseLocalDate } from '@/lib/date'
import { fmtTime } from '@/lib/format'
import { toDisplayDistance, distanceUnitLabel, type UnitSystem } from '@/lib/units'
import { getTasksForDay, updateDayTasks, type DaySummary, type TaskItem } from '@/services/dailyLog'
import type { CardioWorkout, StrengthWorkout } from '@/services/workouts'
import type { CompletedSessionItem } from '@/services/workoutSchedule'
import { GymSummaryView } from './GymSummaryView'
import { useT, dateLocale } from '@/lib/i18n'

const SCREEN_HEIGHT = Dimensions.get('window').height
const SCREEN_WIDTH  = Dimensions.get('window').width
const SHEET_SP      = { damping: 26, stiffness: 260, mass: 1 } as const

const EXERCISE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  running:  'fitness-outline',
  cycling:  'bicycle-outline',
  interval: 'flash-outline',
  walking:  'walk-outline',
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

// Dagens uppgifter — första kortet i dagsvyn. Går inte att svepa bort;
// glömda bockar rättas i efterhand via Redigera, med ärlighetspåminnelsen
// innan. Sparningen uppdaterar dagens status så hela appen följer med.
function TasksCard({ tasks, failedDay, editable, onSave }: {
  tasks: TaskItem[]
  failedDay: boolean
  editable: boolean
  onSave: (updated: TaskItem[]) => Promise<void>
}) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<TaskItem[]>(tasks)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (!editing) setDraft(tasks) }, [tasks, editing])

  function startEditing() {
    Alert.alert(
      t('Ändra i efterhand?'),
      t('Bocka bara i det du faktiskt gjorde. Utmaningen handlar om ärlighet mot dig själv, det är bara dig det påverkar.'),
      [
        { text: t('Avbryt'), style: 'cancel' },
        { text: t('Jag är säker'), onPress: () => setEditing(true) },
      ],
    )
  }

  async function save() {
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } catch {
      Alert.alert(t('Kunde inte spara'), t('Kontrollera din anslutning och försök igen.'))
    } finally {
      setSaving(false)
    }
  }

  const shown = editing ? draft : tasks
  return (
    <View style={s.tasksWrap}>
      <View style={s.tasksHead}>
        <Text style={s.tasksTitle}>{t('Dagens uppgifter')}</Text>
        {editing ? (
          <View style={s.editActions}>
            <TouchableOpacity onPress={() => setEditing(false)} hitSlop={8} disabled={saving}>
              <Text style={s.editCancel}>{t('Avbryt')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} hitSlop={8} disabled={saving} testID="tasksSave">
              <Text style={s.editSave}>{saving ? t('Sparar …') : t('Spara')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.editActions}>
            <Text style={[
              s.tasksCount,
              { color: tasks.every(x => x.completed) ? GREEN : failedDay ? RED : TEXT_SECONDARY },
            ]}>
              {t('{a} av {b}', { a: tasks.filter(x => x.completed).length, b: tasks.length })}
            </Text>
            {editable && (
              <TouchableOpacity onPress={startEditing} hitSlop={8} testID="tasksEdit">
                <Text style={s.editSave}>{t('Redigera')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      {shown.map((task, i) => {
        const missed = !task.completed && failedDay && !editing
        const row = (
          <>
            <Ionicons
              name={task.completed ? 'checkmark-circle' : missed ? 'close-circle' : 'ellipse-outline'}
              size={20}
              color={task.completed ? GREEN : missed ? RED : 'rgba(255,255,255,0.25)'}
            />
            <Text style={[s.taskName, missed && { color: RED, fontWeight: '600' }]} numberOfLines={1}>
              {task.name}
            </Text>
          </>
        )
        if (!editing) {
          return <View key={task.completionId} style={[s.taskRow, i > 0 && s.taskRowBorder]}>{row}</View>
        }
        return (
          <TouchableOpacity
            key={task.completionId}
            style={[s.taskRow, i > 0 && s.taskRowBorder]}
            activeOpacity={0.7}
            testID={`taskToggle-${i}`}
            onPress={() => setDraft(prev => prev.map(x =>
              x.completionId === task.completionId ? { ...x, completed: !x.completed } : x
            ))}
          >
            {row}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

export function DayWorkoutsModal({ day, startDate, challengeId, workouts, strengthWorkouts, completedSessions, unit = 'metric', onClose, onSelectWorkout, onTasksChanged }: {
  day: DaySummary
  startDate: string
  challengeId?: string | null
  workouts: CardioWorkout[]
  strengthWorkouts: StrengthWorkout[]
  completedSessions?: CompletedSessionItem[]
  unit?: UnitSystem
  onClose: () => void
  onSelectWorkout: (w: CardioWorkout) => void
  /** Efter en efterhandsredigering — skalet laddar om så allt blir grönt överallt */
  onTasksChanged?: () => void
}) {
  const t = useT()
  const T = useThemeStrings()
  const insets    = useSafeAreaInsets()
  const FULL_TOP  = insets.top + 8
  const sheetTop     = useSharedValue(SCREEN_HEIGHT)
  const backdropAnim = useSharedValue(0)
  const pagerRef  = useRef<ScrollView>(null)
  const [page, setPage] = useState(0)

  useEffect(() => {
    // Öppnar i fullhöjd direkt — dra ner för att stänga
    sheetTop.value     = withSpring(FULL_TOP, SHEET_SP)
    backdropAnim.value = withTiming(1, { duration: 260 })
  }, [])

  // Dagens fem uppgifter — så man ser exakt vad som missades en fälld dag.
  // Kortet ligger först i träningslistan (scrollar bort naturligt) och
  // kan svepas bort i sidled; extra scrollhöjd garanterar att det alltid
  // går att dra upp listan över kortet, även med få övningar.
  const [tasks, setTasks] = useState<TaskItem[] | null>(null)
  // Gympassets detaljvy — samma Apple-stil som cardiopassens
  const [gymDetail, setGymDetail] = useState<{ name: string; planned: string[]; logged: StrengthWorkout[] } | null>(null)
  const showTasks = !!tasks && tasks.length > 0
  useEffect(() => {
    if (!challengeId || day.status === 'future') return
    let active = true
    getTasksForDay(challengeId, day.dayNumber)
      .then(t => { if (active) setTasks(t) })
      .catch(() => {})
    return () => { active = false }
  }, [challengeId, day.dayNumber])

  // Efterhandsredigeringen: skriv bockarna, uppdatera dagens status och
  // låt skalet ladda om — kalendern och räknarna blir gröna i hela appen
  async function handleSaveTasks(updated: TaskItem[]) {
    if (!challengeId) return
    const status = await updateDayTasks(
      challengeId,
      day.dayNumber,
      dateIso,
      updated.map(item => ({
        completionId: item.completionId,
        templateId: item.templateId,
        completed: item.completed,
      })),
    )
    setTasks(updated)
    onTasksChanged?.()
    if (status === 'completed' && day.status !== 'completed') {
      Alert.alert(t('Snyggt!'), t('Dag {n} räknas nu som klarad.', { n: day.dayNumber }))
    }
  }

  function dismiss() {
    sheetTop.value     = withTiming(SCREEN_HEIGHT, { duration: 300 }, () => runOnJS(onClose)())
    backdropAnim.value = withTiming(0, { duration: 250 })
  }

  // Två lägen: helt öppet eller stängt — drar man ner tillräckligt stängs
  // arket direkt, inget halvvägsstopp
  const panGesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate(e => {
      sheetTop.value = Math.max(FULL_TOP, Math.min(SCREEN_HEIGHT, FULL_TOP + e.translationY))
      backdropAnim.value = Math.max(0, 1 - (sheetTop.value - FULL_TOP) / (SCREEN_HEIGHT - FULL_TOP))
    })
    .onEnd(e => {
      const endPos = FULL_TOP + e.translationY
      if (e.velocityY > 500 || endPos > SCREEN_HEIGHT * 0.4) {
        sheetTop.value     = withTiming(SCREEN_HEIGHT, { duration: 260 }, () => runOnJS(onClose)())
        backdropAnim.value = withTiming(0, { duration: 230 })
      } else {
        sheetTop.value     = withSpring(FULL_TOP, SHEET_SP)
        backdropAnim.value = withTiming(1, { duration: 200 })
      }
    })

  const sheetStyle    = useAnimatedStyle(() => ({ top: sheetTop.value }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropAnim.value }))

  const date    = dayDate(startDate, day.dayNumber)
  const dateIso = toLocalDateString(date)
  const dateStr = date.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })

  const dayCardio   = workouts.filter(w => sameDay(new Date(w.created_at), date))
  const dayStrength = strengthWorkouts.filter(w => {
    const wd = w.data.workout_date
    return wd ? wd === dateIso : sameDay(new Date(w.created_at), date)
  })
  const daySessions = (completedSessions ?? []).filter(c => c.completedDate === dateIso)
  // Cardio-schemapass avbockade utan GPS (de med distans visas redan som tappbara pass)
  const cardioSessions = daySessions.filter(c => c.sessionType === 'cardio' && c.distanceKm == null)
  const gymSessions    = daySessions.filter(c => c.sessionType === 'gym')

  // Uppdelat i löpar-/cardiopass och gympass — swipa mellan dem
  const pages: { key: 'cardio' | 'gym'; label: string; count: number }[] = []
  if (dayCardio.length > 0 || cardioSessions.length > 0) pages.push({ key: 'cardio', label: t('Cardio'), count: dayCardio.length + cardioSessions.length })
  if (dayStrength.length > 0 || gymSessions.length > 0)  pages.push({ key: 'gym',    label: t('Gym'),    count: dayStrength.length + gymSessions.length })
  const hasAny = pages.length > 0

  function goToPage(i: number) {
    setPage(i)
    pagerRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true })
  }

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }, backdropStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={dismiss} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[s.sheet, { backgroundColor: T.CARD, borderColor: T.BORDER }, sheetStyle]}>
        <GestureDetector gesture={panGesture}>
          <View style={s.dragArea}>
            <View style={s.handle} />
            <Text style={s.title} numberOfLines={1}>{dateStr}</Text>
            <Text style={s.sub}>Dag {day.dayNumber}</Text>
          </View>
        </GestureDetector>

        {!hasAny ? (
          <>
          {showTasks && (
            <View style={{ paddingHorizontal: 20 }}>
              <TasksCard
                tasks={tasks!}
                failedDay={day.status === 'failed'}
                editable={!!challengeId && day.status !== 'future'}
                onSave={handleSaveTasks}
              />
            </View>
          )}
          <View style={s.empty}>
            <Ionicons name="fitness-outline" size={28} color="rgba(255,255,255,0.2)" />
            <Text style={s.emptyText}>{t('Inga träningar sparade')}</Text>
          </View>
          </>
        ) : (
          <>
            {/* Flikar — Cardio / Gym (swipa eller tryck) */}
            {pages.length > 1 && (
              <View style={s.tabBar}>
                {pages.map((p, i) => {
                  const active = page === i
                  const accent = p.key === 'cardio' ? CARDIO_BLUE : T.ACCENT
                  return (
                    <TouchableOpacity key={p.key} style={s.tabBtn} onPress={() => goToPage(i)} activeOpacity={0.7}>
                      <View style={s.tabLabelRow}>
                        <Text style={[s.tabLabel, active && { color: TEXT_PRIMARY }]}>{p.label}</Text>
                        <View style={[s.tabCount, active && { backgroundColor: accent + '2A' }]}>
                          <Text style={[s.tabCountText, active && { color: accent }]}>{p.count}</Text>
                        </View>
                      </View>
                      {active && <View style={[s.tabUnderline, { backgroundColor: accent }]} />}
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}

            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
              onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
            >
              {pages.map(p => (
                <ScrollView
                  key={p.key}
                  style={{ width: SCREEN_WIDTH }}
                  contentContainerStyle={s.scroll}
                  showsVerticalScrollIndicator={false}
                >
                  {showTasks && (
                    <TasksCard
                      tasks={tasks!}
                      failedDay={day.status === 'failed'}
                      editable={!!challengeId && day.status !== 'future'}
                      onSave={handleSaveTasks}
                    />
                  )}
                  {p.key === 'cardio' ? (
                    <>
                      {dayCardio.map((w, i) => (
                        <TouchableOpacity
                          key={w.id}
                          style={[s.item, (i < dayCardio.length - 1 || cardioSessions.length > 0) && s.itemBorder]}
                          onPress={() => { dismiss(); setTimeout(() => onSelectWorkout(w), 300) }}
                          activeOpacity={0.7}
                        >
                          <View style={[s.itemIcon, { backgroundColor: CARDIO_BLUE + '22' }]}>
                            <Ionicons name={EXERCISE_ICONS[w.data.type] ?? 'fitness-outline'} size={18} color={CARDIO_BLUE} />
                          </View>
                          <View style={s.itemBody}>
                            <Text style={s.itemName}>{w.name}</Text>
                            <View style={s.itemMeta}>
                              <Text style={s.itemStat}>{toDisplayDistance(w.data.distance_km, unit).toFixed(2)} {distanceUnitLabel(unit)}</Text>
                              <Text style={s.itemDot}>·</Text>
                              <Text style={s.itemStat}>{fmtTime(w.data.duration_seconds)}</Text>
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" style={{ alignSelf: 'center' }} />
                        </TouchableOpacity>
                      ))}
                      {cardioSessions.map((c, i) => (
                        <View key={c.id} style={[s.item, i < cardioSessions.length - 1 && s.itemBorder]}>
                          <View style={[s.itemIcon, { backgroundColor: CARDIO_BLUE + '22' }]}>
                            <Ionicons name={EXERCISE_ICONS[c.cardioType ?? ''] ?? 'fitness-outline'} size={18} color={CARDIO_BLUE} />
                          </View>
                          <View style={s.itemBody}>
                            <Text style={s.itemName}>{c.name}</Text>
                            <View style={s.itemMeta}><Text style={s.itemStat}>{t('Avklarat pass')}</Text></View>
                          </View>
                          <Ionicons name="checkmark-circle" size={18} color={GREEN} style={{ alignSelf: 'center' }} />
                        </View>
                      ))}
                    </>
                  ) : (
                    (() => {
                      // Gruppera: loggade övningar som hör till ett avklarat pass
                      // visas UNDER passet — inte en gång till som egna rader
                      const claimed = new Set<string>()
                      const passBlocks = gymSessions.map(c => {
                        const sub = dayStrength.filter(w =>
                          !claimed.has(w.id) && c.exerciseNames.includes(w.data.exercise_name)
                        )
                        sub.forEach(w => claimed.add(w.id))
                        return { c, sub }
                      })
                      const loose = dayStrength.filter(w => !claimed.has(w.id))
                      return (
                        <>
                          {passBlocks.map(({ c, sub }, i) => (
                            <View key={c.id} style={[(i < passBlocks.length - 1 || loose.length > 0) && s.itemBorder, { paddingVertical: 6 }]}>
                              <TouchableOpacity
                                style={s.item}
                                activeOpacity={0.7}
                                onPress={() => setGymDetail({ name: c.name, planned: c.exerciseNames, logged: sub })}
                              >
                                <View style={s.itemIcon}><Ionicons name="barbell-outline" size={18} color={ACCENT} /></View>
                                <View style={s.itemBody}>
                                  <Text style={s.itemName}>{c.name}</Text>
                                  <View style={s.itemMeta}>
                                    <Text style={s.itemStat}>
                                      {sub.length > 0
                                        ? t('{n} loggade övningar', { n: sub.length })
                                        : c.exerciseNames.length > 0
                                          ? t('{n} övningar', { n: c.exerciseNames.length })
                                          : t('Avklarat pass')}
                                    </Text>
                                  </View>
                                </View>
                                <Ionicons name="checkmark-circle" size={18} color={GREEN} style={{ alignSelf: 'center' }} />
                                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" style={{ alignSelf: 'center' }} />
                              </TouchableOpacity>
                              {sub.map(w => {
                                const topKg = w.data.sets.reduce((m, r) => Math.max(m, r.weight_kg || 0), 0)
                                const totalReps = w.data.sets.reduce((sum, r) => sum + r.reps, 0)
                                return (
                                  <View key={w.id} style={s.subRow}>
                                    <View style={s.subDot} />
                                    <Text style={s.subName} numberOfLines={1}>{w.data.exercise_name}</Text>
                                    <Text style={s.subStat}>
                                      {w.data.sets.length} set · {totalReps} reps{topKg > 0 ? ` · ${topKg} kg` : ''}
                                    </Text>
                                  </View>
                                )
                              })}
                            </View>
                          ))}
                          {loose.map((w, i) => {
                            const totalReps = w.data.sets.reduce((sum, r) => sum + r.reps, 0)
                            return (
                              <TouchableOpacity
                                key={w.id}
                                style={[s.item, i < loose.length - 1 && s.itemBorder]}
                                activeOpacity={0.7}
                                onPress={() => setGymDetail({ name: w.name, planned: [], logged: [w] })}
                              >
                                <View style={s.itemIcon}><Ionicons name="barbell-outline" size={18} color={ACCENT} /></View>
                                <View style={s.itemBody}>
                                  <Text style={s.itemName}>{w.name}</Text>
                                  <View style={s.itemMeta}>
                                    <Text style={s.itemStat}>{w.data.sets.length} set</Text>
                                    {totalReps > 0 && (<><Text style={s.itemDot}>·</Text><Text style={s.itemStat}>{totalReps} reps</Text></>)}
                                  </View>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" style={{ alignSelf: 'center' }} />
                              </TouchableOpacity>
                            )
                          })}
                        </>
                      )
                    })()
                  )}
                </ScrollView>
              ))}
            </ScrollView>
          </>
        )}
      </Animated.View>

      <Modal visible={!!gymDetail} animationType="slide" onRequestClose={() => setGymDetail(null)}>
        {gymDetail && (
          <GymSummaryView
            name={gymDetail.name}
            dateLabel={dateStr}
            logged={gymDetail.logged}
            plannedNames={gymDetail.planned}
            allWorkouts={strengthWorkouts}
            onClose={() => setGymDetail(null)}
          />
        )}
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderBottomWidth: 0,
    overflow: 'hidden',
  },
  dragArea: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
  handle:   { width: 40, height: 5, backgroundColor: 'rgba(128,128,128,0.45)', borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  title:    { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700', textTransform: 'capitalize' },
  sub:      { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
  scroll:   { paddingHorizontal: 20, paddingBottom: 40 },
  section:  { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  tabBtn: { marginRight: 24, paddingBottom: 10, alignItems: 'flex-start' },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tabLabel: { color: TEXT_SECONDARY, fontSize: 15, fontWeight: '700' },
  tabCount: {
    minWidth: 20, paddingHorizontal: 6, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  tabCountText: { color: TEXT_SECONDARY, fontSize: 12, fontFamily: NUM_FONT_SEMI, fontVariant: ['tabular-nums'] },
  tabUnderline: {
    position: 'absolute', left: 0, bottom: -1, height: 2.5, borderRadius: 2,
    width: '100%',
  },
  empty:    { alignItems: 'center', paddingVertical: 24, gap: 10 },

  tasksWrap: {
    marginTop: 10, marginBottom: 18,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 4,
  },
  tasksHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DIVIDER,
  },
  tasksTitle: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
  tasksCount: { fontSize: 13, fontFamily: NUM_FONT_SEMI },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  editSave:   { color: ACCENT, fontSize: 13, fontWeight: '800' },
  editCancel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  taskRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.07)' },
  taskName: { color: TEXT_PRIMARY, fontSize: 14, flex: 1 },
  emptyText:{ color: TEXT_SECONDARY, fontSize: 14 },
  item:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  itemBorder:{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  itemIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: accentAlpha('22'), alignItems: 'center', justifyContent: 'center' },
  itemBody: { flex: 1, gap: 4 },
  itemName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemStat: { color: TEXT_SECONDARY, fontSize: 13 },
  itemDot:  { color: 'rgba(255,255,255,0.15)', fontSize: 13 },

  // Övningar under ett grupperat pass
  subRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingLeft: 50, paddingRight: 4, paddingVertical: 5,
  },
  subDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: accentAlpha('88') },
  subName: { flex: 1, color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' },
  subStat: { color: TEXT_SECONDARY, fontSize: 12, fontFamily: NUM_FONT_SEMI, fontVariant: ['tabular-nums'] },
})
