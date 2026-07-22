// GYMPASS-fliken på Framsteg: veckobläddring, dagremsa, statsrutnät,
// volymgraf, kroppskarta, genomförda pass och styrkerekord — med sina
// detaljmodaler. Skalet (stats.tsx) äger rådatan och skickar in den.
import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue, useAnimatedStyle, interpolate, runOnJS, Extrapolation,
  withTiming, Easing,
} from 'react-native-reanimated'
import Svg, { Text as SvgText, Line as SvgLine, Rect, G } from 'react-native-svg'
import Body from 'react-native-body-highlighter'
import { supabase } from '@/lib/supabase'
import { BG, GREEN, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT, useThemeStrings } from '@/lib/theme'
import { toLocalDateString, parseLocalDate, startOfWeek } from '@/lib/date'
import { getMusclesForName, MUSCLE_GROUPS_6, type Slug } from '@/lib/muscles'
import {
  getCompletedExerciseNamesForWeek, getCompletedExerciseNamesByDay,
  type CompletedSessionItem,
} from '@/services/workoutSchedule'
import type { StrengthWorkout } from '@/services/workouts'
import {
  GRID_PADDING, STATS_SCREEN_W, BLUE, YELLOW, PURPLE, TEAL,
  getWeekBounds, s, type GymSession,
} from './statsShared'
import { SwipeRow } from './SwipeRow'
import { GlassCircleButton } from '@/components/GlassButton'
import { GymSummaryView } from './GymSummaryView'
import { MuscleDetailModal } from './MuscleDetailModal'
import { VolumeDetailModal } from './VolumeDetailModal'
import { SafeAreaView } from 'react-native-safe-area-context'

