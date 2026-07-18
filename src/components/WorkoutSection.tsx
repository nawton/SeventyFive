import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActionSheetIOS, Platform, Alert, Dimensions,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
  runOnJS,
  Easing,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { ORANGE, RED, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT } from '@/lib/theme'
import type { WorkoutSession, SessionExercise } from '@/services/workoutSchedule'

const GREEN    = '#4CAF50'
// Kondition har egen accentfärg så gym- och cardiopass skiljer sig direkt
const CARDIO_BLUE = '#4AA8E0'
const SCREEN_W = Dimensions.get('window').width

const GPS_KEYWORDS = ['löpning', 'running', 'jogging', 'cykling', 'cycling', 'promenad', 'walking', 'spring', 'intervallspring', 'gång']
function isGPS(name: string) {
  return GPS_KEYWORDS.some(kw => name.toLowerCase().includes(kw))
}

function cardioIcon(type: string | null): React.ComponentProps<typeof Ionicons>['name'] {
  switch (type) {
    case 'cycling':  return 'bicycle-outline'
    case 'interval': return 'flash-outline'
    case 'walking':  return 'walk-outline'
    default:         return 'fitness-outline'
  }
}

function cardioLabel(type: string | null): string {
  switch (type) {
    case 'cycling':  return 'Cykling'
    case 'interval': return 'Intervall'
    case 'walking':  return 'Promenad'
    default:         return 'Löpning'
  }
}

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

