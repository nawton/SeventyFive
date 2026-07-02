import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActionSheetIOS, Platform,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, router } from 'expo-router'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, interpolate, runOnJS,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getExercises, type Exercise } from '@/services/exercises'
import {
  getWorkoutSessions,
  deleteSessionWithSkips,
  deleteFutureOnceSessions,
  type WorkoutSession,
} from '@/services/workoutSchedule'
import { SessionEditor, WEEKDAYS } from '@/components/SessionEditor'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

const SCREEN_W       = Dimensions.get('window').width
const SNAP_OPEN      = 82
const FULL_THRESHOLD = Math.round(SCREEN_W * 0.54)
const BTN_MIN_W      = 52
const BTN_MAX_W      = 160
const BTN_R_PAD      = 12
const CARD_GAP       = 12
const SP = { damping: 22, stiffness: 180, mass: 1 } as const

// ── Swipeable session card ─────────────────────────────────────────────────────

function SwipeableSessionCard({
  session,
  name,
  subtitle,
  onEdit,
  onDelete,
}: {
  session:  WorkoutSession
  name:     string
  subtitle: string
  onEdit:   () => void
  onDelete: () => void
}) {
  const tx       = useSharedValue(0)
  const startTx  = useSharedValue(0)
  const isOpen   = useSharedValue(0)
  const overFull = useSharedValue(0)
  const maxH     = useSharedValue(500)
  const opac     = useSharedValue(1)
  const marg     = useSharedValue(CARD_GAP)

  function haptSnap() { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }
  function haptFull() { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) }

  function triggerDelete() {
    opac.value = withTiming(0, { duration: 180 })
    maxH.value = withTiming(0, { duration: 270 })
    marg.value = withTiming(0, { duration: 270 }, () => runOnJS(onDelete)())
  }

  function showDeleteConfirm() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: name,
          message: 'Tar bort passet från alla kommande schemalagda tillfällen.',
          options: ['Avbryt', 'Redigera', 'Ta bort'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        i => { if (i === 1) onEdit(); if (i === 2) triggerDelete() },
      )
    } else {
      Alert.alert(name, 'Tar bort passet från alla kommande schemalagda tillfällen.', [
        { text: 'Redigera', onPress: onEdit },
        { text: 'Ta bort', style: 'destructive', onPress: triggerDelete },
        { text: 'Avbryt', style: 'cancel' },
      ])
    }
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onBegin(() => { startTx.value = tx.value })
    .onUpdate(e => {
      const raw = startTx.value + e.translationX
      if (raw >= 0) { tx.value = 0; return }
      tx.value = raw < -FULL_THRESHOLD
        ? -FULL_THRESHOLD - (Math.abs(raw) - FULL_THRESHOLD) * 0.18
        : raw
      const nowOver = Math.abs(tx.value) >= FULL_THRESHOLD ? 1 : 0
      if (nowOver !== overFull.value) { overFull.value = nowOver; if (nowOver === 1) runOnJS(haptFull)() }
    })
    .onEnd(() => {
      const absX = Math.abs(tx.value)
      if (absX >= FULL_THRESHOLD * 0.88) { tx.value = withTiming(-SCREEN_W, { duration: 220 }); runOnJS(triggerDelete)() }
      else if (tx.value > -(SNAP_OPEN * 0.45)) { tx.value = withSpring(0, SP); isOpen.value = 0 }
      else { if (isOpen.value === 0) runOnJS(haptSnap)(); tx.value = withSpring(-SNAP_OPEN, SP); isOpen.value = 1 }
      overFull.value = 0
    })

  const longPress = Gesture.LongPress()
    .minDuration(370)
    .onStart(() => runOnJS(showDeleteConfirm)())

  const wrapStyle = useAnimatedStyle(() => ({
    maxHeight: maxH.value, opacity: opac.value, marginBottom: marg.value, overflow: 'hidden' as const,
  }))
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }))
  const btnStyle  = useAnimatedStyle(() => {
    const dist = Math.abs(tx.value)
    const w = dist <= SNAP_OPEN
      ? interpolate(dist, [0, SNAP_OPEN], [0, BTN_MIN_W], 'clamp')
      : interpolate(dist, [SNAP_OPEN, FULL_THRESHOLD], [BTN_MIN_W, BTN_MAX_W], 'clamp')
    return {
      width: w, borderRadius: BTN_MIN_W / 2, overflow: 'hidden' as const,
      opacity: interpolate(dist, [0, SNAP_OPEN * 0.25], [0, 1], 'clamp'),
      backgroundColor: '#E53935',
    }
  })
  const labelWrapStyle = useAnimatedStyle(() => ({
    width:   interpolate(Math.abs(tx.value), [SNAP_OPEN + 14, SNAP_OPEN + 60], [0, 62], 'clamp'),
    opacity: interpolate(Math.abs(tx.value), [SNAP_OPEN + 14, SNAP_OPEN + 60], [0, 1], 'clamp'),
    overflow: 'hidden' as const,
  }))

  return (
    <Animated.View style={wrapStyle}>
      <View style={c.container}>
        {/* Delete reveal button */}
        <View style={c.btnArea}>
          <TouchableOpacity onPress={triggerDelete} activeOpacity={0.78}>
            <Animated.View style={[c.btn, btnStyle]}>
              <Ionicons name="trash" size={18} color="#fff" />
              <Animated.View style={labelWrapStyle}>
                <Text style={c.btnLabel} numberOfLines={1}>Ta bort</Text>
              </Animated.View>
            </Animated.View>
          </TouchableOpacity>
        </View>

        <GestureDetector gesture={Gesture.Race(pan, longPress)}>
          <Animated.View style={cardStyle}>
            <View style={c.card}>
              <View style={c.cardLeft}>
                <Text style={c.cardName}>{name}</Text>
                {subtitle ? (
                  <View style={c.dayPills}>
                    <View style={c.pill}>
                      <Text style={c.pillText}>{subtitle}</Text>
                    </View>
                  </View>
                ) : null}
                {session.exercises.length > 0 && (
                  <Text style={c.exCount}>
                    {session.exercises.length} övning{session.exercises.length !== 1 ? 'ar' : ''}
                  </Text>
                )}
              </View>
              <TouchableOpacity style={c.editBtn} onPress={onEdit} activeOpacity={0.7}>
                <Ionicons name="create-outline" size={19} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ManageSessionsScreen() {
  const [sessions, setSessions]             = useState<WorkoutSession[]>([])
  const [exercises, setExercises]           = useState<Exercise[]>([])
  const [userId, setUserId]                 = useState<string | null>(null)
  const [loadError, setLoadError]           = useState<string | null>(null)
  const [editorVisible, setEditorVisible]   = useState(false)
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null)

  async function loadData(uid: string) {
    setLoadError(null)
    try {
      const [sess, exs] = await Promise.all([
        getWorkoutSessions(uid),
        getExercises().catch(() => [] as Exercise[]),
      ])
      setSessions(sess)
      setExercises(exs)
    } catch (e: any) {
      setLoadError(e?.message ?? 'Kunde inte ladda pass')
      setSessions([])
    }
  }

  useFocusEffect(useCallback(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoadError('Inte inloggad'); return }
      setUserId(user.id)
      loadData(user.id)
    }).catch(e => setLoadError(e?.message ?? 'Auth-fel'))
  }, []))

  function displayName(s: WorkoutSession): string {
    if (s.name.startsWith('ONCE:')) return s.name.split(':').slice(2).join(':')
    return s.name
  }

  function sessionSubtitle(s: WorkoutSession): string {
    if (s.weekdays.length > 0) {
      return [...s.weekdays].sort((a, b) => a - b).map(d => WEEKDAYS[d - 1]).join(', ')
    }
    if (s.name.startsWith('ONCE:')) return s.name.split(':')[1]
    return ''
  }

  const managed = sessions.filter(s => s.weekdays.length > 0)

  return (
    <SafeAreaView style={s.screen} edges={['top']}>

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.navigate('/(app)/add')} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={s.titleWrap} pointerEvents="none">
          <Text style={s.title}>Schemalagda pass</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {loadError ? (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: '#E53935' }]}>Fel</Text>
            <Text style={s.emptyText}>{loadError}</Text>
          </View>
        ) : managed.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="calendar-outline" size={32} color={ORANGE} />
            </View>
            <Text style={s.emptyTitle}>Inga schemalagda pass</Text>
            <Text style={s.emptyText}>Skapa ett pass med "Upprepa" för att se det här</Text>
          </View>
        ) : (
          managed.map(sess => (
            <SwipeableSessionCard
              key={sess.id}
              session={sess}
              name={displayName(sess)}
              subtitle={sessionSubtitle(sess)}
              onEdit={() => { setEditingSession(sess); setEditorVisible(true) }}
              onDelete={() => {
                if (userId) {
                  deleteSessionWithSkips(userId, sess.id)
                    .catch(() => {})
                    .finally(() => loadData(userId!))
                }
              }}
            />
          ))
        )}
      </ScrollView>

      {userId && (
        <TouchableOpacity
          style={s.clearBtn}
          activeOpacity={0.8}
          onPress={() => {
            if (Platform.OS === 'ios') {
              ActionSheetIOS.showActionSheetWithOptions(
                {
                  title: 'Rensa framtida pass',
                  message: 'Tar bort alla engångssessioner som inte har körts ännu.',
                  options: ['Avbryt', 'Rensa'],
                  destructiveButtonIndex: 1,
                  cancelButtonIndex: 0,
                },
                i => {
                  if (i !== 1 || !userId) return
                  deleteFutureOnceSessions(userId)
                    .then(count => { loadData(userId!); Alert.alert('Klart', `${count} framtida pass borttagna.`) })
                    .catch(() => Alert.alert('Fel', 'Kunde inte ta bort passen.'))
                },
              )
            } else {
              Alert.alert(
                'Rensa framtida pass',
                'Tar bort alla engångssessioner som inte har körts ännu.',
                [
                  { text: 'Avbryt', style: 'cancel' },
                  {
                    text: 'Rensa', style: 'destructive',
                    onPress: () => {
                      if (!userId) return
                      deleteFutureOnceSessions(userId)
                        .then(count => { loadData(userId!); Alert.alert('Klart', `${count} framtida pass borttagna.`) })
                        .catch(() => Alert.alert('Fel', 'Kunde inte ta bort passen.'))
                    },
                  },
                ],
              )
            }
          }}
        >
          <Ionicons name="trash-outline" size={16} color="#E53935" />
          <Text style={s.clearBtnText}>Rensa framtida engångssessioner</Text>
        </TouchableOpacity>
      )}

      {userId && (
        <SessionEditor
          visible={editorVisible}
          session={editingSession}
          exercises={exercises}
          userId={userId}
          onClose={() => setEditorVisible(false)}
          onSaved={() => { if (userId) loadData(userId) }}
        />
      )}
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const c = StyleSheet.create({
  container: { overflow: 'hidden' },
  btnArea: {
    position: 'absolute', right: BTN_R_PAD,
    top: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'flex-end',
  },
  btn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, height: 52,
  },
  btnLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    padding: 16, gap: 12,
  },
  cardLeft:  { flex: 1, gap: 8 },
  cardName:  { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  dayPills:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: ORANGE + '20', borderWidth: 1, borderColor: ORANGE + '50',
  },
  pillText: { color: ORANGE, fontSize: 12, fontWeight: '700' },
  exCount:  { color: TEXT_SECONDARY, fontSize: 12 },
  editBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: BG, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
})

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER, height: 56,
  },
  backBtn:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  titleWrap: {
    position: 'absolute', left: 0, right: 0, height: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  title:    { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  scroll:   { padding: 16, paddingBottom: 60 },
  empty:    { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: ORANGE + '18',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  emptyText:  { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, paddingHorizontal: 20,
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 14, borderWidth: 1,
    borderColor: '#E5393520', backgroundColor: '#E5393510',
  },
  clearBtnText: { color: '#E53935', fontSize: 14, fontWeight: '600' },
})