export function GymTab({
  userId, strengthWorkouts, completedSessions, reloadToken,
  bodyFlipRef, onTabScroll, refreshControl, onDeleteCompletion,
}: {
  userId: string | null
  strengthWorkouts: StrengthWorkout[]
  completedSessions: CompletedSessionItem[]
  /** Ökas av skalet vid dra-för-att-uppdatera → veckodatan laddas om */
  reloadToken: number
  /** Delas med flik-pagerns waitFor så kroppssvepet vinner över sidbytet */
  bodyFlipRef: React.MutableRefObject<GestureType | undefined>
  onTabScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => void
  /** Appens gemensamma dra-för-att-uppdatera — samma i alla tre flikarna */
  refreshControl: React.ReactElement<import('react-native').RefreshControlProps>
  /** Skalet äger completedSessions + databasraderingen; false = misslyckades */
  onDeleteCompletion: (id: string) => Promise<boolean>
}) {
  const T = useThemeStrings()
  const insets = useSafeAreaInsets()

  const [bodyView, setBodyView]                 = useState<'front' | 'back'>('front')
  const [gymDetail, setGymDetail] = useState<{ name: string; dateLabel: string; planned: string[]; logged: StrengthWorkout[] } | null>(null)
  const [muscleOpen, setMuscleOpen] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [volumeOpen, setVolumeOpen] = useState(false)
  const [weekOffset, setWeekOffset]             = useState(0)
  const [weekExNames, setWeekExNames]           = useState<string[]>([])
  const [weekExByDay, setWeekExByDay]           = useState<Record<string, string[]>>({})
  const [prevWeekExNames, setPrevWeekExNames]   = useState<string[]>([])
  // null = hela veckan, 0–6 = vald veckodag (Mån–Sön)
  const [dayIdx, setDayIdx]                     = useState<number | null>(null)
  // Dagrutorna är gömda som standard — veckovyn räcker oftast
  const [dayPickerOpen, setDayPickerOpen]       = useState(false)
  const [weekLoading, setWeekLoading]           = useState(false)
  const [weekGymSessions, setWeekGymSessions]   = useState<GymSession[]>([])

  // Svep på kroppsfiguren växlar fram/bak. Pagern får waitFor=denna gest så
  // horisontella svep som startar på figuren flippar den istället för att byta
  // flik; vertikala drag faller igenom till sidscrollen (failOffsetY).
  // Bytet animeras som en 3D-flip: rotera ut till 90°, byt sida, rotera in.
  const bodyRot = useSharedValue(0)
  const bodyAnimStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${bodyRot.value}deg` }],
    opacity: interpolate(Math.abs(bodyRot.value), [0, 90], [1, 0.25], Extrapolation.CLAMP),
  }))

  function swapSide() {
    setBodyView(v => (v === 'front' ? 'back' : 'front'))
  }

  function animateFlip(dir: number = 1) {
    Haptics.selectionAsync()
    bodyRot.value = withTiming(90 * dir, { duration: 150, easing: Easing.in(Easing.quad) }, finished => {
      if (finished) {
        runOnJS(swapSide)()
        bodyRot.value = -90 * dir
        bodyRot.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.quad) })
      }
    })
  }

  const bodyFlip = Gesture.Pan()
    .withRef(bodyFlipRef)
    .activeOffsetX([-12, 12])
    .failOffsetY([-15, 15])
    .onEnd(e => {
      if (Math.abs(e.translationX) > 40 || Math.abs(e.velocityX) > 500) {
        runOnJS(animateFlip)(e.translationX < 0 ? 1 : -1)
      }
    })

  // Svep-radering i Genomförda pass: tar bort avbockningen (inte passmallen)
  function deleteGymCompletion(id: string) {
    setWeekGymSessions(prev => prev.filter(x => x.id !== id))
    onDeleteCompletion(id).then(ok => { if (!ok && userId) loadWeekData(userId) })
  }

  useEffect(() => {
    if (!userId) return
    setWeekLoading(true)
    setDayIdx(null)
    loadWeekData(userId).finally(() => setWeekLoading(false))
  }, [userId, weekOffset, reloadToken])

  // Gymveckans data — körs både vid veckobyte och vid dra-för-att-uppdatera
  async function loadWeekData(uid: string) {
    const { start, end } = getWeekBounds(weekOffset)
    const prev = getWeekBounds(weekOffset - 1)
    const [byDay, , prevNames] = await Promise.all([
      getCompletedExerciseNamesByDay(uid, start, end).catch(() => ({} as Record<string, string[]>)),
      fetchGymSessions(uid, start, end),
      getCompletedExerciseNamesForWeek(uid, prev.start, prev.end).catch(() => [] as string[]),
    ])
    setWeekExByDay(byDay)
    setWeekExNames(Object.values(byDay).flat())
    setPrevWeekExNames(prevNames)
  }

  async function fetchGymSessions(uid: string, start: string, end: string) {
    const { data } = await supabase
      .from('workout_completions')
      .select(`id, completed_date, workout_sessions(id, name, session_type, session_exercises(exercise_name, sort_order))`)
      .eq('user_id', uid)
      .gte('completed_date', start)
      .lte('completed_date', end)
      .order('completed_date', { ascending: true })

    const sessions: GymSession[] = (data ?? [])
      .filter((c: any) => (c.workout_sessions as any)?.session_type !== 'cardio')
      .map((c: any) => {
        const rawName: string = (c.workout_sessions as any)?.name ?? 'Pass'
        const sessionName = rawName.startsWith('ONCE:')
          ? rawName.split(':').slice(2).join(':')
          : rawName
        return {
          id:            c.id as string,
          completedDate: c.completed_date as string,
          sessionName,
          exercises:     [...((c.workout_sessions as any)?.session_exercises ?? [])]
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((e: any) => e.exercise_name as string),
        }
      })
    setWeekGymSessions(sessions)
  }

  const weekBounds   = getWeekBounds(weekOffset)
  const prevBounds   = getWeekBounds(weekOffset - 1)

  // ── Gym-fördjupning: set/reps/volym + muskelgrupper, vald vecka vs förra ──
  const inWeek = (w: StrengthWorkout, b: { start: string; end: string }) => {
    const d = w.data.workout_date ?? toLocalDateString(new Date(w.created_at))
    return d >= b.start && d <= b.end
  }
  const weekStrength = useMemo(
    () => strengthWorkouts.filter(w => inWeek(w, weekBounds)),
    [strengthWorkouts, weekBounds.start, weekBounds.end])
  const prevStrength = useMemo(
    () => strengthWorkouts.filter(w => inWeek(w, prevBounds)),
    [strengthWorkouts, prevBounds.start, prevBounds.end])
  const strengthSums = (list: StrengthWorkout[]) => ({
    sets:   list.reduce((s, w) => s + w.data.sets.length, 0),
    reps:   list.reduce((s, w) => s + w.data.sets.reduce((x, r) => x + r.reps, 0), 0),
    volume: list.reduce((s, w) => s + w.data.sets.reduce((x, r) => x + r.reps * (r.weight_kg || 0), 0), 0),
  })
  const prevSums = strengthSums(prevStrength)
  const gymPassCount = (b: { start: string; end: string }) =>
    completedSessions.filter(c => c.sessionType === 'gym' && c.completedDate >= b.start && c.completedDate <= b.end).length
  const prevPassCount = gymPassCount(prevBounds)

  // ── Dagval: V-knappen visar hela veckan, dagrutorna zoomar in på en dag ──
  const selDayDate = (() => {
    if (dayIdx === null) return null
    const d = parseLocalDate(weekBounds.start)
    d.setDate(d.getDate() + dayIdx)
    return toLocalDateString(d)
  })()
  const scopedExNames  = selDayDate ? (weekExByDay[selDayDate] ?? []) : weekExNames
  const scopedStrength = selDayDate
    ? weekStrength.filter(w => (w.data.workout_date ?? toLocalDateString(new Date(w.created_at))) === selDayDate)
    : weekStrength
  const weekSums = strengthSums(scopedStrength)
  const scopedPassCount = selDayDate
    ? weekGymSessions.filter(gs => gs.completedDate === selDayDate).length
    : weekGymSessions.length

  const weekMuscleFreq = new Map<Slug, number>()
  scopedExNames.forEach(name => {
    getMusclesForName(name).forEach(slug => {
      weekMuscleFreq.set(slug, (weekMuscleFreq.get(slug) || 0) + 1)
    })
  })
  const weekMuscleData = Array.from(weekMuscleFreq.entries()).map(([slug, count]) => ({
    slug,
    intensity: (count >= 4 ? 3 : count >= 2 ? 2 : 1) as 1 | 2 | 3,
  }))

  // Muskelgrupper (av de 6) som tränats — samma taxonomi som radarn använder
  const groupCount = (names: string[]) => MUSCLE_GROUPS_6.filter(g =>
    names.some(n => getMusclesForName(n).some(sl => g.slugs.includes(sl)))).length
  const scopedGroupCount = groupCount(scopedExNames)
  const prevGroupCount   = groupCount(prevWeekExNames)

  // ── Styrkerekord (all-time) — från loggade set, klickbara till passet.
  // Tung loop över hela historiken → räknas bara om när datan ändras
  type LiftRec = { name: string; kg: number; date: string }
  const { recTopLift, recOneRm, recBigDay, recWeekSets } = useMemo(() => {
    let recTopLift: LiftRec | null = null
    let recOneRm: LiftRec | null = null
    const volByDate = new Map<string, number>()
    const setsByWeekMap = new Map<string, number>()
    for (const w of strengthWorkouts) {
      const d = w.data.workout_date ?? toLocalDateString(new Date(w.created_at))
      let vol = 0
      for (const st of w.data.sets) {
        vol += st.reps * (st.weight_kg || 0)
        if (st.weight_kg > 0 && (!recTopLift || st.weight_kg > recTopLift.kg)) {
          recTopLift = { name: w.data.exercise_name, kg: st.weight_kg, date: d }
        }
        // Epley: vikt × (1 + reps/30)
        const orm = st.weight_kg > 0 && st.reps > 0 ? st.weight_kg * (1 + st.reps / 30) : 0
        if (orm > 0 && (!recOneRm || orm > recOneRm.kg)) {
          recOneRm = { name: w.data.exercise_name, kg: orm, date: d }
        }
      }
      volByDate.set(d, (volByDate.get(d) ?? 0) + vol)
      const wk = toLocalDateString(startOfWeek(parseLocalDate(d)))
      setsByWeekMap.set(wk, (setsByWeekMap.get(wk) ?? 0) + w.data.sets.length)
    }
    let recBigDay: { date: string; vol: number } | null = null
    for (const [d, v] of volByDate) {
      if (v > 0 && (!recBigDay || v > recBigDay.vol)) recBigDay = { date: d, vol: v }
    }
    let recWeekSets = 0
    for (const v of setsByWeekMap.values()) recWeekSets = Math.max(recWeekSets, v)
    return { recTopLift, recOneRm, recBigDay, recWeekSets }
  }, [strengthWorkouts])
  const hasGymRecords = recTopLift !== null || recWeekSets > 0

  // Öppnar gympassdetaljen för alla loggade övningar ett visst datum
  function openGymDay(date: string, title: string) {
    const logged = strengthWorkouts.filter(w =>
      (w.data.workout_date ?? toLocalDateString(new Date(w.created_at))) === date)
    setGymDetail({
      name: title,
      dateLabel: parseLocalDate(date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }),
      planned: [],
      logged,
    })
  }

  // Gympassdetaljen renderas i TVÅ modal-värdar (inuti Genomförda pass och på
  // rotnivå) eftersom iOS bara kan presentera en modal ovanpå sin egen ägare —
  // men själva vyn definieras en enda gång här
  const gymDetailView = gymDetail && (
    <GymSummaryView
      name={gymDetail.name}
      dateLabel={gymDetail.dateLabel}
      logged={gymDetail.logged}
      plannedNames={gymDetail.planned}
      allWorkouts={strengthWorkouts}
      onClose={() => setGymDetail(null)}
    />
  )

  return (
    <>
        <ScrollView
          style={{ width: STATS_SCREEN_W }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          onScroll={onTabScroll}
          refreshControl={refreshControl}
          scrollEventThrottle={16}
        >
          {strengthWorkouts.length === 0 && completedSessions.every(c => c.sessionType !== 'gym') ? (
            <View style={s.tabEmpty}>
              <View style={s.tabEmptyIcon}><Ionicons name="barbell-outline" size={30} color={ACCENT} /></View>
              <Text style={s.tabEmptyTitle}>Inga gympass ännu</Text>
              <Text style={s.tabEmptyText}>
                Bocka av övningar i schemat och logga reps och vikt i passen — då fylls muskelkartan, volymen och rekorden på här.
              </Text>
              <TouchableOpacity style={s.tabEmptyBtn} activeOpacity={0.85} onPress={() => router.push('/(app)/add')}>
                <Text style={s.tabEmptyBtnText}>Till schemat</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <>
            {/* Veckobläddring — samma pilnavigering som i Distans-detaljvyn */}
            <View style={s.weekNav}>
              <TouchableOpacity style={s.weekNavBtn} onPress={() => setWeekOffset(o => o - 1)} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
              </TouchableOpacity>
              <Text style={s.weekNavLabel}>{weekBounds.label}</Text>
              <TouchableOpacity
                style={s.weekNavBtn}
                onPress={() => setWeekOffset(o => o + 1)}
                disabled={weekOffset >= 0}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={20} color={weekOffset >= 0 ? 'rgba(255,255,255,0.18)' : TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>

            {/* Dagval — veckovyn är standard; knappen fäller ut dagrutorna
                när man vill zooma in på en specifik dag */}
            <TouchableOpacity
              style={[s.dayPickToggle, dayIdx !== null && s.dayPickToggleActive]}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.selectionAsync()
                if (dayPickerOpen) { setDayPickerOpen(false); setDayIdx(null) }
                else setDayPickerOpen(true)
              }}
            >
              <Ionicons name="calendar-clear-outline" size={14} color={dayIdx !== null ? '#000' : TEXT_SECONDARY} />
              <Text style={[s.dayPickToggleText, dayIdx !== null && s.dayPickToggleTextActive]}>
                {selDayDate
                  ? parseLocalDate(selDayDate).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
                  : dayPickerOpen ? 'Visa hela veckan' : 'Välj specifik dag'}
              </Text>
              <Ionicons
                name={dayPickerOpen ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={dayIdx !== null ? '#000' : TEXT_SECONDARY}
              />
            </TouchableOpacity>

            {dayPickerOpen && (
              <View style={s.dayStrip}>
                {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((l, i) => {
                  const d = parseLocalDate(weekBounds.start)
                  d.setDate(d.getDate() + i)
                  const iso = toLocalDateString(d)
                  const future = iso > toLocalDateString(new Date())
                  const active = dayIdx === i
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[s.dayBox, active && s.dayBoxActive, future && { opacity: 0.3 }]}
                      activeOpacity={0.8}
                      disabled={future}
                      onPress={() => setDayIdx(active ? null : i)}
                    >
                      <Text style={[s.dayBoxLetter, active && s.dayBoxTextActive]}>{l}</Text>
                      <Text style={[s.dayBoxNum, active && s.dayBoxTextActive]}>{d.getDate()}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}

            {/* Veckostatistik — samma Apple-rutnät, med förra veckan som jämförelse */}
            <Text style={s.sectionHead}>{dayIdx === null ? 'Veckans träning' : 'Dagens träning'}</Text>
            <View style={[s.card, s.cardPlain]}>
              <View style={[s.dtlRow, { paddingTop: 0 }]}>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Pass</Text>
                  <Text style={[s.dtlVal, { color: ACCENT }]}>{scopedPassCount}</Text>
                  {dayIdx === null && <Text style={s.dtlPrev} numberOfLines={1} adjustsFontSizeToFit>förra veckan {prevPassCount}</Text>}
                </View>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl} numberOfLines={1} adjustsFontSizeToFit>Muskelgrupper</Text>
                  <Text style={[s.dtlVal, { color: PURPLE }]}>
                    {scopedGroupCount}
                    <Text style={s.dtlUnit}> AV 6</Text>
                  </Text>
                  {dayIdx === null && <Text style={s.dtlPrev} numberOfLines={1} adjustsFontSizeToFit>förra veckan {prevGroupCount}</Text>}
                </View>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Övningar</Text>
                  <Text style={[s.dtlVal, { color: GREEN }]}>{scopedExNames.length}</Text>
                  {dayIdx === null && <Text style={s.dtlPrev} numberOfLines={1} adjustsFontSizeToFit>förra veckan {prevWeekExNames.length}</Text>}
                </View>
              </View>
              <View style={s.dtlSep} />
              <View style={[s.dtlRow, { paddingBottom: 0 }]}>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Set</Text>
                  <Text style={[s.dtlVal, { color: BLUE }]}>{weekSums.sets}</Text>
                  {dayIdx === null && <Text style={s.dtlPrev} numberOfLines={1} adjustsFontSizeToFit>förra veckan {prevSums.sets}</Text>}
                </View>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Reps</Text>
                  <Text style={[s.dtlVal, { color: TEAL }]}>{weekSums.reps}</Text>
                  {dayIdx === null && <Text style={s.dtlPrev} numberOfLines={1} adjustsFontSizeToFit>förra veckan {prevSums.reps}</Text>}
                </View>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Volym</Text>
                  <Text style={[s.dtlVal, { color: YELLOW }]} numberOfLines={1} adjustsFontSizeToFit>
                    {Math.round(weekSums.volume).toLocaleString('sv-SE')}
                    <Text style={s.dtlUnit}> KG</Text>
                  </Text>
                  {dayIdx === null && <Text style={s.dtlPrev} numberOfLines={1} adjustsFontSizeToFit>förra veckan {Math.round(prevSums.volume).toLocaleString('sv-SE')}</Text>}
                </View>
              </View>
            </View>

            {/* Volym per dag i vald vecka — tryck för fullständig historik */}
            {weekStrength.some(w => w.data.sets.some(st => st.weight_kg > 0)) && (
              <>
              <View style={s.sectionHeadRow}>
                <Text style={[s.sectionHead, s.sectionHeadInline]}>Volym</Text>
                <Ionicons name="chevron-forward" size={19} color={TEXT_SECONDARY} />
              </View>
              <TouchableOpacity
                style={[s.card, s.cardPlain]}
                activeOpacity={0.85}
                onPress={() => setVolumeOpen(true)}
              >
                <Text style={[s.cardSub, { marginTop: 0 }]}>kg lyft per dag, vald vecka</Text>
                {(() => {
                  const CH_W = STATS_SCREEN_W - 80
                  const CH_H = 130
                  const slot = CH_W / 7
                  const barW = Math.min(30, Math.round(slot * 0.5))
                  const dayVols = Array.from({ length: 7 }, (_, i) => {
                    const d = parseLocalDate(weekBounds.start)
                    d.setDate(d.getDate() + i)
                    const iso = toLocalDateString(d)
                    return weekStrength
                      .filter(w => (w.data.workout_date ?? toLocalDateString(new Date(w.created_at))) === iso)
                      .reduce((sum, w) => sum + w.data.sets.reduce((x, r) => x + r.reps * (r.weight_kg || 0), 0), 0)
                  })
                  const maxV = Math.max(...dayVols, 1)
                  const scale = (CH_H - 28) / maxV
                  return (
                    <>
                      <Svg width={CH_W} height={CH_H}>
                        {[0.5, 1].map(f => (
                          <SvgLine
                            key={f}
                            x1={0} x2={CH_W}
                            y1={CH_H - 4 - f * (CH_H - 28)} y2={CH_H - 4 - f * (CH_H - 28)}
                            stroke="rgba(255,255,255,0.06)" strokeWidth={1}
                          />
                        ))}
                        {dayVols.map((v, i) => {
                          const x = i * slot + (slot - barW) / 2
                          if (v <= 0) {
                            return <Rect key={i} x={x} y={CH_H - 7} width={barW} height={3} rx={1.5} fill="rgba(255,255,255,0.10)" />
                          }
                          const h = Math.max(3, v * scale)
                          return (
                            <G key={i}>
                              <Rect x={x} y={CH_H - 4 - h} width={barW} height={h} rx={3} fill={ACCENT} opacity={dayIdx === null || dayIdx === i ? 1 : 0.35} />
                              <SvgText
                                x={x + barW / 2} y={CH_H - 8 - h}
                                fontSize={9} fontWeight="700" textAnchor="middle"
                                fill="rgba(255,255,255,0.55)"
                              >
                                {Math.round(v).toLocaleString('sv-SE')}
                              </SvgText>
                            </G>
                          )
                        })}
                      </Svg>
                      <View style={s.distLblRow}>
                        {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((l, i) => (
                          <Text key={i} style={[s.distLbl, dayIdx === i && { color: ACCENT }]}>{l}</Text>
                        ))}
                      </View>
                    </>
                  )
                })()}
              </TouchableOpacity>
              </>
            )}

            {/* Body map — rubriken öppnar muskeldetaljen (radar + set per grupp) */}
            <TouchableOpacity style={s.sectionHeadRow} activeOpacity={0.7} onPress={() => setMuscleOpen(true)}>
              <Text style={[s.sectionHead, s.sectionHeadInline]}>Tränade muskler</Text>
              <Ionicons name="chevron-forward" size={19} color={TEXT_SECONDARY} />
            </TouchableOpacity>
            <View style={[s.card, s.cardPlain]}>
              <View style={s.muscleHeader}>
                <Text style={s.muscleAuto}>Från dina avbockade övningar</Text>
                <View style={s.bodyToggle}>
                  {(['front', 'back'] as const).map(side => (
                    <TouchableOpacity
                      key={side}
                      style={[s.bodyToggleBtn, bodyView === side && s.bodyToggleBtnActive]}
                      onPress={() => bodyView !== side && animateFlip(side === 'back' ? 1 : -1)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.bodyToggleText, bodyView === side && s.bodyToggleTextActive]}>
                        {side === 'front' ? 'Fram' : 'Bak'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {weekLoading ? (
                <View style={s.bodyWrap}><ActivityIndicator color={ACCENT} /></View>
              ) : (
                <>
                  <GestureDetector gesture={bodyFlip}>
                    {/* Tryck på gubben öppnar muskeldetaljen — svep i sidled vänder honom */}
                    <TouchableOpacity
                      style={s.bodyWrap}
                      activeOpacity={0.85}
                      onPress={() => setMuscleOpen(true)}
                    >
                      <Animated.View style={bodyAnimStyle} pointerEvents="none">
                        <Body
                          data={weekMuscleData}
                          side={bodyView}
                          gender="male"
                          scale={1.6}
                          colors={[BLUE, YELLOW, T.ACCENT]}
                          defaultFill="#2A2A2C"
                          border="rgba(255,255,255,0.10)"
                        />
                      </Animated.View>
                    </TouchableOpacity>
                  </GestureDetector>
                  {weekMuscleData.length > 0 && (
                    <View style={s.legend}>
                      {([
                        { color: BLUE,   label: '1 övning' },
                        { color: YELLOW, label: '2–3 övningar' },
                        { color: ACCENT, label: '4+ övningar' },
                      ] as const).map(({ color, label }) => (
                        <View key={label} style={s.legendItem}>
                          <View style={[s.legendDot, { backgroundColor: color }]} />
                          <Text style={s.legendText}>{label}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}

              {!weekLoading && scopedExNames.length === 0 && (
                <Text style={s.muscleEmpty}>
                  {dayIdx !== null
                    ? 'Inga avklarade övningar vald dag'
                    : weekOffset === 0 ? 'Inga avklarade övningar denna vecka' : 'Inga avklarade övningar vald vecka'}
                </Text>
              )}

            </View>

            {/* Genomförda pass — arkivet bakom en enkel rad */}
            <TouchableOpacity
              style={[s.card, s.cardPlain, s.muscleLinkRow]}
              activeOpacity={0.7}
              onPress={() => setSessionsOpen(true)}
            >
              <View style={[s.muscleLinkIcon, { backgroundColor: GREEN + '18' }]}>
                <Ionicons name="checkmark-done-outline" size={17} color={GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.muscleLinkTitle}>Genomförda pass</Text>
                <Text style={s.muscleLinkSub}>
                  {weekGymSessions.length} pass {weekOffset === 0 ? 'denna vecka' : 'vald vecka'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={TEXT_SECONDARY} />
            </TouchableOpacity>

            {/* Styrkerekord — all-time, klickbara till passet där rekordet sattes */}
            {hasGymRecords && (
              <>
              <Text style={s.sectionHead}>Styrkerekord</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -GRID_PADDING }}
                contentContainerStyle={s.recScroll}
              >
                {([
                  recTopLift && {
                    icon: 'barbell-outline' as const, color: ACCENT,
                    label: `Tyngsta lyft · ${recTopLift.name}`,
                    value: `${recTopLift.kg} kg`,
                    onPress: () => openGymDay(recTopLift!.date, recTopLift!.name),
                  },
                  recOneRm && {
                    icon: 'speedometer-outline' as const, color: PURPLE,
                    label: `Bästa 1RM · ${recOneRm.name}`,
                    value: `${Math.round(recOneRm.kg)} kg`,
                    onPress: () => openGymDay(recOneRm!.date, recOneRm!.name),
                  },
                  recBigDay && {
                    icon: 'trophy-outline' as const, color: YELLOW,
                    label: 'Största passet (volym)',
                    value: `${Math.round(recBigDay.vol).toLocaleString('sv-SE')} kg`,
                    onPress: () => openGymDay(recBigDay!.date, 'Största passet'),
                  },
                  recWeekSets > 0 && {
                    icon: 'layers-outline' as const, color: BLUE,
                    label: 'Flest set en vecka',
                    value: `${recWeekSets} set`,
                    onPress: undefined,
                  },
                ].filter(Boolean) as Array<{
                  icon: React.ComponentProps<typeof Ionicons>['name']
                  color: string; label: string; value: string; onPress?: () => void
                }>).map(r => (
                  <TouchableOpacity
                    key={r.label}
                    style={s.recCard}
                    activeOpacity={0.75}
                    disabled={!r.onPress}
                    onPress={r.onPress}
                  >
                    <View style={s.recCardTop}>
                      <View style={[s.recIconWrap, { backgroundColor: r.color + '1A' }]}>
                        <Ionicons name={r.icon} size={16} color={r.color} />
                      </View>
                      {r.onPress && <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.28)" />}
                    </View>
                    <Text style={[s.recCardVal, { color: r.color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {r.value}
                    </Text>
                    <Text style={s.recCardLbl} numberOfLines={2}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              </>
            )}

          </>
          )}
        </ScrollView>

      {/* Genomförda pass — egen vy i stället för att listan ligger på fliken */}
      <Modal visible={sessionsOpen} animationType="slide" onRequestClose={() => setSessionsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: BG }}>
          <View style={[s.modalTopBar, { paddingTop: insets.top + 8 }]}>
            <GlassCircleButton icon="chevron-back" onPress={() => setSessionsOpen(false)} />
            <Text style={s.modalTopTitle}>Genomförda pass</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <Text style={s.sessionsWeekLabel}>
              {weekBounds.label} · {weekGymSessions.length} pass
            </Text>
            {weekGymSessions.length > 0 ? (
              <View style={[s.card, s.cardPlain, { marginTop: 12 }]}>
                <View style={s.gymList}>
                  {weekGymSessions.map(gs => {
                    const gymDay    = new Date(gs.completedDate + 'T12:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
                    const exPreview = gs.exercises.slice(0, 3).join(' · ')
                      + (gs.exercises.length > 3 ? ` · +${gs.exercises.length - 3}` : '')
                    return (
                      <SwipeRow key={gs.id} name={gs.sessionName} onDelete={() => deleteGymCompletion(gs.id)}>
                      <TouchableOpacity
                        style={s.gymRow}
                        activeOpacity={0.7}
                        onPress={() => {
                          const logged = strengthWorkouts.filter(w => {
                            const wDate = w.data.workout_date ?? toLocalDateString(new Date(w.created_at))
                            return wDate === gs.completedDate && gs.exercises.includes(w.data.exercise_name)
                          })
                          setGymDetail({
                            name: gs.sessionName,
                            dateLabel: new Date(gs.completedDate + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }),
                            planned: gs.exercises,
                            logged,
                          })
                        }}
                      >
                        <View style={s.gymCheck}>
                          <Ionicons name="checkmark" size={14} color={GREEN} />
                        </View>
                        <View style={s.gymInfo}>
                          <Text style={s.gymName}>{gs.sessionName}</Text>
                          {!!exPreview && <Text style={s.gymExs}>{exPreview}</Text>}
                        </View>
                        <Text style={s.gymDay}>{gymDay}</Text>
                        <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.25)" />
                      </TouchableOpacity>
                      </SwipeRow>
                    )
                  })}
                </View>
              </View>
            ) : (
              <View style={s.empty}>
                <Ionicons name="barbell-outline" size={40} color="rgba(255,255,255,0.12)" />
                <Text style={s.emptyText}>Inga gympass klarade vald vecka</Text>
              </View>
            )}
          </ScrollView>
        </View>

        <Modal visible={!!gymDetail} animationType="slide" onRequestClose={() => setGymDetail(null)}>
          {gymDetailView}
        </Modal>
      </Modal>
      <Modal visible={!!gymDetail && !sessionsOpen} animationType="slide" onRequestClose={() => setGymDetail(null)}>
        {gymDetailView}
      </Modal>
      <VolumeDetailModal
        visible={volumeOpen}
        onClose={() => setVolumeOpen(false)}
        workouts={strengthWorkouts}
      />
      <MuscleDetailModal
        visible={muscleOpen}
        onClose={() => setMuscleOpen(false)}
        userId={userId}
        workouts={strengthWorkouts}
        weekStart={weekBounds.start}
        weekLabel={weekBounds.label}
        day={selDayDate}
        dayLabel={selDayDate
          ? parseLocalDate(selDayDate).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
          : null}
      />
    </>
  )
}
