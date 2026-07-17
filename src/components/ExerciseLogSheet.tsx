import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Alert, InputAccessoryView, Dimensions,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Body from 'react-native-body-highlighter'
import { getMusclesForName, bestSideForMuscles, SLUG_LABELS } from '@/lib/muscles'
import * as Haptics from 'expo-haptics'
import { saveStrengthWorkout, deleteWorkout, getStrengthWorkouts, type StrengthSet } from '@/services/workouts'
import { getPersonalRecords, findNewPR, type ExerciseRecord } from '@/services/personalRecords'
import { dateForWeekday } from '@/services/workoutSchedule'
import { supabase } from '@/lib/supabase'
import { toLocalDateString } from '@/lib/date'
import { CATEGORY_LABELS, DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '@/services/exercises'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import type { ExerciseCategory } from '@/types/database'

type SetRow = { reps: string; weight: string }

const SCREEN_HEIGHT = Dimensions.get('window').height
const SHEET_SP      = { damping: 26, stiffness: 260, mass: 1 } as const

export type ExerciseLogProps = {
  id: string
  name: string
  description?: string
  category: string
  difficulty: string
  initialSets?: string
  initialReps?: string
  sessionExId?: string
  sessionDate?: string
  loggedWorkoutId?: string
  loggedWorkoutDate?: string
  onClose: () => void
  onSaved?: () => void
}

export function ExerciseLogSheet(props: ExerciseLogProps) {
  const { id, name, description, category, difficulty, onClose, onSaved } = props
  const insets   = useSafeAreaInsets()
  const FULL_TOP = insets.top + 8
  const PARTIAL  = SCREEN_HEIGHT * 0.36

  const muscles  = getMusclesForName(name ?? '')
  const initSide = bestSideForMuscles(muscles)
  const [bodyView, setBodyView] = useState<'front' | 'back'>(initSide)

  const [sets, setSets] = useState<SetRow[]>(() => {
    const count = props.initialSets ? parseInt(props.initialSets) : 1
    const reps  = props.initialReps ?? ''
    return Array.from({ length: Math.max(count, 1) }, () => ({ reps, weight: '' }))
  })
  const [saving, setSaving]     = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [datePicker, setDatePicker] = useState(false)

  const [record, setRecord]     = useState<ExerciseRecord | null>(null)
  const [prevSets, setPrevSets] = useState<StrengthSet[] | null>(null)

  useEffect(() => {
    async function loadHistory() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || !name) return
      const [records, workouts] = await Promise.all([
        getPersonalRecords(session.user.id).catch(() => [] as ExerciseRecord[]),
        getStrengthWorkouts(session.user.id).catch(() => []),
      ])
      setRecord(records.find(r => r.exerciseName === name) ?? null)
      const lastWo = workouts.find(w => w.data.exercise_name === name)
      if (lastWo && lastWo.data.sets.length > 0) setPrevSets(lastWo.data.sets)
    }
    loadHistory()
  }, [name])

  // ── Sheet-animation — öppnas hela vägen upp ──
  const snapState    = useSharedValue(1)   // 0 = partial, 1 = fullscreen
  const sheetTop     = useSharedValue(SCREEN_HEIGHT)
  const backdropAnim = useSharedValue(0)

  useEffect(() => {
    sheetTop.value     = withSpring(FULL_TOP, SHEET_SP)
    backdropAnim.value = withTiming(1, { duration: 260 })
  }, [])

  function dismiss() {
    sheetTop.value     = withTiming(SCREEN_HEIGHT + 50, { duration: 300 }, (f) => { if (f) runOnJS(onClose)() })
    backdropAnim.value = withTiming(0, { duration: 250 })
  }

  const panGesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate(e => {
      const base = snapState.value === 1 ? FULL_TOP : PARTIAL
      sheetTop.value = Math.max(FULL_TOP, Math.min(SCREEN_HEIGHT, base + e.translationY))
      const belowPartial = Math.max(0, sheetTop.value - PARTIAL)
      backdropAnim.value = Math.max(0, 1 - belowPartial / (SCREEN_HEIGHT - PARTIAL))
    })
    .onEnd(e => {
      const base   = snapState.value === 1 ? FULL_TOP : PARTIAL
      const endPos = base + e.translationY
      if (e.velocityY < -600 || endPos < PARTIAL * 0.45) {
        sheetTop.value     = withSpring(FULL_TOP, SHEET_SP)
        backdropAnim.value = withTiming(1, { duration: 200 })
        snapState.value    = 1
      } else if (e.velocityY > 600 || endPos > PARTIAL + 140) {
        sheetTop.value     = withTiming(SCREEN_HEIGHT + 50, { duration: 280 }, (f) => { if (f) runOnJS(onClose)() })
        backdropAnim.value = withTiming(0, { duration: 230 })
      } else {
        sheetTop.value     = withSpring(PARTIAL, SHEET_SP)
        backdropAnim.value = withTiming(1, { duration: 200 })
        snapState.value    = 0
      }
    })

  const sheetStyle    = useAnimatedStyle(() => ({ top: sheetTop.value }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropAnim.value }))

  const dpTranslateY   = useSharedValue(0)
  const dpBackdropAnim = useSharedValue(0)
  useEffect(() => {
    if (datePicker) {
      dpTranslateY.value   = 500
      dpBackdropAnim.value = 0
      dpTranslateY.value   = withSpring(0, { damping: 26, stiffness: 260 })
      dpBackdropAnim.value = withTiming(1, { duration: 260 })
    }
  }, [datePicker])
  function closeDatePicker() {
    dpTranslateY.value   = withTiming(500, { duration: 290 }, (f) => { if (f) runOnJS(setDatePicker)(false) })
    dpBackdropAnim.value = withTiming(0, { duration: 240 })
  }
  const dpPanGesture = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate(e => {
      if (e.translationY > 0) {
        dpTranslateY.value   = e.translationY
        dpBackdropAnim.value = Math.max(0, 1 - e.translationY / 300)
      }
    })
    .onEnd(e => {
      if (e.translationY > 100 || e.velocityY > 600) {
        dpTranslateY.value   = withTiming(500, { duration: 280 }, (f) => { if (f) runOnJS(setDatePicker)(false) })
        dpBackdropAnim.value = withTiming(0, { duration: 230 })
      } else {
        dpTranslateY.value   = withSpring(0, { damping: 26, stiffness: 260 })
        dpBackdropAnim.value = withTiming(1, { duration: 200 })
      }
    })
  const dpSheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: dpTranslateY.value }] }))
  const dpBackdropStyle = useAnimatedStyle(() => ({ opacity: dpBackdropAnim.value }))

  const DAY_OPTIONS = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const iso   = toLocalDateString(d)
    const label = i === 0 ? 'Idag' : i === 1 ? 'Igår' : d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' })
    return { iso, label }
  })
  const [workoutDate, setWorkoutDate] = useState(
    props.loggedWorkoutDate && DAY_OPTIONS.some(d => d.iso === props.loggedWorkoutDate)
      ? props.loggedWorkoutDate
      : DAY_OPTIONS[0].iso
  )

  const muscleData = muscles.map(slug => ({ slug, intensity: 1 as const }))
  const diffColor  = DIFFICULTY_COLORS[difficulty as keyof typeof DIFFICULTY_COLORS] ?? ORANGE

  function updateSet(index: number, field: keyof SetRow, value: string) {
    setSets(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }
  function addSet() {
    const last = sets[sets.length - 1]
    setSets(prev => [...prev, { reps: last.reps, weight: last.weight }])
  }
  function removeSet(index: number) {
    if (sets.length === 1) return
    setSets(prev => prev.filter((_, i) => i !== index))
  }

  async function markScheduleComplete(userId: string) {
    if (props.sessionExId && props.sessionDate) {
      await supabase
        .from('exercise_completions')
        .upsert(
          { exercise_id: props.sessionExId, user_id: userId, completed_date: props.sessionDate },
          { onConflict: 'exercise_id,user_id,completed_date' },
        )
      return
    }
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('id, weekdays, session_exercises(*)')
      .eq('user_id', userId)
    if (!sessions) return
    const completions: Array<{ exercise_id: string; user_id: string; completed_date: string }> = []
    for (const s of sessions) {
      const weekdays  = s.weekdays as number[]
      const exercises = s.session_exercises as Array<{ id: string; exercise_name: string }>
      const matching  = exercises.filter(e => e.exercise_name === name)
      for (const ex of matching) {
        for (const wd of weekdays) {
          completions.push({ exercise_id: ex.id, user_id: userId, completed_date: dateForWeekday(wd) })
        }
      }
    }
    if (completions.length > 0) {
      await supabase.from('exercise_completions').upsert(completions, { onConflict: 'exercise_id,user_id,completed_date' })
    }
  }

  async function handleSave(date: string) {
    const validSets = sets
      .map(s => ({ reps: parseInt(s.reps) || 0, weight_kg: parseFloat(s.weight) || 0 }))
      .filter(s => s.reps > 0)
    if (validSets.length === 0) {
      Alert.alert('Lägg till set', 'Fyll i minst ett set med reps.')
      return
    }
    setDatePicker(false)
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const userId = session.user.id
        const prevRecord = (await getPersonalRecords(userId).catch(() => []))
          .find(r => r.exerciseName === name)
        const ok = await saveStrengthWorkout({
          userId,
          exerciseId: id,
          exerciseName: name,
          category: category as 'strength' | 'mobility' | 'hiit',
          sets: validSets,
          workoutDate: date,
        })
        if (ok) {
          if (props.loggedWorkoutId) await deleteWorkout(props.loggedWorkoutId)
          await markScheduleComplete(userId)
          onSaved?.()
          const pr = findNewPR(prevRecord, validSets)
          if (pr) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            Alert.alert('🏆 Nytt personligt rekord!',
              `${name}: ${pr.weightKg} kg × ${pr.reps}\nEst. 1RM ${Math.round(pr.e1rm)} kg — se alla rekord i profilen.`,
              [{ text: 'Grymt!', onPress: () => dismiss() }])
          } else {
            Alert.alert('Sparat!', `${name} loggat.`, [{ text: 'OK', onPress: () => dismiss() }])
          }
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const totalReps = sets.reduce((s, r) => s + (parseInt(r.reps) || 0), 0)

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={dismiss} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetStyle]}>
        <GestureDetector gesture={panGesture}>
          <View style={styles.dragArea}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>{name}</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => setInfoOpen(true)} activeOpacity={0.8}>
                  <Ionicons name="information-circle-outline" size={22} color={TEXT_PRIMARY} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={dismiss} activeOpacity={0.8}>
                  <Ionicons name="close" size={22} color={TEXT_PRIMARY} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </GestureDetector>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.badgeRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{CATEGORY_LABELS[category as ExerciseCategory] ?? category}</Text>
              </View>
              <View style={[styles.diffBadge, { backgroundColor: diffColor + '22', borderColor: diffColor + '55' }]}>
                <Text style={[styles.diffBadgeText, { color: diffColor }]}>
                  {DIFFICULTY_LABELS[difficulty as keyof typeof DIFFICULTY_LABELS] ?? difficulty}
                </Text>
              </View>
            </View>

            {(record || prevSets) && (
              <View style={styles.historyRow}>
                {record && (
                  <View style={styles.historyChip}>
                    <Ionicons name="trophy" size={13} color="#FFD54F" />
                    <Text style={styles.historyChipText}>{record.bestWeightKg} kg × {record.bestWeightReps}</Text>
                  </View>
                )}
                {prevSets && (
                  <View style={styles.historyChip}>
                    <Ionicons name="time-outline" size={13} color={TEXT_SECONDARY} />
                    <Text style={styles.historyChipText}>
                      Senast {prevSets.length} set
                      {Math.max(...prevSets.map(p => p.weight_kg)) > 0 ? ` · topp ${Math.max(...prevSets.map(p => p.weight_kg))} kg` : ''}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Logga träning</Text>
              {sets.map((s, i) => {
                const prev = prevSets?.[i]
                return (
                  <View key={i} style={styles.setRow}>
                    <View style={styles.setIndex}><Text style={styles.setIndexText}>{i + 1}</Text></View>
                    <View style={styles.fieldWrap}>
                      <TextInput
                        style={styles.fieldInput}
                        value={s.reps}
                        onChangeText={v => updateSet(i, 'reps', v.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        placeholder={prev && prev.reps > 0 ? String(prev.reps) : '—'}
                        placeholderTextColor="rgba(255,255,255,0.22)"
                        inputAccessoryViewID={Platform.OS === 'ios' ? 'ex-log-kb' : undefined}
                      />
                      <Text style={styles.fieldSuffix}>reps</Text>
                    </View>
                    <View style={styles.fieldWrap}>
                      <TextInput
                        style={styles.fieldInput}
                        value={s.weight}
                        onChangeText={v => updateSet(i, 'weight', v.replace(/[^0-9.]/g, ''))}
                        keyboardType="decimal-pad"
                        placeholder={prev && prev.weight_kg > 0 ? String(prev.weight_kg) : '—'}
                        placeholderTextColor="rgba(255,255,255,0.22)"
                        inputAccessoryViewID={Platform.OS === 'ios' ? 'ex-log-kb' : undefined}
                      />
                      <Text style={styles.fieldSuffix}>kg</Text>
                    </View>
                    <TouchableOpacity style={styles.removeBtn} onPress={() => removeSet(i)}>
                      <Ionicons name="close-circle" size={20} color={sets.length > 1 ? 'rgba(255,255,255,0.3)' : 'transparent'} />
                    </TouchableOpacity>
                  </View>
                )
              })}
              {prevSets && <Text style={styles.ghostHint}>Grå siffror = förra passet</Text>}
              <TouchableOpacity style={styles.addSetBtn} onPress={addSet} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={18} color={ORANGE} />
                <Text style={styles.addSetText}>Lägg till set</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={[styles.saveWrap, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={() => setDatePicker(true)}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={19} color="#000" />
              <Text style={styles.saveBtnText}>
                {saving ? 'Sparar…' : `Spara pass  ·  ${sets.length} set${totalReps > 0 ? ` · ${totalReps} reps` : ''}`}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="ex-log-kb"><View style={{ height: 0 }} /></InputAccessoryView>
      )}

      {/* Datumväljare — View-lager (funkar även när sheeten ligger i en annan modal) */}
      {datePicker && (
        <View style={[StyleSheet.absoluteFill, styles.dpOverlay]}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }, dpBackdropStyle]}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeDatePicker} />
          </Animated.View>
          <GestureDetector gesture={dpPanGesture}>
            <Animated.View style={[styles.dpSheet, dpSheetStyle]}>
              <View style={styles.dpHandle} />
              <View style={styles.dpHeader}>
                <Text style={styles.dpTitle}>Välj dag</Text>
                <TouchableOpacity onPress={closeDatePicker} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={20} color={TEXT_PRIMARY} />
                </TouchableOpacity>
              </View>
              {DAY_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.iso}
                  style={[styles.dpRow, workoutDate === opt.iso && styles.dpRowActive]}
                  onPress={() => { setWorkoutDate(opt.iso); handleSave(opt.iso) }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dpRowText, workoutDate === opt.iso && styles.dpRowTextActive]}>{opt.label}</Text>
                  {workoutDate === opt.iso && <Ionicons name="checkmark" size={18} color={ORANGE} />}
                </TouchableOpacity>
              ))}
            </Animated.View>
          </GestureDetector>
        </View>
      )}

      {/* Info — helskärmslager */}
      {infoOpen && (
        <SafeAreaView style={[StyleSheet.absoluteFill, styles.infoSheet]} edges={['top', 'bottom']}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoTitle}>{name}</Text>
            <TouchableOpacity onPress={() => setInfoOpen(false)} activeOpacity={0.8}>
              <Ionicons name="close" size={24} color={TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.infoScroll} showsVerticalScrollIndicator={false}>
            {description ? (
              <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>Om övningen</Text>
                <Text style={styles.descText}>{description}</Text>
              </View>
            ) : null}
            <View style={styles.infoCard}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Muskelgrupper</Text>
                <View style={styles.toggle}>
                  {(['front', 'back'] as const).map(side => (
                    <TouchableOpacity key={side} style={[styles.toggleBtn, bodyView === side && styles.toggleBtnActive]} onPress={() => setBodyView(side)} activeOpacity={0.8}>
                      <Text style={[styles.toggleText, bodyView === side && styles.toggleTextActive]}>{side === 'front' ? 'Fram' : 'Bak'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.bodyWrap}>
                <Body data={muscleData} side={bodyView} gender="male" scale={1.6} colors={[ORANGE]} defaultFill="#2A2A2C" border="rgba(255,255,255,0.10)" />
              </View>
              {muscles.length > 0 ? (
                <View style={styles.muscleChips}>
                  {muscles.map(slug => (
                    <View key={slug} style={styles.muscleChip}><Text style={styles.muscleChipText}>{SLUG_LABELS[slug]}</Text></View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noMuscles}>Inga muskler mappade för denna övning</Text>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: BG,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderBottomWidth: 0, borderColor: BORDER,
    overflow: 'hidden',
  },
  dragArea: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center', marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 },
  sheetTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700', flex: 1 },
  headerActions: { flexDirection: 'row', gap: 6 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, gap: 16 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  categoryBadge: { backgroundColor: ORANGE + '22', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: ORANGE + '44' },
  categoryBadgeText: { color: ORANGE, fontSize: 13, fontWeight: '600' },
  diffBadge: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1 },
  diffBadgeText: { fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 20, gap: 14 },
  cardTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 3, gap: 2 },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: ORANGE },
  toggleText: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  toggleTextActive: { color: '#000' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  setIndex: { width: 36, height: 36, borderRadius: 10, backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center' },
  setIndexText: { color: ORANGE, fontSize: 14, fontWeight: '700' },
  fieldWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 48, backgroundColor: '#232326', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', paddingRight: 12 },
  fieldInput: { flex: 1, height: '100%', color: TEXT_PRIMARY, fontSize: 19, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  fieldSuffix: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  ghostHint: { color: 'rgba(255,255,255,0.28)', fontSize: 11, textAlign: 'center' },
  historyRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  historyChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, paddingVertical: 7 },
  historyChipText: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '600' },
  removeBtn: { width: 32, alignItems: 'center', justifyContent: 'center' },
  addSetBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  addSetText: { color: ORANGE, fontSize: 15, fontWeight: '600' },
  saveWrap: { paddingHorizontal: 20, paddingTop: 12 },
  saveBtn: { flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 18, alignItems: 'center', shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
  dpOverlay: { flex: 1, justifyContent: 'flex-end' },
  dpSheet: { backgroundColor: BG, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 36, paddingTop: 10 },
  dpHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center', marginBottom: 4 },
  dpHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  dpTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  dpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: BORDER },
  dpRowActive: { backgroundColor: ORANGE + '12' },
  dpRowText: { color: TEXT_PRIMARY, fontSize: 16 },
  dpRowTextActive: { color: ORANGE, fontWeight: '700' },
  infoSheet: { flex: 1, backgroundColor: BG },
  infoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: BORDER },
  infoTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700', flex: 1, marginRight: 12 },
  infoScroll: { padding: 20, gap: 16, paddingBottom: 32 },
  infoCard: { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 20, gap: 14 },
  bodyWrap: { alignItems: 'center' },
  muscleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muscleChip: { backgroundColor: 'rgba(255,143,0,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: ORANGE + '33' },
  muscleChipText: { color: ORANGE, fontSize: 13, fontWeight: '600' },
  noMuscles: { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center' },
  descText: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 22 },
})