/** Snittempo min/km i "m:ss"-form */
function fmtPace(distanceKm: number, seconds: number): string {
  if (distanceKm < 0.01) return '--:--'
  const p = seconds / distanceKm
  return `${Math.floor(p / 60)}:${String(Math.floor(p % 60)).padStart(2, '0')}`
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
//
// Förhandsvisningsrad: namn + set×reps (+ klar-bock). All träningsinteraktion
// sker i passets helskärm (Öppna) — radens enda gest är svep för att TA BORT.

function ExerciseRow({
  ex,
  done,
  divider,
  progressed,
  onDelete,
}: {
  ex:          SessionExercise
  done:        boolean
  /** Tunn linje ovanför raden — alla utom första i kortet */
  divider?:    boolean
  progressed?: boolean
  onDelete:    () => void
}) {
  // ── Shared values ─────────────────────────────────────────────────────────

  const tx       = useSharedValue(0)  // card X offset
  const startTx  = useSharedValue(0)  // card position at gesture start
  const isOpen   = useSharedValue(0)  // 1 = snapped at SNAP_OPEN
  const overFull = useSharedValue(0)  // 1 = past FULL_THRESHOLD (haptic guard)

  // Collapse (delete animation)
  const maxH = useSharedValue(200)
  const opac = useSharedValue(1)
  const marg = useSharedValue(0)

  function haptSnap()  { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }
  function haptFull()  { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) }

  function handleDelete() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    opac.value = withTiming(0, { duration: 180 })
    maxH.value = withTiming(0, { duration: 270 })
    marg.value = withTiming(0, { duration: 270 }, () => runOnJS(onDelete)())
  }

  // ── Pan gesture — två steg, action = ta bort ──────────────────────────────

  const panGesture = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      startTx.value = tx.value
    })
    .onUpdate((e) => {
      const raw = startTx.value + e.translationX
      if (raw >= 0) { tx.value = 0; return }
      tx.value = raw < -FULL_THRESHOLD
        ? -FULL_THRESHOLD - (Math.abs(raw) - FULL_THRESHOLD) * 0.18
        : raw
      const nowOver = Math.abs(tx.value) >= FULL_THRESHOLD ? 1 : 0
      if (nowOver !== overFull.value) {
        overFull.value = nowOver
        if (nowOver === 1) runOnJS(haptFull)()
      }
    })
    .onEnd(() => {
      const absX = Math.abs(tx.value)
      if (absX >= FULL_THRESHOLD * 0.88) {
        // Full swipe → radera
        runOnJS(handleDelete)()
        isOpen.value = 0
      } else if (tx.value > -(SNAP_OPEN * 0.45)) {
        tx.value     = withSpring(0, SP)
        isOpen.value = 0
      } else {
        if (isOpen.value === 0) runOnJS(haptSnap)()
        tx.value     = withSpring(-SNAP_OPEN, SP)
        isOpen.value = 1
      }
      overFull.value = 0
    })

  // ── Animated styles ───────────────────────────────────────────────────────

  const wrapStyle = useAnimatedStyle(() => ({
    maxHeight:    maxH.value,
    opacity:      opac.value,
    marginBottom: marg.value,
    overflow:     'hidden' as const,
  }))

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }))

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
      backgroundColor: RED,
    }
  })

  const labelWrapStyle = useAnimatedStyle(() => ({
    width: interpolate(
      Math.abs(tx.value),
      [SNAP_OPEN + 14, SNAP_OPEN + 60],
      [0, 78],
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Animated.View style={wrapStyle}>
      <View style={[r.container, divider && r.containerDivider]}>

        {/* Radera-knappen — bakom kortet, avslöjas av svepet */}
        <View style={r.btnArea}>
          <TouchableOpacity onPress={handleDelete} activeOpacity={0.78}>
            <Animated.View style={[r.btn, btnStyle]}>
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Animated.View style={labelWrapStyle}>
                <Text style={r.btnLabel} numberOfLines={1}>Ta bort</Text>
              </Animated.View>
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Förhandsvisning — ingen tap-interaktion */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[r.row, done && r.rowDone, cardStyle]}>
            <View style={r.text}>
              <Text style={[r.name, done && r.nameDone]} numberOfLines={1}>
                {ex.exercise_name}
              </Text>
              {(ex.sets || ex.reps) && (
                <Text style={r.meta}>
                  {[ex.sets && `${ex.sets} set`, ex.reps && `${ex.reps} reps`]
                    .filter(Boolean)
                    .join(' · ')}
                  {progressed && (
                    <Text style={r.progressedMark}>  ↑</Text>
                  )}
                </Text>
              )}
            </View>
            {done && (
              <Ionicons name="checkmark-circle" size={20} color={GREEN} style={r.doneIcon} />
            )}
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
  containerDivider: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
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
    overflow:        'hidden',
    minHeight:       62,
    backgroundColor: CARD,
  },
  rowDone:  { backgroundColor: '#0B2418' },
  text:     { flex: 1, paddingVertical: 13, paddingHorizontal: 16 },
  name:     { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  nameDone: { color: TEXT_SECONDARY, textDecorationLine: 'line-through' },
  meta:     { color: TEXT_SECONDARY, fontSize: 12, marginTop: 3 },
  progressedMark: { color: ORANGE, fontSize: 12, fontWeight: '800' },
  doneIcon: { marginRight: 16 },
})

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WorkoutSectionProps {
  session:           WorkoutSession
  checked:           Record<string, boolean>
  isCompleted:       boolean
  /** Används inte längre av korten — interaktionen sker i passvyn (Öppna) */
  onToggleExercise?: (exId: string) => void
  onDeleteExercise:  (exId: string) => void
  onStartCardio?:        (name: string) => void
  onStartCardioSession?: () => void
  onViewCardioSummary?:  () => void
  onOpenFullscreen?:     () => void
  onCardPress?:          (ex: SessionExercise) => void
  onComplete:            () => void
  onUncomplete:          () => void
  /** Passinställningar nås numera via långtryck på passnamnet → Inställningar */
  onEdit?:               () => void
  onLongPress?:          () => void
  onAddExercise?:        () => void
  isQuickLog?:           boolean
  /** Distans/tid för ett avklarat cardio-pass — visas i kroppen när klart */
  cardioStats?:          { distanceKm: number; durationSeconds: number }
  /** Loggad statistik för ett avklarat gympass — visas i kroppen när klart */
  gymStats?:             { sets: number; volumeKg: number }
  /** Övnings-id:n vars reps skalats upp av progressionen — visar ↑-indikator */
  progressedIds?:        Set<string>
}

// ─── WorkoutSection ───────────────────────────────────────────────────────────

export function WorkoutSection({
  session,
  checked,
  isCompleted,
  onToggleExercise,
  onDeleteExercise,
  onStartCardio,
  onStartCardioSession,
  onViewCardioSummary,
  onOpenFullscreen,
  onCardPress,
  onComplete,
  onUncomplete,
  onLongPress,
  onAddExercise,
  onEdit,
  isQuickLog,
  cardioStats,
  gymStats,
  progressedIds,
}: WorkoutSectionProps) {
  const isCardio  = session.session_type === 'cardio'
  const total     = isCardio ? 0 : session.exercises.length
  const doneCount = isCardio ? 0 : session.exercises.filter(e => checked[e.id]).length
  const pct       = total > 0 ? doneCount / total : 0

  // ── Collapse: tryck på rubriken fäller ihop kortet till rubrik + progress ──
  const hasBody =
    (!isCardio && (total > 0 || !!onAddExercise)) ||
    (isCardio && (!isCompleted || !!onViewCardioSummary))
  // Passen startar alltid hopfällda — tryck på namnet fäller ut
  const [collapsed, setCollapsed] = useState(true)
  const [bodyH, setBodyH]         = useState(0)
  // Latmontering: kroppen (övningsrader med gester m.m.) är dyr att montera —
  // skapa den först när kortet fälls ut första gången. Gör dagbyten mycket
  // billigare eftersom pagern monterar flera dagars kort åt gången.
  const [bodyMounted, setBodyMounted] = useState(false)
  const collapseV = useSharedValue(0)   // 1 = utfälld

  function toggleCollapse() {
    if (!hasBody) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (collapsed && !bodyMounted) setBodyMounted(true)
    collapseV.value = withTiming(collapsed ? 1 : 0, { duration: 260, easing: Easing.inOut(Easing.quad) })
    setCollapsed(!collapsed)
  }

  // maxHeight (inte height) — annars kan en 0-mätning i hopfällt läge låsa
  // kortet stängt; fallback 1200 garanterar att expandering alltid fungerar
  const bodyStyle = useAnimatedStyle(() => ({
    maxHeight: interpolate(collapseV.value, [0, 1], [0, bodyH > 0 ? bodyH : 1200]),
    opacity:   interpolate(collapseV.value, [0, 0.6], [0, 1]),
    overflow:  'hidden' as const,
  }))

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(collapseV.value, [0, 1], [-90, 0])}deg` }],
  }))

  // Inga pass tonar mot grönt längre — statraden i kroppen och bockarna på
  // raderna räcker som klart-signal, den gröna infärgningen var störande
  const greenComplete = false

  const completedV = useSharedValue(greenComplete ? 1 : 0)
  useEffect(() => {
    completedV.value = withSpring(greenComplete ? 1 : 0, { damping: 18, stiffness: 140 })
  }, [greenComplete])

  // Hela kortets ram och bakgrund tonar mot grönt när passet är klart
  const cardOuterStyle = useAnimatedStyle(() => ({
    borderColor:     interpolateColor(completedV.value, [0, 1], [BORDER, GREEN + '45']),
    backgroundColor: interpolateColor(completedV.value, [0, 1], [CARD, '#0A2416']),
  }))

  // Typfärgen genomsyrar kortet: accentlinje, ikon, progress och gradient-wash
  const typeColor = isCardio ? CARDIO_BLUE : ORANGE

  const accentBarStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(completedV.value, [0, 1], [typeColor, GREEN]),
  }))

  const progressFillStyle = useAnimatedStyle(() => ({
    width:           `${(isCompleted ? 1 : pct) * 100}%` as any,
    backgroundColor: interpolateColor(completedV.value, [0, 1], [typeColor, GREEN]),
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
      {/* Hela passet bor i ETT kort: rubrik, progress, övningar, lägg till */}
      <Animated.View style={[s.card, cardOuterStyle]}>

      {/* ── Session header ── */}
      <View style={s.header}>
        {/* Subtil typfärgad wash från vänster — skiljer gym/kondition i en blick */}
        {!greenComplete && (
          <LinearGradient
            colors={[typeColor + '1E', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.75, y: 0 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}
        <Animated.View style={[s.headerAccent, accentBarStyle]} />

        <View style={[s.headerIcon, { backgroundColor: typeColor + '22' }, greenComplete && s.headerIconDone]}>
          <Ionicons
            name={greenComplete ? 'checkmark' : isCardio ? cardioIcon(session.cardio_type) : 'barbell-outline'}
            size={16}
            color={greenComplete ? '#fff' : typeColor}
          />
        </View>

        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={0.7}
          onPress={toggleCollapse}
          onLongPress={onLongPress}
          delayLongPress={400}
        >
          <View style={s.nameRow}>
            <Text style={s.sessionName}>{session.name}</Text>
            {hasBody && (
              <Animated.View style={chevronStyle}>
                <Ionicons name="chevron-down" size={14} color={TEXT_SECONDARY} />
              </Animated.View>
            )}
          </View>
          <Text style={s.sessionMeta}>
            {isCompleted
              ? (isCardio ? 'Pass avklarat' : 'Alla övningar klara')
              : isCardio
                ? cardioLabel(session.cardio_type)
                : total === 0
                  ? 'Inga övningar tillagda'
                  : `${doneCount} av ${total} klara`}
          </Text>
          {!!session.notes && (
            <View style={s.notesRow}>
              <Ionicons name="chatbubble-outline" size={11} color="#555" />
              <Text style={s.notesText} numberOfLines={2}>{session.notes}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Avklarade pass har ingen snabb-avbockning — ett tryck ska inte kunna
            radera passets status. Ångra görs i passvyn (gym) / detaljvyn (cardio). */}
        {isCardio && isCompleted ? null : (!isCardio && onOpenFullscreen) ? (
          // Gympass: alltid Öppna — även avklarade (info + Spara finns därinne)
          <TouchableOpacity onPress={onOpenFullscreen} style={s.openBtn} activeOpacity={0.8}>
            <Ionicons name="expand-outline" size={14} color={ORANGE} />
            <Text style={s.openBtnText}>Öppna</Text>
          </TouchableOpacity>
        ) : greenComplete ? (
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

      </View>

      {/* ── Progress bar ── */}
      {total > 0 && (
        <View style={s.progressTrack}>
          <Animated.View style={[s.progressFill, progressFillStyle]} />
        </View>
      )}

      {/* ── Kollapsbar kropp: allt under rubrik + progress.
             Monteras lat — först vid första utfällningen. ── */}
      <Animated.View style={bodyStyle}>
      {bodyMounted && (
      <View onLayout={e => {
        const h = e.nativeEvent.layout.height
        // Monotont växande: under expanderingen rapporterar onLayout delhöjder
        // (innehållet begränsas av animerad maxHeight) — att spara dem skapar en
        // återkopplingsloop som krymper målhöjden mot noll. Bara större gäller.
        if (h > bodyH) setBodyH(h)
      }}>

      {/* ── Cardio start row ── */}
      {isCardio && !isCompleted && (
        <TouchableOpacity
          style={s.cardioStartRow}
          onPress={onStartCardioSession}
          activeOpacity={0.8}
        >
          <Ionicons name={cardioIcon(session.cardio_type)} size={18} color={CARDIO_BLUE} />
          <Text style={[s.cardioStartText, { color: CARDIO_BLUE }]}>STARTA {cardioLabel(session.cardio_type).toUpperCase()}</Text>
          <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
        </TouchableOpacity>
      )}

      {/* ── Cardio summary (avklarat pass — klicka för detaljer) ── */}
      {isCardio && isCompleted && onViewCardioSummary && (
        <TouchableOpacity style={s.cardioSummary} onPress={onViewCardioSummary} activeOpacity={0.8}>
          <View style={s.cardioSummaryStats}>
            <View style={s.cardioSummaryStat}>
              <Text style={s.cardioSummaryValue}>
                {cardioStats ? cardioStats.distanceKm.toFixed(2) : '–'}
              </Text>
              <Text style={s.cardioSummaryLabel}>km</Text>
            </View>
            <View style={s.cardioSummaryDivider} />
            <View style={s.cardioSummaryStat}>
              <Text style={s.cardioSummaryValue}>
                {cardioStats ? fmtDuration(cardioStats.durationSeconds) : '–'}
              </Text>
              <Text style={s.cardioSummaryLabel}>tid</Text>
            </View>
            <View style={s.cardioSummaryDivider} />
            <View style={s.cardioSummaryStat}>
              <Text style={s.cardioSummaryValue}>
                {cardioStats ? fmtPace(cardioStats.distanceKm, cardioStats.durationSeconds) : '–'}
              </Text>
              <Text style={s.cardioSummaryLabel}>/km</Text>
            </View>
          </View>
          <View style={s.cardioSummaryLink}>
            <Ionicons name="map-outline" size={15} color={CARDIO_BLUE} />
            <Text style={s.cardioSummaryLinkText}>Visa pass</Text>
            <Ionicons name="chevron-forward" size={15} color={CARDIO_BLUE} />
          </View>
        </TouchableOpacity>
      )}

      {/* ── Exercise rows — inbäddade i passkortet ── */}
      {/* ── Gym summary (avklarat pass — som cardio-kortets statrad) ── */}
      {!isCardio && isCompleted && (
        <View style={s.cardioSummary}>
          <View style={s.cardioSummaryStats}>
            <View style={s.cardioSummaryStat}>
              <Text style={s.cardioSummaryValue}>{total}</Text>
              <Text style={s.cardioSummaryLabel}>övningar</Text>
            </View>
            <View style={s.cardioSummaryDivider} />
            <View style={s.cardioSummaryStat}>
              <Text style={s.cardioSummaryValue}>{gymStats ? gymStats.sets : '–'}</Text>
              <Text style={s.cardioSummaryLabel}>set</Text>
            </View>
          </View>
          {onOpenFullscreen && (
            <TouchableOpacity
              style={[s.cardioSummaryLink, { backgroundColor: ORANGE + '18' }]}
              onPress={onOpenFullscreen}
              activeOpacity={0.8}
            >
              <Ionicons name="barbell-outline" size={15} color={ORANGE} />
              <Text style={[s.cardioSummaryLinkText, { color: ORANGE }]}>Visa pass</Text>
              <Ionicons name="chevron-forward" size={15} color={ORANGE} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {!isCardio && total > 0 && (
        <View style={s.exList}>
          {session.exercises.map((ex, i) => (
            <ExerciseRow
              key={ex.id}
              ex={ex}
              divider={i > 0}
              progressed={progressedIds?.has(ex.id)}
              done={isCompleted || !!checked[ex.id]}
              onDelete={() => onDeleteExercise(ex.id)}
            />
          ))}
        </View>
      )}

      {!isCardio && onAddExercise && (
        <TouchableOpacity style={s.addRow} onPress={onAddExercise} activeOpacity={0.75}>
          <Ionicons name="add" size={16} color={ORANGE} />
          <Text style={s.addRowText}>Lägg till övning</Text>
        </TouchableOpacity>
      )}

      </View>
      )}
      </Animated.View>

      </Animated.View>
    </View>
  )
}

// ─── Styles (section) ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  section: { marginBottom: 20 },

  // Ett kort per pass — rubrik, progress, övningar och lägg-till bor innanför
  card: {
    borderRadius: 18,
    borderWidth:  1,
    overflow:     'hidden',
  },

  header: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             11,
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
  nameRow:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sessionName:     { color: TEXT_PRIMARY,   fontSize: 16, fontWeight: '700' },
  sessionMeta:     { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  notesRow:        { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  notesText:       { color: '#555', fontSize: 12, flex: 1, lineHeight: 16 },

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

  openBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, borderColor: ORANGE + '80', backgroundColor: ORANGE + '15',
  },
  openBtnText: { color: ORANGE, fontSize: 13, fontWeight: '700' },

  progressTrack: {
    height:          3,
    backgroundColor: BORDER,
    overflow:        'hidden',
  },
  progressFill:  { height: 3 },

  exList: {},

  addRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    borderTopWidth:    1,
    borderTopColor:    BORDER,
    paddingHorizontal: 16,
    paddingVertical:   14,
  },
  addRowText: { color: ORANGE, fontSize: 14, fontWeight: '500' },

  cardioStartRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    borderTopWidth:    1,
    borderTopColor:    BORDER,
    paddingHorizontal: 16,
    paddingVertical:   14,
    marginBottom:      6,
  },
  cardioStartText: {
    flex:        1,
    color:       ORANGE,
    fontSize:    14,
    fontWeight:  '700',
    letterSpacing: 1,
  },

  cardioSummary: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
  },
  cardioSummaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardioSummaryStat: { flex: 1, alignItems: 'center', gap: 2 },
  cardioSummaryValue: {
    color: TEXT_PRIMARY, fontSize: 19, fontFamily: NUM_FONT,
    fontVariant: ['tabular-nums'],
  },
  cardioSummaryLabel: {
    color: TEXT_SECONDARY, fontSize: 10, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  cardioSummaryDivider: { width: 1, height: 26, backgroundColor: BORDER },
  cardioSummaryLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: CARDIO_BLUE + '18', borderRadius: 12, paddingVertical: 9,
  },
  cardioSummaryLinkText: { color: CARDIO_BLUE, fontSize: 13, fontWeight: '700' },
})
