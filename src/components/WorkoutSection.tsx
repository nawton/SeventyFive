import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActionSheetIOS, Platform, Alert, Dimensions,
  Modal, KeyboardAvoidingView, TextInput, InputAccessoryView,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
  runOnJS,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import type { WorkoutSession, SessionExercise } from '@/services/workoutSchedule'

const GREEN    = '#4CAF50'
const SCREEN_W = Dimensions.get('window').width
const SCREEN_H = Dimensions.get('window').height

const GPS_KEYWORDS = ['löpning', 'running', 'jogging', 'cykling', 'cycling', 'promenad', 'walking', 'spring', 'intervallspring', 'gång']
function isGPS(name: string) {
  return GPS_KEYWORDS.some(kw => name.toLowerCase().includes(kw))
}

// ── Two-stage swipe constants ─────────────────────────────────────────────────
//
// Stage 1: card snaps to SNAP_OPEN — action button appears as a circle.
//          User can tap the circle OR continue dragging to stage 2.
//
// Stage 2: card dragged past SNAP_OPEN — button morphs pill-wise (width only,
//          height locked). On release past FULL_THRESHOLD, action fires.
//
const SNAP_OPEN      = 82                          // snap-to-open offset (px)
const FULL_THRESHOLD = Math.round(SCREEN_W * 0.54) // full-swipe auto-trigger

const BTN_H     = 52    // fixed — never changes
const BTN_MIN_W = BTN_H // circle: W === H
const BTN_MAX_W = 170   // pill at FULL_THRESHOLD
const BTN_R_PAD = 12    // gap from right edge of container

// mass: 1 + lower stiffness → critically damped, no visible bounce
const SP = { damping: 22, stiffness: 180, mass: 1 } as const

// ─── ExerciseRow ──────────────────────────────────────────────────────────────

