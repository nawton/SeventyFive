import { useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import type { WorkoutSession } from '@/services/workoutSchedule'

const GREEN = '#4CAF50'

interface Props {
  session: WorkoutSession
  checked: Record<string, boolean>
  isCompleted: boolean
  onToggleExercise: (exId: string) => void
  onComplete: () => void
  onUncomplete: () => void
  onEdit: () => void
}

export function SwipeableSessionCard({
  session,
  checked,
  isCompleted,
  onToggleExercise,
  onComplete,
  onUncomplete,
  onEdit,
}: Props) {
  const swipeableRef = useRef<Swipeable>(null)
  const handledRef   = useRef(false)

  const total     = session.exercises.length
  const doneCount = session.exercises.filter(e => checked[e.id]).length
  const pct       = total > 0 ? doneCount / total : 0
  const allExDone = total > 0 && doneCount === total

  function closeSwipeable() {
    swipeableRef.current?.close()
  }

  function handleComplete() {
    if (handledRef.current) return
    handledRef.current = true
    closeSwipeable()
    onComplete()
    setTimeout(() => { handledRef.current = false }, 600)
  }

  function handleUncomplete() {
    if (handledRef.current) return
    handledRef.current = true
    closeSwipeable()
    onUncomplete()
    setTimeout(() => { handledRef.current = false }, 600)
  }

  function renderRightActions(
    progress: Animated.AnimatedInterpolation<number>,
  ) {
    const scale = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.85, 1],
      extrapolate: 'clamp',
    })
    const opacity = progress.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, 0.8, 1],
      extrapolate: 'clamp',
    })

    if (isCompleted) {
      return (
        <Animated.View style={[s.actionWrap, { opacity, transform: [{ scale }] }]}>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: '#E53935' }]}
            onPress={handleUncomplete}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-undo-outline" size={22} color="#fff" />
            <Text style={s.actionText}>Ångra</Text>
          </TouchableOpacity>
        </Animated.View>
      )
    }

    return (
      <Animated.View style={[s.actionWrap, { opacity, transform: [{ scale }] }]}>
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: GREEN }]}
          onPress={handleComplete}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark" size={24} color="#fff" />
          <Text style={s.actionText}>Klar</Text>
        </TouchableOpacity>
      </Animated.View>
    )
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={72}
      friction={1.8}
      overshootRight={false}
      overshootFriction={8}
      onSwipeableOpen={() => {
        if (isCompleted) handleUncomplete()
        else handleComplete()
      }}
    >
      <View style={[s.card, isCompleted && s.cardDone]}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={[s.icon, isCompleted && s.iconDone]}>
            <Ionicons
              name={isCompleted ? 'checkmark' : 'barbell-outline'}
              size={18}
              color={isCompleted ? '#fff' : ORANGE}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{session.name}</Text>
            <Text style={s.meta}>
              {isCompleted
                ? 'Avslutat'
                : total === 0 ? 'Inga övningar'
                : `${doneCount} av ${total} klara`}
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
              <View style={[
                s.progressFill,
                { width: `${(isCompleted ? 1 : pct) * 100}%` as any },
                (isCompleted || allExDone) && { backgroundColor: GREEN },
              ]} />
            </View>
          </View>
        )}

        {/* ── Exercise list ── */}
        {total === 0 ? (
          <TouchableOpacity style={s.addHint} onPress={onEdit} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={16} color={ORANGE} />
            <Text style={s.addHintText}>Lägg till övningar</Text>
          </TouchableOpacity>
        ) : (
          session.exercises.map((ex, idx) => {
            const done = isCompleted || !!checked[ex.id]
            return (
              <TouchableOpacity
                key={ex.id}
                style={[s.exRow, idx === 0 && s.exRowFirst, done && s.exRowDone]}
                onPress={() => !isCompleted && onToggleExercise(ex.id)}
                activeOpacity={isCompleted ? 1 : 0.65}
              >
                <View style={[s.checkbox, done && s.checkboxDone]}>
                  {done && <Ionicons name="checkmark" size={11} color="#000" />}
                </View>
                <Text style={[s.exName, done && s.exNameDone]} numberOfLines={1}>
                  {ex.exercise_name}
                </Text>
                {(ex.sets || ex.reps) && (
                  <View style={[s.setsBadge, done && { opacity: 0.3 }]}>
                    <Text style={s.setsText}>
                      {[ex.sets && `${ex.sets}×`, ex.reps].filter(Boolean).join('')}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })
        )}

        {/* ── Completed banner ── */}
        {isCompleted && (
          <View style={s.completedBanner}>
            <Ionicons name="trophy-outline" size={15} color={GREEN} />
            <Text style={s.completedBannerText}>Passet avslutat — bra jobbat!</Text>
          </View>
        )}

        {/* Swipe hint (only if not completed and no exercises checked yet) */}
        {!isCompleted && doneCount === 0 && total > 0 && (
          <View style={s.swipeHint}>
            <Ionicons name="chevron-back" size={11} color={TEXT_SECONDARY} style={{ opacity: 0.5 }} />
            <Text style={s.swipeHintText}>Svep för att markera klart</Text>
          </View>
        )}

      </View>
    </Swipeable>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  cardDone: {
    borderColor: GREEN + '60',
    borderLeftWidth: 3,
    borderLeftColor: GREEN,
  },

  // Swipe action
  actionWrap: {
    width: 90,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionBtn: {
    width: 76,
    height: '88%' as any,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: ORANGE + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDone: {
    backgroundColor: GREEN,
  },
  name: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  meta: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  klarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: GREEN + '18',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GREEN + '40',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  klarBadgeText: { color: GREEN, fontSize: 12, fontWeight: '700' },
  pctBadge: {
    backgroundColor: ORANGE + '20',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pctText: { color: ORANGE, fontSize: 13, fontWeight: '700' },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Progress
  progressWrap: { paddingHorizontal: 16, paddingBottom: 6 },
  progressBg: { height: 4, backgroundColor: BORDER, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: ORANGE, borderRadius: 2 },

  // Exercise rows
  addHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  addHintText: { color: ORANGE, fontSize: 14, fontWeight: '500' },

  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  exRowFirst: { borderTopWidth: 1, borderTopColor: BORDER },
  exRowDone: { backgroundColor: 'rgba(255,255,255,0.01)' },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: ORANGE, borderColor: ORANGE },
  exName: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontWeight: '500' },
  exNameDone: {
    color: TEXT_SECONDARY,
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  setsBadge: {
    backgroundColor: BG,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  setsText: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },

  // Completed banner
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: GREEN + '15',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: GREEN + '30',
  },
  completedBannerText: { color: GREEN, fontSize: 14, fontWeight: '600' },

  // Swipe hint
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  swipeHintText: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    opacity: 0.5,
  },
})
