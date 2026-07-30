// GYMPASS-fliken på Framsteg: veckobläddring, dagremsa, statsrutnät,
// volymgraf, kroppskarta, genomförda pass och styrkerekord — med sina
// detaljmodaler. Skalet (stats.tsx) äger rådatan och skickar in den.
import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, ActivityIndicator , useColorScheme,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@/components/Icon'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue, useAnimatedStyle, interpolate, runOnJS, Extrapolation,
  withTiming, Easing,
} from 'react-native-reanimated'
import Svg, { Text as SvgText, Line as SvgLine, Rect, G } from 'react-native-svg'
import Body from 'react-native-body-highlighter'

// Gymmets signaturfärg i den nya kostymen — orange i båda temalägena
// (cardio är blått, gym är orange)
const GYM = '#EE7C4B'
import { supabase } from '@/lib/supabase'
import { useBodyGender } from '@/lib/bodyGender'
import { BG, CARD, GREEN, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT, ACCENT_CONTRAST, useThemeStrings, useCardChrome } from '@/lib/theme'
import { toLocalDateString, parseLocalDate, startOfWeek } from '@/lib/date'
import { getMusclesForName, MUSCLE_GROUPS_6, type Slug } from '@/lib/muscles'
import {
  getCompletedExerciseNamesForWeek, getCompletedExerciseNamesByDay,
  type CompletedSessionItem,
} from '@/services/workoutSchedule'
import type { StrengthWorkout } from '@/services/workouts'
import {
  GRID_PADDING, STATS_SCREEN_W, BLUE, YELLOW, TEAL,
  getWeekBounds, s, type GymSession,
  useStatsColors,
} from './statsShared'
import { SwipeRow } from './SwipeRow'
import { GlassCircleButton } from '@/components/GlassButton'
import { GymSummaryView } from './GymSummaryView'
import { MuscleDetailModal } from './MuscleDetailModal'
import { VolumeDetailModal } from './VolumeDetailModal'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useT, dateLocale } from '@/lib/i18n'

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
  const bodyGender = useBodyGender()
  const t = useT()
  // Kroppskartan: mörkgrå siluett på mörk botten, ljusgrå på ljus
  const bodyLight = useColorScheme() === 'light'
  const bodyFill = bodyLight ? '#DFE0E4' : '#2A2A2C'
  const bodyBorder = bodyLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'
  const P = useStatsColors()
  const T = useThemeStrings()
  const chrome = useCardChrome()
  const insets = useSafeAreaInsets()

  const [bodyView, setBodyView]                 = useState<'front' | 'back'>('front')
  const [gymDetail, setGymDetail] = useState<{ name: string; dateLabel: string; planned: string[]; logged: StrengthWorkout[]; workoutDate?: string; passKey?: string } | null>(null)
  const [muscleOpen, setMuscleOpen] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [volumeOpen, setVolumeOpen] = useState(false)
  const [weekOffset, setWeekOffset]             = useState(0)
  const [weekNavOpen, setWeekNavOpen]           = useState(false)
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
        const rawName: string = (c.workout_sessions as any)?.name ?? t('Pass')
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
  const { recTopLift, topLiftOneRm } = useMemo(() => {
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
    // Est. 1RM (Epley) för just den övning där tyngsta lyftet sattes
    let topLiftOneRm = 0
    if (recTopLift !== null) {
      const liftName = (recTopLift as LiftRec).name
      for (const w of strengthWorkouts) {
        if (w.data.exercise_name !== liftName) continue
        for (const st of w.data.sets) {
          if (st.weight_kg > 0 && st.reps > 0) {
            topLiftOneRm = Math.max(topLiftOneRm, st.weight_kg * (1 + st.reps / 30))
          }
        }
      }
    }
    return { recTopLift, recOneRm, recBigDay, recWeekSets, topLiftOneRm }
  }, [strengthWorkouts])

  // "65,5 t" när volymen är stor nog — som förlagan
  const fmtVol = (kg: number) => kg >= 1000
    ? `${(kg / 1000).toFixed(1).replace('.', ',')} t`
    : `${Math.round(kg).toLocaleString(dateLocale())} kg`

  // Set per muskelgrupp (samma sextaxonomi som kroppskartan) — en övning
  // som träffar flera grupper räknas i varje grupp den träffar
  const groupSets = MUSCLE_GROUPS_6.map(g => ({
    label: t(g.label),
    sets: scopedStrength.reduce((sum, w) => {
      const slugs = getMusclesForName(w.data.exercise_name)
      return slugs.some(sl => g.slugs.includes(sl)) ? sum + w.data.sets.length : sum
    }, 0),
  }))

  // Öppnar gympassdetaljen för alla loggade övningar ett visst datum.
  // Delar alla rader en pass-nyckel följer titel/kommentar/foto med.
  function openGymDay(date: string, title: string) {
    const logged = strengthWorkouts.filter(w =>
      (w.data.workout_date ?? toLocalDateString(new Date(w.created_at))) === date)
    const keys = new Set(logged.map(w => w.data.pass_key ?? ''))
    setGymDetail({
      name: title,
      dateLabel: parseLocalDate(date).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' }),
      planned: [],
      logged,
      workoutDate: date,
      passKey: keys.size === 1 ? [...keys][0] : '',
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
      ownerId={userId ?? undefined}
      workoutDate={gymDetail.workoutDate}
      passKey={gymDetail.passKey}
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
              <Text style={s.tabEmptyTitle}>{t('Inga gympass ännu')}</Text>
              <Text style={s.tabEmptyText}>
                {t('Bocka av övningar i schemat och logga reps och vikt i passen, då fylls muskelkartan, volymen och rekorden på här.')}
              </Text>
              <TouchableOpacity style={s.tabEmptyBtn} activeOpacity={0.85} onPress={() => router.push('/(app)/add')}>
                <Text style={s.tabEmptyBtnText}>{t('Till schemat')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <>
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
                  ? parseLocalDate(selDayDate).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })
                  : dayPickerOpen ? t('Visa hela veckan') : t('Välj specifik dag')}
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
                      <Text style={[s.dayBoxLetter, active && s.dayBoxTextActive]}>{t(l)}</Text>
                      <Text style={[s.dayBoxNum, active && s.dayBoxTextActive]}>{d.getDate()}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}

            {/* Veckans träning — rutnät med förra veckan som jämförelse */}
            <View style={[l.secCard, chrome]}>
              <View style={l.secHead}>
                <Text style={l.secTitle}>{dayIdx === null ? t('Veckans träning') : t('Dagens träning')}</Text>
                <TouchableOpacity onPress={() => setWeekNavOpen(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="pickWeek">
                  <Text style={[l.secLink, { color: T.ACCENT }]}>{t('Välj vecka')} ›</Text>
                </TouchableOpacity>
              </View>
              {(weekNavOpen || weekOffset !== 0) && (
                <View style={l.weekNavRow}>
                  <TouchableOpacity style={l.weekNavBtn} onPress={() => setWeekOffset(o => o - 1)} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={18} color={TEXT_PRIMARY} />
                  </TouchableOpacity>
                  <Text style={l.weekNavLbl}>{weekBounds.label}</Text>
                  <TouchableOpacity style={l.weekNavBtn} onPress={() => setWeekOffset(o => o + 1)} disabled={weekOffset >= 0} activeOpacity={0.7}>
                    <Ionicons name="chevron-forward" size={18} color={weekOffset >= 0 ? 'rgba(128,128,128,0.35)' : TEXT_PRIMARY} />
                  </TouchableOpacity>
                </View>
              )}
              <View style={l.statGrid}>
                {([
                  { lbl: t('Pass'), val: String(scopedPassCount), cur: scopedPassCount, prev: prevPassCount, prevStr: String(prevPassCount) },
                  { lbl: t('Muskler'), val: String(scopedGroupCount), suffix: ' /6', cur: scopedGroupCount, prev: prevGroupCount, prevStr: String(prevGroupCount) },
                  { lbl: t('Övningar'), val: String(scopedExNames.length), cur: scopedExNames.length, prev: prevWeekExNames.length, prevStr: String(prevWeekExNames.length) },
                  { lbl: 'Set', val: String(weekSums.sets), cur: weekSums.sets, prev: prevSums.sets, prevStr: String(prevSums.sets) },
                  { lbl: 'Reps', val: weekSums.reps.toLocaleString(dateLocale()), cur: weekSums.reps, prev: prevSums.reps, prevStr: prevSums.reps.toLocaleString(dateLocale()) },
                  { lbl: t('Volym'), val: fmtVol(weekSums.volume), color: GYM, cur: weekSums.volume, prev: prevSums.volume, prevStr: fmtVol(prevSums.volume) },
                ] as Array<{ lbl: string; val: string; suffix?: string; color?: string; cur: number; prev: number; prevStr: string }>).map(c => (
                  <View key={c.lbl} style={l.statCell}>
                    <Text style={l.statLbl}>{c.lbl}</Text>
                    <Text style={[l.statVal, c.color ? { color: c.color } : null]} numberOfLines={1} adjustsFontSizeToFit>
                      {c.val}
                      {c.suffix ? <Text style={l.statSuffix}>{c.suffix}</Text> : null}
                    </Text>
                    {dayIdx === null && (
                      <Text style={[l.statPrev, c.cur > c.prev && { color: GREEN }]} numberOfLines={1} adjustsFontSizeToFit>
                        {t('förra: {n}', { n: c.prevStr })}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </View>

            {/* Volym per dag — staplar i vald vecka; tryck för historiken */}
            {weekStrength.some(w => w.data.sets.some(st => st.weight_kg > 0)) && (
              <TouchableOpacity style={[l.secCard, chrome]} activeOpacity={0.85} onPress={() => setVolumeOpen(true)} testID="volumeCard">
                <View style={l.secHead}>
                  <Text style={l.secTitle}>{t('Volym per dag')}</Text>
                  <Text style={l.secHint}>{weekOffset === 0 ? t('kg lyft, denna vecka') : t('kg lyft, vald vecka')}</Text>
                </View>
                <View style={l.barRow}>
                  {(() => {
                    const dayVols = Array.from({ length: 7 }, (_, i) => {
                      const d = parseLocalDate(weekBounds.start)
                      d.setDate(d.getDate() + i)
                      const iso = toLocalDateString(d)
                      return weekStrength
                        .filter(w => (w.data.workout_date ?? toLocalDateString(new Date(w.created_at))) === iso)
                        .reduce((sum, w) => sum + w.data.sets.reduce((x, r) => x + r.reps * (r.weight_kg || 0), 0), 0)
                    })
                    const maxV = Math.max(...dayVols, 1)
                    return dayVols.map((v, i) => (
                      <View key={i} style={l.barCell}>
                        <View style={l.barSlot}>
                          {v > 0
                            ? <View style={[l.bar, { height: Math.max(16, (v / maxV) * 120), backgroundColor: GYM, opacity: dayIdx === null || dayIdx === i ? 1 : 0.35 }]} />
                            : <View style={l.barEmpty} />}
                        </View>
                        <Text style={[l.barLbl, dayIdx === i && { color: GYM, fontWeight: '700' }]}>{t(['M', 'T', 'O', 'T', 'F', 'L', 'S'][i])}</Text>
                      </View>
                    ))
                  })()}
                </View>
              </TouchableOpacity>
            )}

            {/* Body map — titeln i kortet, fram/bak-pillret till höger och
                undertexten på egen rad, som förlagan */}
            <View style={[l.secCard, chrome]}>
              <View style={l.bodyHead}>
                <Text style={l.secTitle}>{t('Tränade muskler')}</Text>
                <View style={l.bodyToggle}>
                  {(['front', 'back'] as const).map(side => (
                    <TouchableOpacity
                      key={side}
                      style={[l.bodyToggleBtn, bodyView === side && { backgroundColor: T.ACCENT }]}
                      onPress={() => bodyView !== side && animateFlip(side === 'back' ? 1 : -1)}
                      activeOpacity={0.8}
                    >
                      <Text style={[l.bodyToggleText, bodyView === side && { color: ACCENT_CONTRAST, fontWeight: '700' }]}>
                        {side === 'front' ? t('Fram') : t('Bak')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <Text style={l.bodySub}>
                {weekOffset === 0
                  ? t('Från dina avbockade övningar denna vecka')
                  : t('Från dina avbockade övningar vald vecka')}
              </Text>

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
                          gender={bodyGender}
                          scale={1.6}
                          colors={[P.BLUE, P.YELLOW, T.ACCENT]}
                          defaultFill={bodyFill}
                          border={bodyBorder}
                        />
                      </Animated.View>
                    </TouchableOpacity>
                  </GestureDetector>
                  {weekMuscleData.length > 0 && (
                    <View style={s.legend}>
                      {([
                        { color: P.BLUE,   label: '1 övning' },
                        { color: P.YELLOW, label: '2–3 övningar' },
                        { color: ACCENT, label: '4+ övningar' },
                      ] as const).map(({ color, label }) => (
                        <View key={label} style={s.legendItem}>
                          <View style={[s.legendDot, { backgroundColor: color }]} />
                          <Text style={s.legendText}>{t(label)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}

              {!weekLoading && scopedExNames.length === 0 && (
                <Text style={s.muscleEmpty}>
                  {dayIdx !== null
                    ? t('Inga avklarade övningar vald dag')
                    : weekOffset === 0 ? t('Inga avklarade övningar denna vecka') : t('Inga avklarade övningar vald vecka')}
                </Text>
              )}

            </View>

            {/* Set per muskelgrupp — obalans flaggas ärligt, Detaljer öppnar radarn */}
            <View style={[l.secCard, chrome]}>
              <View style={l.secHead}>
                <Text style={l.secTitle}>{t('Set per muskelgrupp')}</Text>
                <TouchableOpacity onPress={() => setMuscleOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="muscleDetails">
                  <Text style={[l.secLink, { color: T.ACCENT }]}>{t('Detaljer')} ›</Text>
                </TouchableOpacity>
              </View>
              {(() => {
                const max = Math.max(...groupSets.map(g => g.sets), 1)
                const laggards = groupSets.filter(g => g.sets < max * 0.33)
                const hasAny = groupSets.some(g => g.sets > 0)
                const lagNames = laggards.map((g, i) => i === 0 ? g.label : g.label.toLowerCase())
                const joined = lagNames.length > 1
                  ? `${lagNames.slice(0, -1).join(', ')} ${t('och')} ${lagNames[lagNames.length - 1]}`
                  : lagNames[0]
                return (
                  <>
                    {groupSets.map(g => (
                      <View key={g.label} style={l.mgRow}>
                        <Text style={l.mgName}>{g.label}</Text>
                        <View style={l.mgTrack}>
                          {g.sets > 0 && (
                            <View style={[l.mgFill, {
                              width: `${Math.max(6, (g.sets / max) * 100)}%` as never,
                              backgroundColor: g.sets < max * 0.33 ? GYM : P.BLUE,
                            }]} />
                          )}
                        </View>
                        <Text style={l.mgVal}>{g.sets}</Text>
                      </View>
                    ))}
                    {hasAny && laggards.length > 0 && laggards.length <= 3 && (
                      <View style={[l.mgInsight, { backgroundColor: `${GYM}14` }]}>
                        <Ionicons name="alert-circle-outline" size={17} color={GYM} />
                        <Text style={l.mgInsightText}>
                          {t('{g} ligger efter, lägg in ett pass för balans.', { g: joined })}
                        </Text>
                      </View>
                    )}
                  </>
                )
              })()}
            </View>

            {/* Tyngsta lyftet — trycket öppnar passet där det sattes */}
            {recTopLift !== null && (
              <TouchableOpacity
                style={[l.secCard, l.prRow, chrome]}
                activeOpacity={0.75}
                onPress={() => openGymDay((recTopLift as LiftRec).date, (recTopLift as LiftRec).name)}
                testID="topLiftCard"
              >
                <View style={[l.prIcon, { backgroundColor: `${GYM}1C` }]}>
                  <Ionicons name="trophy-outline" size={22} color={GYM} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={l.prTitle}>{t('Tyngsta lyft: {n} kg', { n: (recTopLift as LiftRec).kg })}</Text>
                  <Text style={l.prSub} numberOfLines={1}>
                    {t((recTopLift as LiftRec).name)}
                    {topLiftOneRm > 0 ? ` · ${t('est. 1RM {n} kg', { n: Math.round(topLiftOneRm) })}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            )}

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
                <Text style={s.muscleLinkTitle}>{t('Genomförda pass')}</Text>
                <Text style={s.muscleLinkSub}>
                  {weekOffset === 0
                    ? t('{n} pass denna vecka', { n: weekGymSessions.length })
                    : t('{n} pass vald vecka', { n: weekGymSessions.length })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={TEXT_SECONDARY} />
            </TouchableOpacity>

          </>
          )}
        </ScrollView>

      {/* Genomförda pass — egen vy i stället för att listan ligger på fliken */}
      <Modal visible={sessionsOpen} animationType="slide" onRequestClose={() => setSessionsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: BG }}>
          <View style={[s.modalTopBar, { paddingTop: insets.top + 8 }]}>
            <GlassCircleButton icon="chevron-back" onPress={() => setSessionsOpen(false)} />
            <Text style={s.modalTopTitle}>{t('Genomförda pass')}</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <Text style={s.sessionsWeekLabel}>
              {weekBounds.label} · {t('{n} pass', { n: weekGymSessions.length })}
            </Text>
            {weekGymSessions.length > 0 ? (
              <View style={[s.card, s.cardPlain, { marginTop: 12 }]}>
                <View style={s.gymList}>
                  {weekGymSessions.map(gs => {
                    const gymDay    = new Date(gs.completedDate + 'T12:00:00').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long' })
                    const exPreview = gs.exercises.slice(0, 3).join(' · ')
                      + (gs.exercises.length > 3 ? ` · +${gs.exercises.length - 3}` : '')
                    return (
                      <SwipeRow key={gs.id} name={gs.sessionName} onDelete={() => deleteGymCompletion(gs.id)}>
                      <TouchableOpacity
                        style={s.gymRow}
                        activeOpacity={0.7}
                        onPress={() => {
                          const dayRows = strengthWorkouts.filter(w => {
                            const wDate = w.data.workout_date ?? toLocalDateString(new Date(w.created_at))
                            return wDate === gs.completedDate && gs.exercises.includes(w.data.exercise_name)
                          })
                          // Två pass samma dag: nyckeln skiljer dem åt så
                          // raderna inte dubbleras i båda detaljvyerna
                          const keys = [...new Set(dayRows.map(w => w.data.pass_key ?? ''))]
                          const passKey = keys.length === 1 ? keys[0] : ''
                          const logged = keys.length === 1
                            ? dayRows
                            : dayRows.filter(w => (w.data.pass_key ?? '') === passKey)
                          setGymDetail({
                            name: gs.sessionName,
                            dateLabel: new Date(gs.completedDate + 'T12:00:00').toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' }),
                            planned: gs.exercises,
                            logged: logged.length > 0 ? logged : dayRows,
                            workoutDate: gs.completedDate,
                            passKey,
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
                <Text style={s.emptyText}>{t('Inga gympass klarade vald vecka')}</Text>
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
          ? parseLocalDate(selDayDate).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })
          : null}
      />
    </>
  )
}


// Lokala stilar för nya kostymen — delade s-stilar rörs inte (andra flikar)
const l = StyleSheet.create({
  secCard: { backgroundColor: CARD, borderRadius: 20, padding: 16, marginBottom: 14 },
  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  secTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '800' },
  secLink: { fontSize: 14, fontWeight: '700' },
  secHint: { color: TEXT_SECONDARY, fontSize: 13 },

  weekNavRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14,
  },
  weekNavBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  weekNavLbl: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  statCell: { width: '33.3%' as never, gap: 2, paddingRight: 8 },
  statLbl: { color: TEXT_SECONDARY, fontSize: 13.5 },
  statVal: { color: TEXT_PRIMARY, fontSize: 24, fontWeight: '800' },
  statSuffix: { fontSize: 14, fontWeight: '700', color: TEXT_SECONDARY },
  statPrev: { color: TEXT_SECONDARY, fontSize: 12.5 },

  barRow: { flexDirection: 'row', alignItems: 'flex-end' },
  barCell: { flex: 1, alignItems: 'center', gap: 8 },
  barSlot: { height: 122, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 26, borderRadius: 13 },
  barEmpty: { width: 22, height: 5, borderRadius: 3, backgroundColor: 'rgba(128,128,128,0.22)' },
  barLbl: { color: TEXT_SECONDARY, fontSize: 12.5, fontWeight: '600' },

  mgRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 },
  mgName: { width: 56, color: TEXT_PRIMARY, fontSize: 14.5, fontWeight: '600' },
  mgTrack: {
    flex: 1, height: 10, borderRadius: 5,
    backgroundColor: 'rgba(128,128,128,0.14)', overflow: 'hidden',
  },
  mgFill: { height: 10, borderRadius: 5 },
  mgVal: { minWidth: 34, textAlign: 'right', color: TEXT_PRIMARY, fontSize: 15, fontWeight: '800' },
  mgInsight: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, padding: 13, marginTop: 10,
  },
  mgInsightText: { flex: 1, color: TEXT_PRIMARY, fontSize: 13.5, lineHeight: 19 },

  bodyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bodyToggle: {
    flexDirection: 'row', backgroundColor: 'rgba(128,128,128,0.12)',
    borderRadius: 999, padding: 3,
  },
  bodyToggleBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999 },
  bodyToggleText: { color: TEXT_SECONDARY, fontSize: 13.5, fontWeight: '600' },
  bodySub: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 6 },

  prRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  prIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  prTitle: { color: TEXT_PRIMARY, fontSize: 16.5, fontWeight: '800' },
  prSub: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
})