function ExerciseRow({
  ex,
  done,
  onToggle,
  onDelete,
  onEditExercise,
  onStartCardio,
  onCardPress,
}: {
  ex:              SessionExercise
  done:            boolean
  onToggle:        () => void
  onDelete:        () => void
  onEditExercise:  (sets: number | null, reps: string | null) => void
  onStartCardio:   (name: string) => void
  onCardPress:     (ex: SessionExercise) => void
}) {
  // ── Exercise editor state ─────────────────────────────────────────────────

  const [editOpen, setEditOpen] = useState(false)
  const [editSets, setEditSets] = useState('')
  const [editReps, setEditReps] = useState('')

  function openExerciseEdit() {
    setEditSets(ex.sets != null ? String(ex.sets) : '')
    setEditReps(ex.reps ?? '')
    setEditOpen(true)
  }

  function saveExerciseEdit() {
    const sets = editSets.trim() ? parseInt(editSets) : null
    const reps = editReps.trim() || null
    onEditExercise(sets, reps)
    setEditOpen(false)
  }

  // ── Shared values ─────────────────────────────────────────────────────────

  const tx       = useSharedValue(0)  // card X offset
  const startTx  = useSharedValue(0)  // card position at gesture start
  const isOpen   = useSharedValue(0)  // 1 = snapped at SNAP_OPEN
  const overFull = useSharedValue(0)  // 1 = past FULL_THRESHOLD (haptic guard)

  // Collapse (delete animation)
  const maxH = useSharedValue(200)
  const opac = useSharedValue(1)
  const marg = useSharedValue(6)

  // Done visual (0 = undone, 1 = done)
  const doneV = useSharedValue(done ? 1 : 0)
  useEffect(() => {
    // same tight spring as SP — no bounce on done/undone transition
    doneV.value = withSpring(done ? 1 : 0, { damping: 22, stiffness: 180, mass: 1 })
  }, [done])

  // ── JS-thread callbacks (called via runOnJS) ──────────────────────────────

  function haptSnap()  { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }
  function haptFull()  { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) }

  function doToggle() {
    Haptics.notificationAsync(
      done ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
    )
    onToggle()
  }

  function handleDelete() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    opac.value = withTiming(0, { duration: 180 })
    maxH.value = withTiming(0, { duration: 270 })
    marg.value = withTiming(0, { duration: 270 }, () => runOnJS(onDelete)())
  }

  function showOptions() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const gps = isGPS(ex.exercise_name)
    if (Platform.OS === 'ios') {
      const options = gps
        ? ['Avbryt', 'Starta löpning', 'Ändra övning', 'Ta bort övning']
        : ['Avbryt', 'Ändra övning', 'Ta bort övning']
      ActionSheetIOS.showActionSheetWithOptions(
        { title: ex.exercise_name, options, destructiveButtonIndex: options.length - 1, cancelButtonIndex: 0 },
        (i) => {
          if (gps) {
            if (i === 1) onStartCardio(ex.exercise_name)
            if (i === 2) openExerciseEdit()
            if (i === 3) setTimeout(handleDelete, 60)
          } else {
            if (i === 1) openExerciseEdit()
            if (i === 2) setTimeout(handleDelete, 60)
          }
        },
      )
    } else {
      Alert.alert(ex.exercise_name, undefined, [
        ...(gps ? [{ text: 'Starta löpning', onPress: () => onStartCardio(ex.exercise_name) }] : []),
        { text: 'Ändra övning', onPress: openExerciseEdit },
        { text: 'Ta bort',      style: 'destructive' as const, onPress: handleDelete },
        { text: 'Avbryt',       style: 'cancel' as const },
      ])
    }
  }

  // Tapping the action button (circle/pill) when card is open → toggle + close
  function handleBtnPress() {
    Haptics.notificationAsync(
      done ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
    )
    onToggle()
    tx.value     = withSpring(0, SP)
    isOpen.value = 0
  }

  // Tapping the card body → navigate to exercise detail
  function handleCardPress() {
    if (isOpen.value === 1) {
      tx.value     = withSpring(0, SP)
      isOpen.value = 0
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onCardPress(ex)
  }

  // ── Pan gesture ───────────────────────────────────────────────────────────

  const panGesture = Gesture.Pan()
    .activeOffsetX([-8, 8])   // ignore tiny jitter
    .failOffsetY([-12, 12])   // yield to vertical scroll

    // Remember where card sits at the start of this gesture — handles stage 2
    // starting from the already-open position correctly
    .onBegin(() => {
      startTx.value = tx.value
    })

    .onUpdate((e) => {
      const raw = startTx.value + e.translationX

      // Never allow card to drift right of rest position
      if (raw >= 0) { tx.value = 0; return }

      // Rubber-band resistance beyond FULL_THRESHOLD
      tx.value = raw < -FULL_THRESHOLD
        ? -FULL_THRESHOLD - (Math.abs(raw) - FULL_THRESHOLD) * 0.18
        : raw

      // One-shot haptic when crossing the full-action threshold
      const nowOver = Math.abs(tx.value) >= FULL_THRESHOLD ? 1 : 0
      if (nowOver !== overFull.value) {
        overFull.value = nowOver
        if (nowOver === 1) runOnJS(haptFull)()
      }
    })

    .onEnd(() => {
      const absX = Math.abs(tx.value)

      if (absX >= FULL_THRESHOLD * 0.88) {
        // ── Full swipe: fire action + close ───────────────────────────────
        runOnJS(doToggle)()
        tx.value     = withSpring(0, SP)
        isOpen.value = 0

      } else if (tx.value > -(SNAP_OPEN * 0.45)) {
        // ── Swiped right from open, or didn't reach snap threshold: close ─
        tx.value     = withSpring(0, SP)
        isOpen.value = 0

      } else {
        // ── Snap to open (stage 1) ────────────────────────────────────────
        if (isOpen.value === 0) runOnJS(haptSnap)()
        tx.value     = withSpring(-SNAP_OPEN, SP)
        isOpen.value = 1
      }

      overFull.value = 0
    })

  const longPressGesture = Gesture.LongPress()
    .minDuration(370)
    .onStart(() => runOnJS(showOptions)())

  // Pan wins on horizontal drag; long press wins on stationary hold
  const gesture = Gesture.Race(panGesture, longPressGesture)

  // ── Animated styles ───────────────────────────────────────────────────────

  const wrapStyle = useAnimatedStyle(() => ({
    maxHeight:    maxH.value,
    opacity:      opac.value,
    marginBottom: marg.value,
    overflow:     'hidden' as const,
  }))

  const cardStyle = useAnimatedStyle(() => ({
    transform:       [{ translateX: tx.value }],
    backgroundColor: interpolateColor(doneV.value, [0, 1], [CARD, '#0B2418']),
    borderColor:     interpolateColor(doneV.value, [0, 1], [BORDER, GREEN + '45']),
  }))

  const barStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(doneV.value, [0, 1], [ORANGE, GREEN]),
  }))

  const ringStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(doneV.value, [0, 1], ['transparent', GREEN]),
    borderColor:     interpolateColor(doneV.value, [0, 1], [BORDER, GREEN]),
    transform: [{ scale: interpolate(doneV.value, [0, 0.5, 1], [1, 1.14, 1], 'clamp') }],
  }))

  const checkStyle = useAnimatedStyle(() => ({
    opacity:   doneV.value,
    transform: [{ scale: interpolate(doneV.value, [0, 1], [0.3, 1], 'clamp') }],
  }))

  // ── Action button styles ──────────────────────────────────────────────────
  //
  // Stage 1 (0 → SNAP_OPEN):    width 0 → BTN_MIN_W  (circle emerges)
  // Stage 2 (SNAP_OPEN → FULL): width BTN_MIN_W → BTN_MAX_W  (pill expands)
  // Height: BTN_H always fixed
  // borderRadius: BTN_H/2 always — ends stay fully rounded (pill, not oval)
  //
  const btnStyle = useAnimatedStyle(() => {
    const dist = Math.abs(tx.value)
    const w = dist <= SNAP_OPEN
      ? interpolate(dist, [0, SNAP_OPEN], [0, BTN_MIN_W], 'clamp')
      : interpolate(dist, [SNAP_OPEN, FULL_THRESHOLD], [BTN_MIN_W, BTN_MAX_W], 'clamp')

    return {
      width:           w,
      height:          BTN_H,
      borderRadius:    BTN_H / 2,
      overflow:        'hidden' as const,
      opacity:         interpolate(dist, [0, SNAP_OPEN * 0.25], [0, 1], 'clamp'),
      backgroundColor: done ? ORANGE : GREEN,
    }
  })

  // Label wrapper: width 0 in stage 1 (removes it from layout so icon stays
  // perfectly centered in the circle), expands during stage 2 as pill grows.
  const labelWrapStyle = useAnimatedStyle(() => ({
    width: interpolate(
      Math.abs(tx.value),
      [SNAP_OPEN + 14, SNAP_OPEN + 60],
      [0, 68],
      'clamp',
    ),
    opacity: interpolate(
      Math.abs(tx.value),
      [SNAP_OPEN + 14, SNAP_OPEN + 56],
      [0, 1],
      'clamp',
    ),
    overflow: 'hidden' as const,
  }))

  const actionIcon  = done ? 'arrow-undo' : 'checkmark'
  const actionLabel = done ? 'Ångra'      : 'Klar'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Animated.View style={wrapStyle}>

      {/* ── Exercise editor sheet ── */}
      <Modal
        visible={editOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setEditOpen(false)}
      >
        <KeyboardAvoidingView
          style={ee.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setEditOpen(false)}
            activeOpacity={1}
          />
          <View style={ee.sheet}>
            <View style={ee.header}>
              <TouchableOpacity onPress={() => setEditOpen(false)} style={ee.closeBtn}>
                <Ionicons name="close" size={20} color={TEXT_PRIMARY} />
              </TouchableOpacity>
              <Text style={ee.title} numberOfLines={1}>{ex.exercise_name}</Text>
              <View style={{ width: 36 }} />
            </View>

            <View style={ee.body}>
              <View style={ee.fieldRow}>
                <Text style={ee.fieldLabel}>SET</Text>
                <TextInput
                  style={ee.input}
                  value={editSets}
                  onChangeText={setEditSets}
                  placeholder="—"
                  placeholderTextColor={TEXT_SECONDARY}
                  keyboardType="number-pad"
                  inputAccessoryViewID={Platform.OS === 'ios' ? 'ex-editor-kb' : undefined}
                />
              </View>
              <View style={ee.fieldRow}>
                <Text style={ee.fieldLabel}>REPS</Text>
                <TextInput
                  style={ee.input}
                  value={editReps}
                  onChangeText={setEditReps}
                  placeholder="—"
                  placeholderTextColor={TEXT_SECONDARY}
                  keyboardType="number-pad"
                  inputAccessoryViewID={Platform.OS === 'ios' ? 'ex-editor-kb' : undefined}
                />
              </View>
              <TouchableOpacity style={ee.saveBtn} onPress={saveExerciseEdit} activeOpacity={0.85}>
                <Text style={ee.saveBtnText}>Spara</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
        {Platform.OS === 'ios' && (
          <InputAccessoryView nativeID="ex-editor-kb">
            <View style={{ height: 0 }} />
          </InputAccessoryView>
        )}
      </Modal>

      {/*
        Container: overflow hidden — clips left side of card during swipe.
        Action button lives here absolutely at right, revealed as card moves.
      */}
      <View style={r.container}>

        {/* Action button — behind card, revealed by swipe */}
        <View style={r.btnArea}>
          <TouchableOpacity onPress={handleBtnPress} activeOpacity={0.78}>
            <Animated.View style={[r.btn, btnStyle]}>
              <Ionicons name={actionIcon} size={20} color="#fff" />
              {/* Width-animated wrapper keeps icon centered in stage 1 circle */}
              <Animated.View style={labelWrapStyle}>
                <Text style={r.btnLabel} numberOfLines={1}>
                  {actionLabel}
                </Text>
              </Animated.View>
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Main card */}
        <GestureDetector gesture={gesture}>
          <Animated.View style={[r.row, cardStyle]}>
            <Animated.View style={[r.bar, barStyle]} />

            {/* Tapping the text area toggles completion */}
            <TouchableOpacity
              style={r.text}
              onPress={handleCardPress}
              activeOpacity={0.65}
            >
              <Text style={[r.name, done && r.nameDone]} numberOfLines={1}>
                {ex.exercise_name}
              </Text>
              {(ex.sets || ex.reps) && (
                <Text style={r.meta}>
                  {[ex.sets && `${ex.sets} set`, ex.reps && `${ex.reps} reps`]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={showOptions}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              style={r.optBtn}
            >
              <Ionicons name="ellipsis-horizontal" size={15} color={TEXT_SECONDARY} />
            </TouchableOpacity>

            <TouchableOpacity
              style={r.ringWrap}
              onPress={() => {
                Haptics.notificationAsync(
                  done
                    ? Haptics.NotificationFeedbackType.Warning
                    : Haptics.NotificationFeedbackType.Success,
                )
                onToggle()
              }}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
              activeOpacity={0.7}
            >
              <Animated.View style={[r.ring, ringStyle]}>
                <Animated.View style={checkStyle}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </Animated.View>
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>
        </GestureDetector>

      </View>
    </Animated.View>
  )
}

// ─── Styles (exercise row) ────────────────────────────────────────────────────

const r = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  btnArea: {
    position:       'absolute',
    right:          BTN_R_PAD,
    top:            0,
    bottom:         0,
    justifyContent: 'center',
    alignItems:     'flex-end',
  },
  btn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
  },
  btnLabel: {
    color:      '#fff',
    fontSize:   14,
    fontWeight: '700',
    marginLeft: 4,
  },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    borderRadius:    14,
    borderWidth:     1,
    overflow:        'hidden',
    minHeight:       62,
    backgroundColor: CARD,
  },
  bar:      { width: 3, alignSelf: 'stretch' },
  text:     { flex: 1, paddingVertical: 13, paddingHorizontal: 14 },
  name:     { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  nameDone: { color: TEXT_SECONDARY, textDecorationLine: 'line-through' },
  meta:     { color: TEXT_SECONDARY, fontSize: 12, marginTop: 3 },
  optBtn:   { paddingHorizontal: 6, paddingVertical: 10 },
  ringWrap: { paddingRight: 14, paddingLeft: 4 },
  ring: {
    width:          34,
    height:         34,
    borderRadius:   17,
    borderWidth:    2,
    alignItems:     'center',
    justifyContent: 'center',
  },
})

