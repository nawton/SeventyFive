import { useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActionSheetIOS, Platform, Alert,
} from 'react-native'
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import type { WorkoutSession, SessionExercise } from '@/services/workoutSchedule'

const GREEN = '#4CAF50'
const RED   = '#E53935'

// ─── Exercise swipe hint ──────────────────────────────────────────────────────
// Shows green "Klar" or orange "Ångra" as the card slides left.

function ExerciseToggleHint({
  progress,
  isDone,
}: {
  progress: SharedValue<number>
  isDone: boolean
}) {
  const color = isDone ? ORANGE : GREEN

  const aStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(progress.value, [0, 0.3, 1], [0, 0.55, 1], 'clamp'),
    transform: [{ scale: interpolate(progress.value, [0, 0.5, 1], [0.55, 0.88, 1], 'clamp') }],
  }))

  return (
    <View style={[sh.wrap, { backgroundColor: color + '20' }]}>
      <Animated.View style={[sh.inner, aStyle]}>
        <Ionicons
          name={isDone ? 'arrow-undo-circle' : 'checkmark-circle'}
          size={28}
          color={color}
        />
        <Text style={[sh.label, { color }]}>{isDone ? 'Ångra' : 'Klar'}</Text>
      </Animated.View>
    </View>
  )
}

const sh = StyleSheet.create({
  wrap:  { width: 88, justifyContent: 'center', alignItems: 'center' },
  inner: { alignItems: 'center', gap: 5 },
  label: { fontSize: 12, fontWeight: '700' },
})

// ─── Animated exercise card ───────────────────────────────────────────────────

function ExerciseCard({
  ex,
  done,
  onToggle,
  onDelete,
  onEditSession,
}: {
  ex: SessionExercise
  done: boolean
  onToggle: () => void
  onDelete: () => void
  onEditSession: () => void
}) {
  const swRef   = useRef<SwipeableMethods>(null)
  const handled = useRef(false)

  // Collapse animation (when deleted)
  const maxH = useSharedValue(200)
  const opac = useSharedValue(1)
  const marg = useSharedValue(8)

  // Done state visual transition
  const doneV = useSharedValue(done ? 1 : 0)

  useEffect(() => {
    doneV.value = withSpring(done ? 1 : 0, { damping: 18, stiffness: 140 })
  }, [done])

  // ── Animated styles ──

  const wrapStyle = useAnimatedStyle(() => ({
    maxHeight:    maxH.value,
    opacity:      opac.value,
    marginBottom: marg.value,
    overflow:     'hidden' as const,
  }))

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(doneV.value, [0, 1], [BG, '#0A2416']),
    borderColor:     interpolateColor(doneV.value, [0, 1], [BORDER, GREEN + '60']),
  }))

  const accentStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(doneV.value, [0, 1], [ORANGE + 'BB', GREEN]),
  }))

  const checkRingStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(doneV.value, [0, 1], ['transparent', GREEN]),
    borderColor:     interpolateColor(doneV.value, [0, 1], [BORDER, GREEN]),
    transform: [{ scale: interpolate(doneV.value, [0, 0.45, 1], [1, 1.15, 1], 'clamp') }],
  }))

  const checkIconStyle = useAnimatedStyle(() => ({
    opacity:   doneV.value,
    transform: [{ scale: interpolate(doneV.value, [0, 1], [0.3, 1], 'clamp') }],
  }))

  // ── Handlers ──

  function handleToggle() {
    if (handled.current) return
    handled.current = true
    swRef.current?.close()
    onToggle()
    Haptics.notificationAsync(
      done
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success,
    )
    setTimeout(() => { handled.current = false }, 600)
  }

  function collapse() {
    opac.value = withTiming(0, { duration: 200 })
    maxH.value = withTiming(0, { duration: 290 })
    marg.value = withTiming(0, { duration: 290 }, () => runOnJS(onDelete)())
  }

  function handleDelete() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    collapse()
  }

  function showOptions() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title:                 ex.exercise_name,
          options:               ['Avbryt', 'Ändra pass', 'Ta bort övning'],
          destructiveButtonIndex: 2,
          cancelButtonIndex:     0,
        },
        (i) => {
          if (i === 1) onEditSession()
          if (i === 2) setTimeout(handleDelete, 60)
        },
      )
    } else {
      Alert.alert(ex.exercise_name, undefined, [
        { text: 'Ändra pass',    onPress: onEditSession },
        { text: 'Ta bort',        style: 'destructive', onPress: handleDelete },
        { text: 'Avbryt',         style: 'cancel' },
      ])
    }
  }

  return (
    <Animated.View style={wrapStyle}>
      <ReanimatedSwipeable
        ref={swRef}
        renderRightActions={(prog) => (
          <ExerciseToggleHint progress={prog} isDone={done} />
        )}
        rightThreshold={88}
        friction={1}
        overshootRight={false}
        overshootFriction={8}
        onSwipeableWillOpen={() =>
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }
        onSwipeableOpen={() => handleToggle()}
      >
        <TouchableOpacity
          onLongPress={showOptions}
          activeOpacity={0.88}
          delayLongPress={370}
        >
          <Animated.View style={[s.exCard, cardStyle]}>

            {/* Colored left accent bar */}
            <Animated.View style={[s.exAccent, accentStyle]} />

            {/* Name + sets/reps */}
            <View style={s.exInfo}>
              <Text
                style={[s.exCardName, done && s.exCardNameDone]}
                numberOfLines={1}
              >
                {ex.exercise_name}
              </Text>
              {(ex.sets || ex.reps) && (
                <Text style={s.exCardMeta}>
                  {[
                    ex.sets && `${ex.sets} set`,
                    ex.reps && `${ex.reps} reps`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              )}
            </View>

            {/* Options button */}
            <TouchableOpacity
              onPress={showOptions}
              style={s.optionsBtn}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            >
              <Ionicons name="ellipsis-horizontal" size={16} color={TEXT_SECONDARY} />
            </TouchableOpacity>

            {/* Check ring — visual indicator only, not touchable */}
            <View style={s.checkWrap}>
              <Animated.View style={[s.checkRing, checkRingStyle]}>
                <Animated.View style={checkIconStyle}>
                  <Ionicons name="checkmark" size={15} color="#fff" />
                </Animated.View>
              </Animated.View>
            </View>

          </Animated.View>
        </TouchableOpacity>
      </ReanimatedSwipeable>
    </Animated.View>
  )
}

// ─── Session card swipe action ────────────────────────────────────────────────

function SessionRightAction({
  progress,
  drag,
  isCompleted,
  onPress,
}: {
  progress: SharedValue<number>
  drag: SharedValue<number>
  isCompleted: boolean
  onPress: () => void
}) {
  const aStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(progress.value, [0, 0.35, 1], [0, 0.6, 1], 'clamp'),
    transform: [
      { scale:       interpolate(progress.value, [0, 0.6, 1], [0.5, 0.85, 1], 'clamp') },
      { translateX:  interpolate(drag.value, [-140, -72], [8, 0], 'clamp') },
    ],
  }))

  const color = isCompleted ? RED : GREEN

  return (
    <View style={s.sessionActionOuter}>
      <Animated.View style={[s.sessionActionInner, aStyle]}>
        <TouchableOpacity
          style={[s.sessionActionBtn, { backgroundColor: color }]}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isCompleted ? 'arrow-undo-outline' : 'checkmark'}
            size={24}
            color="#fff"
          />
          <Text style={s.sessionActionText}>{isCompleted ? 'Ångra' : 'Klar'}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  session: WorkoutSession
  checked: Record<string, boolean>
  isCompleted: boolean
  onToggleExercise: (exId: string) => void
  onDeleteExercise: (exId: string) => void
  onComplete: () => void
  onUncomplete: () => void
  onEdit: () => void
}

