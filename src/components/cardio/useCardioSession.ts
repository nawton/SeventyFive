import * as Haptics from 'expo-haptics'
import * as Location from 'expo-location'
import * as Speech from 'expo-speech'
import { useKeepAwake } from 'expo-keep-awake'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type MapView from 'react-native-maps'
import { Gesture } from 'react-native-gesture-handler'
import { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated'
import { useThemeStrings } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { saveCardioWorkout, type CardioInterval } from '@/services/workouts'
import { completeCardioSession } from '@/services/workoutSchedule'
import { toLocalDateString } from '@/lib/date'
import { getUnitSystem, distanceUnitLabel, type UnitSystem } from '@/lib/units'
import { useT } from '@/lib/i18n'
import type { RunSegment } from '@/lib/runProgression'
import { advanceEngine, createEngineState, spokenSegmentIntro } from '@/lib/intervalEngine'
import { getSwedishVoices, getCoachVoiceId, type CoachVoice } from '@/lib/voice'
import { getVoiceCues, setVoiceCues, getVoiceSettings, setVoiceSettings, DEFAULT_VOICE_SETTINGS, getCardioGoal, setCardioGoal, getDefaultMapStyle, getLastMapCoord, setLastMapCoord, getBodyWeightKg, type VoiceSettings } from '@/lib/prefs'
import { estimateCalories, DEFAULT_WEIGHT_KG } from '@/lib/calories'
import { useRouteColor } from '@/lib/routeColor'
import {
  nameToType, formatPace, spokenTime, haversineDistance,
  type Coord, type ExerciseType,
} from '@/lib/cardioUtils'
import { EXERCISES, APPLE_MAP_TYPES, LIVE_W, type Status } from './constants'

/** GPS-spårning, timer, autopaus, intervallmotor och röstcoaching för ett
    cardiopass. All state/logik för app/cardio.tsx bor här — skärmen själv
    renderar bara utifrån det som returneras. */
export function useCardioSession() {
  const T = useThemeStrings()
  const t = useT()
  const routeColor = useRouteColor()
  // Skärmen släcks inte medan GPS-skärmen är öppen (som Strava under pass)
  useKeepAwake()
  // SafeAreaView får noll-insets inne i modaler på iOS — padda explicit
  const insets = useSafeAreaInsets()

  const { name, sessionId, sessionDate, goalKm, goalMin, segments } = useLocalSearchParams<{ name?: string; sessionId?: string; sessionDate?: string; goalKm?: string; goalMin?: string; segments?: string }>()
  const [goalKmNum, setGoalKmNum]   = useState(goalKm ? parseFloat(goalKm) : 0)
  const [goalMinNum, setGoalMinNum] = useState(goalMin ? parseInt(goalMin, 10) : 0)

  // ── Guidat pass: segmentupplägg från run-workout (intervaller/tempo/fartlek).
  // Allt som inte parsar rent → null → vanlig fri runda, aldrig krasch.
  const guidedSegments = useMemo<RunSegment[] | null>(() => {
    const raw = Array.isArray(segments) ? segments[0] : segments
    if (!raw) return null
    try {
      const arr = JSON.parse(raw)
      if (!Array.isArray(arr) || arr.length < 2) return null
      const ok = arr.every((s: RunSegment) =>
        s && typeof s.label === 'string' &&
        ((s.distanceM ?? 0) > 0) !== ((s.durationS ?? 0) > 0))
      return ok ? (arr as RunSegment[]) : null
    } catch {
      return null
    }
  }, [segments])
  const guided = guidedSegments !== null
  const totalWork = useMemo(
    () => guidedSegments?.filter(s => s.kind === 'work').length ?? 0,
    [guidedSegments])
  const [goalModalOpen, setGoalModalOpen] = useState(false)
  // Infosheets för guidade pass: passets upplägg resp. aktivitetens instruktioner
  const [infoSheet, setInfoSheet] = useState<null | 'plan' | 'activity'>(null)
  const [goalKmDraft, setGoalKmDraft]   = useState(0)
  const [goalMinDraft, setGoalMinDraft] = useState(0)

  // Enhetsval (km/miles) — lagring sker alltid i km, bara visningen konverteras
  const [unit, setUnit] = useState<UnitSystem>('metric')
  useEffect(() => { getUnitSystem().then(setUnit) }, [])
  const unitLabel = distanceUnitLabel(unit)

  // Statspanelens utseende (mörk/ljus) — ändras i inställningarna på passdetaljen
  // Statistikkortet och hela springflödet följer appens ljusa/mörka tema
  const lightCard = useColorScheme() === 'light'

  // Röstguidning — talade besked om splittar och mål
  const voiceRef = useRef(true)
  const [voiceOn, setVoiceOn] = useState(true)
  const [voiceSet, setVoiceSet] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS)
  const voiceSetRef = useRef<VoiceSettings>(DEFAULT_VOICE_SETTINGS)
  const [voiceModalOpen, setVoiceModalOpen] = useState(false)
  const [voicePage, setVoicePage] = useState<'main' | 'freq' | 'stats' | 'voice'>('main')
  // Coachrösten — förbättrad svensk röst väljs automatiskt, byts i listan
  const coachVoiceRef = useRef<string | null>(null)
  const [coachVoices, setCoachVoices] = useState<CoachVoice[]>([])
  const [coachVoiceId, setCoachVoiceIdState] = useState<string | null>(null)
  const lastVoiceMinute = useRef(0)
  const nextVoiceKm = useRef(0)

  function updateVoiceSet(patch: Partial<VoiceSettings> | { say: Partial<VoiceSettings['say']> }) {
    setVoiceSet(prev => {
      const next: VoiceSettings = {
        ...prev,
        ...('say' in patch ? {} : patch as Partial<VoiceSettings>),
        say: { ...prev.say, ...('say' in patch ? (patch as { say: Partial<VoiceSettings['say']> }).say : {}) },
      }
      voiceSetRef.current = next
      setVoiceSettings(next).catch(() => {})
      return next
    })
  }
  useEffect(() => {
    getVoiceCues().then(on => { voiceRef.current = on; setVoiceOn(on) })
    getVoiceSettings().then(v => { voiceSetRef.current = v; setVoiceSet(v) })
    getCoachVoiceId().then(id => { coachVoiceRef.current = id; setCoachVoiceIdState(id) })
    getSwedishVoices().then(setCoachVoices)
    return () => { Speech.stop() }
  }, [])
  function speak(text: string) {
    if (!voiceRef.current) return
    Speech.speak(text, { language: 'sv-SE', voice: coachVoiceRef.current ?? undefined })
  }
  /** Intervallguidningens röst — egen toggle, oberoende av huvudrösten.
      Man kan stänga av km-rapporterna och ändå höra "Vila 90 sekunder". */
  function speakGuide(text: string) {
    if (!voiceSetRef.current.say.intervals) return
    Speech.speak(text, { language: 'sv-SE', voice: coachVoiceRef.current ?? undefined })
  }
  const goalKmSaid = useRef(false)
  const goalMinSaid = useRef(false)

  // Nedräkning 3-2-1 innan spårningen startar
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const countRef = useRef(0)
  const pulseV = useSharedValue(1)

  function countdownFeedback(n: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    speak(n === 3 ? t('Tre') : n === 2 ? t('Två') : t('Ett'))
    pulseV.value = 0.3
    pulseV.value = withTiming(1, { duration: 500 })
  }

  function beginCountdown() {
    if (countdownTimer.current) return
    countRef.current = 3
    setCountdown(3)
    countdownFeedback(3)
    countdownTimer.current = setInterval(() => {
      countRef.current -= 1
      if (countRef.current <= 0) {
        cancelCountdown(false)
        startTracking()
      } else {
        setCountdown(countRef.current)
        countdownFeedback(countRef.current)
      }
    }, 1000)
  }

  function cancelCountdown(stopVoice = true) {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current)
      countdownTimer.current = null
    }
    setCountdown(null)
    if (stopVoice) Speech.stop()
  }

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulseV.value, [0.3, 1], [0.55, 1]) }],
    opacity: interpolate(pulseV.value, [0.3, 1], [0.3, 1]),
  }))

  const mapRef = useRef<MapView>(null)
  const followRef = useRef(true)
  const [routeLine, setRouteLine] = useState<Coord[]>([])
  // Startregion: cachad position → kartan öppnar inzoomad, inte hela Sverige
  const [initRegion, setInitRegion] = useState<{ latitude: number; longitude: number } | null>(null)
  useEffect(() => {
    getLastMapCoord().then(c => { if (c) setInitRegion(prev => prev ?? c) })
  }, [])
  const locationSub = useRef<Location.LocationSubscription | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Väntande kartcentrering från init — städas vid unmount
  const initCenterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Kompass: enhetens riktning från sensorn
  const headingSub = useRef<Location.LocationSubscription | null>(null)
  const headingCont = useRef(0)          // kontinuerlig vinkel (utan 359→0-hopp)
  const lastHeadingInt = useRef(-1)
  const compassOpenRef = useRef(false)
  const [compassOpen, setCompassOpen] = useState(false)
  const [headingDeg, setHeadingDeg] = useState(0)
  const headingV = useSharedValue(0)

  const [status, setStatus] = useState<Status>('idle')
  const [exercise, setExercise] = useState<ExerciseType>(() => nameToType(name ?? ''))
  const [pickerOpen, setPickerOpen] = useState(false)
  // Fullskärms-stats: dra ner på statskortet för att dölja kartan
  const [page, setPage] = useState(0)
  const statsExpanded = page === 1
  const splitsOpen = page === 2
  const pageV = useSharedValue(0)
  // Dölj statskortet till en liten tidspill när man vill se kartan
  const [hudHidden, setHudHidden] = useState(false)
  const [styleMenuOpen, setStyleMenuOpen] = useState(false)
  const [activeStyle, setActiveStyle] = useState<string>('satellite')
  // Vald standardkarta appliceras när kartan laddat (satellit är html-default)
  useEffect(() => {
    getDefaultMapStyle().then(k => {
      // Terräng utgick i Apple Maps-bytet
      setActiveStyle(k === 'terrain' ? 'standard' : k)
    })
  }, [])
  const [summary, setSummary] = useState<{
    distanceKm: number
    elapsed: number
    calories: number
    route: Array<[number, number]>
    splits: { label: string; paceSec: number }[]
  } | null>(null)
  const [saving, setSaving] = useState(false)
  // Namn på passet — anges i sammanfattningen när aktiviteten är klar
  const [workoutName, setWorkoutName] = useState('')
  const [distanceKm, setDistanceKm] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  // GPS-signal: 2 = bra, 1 = ok, 0 = svag, -1 = ingen fix på länge
  const [gpsCat, setGpsCat] = useState(1)
  const gpsCatRef = useRef(1)
  const lastFixTs = useRef(0)
  function updateGps(cat: number) {
    if (cat !== gpsCatRef.current) {
      gpsCatRef.current = cat
      setGpsCat(cat)
    }
  }
  const [currentPaceSec, setCurrentPaceSec] = useState(0)
  const [splitToast, setSplitToast] = useState<string | null>(null)
  const [effort, setEffort]         = useState<number | null>(null)
  const [effortOpen, setEffortOpen] = useState(false)
  const lastCoord = useRef<Coord | null>(null)
  const latestCoord = useRef<Coord | null>(null)
  const routeCoords = useRef<Array<[number, number]>>([])
  const mapReady = useRef(false)
  const elapsedRef = useRef(0)
  // Väggklocksbaserad tid: passets tid = elapsedBase (ackumulerat före nuvarande
  // körsträcka) + tid sedan runStartTs. Timer-ticken UPPDATERAR bara visningen —
  // den räknar inte. Så överlever klockan låst skärm/bakgrund, där JS-timers
  // pausas och tick-räkning skulle tappa sekunder.
  const elapsedBaseRef = useRef(0)
  const runStartTs = useRef(0)
  const distanceRef = useRef(0)
  const splitKm = useRef(1)
  const lastSplitElapsed = useRef(0)
  const splitTimes = useRef<number[]>([]) // sekunder per avklarad kilometer
  const paceTs = useRef(0)
  const smoothedPaceRef = useRef(0)
  const splitToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Intervallmotorns state — logiken bor i lib/intervalEngine (ren, testbar);
  // här lever bara refs + översättningen av motorns händelser till röst/haptik.
  // Ref:en är auktoritativ i looparna (läser bara andra refs, aldrig state →
  // inga stale closures). engineUi är en snapshot som ENDAST sätts vid
  // segmentövergångar; per-sekund-progressen härleds i render från redan-
  // tickande elapsed/distanceKm. Ingen motoråterhämtning vid app-omstart.
  const intervalRef = useRef(createEngineState())
  // Faktiskt resultat per avklarat arbetssegment — sparas med passet
  const intervalResults = useRef<CardioInterval[]>([])
  const [engineUi, setEngineUi] = useState({
    idx: 0, segStartDistKm: 0, segStartElapsed: 0, completedWork: 0, done: false,
  })

  // ── Auto-paus: klockan fryser vid stillastående (rödljus) och återupptas
  // automatiskt vid rörelse. Distans fryser av sig själv (rörelsefiltret).
  const [autoPaused, setAutoPaused] = useState(false)
  const autoPausedRef = useRef(false)
  const lastMoveTs = useRef(0)

  const selectedExercise = EXERCISES.find(e => e.key === exercise)!
  // MET-baserade kalorier: aktivitet × fart × kroppsvikt — inte samma schablon
  // för en promenad som för intervaller. Vikten sätts i cardio-inställningarna.
  const [weightKg, setWeightKg] = useState(DEFAULT_WEIGHT_KG)
  useEffect(() => { getBodyWeightKg().then(setWeightKg) }, [])
  const calories = estimateCalories(exercise, distanceKm, elapsed, weightKg)

  // En gemensam sidvariabel (0 karta · 1 detaljvy · 2 splits) — sidorna
  // glider in från sidan i stället för att poppa upp
  function goPage(pg: number) {
    setPage(pg)
    pageV.value = withTiming(pg, { duration: 320, easing: Easing.out(Easing.cubic) })
  }
  function openStats() { goPage(1) }
  function closeStats() { goPage(0) }
  function openSplits() { goPage(2) }
  function closeSplits() { goPage(0) }

  // Tresidig livevy: [Karta] [Detaljvy] [Splits]. Kartan navigeras med
  // kantknappen (svep skulle krocka med kartpanorering); mellan detaljvyn
  // och splits sveper man som vanligt.
  const collapseGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .activeOffsetY([-15, 15])
    .onEnd(e => {
      if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        if (e.translationX > 40) runOnJS(closeStats)()
        else if (e.translationX < -40) runOnJS(openSplits)()
      } else if (e.translationY < -30) {
        runOnJS(closeStats)()
      }
    })
  const splitsCollapseGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .activeOffsetY([-15, 15])
    .onEnd(e => {
      if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        if (e.translationX > 40) runOnJS(openStats)()
      } else if (e.translationY < -30) {
        runOnJS(closeSplits)()
      }
    })

  const expandedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(pageV.value, [0, 1, 2], [LIVE_W, 0, -LIVE_W]) }],
  }))
  const splitsStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(pageV.value, [0, 1, 2], [LIVE_W * 2, LIVE_W, 0]) }],
  }))

  // Aktivitetsväljaren: inline-sheet utan mörk overlay, dras i handtaget
  const sheetY = useSharedValue(420)
  function openPicker() {
    setPickerOpen(true)
    sheetY.value = 420
    sheetY.value = withTiming(0, { duration: 260 })
  }
  function closePicker() {
    sheetY.value = withTiming(420, { duration: 200 }, (finished) => {
      if (finished) runOnJS(setPickerOpen)(false)
    })
  }
  const sheetDrag = Gesture.Pan()
    .onUpdate(e => {
      // Nedåt följer fingret, uppåt bara ett litet gummibandsmotstånd
      sheetY.value = e.translationY > 0 ? e.translationY : e.translationY * 0.15
    })
    .onEnd(e => {
      if (e.translationY > 90 || e.velocityY > 600) {
        sheetY.value = withTiming(420, { duration: 200 }, (finished) => {
          if (finished) runOnJS(setPickerOpen)(false)
        })
      } else {
        sheetY.value = withTiming(0, { duration: 180 })
      }
    })
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }))

  // Kartvals-sheeten: samma beteende som aktivitetsväljaren
  const styleY = useSharedValue(420)
  // Målväljaren på startvyn — förifylls med senaste målet för aktiviteten
  async function openGoalModal() {
    if (goalKmNum > 0 || goalMinNum > 0) {
      setGoalKmDraft(goalKmNum)
      setGoalMinDraft(goalMinNum)
    } else {
      const saved = await getCardioGoal(exercise)
      setGoalKmDraft(saved?.km ?? 0)
      setGoalMinDraft(saved?.min ?? 0)
    }
    setGoalModalOpen(true)
  }

  function saveGoal() {
    setGoalKmNum(goalKmDraft)
    setGoalMinNum(goalMinDraft)
    if (goalKmDraft > 0 || goalMinDraft > 0) {
      setCardioGoal(exercise, { km: goalKmDraft, min: goalMinDraft }).catch(() => {})
    }
    setGoalModalOpen(false)
  }

  function setVoiceEnabled(on: boolean) {
    Haptics.selectionAsync()
    setVoiceOn(on)
    voiceRef.current = on
    setVoiceCues(on).catch(() => {})
  }

  /** Talad statusrad utifrån valda statistik-flaggor */
  function statusPhrase(includeSplit: boolean): string {
    const s = voiceSetRef.current.say
    const dist = distanceRef.current
    const parts: string[] = []
    if (s.time) parts.push(t('Tid: {time}.', { time: spokenTime(elapsedRef.current) }))
    if (s.distance) parts.push(t('Distans: {dist} kilometer.', { dist: dist.toFixed(2).replace('.', ' komma ') }))
    if (s.avgPace && dist > 0.05) parts.push(t('Snittempo: {pace} per kilometer.', { pace: spokenTime(elapsedRef.current / dist) }))
    if (s.curPace && smoothedPaceRef.current > 0) parts.push(t('Aktuellt tempo: {pace} per kilometer.', { pace: spokenTime(smoothedPaceRef.current) }))
    if (includeSplit && s.splitPace && splitTimes.current.length > 0) {
      parts.push(t('Senaste kilometern: {time}.', { time: spokenTime(splitTimes.current[splitTimes.current.length - 1]) }))
    }
    return parts.join(' ')
  }

  // ── Intervallmotorn — logiken bor i lib/intervalEngine; här översätts dess
  // händelser till röst + haptik och UI-snapshoten uppdateras vid segmentbyten.
  // Anropas från både 1 s-timern (tidssegment) och GPS-callbacken (distans-
  // segment). Rör aldrig splitKm/splitTimes — km-splitsen lever sitt eget liv.
  function runIntervalEngine() {
    if (!guidedSegments) return
    const st = intervalRef.current
    const { changed, events } = advanceEngine(
      st,
      guidedSegments,
      { distanceKm: distanceRef.current, elapsedS: elapsedRef.current },
      intervalResults.current,
    )
    for (const ev of events) {
      if (ev.type === 'restWarning') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      speakGuide(ev.phrase)
    }
    if (changed) {
      setEngineUi({
        idx: st.idx,
        segStartDistKm: st.segStartDistKm,
        segStartElapsed: st.segStartElapsed,
        completedWork: st.completedWork,
        done: st.done,
      })
    }
  }

  // Tidssegment (vila, fartlek-faser) räknas på klockan — auto-paus där skulle
  // frysa nedräkningen för evigt när man står still och vilar
  function inDurationSegment(): boolean {
    if (!guidedSegments) return false
    const st = intervalRef.current
    return !st.done && !!guidedSegments[st.idx]?.durationS
  }

  // Dev-genväg: långtryck på intervallbannern force-avancerar segmentet —
  // distanssegment går inte att testa inomhus annars. Skeppas aldrig (__DEV__).
  function devForceSegment() {
    if (!__DEV__ || !guidedSegments) return
    const st = intervalRef.current
    if (st.done) return
    const seg = guidedSegments[st.idx]
    if (seg.distanceM) st.segStartDistKm = distanceRef.current - seg.distanceM / 1000
    else st.segStartElapsed = elapsedRef.current - (seg.durationS ?? 0)
    runIntervalEngine()
  }

  function openStyleSheet() {
    setStyleMenuOpen(true)
    styleY.value = 420
    styleY.value = withTiming(0, { duration: 260 })
  }
  function closeStyleSheet() {
    styleY.value = withTiming(420, { duration: 200 }, (finished) => {
      if (finished) runOnJS(setStyleMenuOpen)(false)
    })
  }
  const styleDrag = Gesture.Pan()
    .onUpdate(e => {
      styleY.value = e.translationY > 0 ? e.translationY : e.translationY * 0.15
    })
    .onEnd(e => {
      if (e.translationY > 90 || e.velocityY > 600) {
        styleY.value = withTiming(420, { duration: 200 }, (finished) => {
          if (finished) runOnJS(setStyleMenuOpen)(false)
        })
      } else {
        styleY.value = withTiming(0, { duration: 180 })
      }
    })
  const styleSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: styleY.value }],
  }))

  // Kompassnål och gradskiva roterar mot norr
  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-headingV.value}deg` }],
  }))
  const dialStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-headingV.value}deg` }],
  }))

  useEffect(() => {
    initLocation()
    return () => cleanup()
  }, [])

  async function initLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          t('Platstjänster krävs'),
          t('Aktivera platstjänster för att spåra din träning.'),
          [{ text: t('OK'), onPress: () => router.back() }]
        )
        return
      }

      // Snabb: sista kända position (omedelbar, ingen GPS-request)
      const last = await Location.getLastKnownPositionAsync().catch(() => null)
      if (last) {
        const c = { latitude: last.coords.latitude, longitude: last.coords.longitude }
        latestCoord.current = c
        setInitRegion(prev => prev ?? c)
        setLastMapCoord(c).catch(() => {})
        sendInit(c)
      }

      // Kompass: följ enhetens riktning (kan sakna magnetometer — ofarligt att hoppa över)
      headingSub.current = await Location.watchHeadingAsync((h) => {
        const raw = h.trueHeading >= 0 ? h.trueHeading : h.magHeading
        // Kortaste vägen runt så nålen inte snurrar ett helt varv vid 359→0
        const prev = headingCont.current
        const delta = ((raw - (((prev % 360) + 360) % 360)) + 540) % 360 - 180
        headingCont.current = prev + delta
        headingV.value = withTiming(headingCont.current, { duration: 150 })
        const i = Math.round(raw) % 360
        if (i !== lastHeadingInt.current) {
          lastHeadingInt.current = i
          // Gradtexten behöver bara uppdateras när fullskärmskompassen är öppen
          if (compassOpenRef.current) setHeadingDeg(i)
        }
      }).catch(() => null)

      // Exakt: hämta aktuell position
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
      latestCoord.current = c
      setInitRegion(prev => prev ?? c)
      setLastMapCoord(c).catch(() => {})
      sendInit(c)
    } catch {
      // GPS:en kan vägra svara (flygplansläge, ingen signal) — skärmen funkar ändå,
      // kartan centreras när första positionen väl kommer under passet
    }
  }

  function openCompass() {
    setHeadingDeg(Math.round(((headingCont.current % 360) + 360) % 360))
    compassOpenRef.current = true
    setCompassOpen(true)
  }
  function closeCompass() {
    compassOpenRef.current = false
    setCompassOpen(false)
  }

  function sendInit(coord: Coord) {
    const center = () => mapRef.current?.animateCamera({ center: coord, zoom: 16 }, { duration: 0 })
    if (mapReady.current) center()
    else {
      if (initCenterTimer.current) clearTimeout(initCenterTimer.current)
      initCenterTimer.current = setTimeout(center, 600)
    }
  }

  function changeStyle(key: string) {
    if (!APPLE_MAP_TYPES[key]) return
    setActiveStyle(key)
    closeStyleSheet()
  }

  function centerOnUser() {
    const c = latestCoord.current
    if (!c) return
    followRef.current = true
    mapRef.current?.animateCamera({ center: c, zoom: 16 }, { duration: 500 })
  }

  function sendToMap(lat: number, lng: number, track: boolean) {
    if (track) setRouteLine(routeCoords.current.map(([la, ln]) => ({ latitude: la, longitude: ln })))
    // Kameran följer med tills användaren panorerar själv — locate slår på igen
    if (followRef.current) {
      mapRef.current?.animateCamera({ center: { latitude: lat, longitude: lng } }, { duration: 700 })
    }
  }

  async function startTracking() {
    // Talat besked vid start (med mål/första segmentet) respektive återupptagning
    if (elapsedRef.current === 0) {
      if (guidedSegments) {
        speakGuide(t('{label} startad. {intro}', { label: t(selectedExercise.label), intro: spokenSegmentIntro(guidedSegments[0]) }))
      } else {
        const kmTxt = goalKmNum > 0
          ? t('{n} kilometer', { n: (goalKmNum % 1 === 0 ? String(goalKmNum) : goalKmNum.toFixed(1).replace('.', ',')) })
          : ''
        const minTxt = goalMinNum > 0 ? t('{n} minuter', { n: goalMinNum }) : ''
        const goalTxt = kmTxt && minTxt
          ? t(' Mål: {km} på {min}.', { km: kmTxt, min: minTxt })
          : kmTxt ? t(' Mål: {km}.', { km: kmTxt }) : minTxt ? t(' Mål: {min}.', { min: minTxt }) : ''
        speak(t('{label} startad.{goal}', { label: t(selectedExercise.label), goal: goalTxt }))
      }
    } else {
      speak(t('Återupptar.'))
    }

    setStatus('running')
    paceTs.current = 0
    // Auto-pausens rörelsefönster börjar om vid varje start/återupptagning
    lastMoveTs.current = Date.now()
    autoPausedRef.current = false
    setAutoPaused(false)
    runStartTs.current = Date.now()
    timerRef.current = setInterval(() => {
      // Auto-paus fryser klockan — allt annat i ticken rullar vidare
      if (!autoPausedRef.current) {
        const v = Math.round(elapsedBaseRef.current + (Date.now() - runStartTs.current) / 1000)
        elapsedRef.current = v
        setElapsed(v)
      }
      // Ingen GPS-fix på 8 sekunder → visa "ingen signal"
      if (lastFixTs.current > 0 && Date.now() - lastFixTs.current > 8000) {
        updateGps(-1)
      }
      // Stillastående i 5 s → auto-paus. Aldrig utan GPS-signal (tunnlar) —
      // en FÄRSK fix krävs, annars är det signalen som är borta och inte
      // löparen som står still (signalflaggan sätts först efter 8 s och
      // hinner inte skydda). Aldrig innan rundan kommit igång, aldrig
      // under tidssegment (vila)
      if (
        !autoPausedRef.current &&
        gpsCatRef.current !== -1 &&
        lastFixTs.current > 0 &&
        Date.now() - lastFixTs.current < 5000 &&
        distanceRef.current > 0.02 &&
        lastMoveTs.current > 0 &&
        Date.now() - lastMoveTs.current > 5000 &&
        !inDurationSegment()
      ) {
        autoPausedRef.current = true
        setAutoPaused(true)
        // Frys väggklockan: banka in det upplupna och vänta på rörelse
        elapsedBaseRef.current = elapsedRef.current
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        speak(t('Autopaus.'))
      }
      // Tidsmål uppnått — säg till en gång
      if (goalMinNum > 0 && !goalMinSaid.current && elapsedRef.current >= goalMinNum * 60) {
        goalMinSaid.current = true
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        speak(t('{n} minuter. Tidsmålet är uppnått!', { n: goalMinNum }))
      }
      // Nollställ nu/km om ingen GPS-rörelse på 5 sekunder
      if (paceTs.current > 0 && Date.now() - paceTs.current > 5000) {
        smoothedPaceRef.current = 0
        setCurrentPaceSec(0)
      }
      // Tidsbaserade statusbesked enligt röstinställningarna
      const ivMin = voiceSetRef.current.timeEvery
      if (ivMin > 0) {
        const minute = Math.floor(elapsedRef.current / 60)
        if (minute > 0 && minute % ivMin === 0 && minute !== lastVoiceMinute.current) {
          lastVoiceMinute.current = minute
          const phrase = statusPhrase(false)
          if (phrase) speak(phrase)
        }
      }
      // Guidade pass: tidssegment (vila, fartlek-värmning) drivs av klockan
      if (guided) runIntervalEngine()
    }, 1000)
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 3 },
      (loc) => {
        // Signalindikator — uppdateras även för fixar som filtreras bort
        const acc = loc.coords.accuracy ?? 99
        lastFixTs.current = Date.now()
        updateGps(acc <= 15 ? 2 : acc <= 30 ? 1 : 0)

        if (loc.coords.accuracy && loc.coords.accuracy > 30) return

        const coord: Coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }

        if (lastCoord.current) {
          const d = haversineDistance(lastCoord.current, coord)
          if (d < 0.002) return

          // Rörelse — auto-pausen släpper direkt
          lastMoveTs.current = Date.now()
          if (autoPausedRef.current) {
            autoPausedRef.current = false
            setAutoPaused(false)
            runStartTs.current = Date.now()   // klockan rullar igen härifrån
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            speak(t('Återupptar.'))
          }

          // Live pace (exponential moving average)
          const nowMs = Date.now()
          if (paceTs.current > 0) {
            const dtSec = (nowMs - paceTs.current) / 1000
            if (dtSec > 0 && d > 0.001) {
              const instant = dtSec / d
              if (instant > 60 && instant < 1200) {
                smoothedPaceRef.current = smoothedPaceRef.current === 0
                  ? instant
                  : smoothedPaceRef.current * 0.6 + instant * 0.4
                setCurrentPaceSec(Math.round(smoothedPaceRef.current))
              }
            }
          }
          paceTs.current = nowMs

          // Km split check
          const prevKm = distanceRef.current
          const newKm = prevKm + d
          if (newKm >= splitKm.current) {
            const splitTime = elapsedRef.current - lastSplitElapsed.current
            const label = `${splitKm.current} km  ${formatPace(1, splitTime)} /km`
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            if (splitToastTimer.current) clearTimeout(splitToastTimer.current)
            setSplitToast(label)
            splitToastTimer.current = setTimeout(() => setSplitToast(null), 3500)
            const vs = voiceSetRef.current
            if (vs.distEvery > 0 && splitKm.current % vs.distEvery === 0) {
              const phrase = statusPhrase(false)
              const splitPart = vs.say.splitPace ? t(' Senaste kilometern: {time}.', { time: spokenTime(splitTime) }) : ''
              speak(t('Kilometer {n}.{split} {phrase}', { n: splitKm.current, split: splitPart, phrase }))
            } else if (vs.say.splitPace) {
              speak(t('Kilometer {n}. Senaste kilometern: {time}.', { n: splitKm.current, time: spokenTime(splitTime) }))
            }
            splitTimes.current.push(splitTime)
            lastSplitElapsed.current = elapsedRef.current
            splitKm.current += 1
          }

          // Distansmål uppnått — säg till en gång
          if (goalKmNum > 0 && !goalKmSaid.current && newKm >= goalKmNum) {
            goalKmSaid.current = true
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            speak(t('Bra jobbat! Distansmålet är uppnått!'))
          }

          distanceRef.current = newKm
          setDistanceKm(newKm)

          // Guidade pass: distanssegment drivs av just committad distans
          if (guided) runIntervalEngine()
        }

        lastCoord.current = coord
        latestCoord.current = coord
        routeCoords.current.push([coord.latitude, coord.longitude])
        sendToMap(coord.latitude, coord.longitude, true)
      }
    ).catch(() => {
      // GPS-prenumerationen kunde inte startas — timern rullar ändå,
      // och ett nytt försök görs vid Återuppta
      locationSub.current = null
      Alert.alert(t('GPS-problem'), t('Kunde inte starta positionsspårningen. Tid loggas, men distans kan saknas.'))
      return null
    })
  }

  function pauseTracking() {
    speak(t('Pausat.'))
    // Banka in det upplupna — Återuppta startar en ny körsträcka
    elapsedBaseRef.current = elapsedRef.current
    setStatus('paused')
    locationSub.current?.remove()
    locationSub.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    paceTs.current = 0 // reset so resume doesn't produce a stale pace
    // Manuell paus tar över auto-pausen
    autoPausedRef.current = false
    setAutoPaused(false)
  }

  function cleanup() {
    locationSub.current?.remove()
    headingSub.current?.remove()
    if (timerRef.current) clearInterval(timerRef.current)
    if (splitToastTimer.current) clearTimeout(splitToastTimer.current)
    if (countdownTimer.current) clearInterval(countdownTimer.current)
    if (initCenterTimer.current) clearTimeout(initCenterTimer.current)
  }

  function handleFinish() {
    cleanup()
    closeStats()
    // Talad sammanfattning om den är påslagen i röstinställningarna
    if (voiceSetRef.current.say.summary) {
      const dist = distanceRef.current
      const paceTxt = dist > 0.05 ? t(' Snittempo: {pace} per kilometer.', { pace: spokenTime(elapsedRef.current / dist) }) : ''
      speak(t('Träning avslutad. Distans: {dist} kilometer. Tid: {time}.{pace} Bra jobbat!', {
        dist: dist.toFixed(2).replace('.', ' komma '),
        time: spokenTime(elapsedRef.current),
        pace: paceTxt,
      }))
    } else {
      speak(t('Träning avslutad. Bra jobbat!'))
    }

    // Splittar: en rad per hel kilometer + ev. påbörjad sista bit
    const splits = splitTimes.current.map((sec, i) => ({ label: `${i + 1} km`, paceSec: sec }))
    const partialDist = distanceKm - splitTimes.current.length
    const partialTime = elapsed - lastSplitElapsed.current
    if (partialDist > 0.05 && partialTime > 3) {
      splits.push({
        label: `${partialDist.toFixed(1).replace('.', ',')} km`,
        paceSec: Math.round(partialTime / partialDist),
      })
    }

    setSummary({ distanceKm, elapsed, calories, route: routeCoords.current, splits })
    setStatus('idle')
    // Betygsätt ansträngningen direkt efter passet (kan hoppas över)
    setEffort(null)
    setEffortOpen(true)
  }

  async function saveSummaryAndExit() {
    if (!summary) return
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        Alert.alert(t('Inte inloggad'), t('Du måste vara inloggad för att spara passet.'))
        return
      }

      // 1) Spara själva passet (måste lyckas)
      await saveCardioWorkout({
        userId: session.user.id,
        name: workoutName.trim() || selectedExercise.label,
        type: exercise,
        distanceKm: summary.distanceKm,
        durationSeconds: summary.elapsed,
        calories: summary.calories,
        route: summary.route,
        splits: summary.splits,
        // Guidade pass: per-intervall-resultat + planerat antal ("4 av 6")
        intervals: guided && intervalResults.current.length > 0 ? intervalResults.current : undefined,
        intervalsPlanned: guided && totalWork > 1 ? totalWork : undefined,
        effort: effort ?? undefined,
      })

      // 2) Markera det schemalagda passet som klart (om vi kom från ett sådant).
      //    Ett fel här ska inte kasta bort passet — vi varnar men går vidare.
      if (sessionId) {
        const date = sessionDate ?? toLocalDateString()
        try {
          await completeCardioSession(sessionId, session.user.id, date, summary.distanceKm, summary.elapsed)
        } catch (e: any) {
          Alert.alert(
            t('Passet sparades'),
            t('…men kunde inte markeras som klart i schemat.\n\n{error}', { error: e?.message ?? e?.code ?? t('Okänt fel') }),
          )
        }
      }

      setSummary(null)
      router.back()
    } catch (e: any) {
      // Behåll sammanfattningen så passet inte går förlorat — användaren kan spara igen
      Alert.alert(t('Kunde inte spara passet'), e?.message ?? t('Kontrollera din anslutning och försök igen.'))
    } finally {
      setSaving(false)
    }
  }

  return {
    T, t, routeColor, insets,
    name, sessionId, sessionDate, goalKm, goalMin, segments,
    goalKmNum, setGoalKmNum, goalMinNum, setGoalMinNum,
    guidedSegments, guided, totalWork,
    goalModalOpen, setGoalModalOpen, infoSheet, setInfoSheet,
    goalKmDraft, setGoalKmDraft, goalMinDraft, setGoalMinDraft,
    unit, setUnit, unitLabel, lightCard,
    voiceRef, voiceOn, setVoiceOn, voiceSet, setVoiceSet, voiceSetRef,
    voiceModalOpen, setVoiceModalOpen, voicePage, setVoicePage,
    coachVoiceRef, coachVoices, setCoachVoices, coachVoiceId, setCoachVoiceIdState,
    lastVoiceMinute, nextVoiceKm, updateVoiceSet, speak, speakGuide,
    goalKmSaid, goalMinSaid,
    countdown, setCountdown, countdownTimer, countRef, pulseV,
    countdownFeedback, beginCountdown, cancelCountdown, pulseStyle,
    mapRef, followRef, routeLine, setRouteLine, initRegion, setInitRegion,
    locationSub, timerRef, initCenterTimer,
    headingSub, headingCont, lastHeadingInt, compassOpenRef,
    compassOpen, setCompassOpen, headingDeg, setHeadingDeg, headingV,
    status, setStatus, exercise, setExercise, pickerOpen, setPickerOpen,
    page, setPage, statsExpanded, splitsOpen, pageV,
    hudHidden, setHudHidden, styleMenuOpen, setStyleMenuOpen, activeStyle, setActiveStyle,
    summary, setSummary, saving, setSaving, workoutName, setWorkoutName,
    distanceKm, setDistanceKm, elapsed, setElapsed,
    gpsCat, setGpsCat, gpsCatRef, lastFixTs, updateGps,
    currentPaceSec, setCurrentPaceSec, splitToast, setSplitToast,
    effort, setEffort, effortOpen, setEffortOpen,
    lastCoord, latestCoord, routeCoords, mapReady, elapsedRef,
    elapsedBaseRef, runStartTs, distanceRef, splitKm, lastSplitElapsed,
    splitTimes, paceTs, smoothedPaceRef, splitToastTimer,
    intervalRef, intervalResults, engineUi, setEngineUi,
    autoPaused, setAutoPaused, autoPausedRef, lastMoveTs,
    selectedExercise, weightKg, setWeightKg, calories,
    goPage, openStats, closeStats, openSplits, closeSplits,
    collapseGesture, splitsCollapseGesture, expandedStyle, splitsStyle,
    sheetY, openPicker, closePicker, sheetDrag, sheetStyle, styleY,
    openGoalModal, saveGoal, setVoiceEnabled, statusPhrase,
    runIntervalEngine, inDurationSegment, devForceSegment,
    openStyleSheet, closeStyleSheet, styleDrag, styleSheetStyle,
    needleStyle, dialStyle,
    openCompass, closeCompass, sendInit, changeStyle, centerOnUser, sendToMap,
    startTracking, pauseTracking, cleanup, handleFinish, saveSummaryAndExit,
  }
}