// ─── Exercise editor styles ───────────────────────────────────────────────────

const ee = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: Math.round(SCREEN_H * 0.56),
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  title: {
    flex: 1, textAlign: 'center',
    color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700',
  },
  body:      { padding: 20, gap: 14 },
  fieldRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fieldLabel: {
    width: 48, color: TEXT_SECONDARY,
    fontSize: 12, fontWeight: '700', letterSpacing: 1.5,
  },
  input: {
    flex: 1, backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    color: TEXT_PRIMARY, fontSize: 16,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  saveBtn: {
    backgroundColor: ORANGE, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  saveBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
})

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WorkoutSectionProps {
  session:           WorkoutSession
  checked:           Record<string, boolean>
  isCompleted:       boolean
  onToggleExercise:  (exId: string) => void
  onDeleteExercise:  (exId: string) => void
  onEditExercise:    (exId: string, sets: number | null, reps: string | null) => void
  onStartCardio:     (name: string) => void
  onCardPress:       (ex: SessionExercise) => void
  onComplete:        () => void
  onUncomplete:      () => void
  onEdit:            () => void
}

// ─── WorkoutSection ───────────────────────────────────────────────────────────

export function WorkoutSection({
  session,
  checked,
  isCompleted,
  onToggleExercise,
  onDeleteExercise,
  onEditExercise,
  onStartCardio,
  onCardPress,
  onComplete,
  onUncomplete,
  onEdit,
}: WorkoutSectionProps) {
  const total     = session.exercises.length
  const doneCount = session.exercises.filter(e => checked[e.id]).length
  const pct       = total > 0 ? doneCount / total : 0

  const completedV = useSharedValue(isCompleted ? 1 : 0)
  useEffect(() => {
    completedV.value = withSpring(isCompleted ? 1 : 0, { damping: 18, stiffness: 140 })
  }, [isCompleted])

  const headerStyle = useAnimatedStyle(() => ({
    borderColor:     interpolateColor(completedV.value, [0, 1], [BORDER, GREEN + '45']),
    backgroundColor: interpolateColor(completedV.value, [0, 1], [CARD, '#0A2416']),
  }))

  const accentBarStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(completedV.value, [0, 1], [ORANGE, GREEN]),
  }))

  const progressFillStyle = useAnimatedStyle(() => ({
    width:           `${(isCompleted ? 1 : pct) * 100}%` as any,
    backgroundColor: interpolateColor(completedV.value, [0, 1], [ORANGE, GREEN]),
  }))

  function handleComplete() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onComplete()
  }

  function handleUncomplete() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onUncomplete()
  }

  return (
    <View style={s.section}>

      {/* ── Session header ── */}
      <Animated.View style={[s.header, headerStyle]}>
        <Animated.View style={[s.headerAccent, accentBarStyle]} />

        <View style={[s.headerIcon, isCompleted && s.headerIconDone]}>
          <Ionicons
            name={isCompleted ? 'checkmark' : 'barbell-outline'}
            size={16}
            color={isCompleted ? '#fff' : ORANGE}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={s.sessionName}>{session.name}</Text>
          <Text style={s.sessionMeta}>
            {isCompleted
              ? 'Alla övningar klara'
              : total === 0
                ? 'Inga övningar tillagda'
                : `${doneCount} av ${total} klara`}
          </Text>
        </View>

        {isCompleted ? (
          <TouchableOpacity onPress={handleUncomplete} style={s.doneBadge} activeOpacity={0.7}>
            <Ionicons name="checkmark-circle" size={13} color={GREEN} />
            <Text style={s.doneBadgeText}>Klar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleComplete}
            style={[s.completeBtn, doneCount > 0 && s.completeBtnHot]}
            activeOpacity={0.75}
          >
            <Text style={[s.completeBtnText, doneCount > 0 && s.completeBtnTextHot]}>
              Klar
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={onEdit}
          style={s.editBtn}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        >
          <Ionicons name="ellipsis-horizontal" size={17} color={TEXT_SECONDARY} />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Progress bar ── */}
      {total > 0 && (
        <View style={s.progressTrack}>
          <Animated.View style={[s.progressFill, progressFillStyle]} />
        </View>
      )}

      {/* ── Exercise rows (flat, NOT nested inside session card) ── */}
      {total > 0 && (
        <View style={s.exList}>
          {session.exercises.map(ex => (
            <ExerciseRow
              key={ex.id}
              ex={ex}
              done={isCompleted || !!checked[ex.id]}
              onToggle={() => onToggleExercise(ex.id)}
              onDelete={() => onDeleteExercise(ex.id)}
              onEditExercise={(sets, reps) => onEditExercise(ex.id, sets, reps)}
              onStartCardio={onStartCardio}
              onCardPress={onCardPress}
            />
          ))}
        </View>
      )}

      {/* ── Add exercise ── */}
      <TouchableOpacity style={s.addRow} onPress={onEdit} activeOpacity={0.7}>
        <Ionicons name="add-circle-outline" size={16} color={ORANGE} />
        <Text style={s.addRowText}>Lägg till övning</Text>
      </TouchableOpacity>

    </View>
  )
}