// ─── Session card ─────────────────────────────────────────────────────────────

export function SwipeableSessionCard({
  session,
  checked,
  isCompleted,
  onToggleExercise,
  onDeleteExercise,
  onComplete,
  onUncomplete,
  onEdit,
}: Props) {
  const swipeableRef = useRef<SwipeableMethods>(null)
  const handledRef   = useRef(false)

  const total     = session.exercises.length
  const doneCount = session.exercises.filter(e => checked[e.id]).length
  const pct       = total > 0 ? doneCount / total : 0
  const allExDone = total > 0 && doneCount === total

  function close() { swipeableRef.current?.close() }

  function handleComplete() {
    if (handledRef.current) return
    handledRef.current = true
    close()
    onComplete()
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setTimeout(() => { handledRef.current = false }, 800)
  }

  function handleUncomplete() {
    if (handledRef.current) return
    handledRef.current = true
    close()
    onUncomplete()
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setTimeout(() => { handledRef.current = false }, 800)
  }

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      renderRightActions={(prog, drag) => (
        <SessionRightAction
          progress={prog}
          drag={drag}
          isCompleted={isCompleted}
          onPress={isCompleted ? handleUncomplete : handleComplete}
        />
      )}
      rightThreshold={72}
      friction={1}
      overshootRight={false}
      overshootFriction={6}
      onSwipeableWillOpen={() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      }
      onSwipeableOpen={() => {
        if (isCompleted) handleUncomplete()
        else handleComplete()
      }}
    >
      <View style={[s.card, isCompleted && s.cardDone]}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={[s.sessionIcon, isCompleted && s.sessionIconDone]}>
            <Ionicons
              name={isCompleted ? 'checkmark' : 'barbell-outline'}
              size={18}
              color={isCompleted ? '#fff' : ORANGE}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.sessionName}>{session.name}</Text>
            <Text style={s.sessionMeta}>
              {isCompleted
                ? 'Avslutat'
                : total === 0
                  ? 'Inga övningar'
                  : `${doneCount} av ${total} övningar klara`}
            </Text>
          </View>

          {isCompleted ? (
            <View style={s.klarBadge}>
              <Ionicons name="checkmark-circle" size={13} color={GREEN} />
              <Text style={s.klarBadgeText}>Klar</Text>
            </View>
          ) : (
            total > 0 && pct > 0 && (
              <View style={s.pctBadge}>
                <Text style={s.pctText}>{Math.round(pct * 100)}%</Text>
              </View>
            )
          )}

          <TouchableOpacity
            onPress={onEdit}
            style={s.editBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={TEXT_SECONDARY} />
          </TouchableOpacity>
        </View>

        {/* ── Progress bar ── */}
        {total > 0 && (
          <View style={s.progressWrap}>
            <View style={s.progressBg}>
              <View
                style={[
                  s.progressFill,
                  { width: `${(isCompleted ? 1 : pct) * 100}%` as any },
                  (isCompleted || allExDone) && { backgroundColor: GREEN },
                ]}
              />
            </View>
          </View>
        )}

        {/* ── Exercise cards ── */}
        {total === 0 ? (
          <TouchableOpacity style={s.addHint} onPress={onEdit} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={16} color={ORANGE} />
            <Text style={s.addHintText}>Lägg till övningar</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.exList}>
            {session.exercises.map(ex => (
              <ExerciseCard
                key={ex.id}
                ex={ex}
                done={isCompleted || !!checked[ex.id]}
                onToggle={() => onToggleExercise(ex.id)}
                onDelete={() => onDeleteExercise(ex.id)}
                onEditSession={onEdit}
              />
            ))}
          </View>
        )}

        {/* ── Completed banner ── */}
        {isCompleted && (
          <View style={s.completedBanner}>
            <Ionicons name="trophy-outline" size={15} color={GREEN} />
            <Text style={s.completedBannerText}>Passet avslutat — bra jobbat!</Text>
          </View>
        )}

        {/* ── Swipe hint ── */}
        {!isCompleted && total > 0 && doneCount === 0 && (
          <View style={s.swipeHint}>
            <Ionicons name="chevron-back" size={11} color={TEXT_SECONDARY} style={{ opacity: 0.35 }} />
            <Text style={s.swipeHintText}>Svep en övning åt vänster för att markera klar</Text>
          </View>
        )}

      </View>
    </ReanimatedSwipeable>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Session card shell
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  cardDone: {
    borderLeftWidth: 3,
    borderLeftColor: GREEN,
    borderColor: GREEN + '40',
  },

  // Session swipe action
  sessionActionOuter: {
    width: 96,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 10,
  },
  sessionActionInner: {
    width: 80,
    height: '82%' as any,
    borderRadius: 18,
    overflow: 'hidden',
  },
  sessionActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  sessionActionText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Session header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  sessionIcon: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: ORANGE + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  sessionIconDone:  { backgroundColor: GREEN },
  sessionName:      { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  sessionMeta:      { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  klarBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: GREEN + '18', borderRadius: 10,
    borderWidth: 1, borderColor: GREEN + '40',
    paddingHorizontal: 8, paddingVertical: 4,
  },
  klarBadgeText: { color: GREEN, fontSize: 12, fontWeight: '700' },
  pctBadge: {
    backgroundColor: ORANGE + '20', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  pctText:  { color: ORANGE, fontSize: 13, fontWeight: '700' },
  editBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: BG, alignItems: 'center', justifyContent: 'center',
  },

  // Progress bar
  progressWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  progressBg:   { height: 3, backgroundColor: BORDER, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: ORANGE, borderRadius: 2 },

  // Exercise list container
  exList: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 4,
  },

  // Exercise card
  exCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG,
    overflow: 'hidden',
    minHeight: 66,
  },
  exAccent: {
    width: 3,
    alignSelf: 'stretch',
  },
  exInfo: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  exCardName: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  exCardNameDone: {
    textDecorationLine: 'line-through',
    color: TEXT_SECONDARY,
  },
  exCardMeta: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    marginTop: 4,
  },
  optionsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  checkWrap: {
    paddingRight: 14,
    paddingLeft: 4,
  },
  checkRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Add hint (when no exercises)
  addHint: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12,
    backgroundColor: BG,
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 16,
  },
  addHintText: { color: ORANGE, fontSize: 14, fontWeight: '500' },

  // Completed banner
  completedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: GREEN + '15', paddingVertical: 12, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: GREEN + '30',
  },
  completedBannerText: { color: GREEN, fontSize: 14, fontWeight: '600' },

  // Swipe hint
  swipeHint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3,
    paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  swipeHintText: { color: TEXT_SECONDARY, fontSize: 11, opacity: 0.4 },
})