// ─── Styles (section) ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  section: { marginBottom: 28 },

  header: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             11,
    borderRadius:    18,
    borderWidth:     1,
    overflow:        'hidden',
    paddingRight:    14,
    paddingVertical: 14,
  },
  headerAccent:   { width: 4, alignSelf: 'stretch' },
  headerIcon: {
    width:           38,
    height:          38,
    borderRadius:    11,
    backgroundColor: ORANGE + '20',
    alignItems:      'center',
    justifyContent:  'center',
  },
  headerIconDone:  { backgroundColor: GREEN },
  sessionName:     { color: TEXT_PRIMARY,   fontSize: 16, fontWeight: '700' },
  sessionMeta:     { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },

  doneBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    backgroundColor:   GREEN + '18',
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       GREEN + '40',
    paddingHorizontal: 9,
    paddingVertical:   5,
  },
  doneBadgeText:      { color: GREEN, fontSize: 12, fontWeight: '700' },

  completeBtn: {
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       BORDER,
  },
  completeBtnHot:     { borderColor: ORANGE + '80', backgroundColor: ORANGE + '15' },
  completeBtnText:    { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  completeBtnTextHot: { color: ORANGE },

  editBtn: {
    width:           30,
    height:          30,
    borderRadius:    9,
    backgroundColor: BG,
    alignItems:      'center',
    justifyContent:  'center',
  },

  progressTrack: {
    height:          3,
    backgroundColor: BORDER,
    borderRadius:    2,
    marginTop:       6,
    marginBottom:    10,
    overflow:        'hidden',
  },
  progressFill:  { height: 3, borderRadius: 2 },

  exList: { gap: 6, marginBottom: 6 },

  addRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    backgroundColor:   CARD,
    borderRadius:      14,
    borderWidth:       1,
    borderColor:       BORDER,
    borderStyle:       'dashed',
    paddingHorizontal: 16,
    paddingVertical:   14,
  },
  addRowText: { color: ORANGE, fontSize: 14, fontWeight: '500' },
})
