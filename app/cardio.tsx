import * as Haptics from 'expo-haptics'
import * as Location from 'expo-location'
import * as Speech from 'expo-speech'
import { useKeepAwake } from 'expo-keep-awake'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import MapView, { Polyline } from 'react-native-maps'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated'
import { ORANGE, NUM_FONT, NUM_FONT_SEMI, CARDIO_BLUE } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { saveCardioWorkout } from '@/services/workouts'
import { completeCardioSession } from '@/services/workoutSchedule'
import { toLocalDateString } from '@/lib/date'
import { getUnitSystem, toDisplayDistance, distanceUnitLabel, paceForUnit, type UnitSystem } from '@/lib/units'
import type { RunSegment } from '@/lib/runProgression'
import { getCardioStatsTheme, getVoiceCues, setVoiceCues, getVoiceSettings, setVoiceSettings, DEFAULT_VOICE_SETTINGS, getCardioGoal, setCardioGoal, getDefaultMapStyle, getLastMapCoord, setLastMapCoord, type CardioStatsTheme, type VoiceSettings } from '@/lib/prefs'
import { EffortRating, effortColor, effortLabel } from '@/components/EffortRating'
import { GlassCircleButton, GlassPill } from '@/components/GlassButton'
import { GlassView } from 'expo-glass-effect'
import { LIQUID_GLASS } from '@/lib/glass'

type Coord = { latitude: number; longitude: number }
type Status = 'idle' | 'running' | 'paused'
type ExerciseType = 'running' | 'cycling' | 'interval' | 'walking'

const EXERCISES: { key: ExerciseType; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'running',  label: 'Löpning',  icon: 'fitness-outline' },
  { key: 'cycling',  label: 'Cykling',  icon: 'bicycle-outline' },
  { key: 'interval', label: 'Intervall', icon: 'flash-outline' },
  { key: 'walking',  label: 'Promenad', icon: 'walk-outline' },
]

function nameToType(name: string): ExerciseType {
  const s = name.toLowerCase()
  if (s.includes('cykling') || s.includes('cycling') || s.includes('cykel')) return 'cycling'
  if (s.includes('intervall') || s.includes('interval')) return 'interval'
  if (s.includes('promenad') || s.includes('walk')) return 'walking'
  return 'running'
}

// Vad aktiviteten går ut på + vad man ska tänka på — visas i infosheeten
// när man trycker på Aktivitet-cellen under ett guidat pass
const ACTIVITY_INFO: Record<ExerciseType, { desc: string; tips: string[] }> = {
  running: {
    desc: 'Löpning i din egen takt — grunden i all distansträning. Lugna kilometrar bygger motorn som gör de snabba passen möjliga.',
    tips: [
      'Starta lugnare än det känns nödvändigt — de första minuterna ljuger alltid',
      'Landa mjukt med foten under kroppen och blicken framåt',
      'Kan du prata i korta meningar ligger du rätt i lugnt tempo',
    ],
  },
  interval: {
    desc: 'Korta upprepningar i hög fart med vila emellan. Inget pass höjer din maxfart och ditt flås mer — men bara om farten är jämn och vilan används.',
    tips: [
      'Håll jämn fart genom hela intervallen — starta inte i sprint',
      'Använd vilan aktivt: gå eller jogga lätt så pulsen hinner sjunka',
      'Sista intervallen ska kännas tuff, men du ska klara alla i samma fart',
      'Tappar du tekniken — sakta ner hellre än att kämpa dig sönder',
    ],
  },
  cycling: {
    desc: 'Cykling — kondition med minimal belastning på leder och senor. Perfekt som volymträning och aktiv återhämtning.',
    tips: [
      'Håll jämn kadens, runt 80–90 tramptag per minut',
      'Växla lättare i backarna istället för att trampa tungt',
      'Slappna av i axlar och grepp — kraften kommer från benen',
    ],
  },
  walking: {
    desc: 'Promenad — aktiv återhämtning som bygger grundkondition utan att slita. Underskattat verktyg mellan de tuffa passen.',
    tips: [
      'Håll ett tempo där du blir lätt andfådd',
      'Ta ut steget och låt armarna jobba med',
      'Perfekt dagen efter ett tufft pass — blodflödet snabbar på återhämtningen',
    ],
  },
}

const DIAL = Math.min(Dimensions.get('window').width - 70, 320)
const LIVE_W = Dimensions.get('window').width
// Cardioskärmens blå accent — ersätter appens orange på just den här ytan
const CARDIO_ACCENT = CARDIO_BLUE

function cardinalLabel(deg: number): string {
  const dirs = ['N', 'NÖ', 'Ö', 'SÖ', 'S', 'SV', 'V', 'NV']
  return dirs[Math.round(deg / 45) % 8]
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Tid i talad form, t.ex. "25 minuter och 30 sekunder" */
function spokenTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const parts: string[] = []
  if (h > 0) parts.push(`${h} ${h === 1 ? 'timme' : 'timmar'}`)
  if (m > 0) parts.push(`${m} ${m === 1 ? 'minut' : 'minuter'}`)
  if (s > 0 || parts.length === 0) parts.push(`${s} sekunder`)
  return parts.join(' och ')
}

function formatPace(distanceKm: number, seconds: number): string {
  if (distanceKm < 0.01) return '--:--'
  const paceSeconds = seconds / distanceKm
  const m = Math.floor(paceSeconds / 60)
  const s = Math.floor(paceSeconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function haversineDistance(a: Coord, b: Coord): number {
  const R = 6371
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180
  const lat1 = (a.latitude * Math.PI) / 180
  const lat2 = (b.latitude * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

// Apple Maps (MapKit) via react-native-maps — stilarna mappar till mapType.
// Terräng finns inte hos Apple; sparade 'terrain'-val faller tillbaka på Karta.
const MAP_STYLES = [
  { key: 'standard',  label: 'Karta',    icon: 'map-outline' as const },
  { key: 'satellite', label: 'Satellit', icon: 'earth-outline' as const },
  { key: 'dark',      label: 'Natt',     icon: 'moon-outline' as const },
]
const APPLE_MAP_TYPES: Record<string, 'standard' | 'satellite' | 'mutedStandard'> = {
  standard: 'standard',
  satellite: 'satellite',
  dark: 'mutedStandard',
}


export default function CardioScreen() {
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
  const [statsTheme, setStatsTheme] = useState<CardioStatsTheme>('dark')
  useEffect(() => { getCardioStatsTheme().then(setStatsTheme) }, [])
  const lightCard = statsTheme === 'light'

  // Röstguidning — talade besked om splittar och mål
  const voiceRef = useRef(true)
  const [voiceOn, setVoiceOn] = useState(true)
  const [voiceSet, setVoiceSet] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS)
  const voiceSetRef = useRef<VoiceSettings>(DEFAULT_VOICE_SETTINGS)
  const [voiceModalOpen, setVoiceModalOpen] = useState(false)
  const [voicePage, setVoicePage] = useState<'main' | 'freq' | 'stats'>('main')
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
    return () => { Speech.stop() }
  }, [])
  function speak(text: string) {
    if (!voiceRef.current) return
    Speech.speak(text, { language: 'sv-SE' })
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
    speak(n === 3 ? 'Tre' : n === 2 ? 'Två' : 'Ett')
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
  const distanceRef = useRef(0)
  const splitKm = useRef(1)
  const lastSplitElapsed = useRef(0)
  const splitTimes = useRef<number[]>([]) // sekunder per avklarad kilometer
  const paceTs = useRef(0)
  const smoothedPaceRef = useRef(0)
  const splitToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Intervallmotorns state — ref:en är auktoritativ i looparna (läser bara
  // andra refs, aldrig state → inga stale closures). engineUi är en snapshot
  // som ENDAST sätts vid segmentövergångar; per-sekund-progressen härleds i
  // render från redan-tickande elapsed/distanceKm. Ingen motoråterhämtning
  // vid app-omstart mitt i pass (samma villkor som fria rundor).
  const intervalRef = useRef({
    idx: 0,
    segStartDistKm: 0,
    segStartElapsed: 0,
    restWarned: false,
    completedWork: 0,
    done: false,
  })
  const [engineUi, setEngineUi] = useState({
    idx: 0, segStartDistKm: 0, segStartElapsed: 0, completedWork: 0, done: false,
  })

  const selectedExercise = EXERCISES.find(e => e.key === exercise)!
  const calories = Math.round(distanceKm * 65)

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
    if (s.time) parts.push(`Tid: ${spokenTime(elapsedRef.current)}.`)
    if (s.distance) parts.push(`Distans: ${dist.toFixed(2).replace('.', ' komma ')} kilometer.`)
    if (s.avgPace && dist > 0.05) parts.push(`Snittempo: ${spokenTime(elapsedRef.current / dist)} per kilometer.`)
    if (s.curPace && smoothedPaceRef.current > 0) parts.push(`Aktuellt tempo: ${spokenTime(smoothedPaceRef.current)} per kilometer.`)
    if (includeSplit && s.splitPace && splitTimes.current.length > 0) {
      parts.push(`Senaste kilometern: ${spokenTime(splitTimes.current[splitTimes.current.length - 1])}.`)
    }
    return parts.join(' ')
  }

  // ── Intervallmotorn — guidar genom segmentupplägget (uppvärmning → arbete/
  // vila → nedvarvning). Anropas från både 1 s-timern (tidssegment) och
  // GPS-callbacken (distanssegment); idempotent så dubbla anrop i samma tick
  // är ofarliga. Rör aldrig splitKm/splitTimes — km-splitsen lever sitt eget liv.

  function segRemaining(seg: RunSegment): number {
    const st = intervalRef.current
    return seg.distanceM
      ? seg.distanceM - (distanceRef.current - st.segStartDistKm) * 1000
      : (seg.durationS ?? 0) - (elapsedRef.current - st.segStartElapsed)
  }

  // "1,5 kilometer" / "600 meter" — för uppläsning
  function spokenDist(m: number): string {
    if (m >= 1000 && m % 100 === 0) {
      return `${String(m / 1000).replace('.', ',')} kilometer`
    }
    return `${m} meter`
  }

  function spokenSegmentIntro(seg: RunSegment): string {
    if (seg.kind === 'work') {
      // Intervaller läses i meter ("Intervall 3 av 6. 1000 meter."),
      // tempo/maratonfart/fartlek i kilometer
      return seg.label.startsWith('Intervall')
        ? `${seg.label}. ${seg.distanceM} meter.`
        : `${seg.label}: ${spokenDist(seg.distanceM ?? 0)}.`
    }
    if (seg.durationS) {
      return `${seg.label}: ${Math.round(seg.durationS / 60)} minuter i lugnt tempo.`
    }
    return `${seg.label}: ${spokenDist(seg.distanceM ?? 0)} i lugnt tempo.`
  }

  function transitionPhrase(finished: RunSegment, next: RunSegment): string {
    if (next.kind === 'rest') {
      return `Intervall klar. Vila ${next.durationS} sekunder.`
    }
    if (next.kind === 'cooldown') {
      const prefix = finished.label.startsWith('Intervall')
        ? 'Sista intervallen klar. '
        : 'Bra jobbat! '
      return `${prefix}${spokenSegmentIntro(next)}`
    }
    return spokenSegmentIntro(next)
  }

  function advanceIntervalEngine() {
    const segs = guidedSegments
    if (!segs) return
    const st = intervalRef.current
    if (st.done) return

    // 10 s-varning innan vilan tar slut — löparen hinner göra sig redo
    const cur = segs[st.idx]
    if (cur.kind === 'rest' && cur.durationS && !st.restWarned) {
      const remain = segRemaining(cur)
      if (remain <= 10 && remain > 0) {
        st.restWarned = true
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        speak('Tio sekunder kvar. Gör dig redo.')
      }
    }

    // Avancera — idx växer strikt, loopen terminerar vid segs.length
    let changed = false
    while (st.idx < segs.length && segRemaining(segs[st.idx]) <= 0) {
      const finished = segs[st.idx]
      if (finished.kind === 'work') st.completedWork += 1
      st.idx += 1
      st.segStartDistKm = distanceRef.current
      st.segStartElapsed = elapsedRef.current
      st.restWarned = false
      changed = true
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      if (st.idx >= segs.length) {
        st.done = true
        speak('Passet är klart! Bra jobbat. Avsluta passet när du vill.')
      } else {
        speak(transitionPhrase(finished, segs[st.idx]))
      }
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

  // Dev-genväg: långtryck på intervallbannern force-avancerar segmentet —
  // distanssegment går inte att testa inomhus annars. Skeppas aldrig (__DEV__).
  function devForceSegment() {
    if (!__DEV__ || !guidedSegments) return
    const st = intervalRef.current
    if (st.done) return
    const seg = guidedSegments[st.idx]
    if (seg.distanceM) st.segStartDistKm = distanceRef.current - seg.distanceM / 1000
    else st.segStartElapsed = elapsedRef.current - (seg.durationS ?? 0)
    advanceIntervalEngine()
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
          'Platstjänster krävs',
          'Aktivera platstjänster för att spåra din träning.',
          [{ text: 'OK', onPress: () => router.back() }]
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
    else setTimeout(center, 600)
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
        speak(`${selectedExercise.label} startad. ${spokenSegmentIntro(guidedSegments[0])}`)
      } else {
        const kmTxt = goalKmNum > 0
          ? `${(goalKmNum % 1 === 0 ? String(goalKmNum) : goalKmNum.toFixed(1).replace('.', ','))} kilometer`
          : ''
        const minTxt = goalMinNum > 0 ? `${goalMinNum} minuter` : ''
        const goalTxt = kmTxt && minTxt
          ? ` Mål: ${kmTxt} på ${minTxt}.`
          : kmTxt ? ` Mål: ${kmTxt}.` : minTxt ? ` Mål: ${minTxt}.` : ''
        speak(`${selectedExercise.label} startad.${goalTxt}`)
      }
    } else {
      speak('Återupptar.')
    }

    setStatus('running')
    paceTs.current = 0
    timerRef.current = setInterval(() => {
      setElapsed(s => {
        const v = s + 1
        elapsedRef.current = v
        return v
      })
      // Ingen GPS-fix på 8 sekunder → visa "ingen signal"
      if (lastFixTs.current > 0 && Date.now() - lastFixTs.current > 8000) {
        updateGps(-1)
      }
      // Tidsmål uppnått — säg till en gång
      if (goalMinNum > 0 && !goalMinSaid.current && elapsedRef.current >= goalMinNum * 60) {
        goalMinSaid.current = true
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        speak(`${goalMinNum} minuter. Tidsmålet är uppnått!`)
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
      if (guided) advanceIntervalEngine()
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
              speak(`Kilometer ${splitKm.current}.${vs.say.splitPace ? ` Senaste kilometern: ${spokenTime(splitTime)}.` : ''} ${phrase}`)
            } else if (vs.say.splitPace) {
              speak(`Kilometer ${splitKm.current}. Senaste kilometern: ${spokenTime(splitTime)}.`)
            }
            splitTimes.current.push(splitTime)
            lastSplitElapsed.current = elapsedRef.current
            splitKm.current += 1
          }

          // Distansmål uppnått — säg till en gång
          if (goalKmNum > 0 && !goalKmSaid.current && newKm >= goalKmNum) {
            goalKmSaid.current = true
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            speak('Bra jobbat! Distansmålet är uppnått!')
          }

          distanceRef.current = newKm
          setDistanceKm(newKm)

          // Guidade pass: distanssegment drivs av just committad distans
          if (guided) advanceIntervalEngine()
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
      Alert.alert('GPS-problem', 'Kunde inte starta positionsspårningen. Tid loggas, men distans kan saknas.')
      return null
    })
  }

  function pauseTracking() {
    speak('Pausat.')
    setStatus('paused')
    locationSub.current?.remove()
    locationSub.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    paceTs.current = 0 // reset so resume doesn't produce a stale pace
  }

  function cleanup() {
    locationSub.current?.remove()
    headingSub.current?.remove()
    if (timerRef.current) clearInterval(timerRef.current)
    if (splitToastTimer.current) clearTimeout(splitToastTimer.current)
    if (countdownTimer.current) clearInterval(countdownTimer.current)
  }

  function handleFinish() {
    cleanup()
    closeStats()
    // Talad sammanfattning om den är påslagen i röstinställningarna
    if (voiceSetRef.current.say.summary) {
      const dist = distanceRef.current
      const paceTxt = dist > 0.05 ? ` Snittempo: ${spokenTime(elapsedRef.current / dist)} per kilometer.` : ''
      speak(`Träning avslutad. Distans: ${dist.toFixed(2).replace('.', ' komma ')} kilometer. Tid: ${spokenTime(elapsedRef.current)}.${paceTxt} Bra jobbat!`)
    } else {
      speak('Träning avslutad. Bra jobbat!')
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
        Alert.alert('Inte inloggad', 'Du måste vara inloggad för att spara passet.')
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
            'Passet sparades',
            `…men kunde inte markeras som klart i schemat.\n\n${e?.message ?? e?.code ?? 'Okänt fel'}`,
          )
        }
      }

      setSummary(null)
      router.back()
    } catch (e: any) {
      // Behåll sammanfattningen så passet inte går förlorat — användaren kan spara igen
      Alert.alert('Kunde inte spara passet', e?.message ?? 'Kontrollera din anslutning och försök igen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.root}>

      {/* ── Fullscreen Apple Maps — väntar på startregion så vi öppnar inzoomade ── */}
      {initRegion === null && <View style={[StyleSheet.absoluteFill, { backgroundColor: '#101012' }]} />}
      {initRegion !== null && (
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...initRegion, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
        mapType={APPLE_MAP_TYPES[activeStyle] ?? 'standard'}
        userInterfaceStyle={activeStyle === 'dark' ? 'dark' : 'light'}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        pitchEnabled
        rotateEnabled
        onPanDrag={() => { followRef.current = false }}
        onMapReady={() => {
          mapReady.current = true
          const c = latestCoord.current
          if (c) mapRef.current?.animateCamera({ center: c, zoom: 16 }, { duration: 0 })
        }}
      >
        {routeLine.length > 1 && (
          <Polyline
            coordinates={routeLine}
            strokeColor={CARDIO_ACCENT}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>
      )}

      {/* ── Nedräkning 3-2-1 innan start ── */}
      {countdown !== null && (
        <Pressable style={styles.countdownOverlay} onPress={() => cancelCountdown()}>
          <Animated.Text style={[styles.countdownNum, pulseStyle]}>{countdown}</Animated.Text>
          <Text style={styles.countdownHint}>Tryck för att avbryta</Text>
        </Pressable>
      )}

      {/* ── Fullskärmskompass — kolsvart med vita symboler ── */}
      <Modal visible={compassOpen} animationType="fade" onRequestClose={closeCompass}>
        <View style={styles.compassRoot}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            <TouchableOpacity style={styles.compassClose} onPress={closeCompass} activeOpacity={0.7}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>

            <View style={styles.compassStage}>
              {/* Fast markör som visar riktningen mot den roterande skivan */}
              <Ionicons name="caret-down" size={24} color="#FF3B4A" style={{ marginBottom: 8 }} />

              <View style={{ width: DIAL, height: DIAL }}>
                <Animated.View style={[styles.compassDial, dialStyle]}>
                  {/* Gradstreck var 6:e grad, längre var 30:e */}
                  {Array.from({ length: 60 }).map((_, i) => (
                    <View key={i} style={[styles.tickWrap, { transform: [{ rotate: `${i * 6}deg` }] }]}>
                      <View style={[styles.tick, i % 5 === 0 && styles.tickMajor]} />
                    </View>
                  ))}
                  {/* Gradtal var 30:e grad */}
                  {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(d => (
                    <View key={`n${d}`} style={[styles.tickWrap, { transform: [{ rotate: `${d}deg` }] }]}>
                      <Text style={styles.dialNum}>{d}</Text>
                    </View>
                  ))}
                  {/* Väderstreck */}
                  {([['N', 0], ['Ö', 90], ['S', 180], ['V', 270]] as const).map(([letter, d]) => (
                    <View key={letter} style={[styles.tickWrap, { transform: [{ rotate: `${d}deg` }] }]}>
                      <Text style={[styles.dialCardinal, letter === 'N' && { color: '#FF3B4A' }]}>{letter}</Text>
                    </View>
                  ))}
                </Animated.View>

                {/* Fast mitt — grader + väderstreck */}
                <View style={styles.compassCenter} pointerEvents="none">
                  <Text style={styles.compassDeg}>{headingDeg}°</Text>
                  <Text style={styles.compassCard}>{cardinalLabel(headingDeg)}</Text>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Stats overlay — syns även innan start ── */}
      {hudHidden ? (
        <SafeAreaView style={styles.statsOverlay} edges={['top']} pointerEvents="box-none">
          <GlassPill
            onPress={() => setHudHidden(false)}
            style={styles.hudMiniLayout}
            fallbackStyle={lightCard ? [styles.hudMini, styles.statsCardLight] : styles.hudMini}
          >
            <Text style={[styles.hudMiniTime, lightCard && { color: '#000' }]}>{formatTime(elapsed)}</Text>
            <View style={styles.hudMiniShow}>
              <Text style={styles.hudMiniShowText}>Visa statistik</Text>
              <Ionicons name="chevron-down" size={13} color="#fff" />
            </View>
          </GlassPill>
        </SafeAreaView>
      ) : (
        <SafeAreaView style={styles.statsOverlay} edges={['top']} pointerEvents="box-none">
          {/* Tryck på kortet krymper det till miniläget — tryck på minit växer igen */}
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => setHudHidden(true)}
            style={[styles.statsCard, lightCard && styles.statsCardLight]}
          >
            <View style={styles.timerRow}>
              <Text style={[styles.timerText, lightCard && { color: '#000' }]}>{formatTime(elapsed)}</Text>
              {status === 'paused' && (
                <View style={styles.pausedBadge}>
                  <Text style={styles.pausedBadgeText}>PAUSAD</Text>
                </View>
              )}
              {/* GPS-signal — så man förstår varför distansen står stilla */}
              {status === 'running' && (
                <View style={styles.gpsChip}>
                  <View style={[styles.gpsDot, {
                    backgroundColor: gpsCat === 2 ? '#3BE862' : gpsCat === 1 ? '#FFC107' : '#FF3B4A',
                  }]} />
                  <Text style={[styles.gpsText, lightCard && { color: '#777' }]}>
                    {gpsCat === -1 ? 'Ingen GPS' : gpsCat === 0 ? 'Svag GPS' : 'GPS'}
                  </Text>
                </View>
              )}
            </View>

            {/* ── Intervallguidning: aktuellt segment + progress ── */}
            {guided && (() => {
              const seg = engineUi.done ? null : guidedSegments![engineUi.idx]
              const total = seg ? (seg.distanceM ?? seg.durationS ?? 1) : 1
              const remain = seg
                ? seg.distanceM
                  ? Math.max(0, seg.distanceM - (distanceKm - engineUi.segStartDistKm) * 1000)
                  : Math.max(0, (seg.durationS ?? 0) - (elapsed - engineUi.segStartElapsed))
                : 0
              const pct = seg ? Math.min(1, Math.max(0, 1 - remain / total)) : 1
              const isWork = seg?.kind === 'work'
              const barColor = !seg ? '#3BE862' : isWork ? CARDIO_ACCENT : lightCard ? '#9E9E9E' : '#8A8F98'
              return (
                <Pressable
                  style={styles.ivBanner}
                  onPress={() => setHudHidden(true)}
                  onLongPress={__DEV__ ? devForceSegment : undefined}
                  delayLongPress={600}
                >
                  <View style={styles.ivBannerRow}>
                    <Text
                      style={[
                        styles.ivBannerLabel,
                        lightCard && { color: '#000' },
                        isWork && { color: CARDIO_ACCENT },
                        !seg && { color: '#3BE862' },
                      ]}
                      numberOfLines={1}
                    >
                      {seg ? seg.label : 'Passet klart'}
                    </Text>
                    {seg ? (
                      <Text style={[styles.ivBannerRemain, lightCard && { color: '#000' }]}>
                        {seg.distanceM ? `${Math.ceil(remain / 10) * 10} m kvar` : formatTime(Math.ceil(remain))}
                      </Text>
                    ) : (
                      <Ionicons name="checkmark-circle" size={15} color="#3BE862" />
                    )}
                  </View>
                  <View style={[styles.ivBannerTrack, lightCard && { backgroundColor: '#E0E0E0' }]}>
                    <View style={[styles.ivBannerFill, { width: `${pct * 100}%` as never, backgroundColor: barColor }]} />
                  </View>
                </Pressable>
              )
            })()}

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, lightCard && { color: '#000' }]}>{toDisplayDistance(distanceKm, unit).toFixed(2)}</Text>
                <Text style={styles.statLabel}>{unitLabel}</Text>
              </View>
              <View style={[styles.statDivider, lightCard && { backgroundColor: '#E0E0E0' }]} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, lightCard && { color: '#000' }]}>
                  {distanceKm > 0.01 ? formatPace(1, paceForUnit(elapsed / distanceKm, unit)) : '--:--'}
                </Text>
                <Text style={styles.statLabel}>snitt /{unitLabel}</Text>
              </View>
              <View style={[styles.statDivider, lightCard && { backgroundColor: '#E0E0E0' }]} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, lightCard && { color: '#000' }, currentPaceSec > 0 && { color: CARDIO_ACCENT }]}>
                  {currentPaceSec > 0 ? formatPace(1, paceForUnit(currentPaceSec, unit)) : '--:--'}
                </Text>
                <Text style={styles.statLabel}>nu /{unitLabel}</Text>
              </View>
              <View style={[styles.statDivider, lightCard && { backgroundColor: '#E0E0E0' }]} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, lightCard && { color: '#000' }]}>{calories}</Text>
                <Text style={styles.statLabel}>kcal</Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={14} color={lightCard ? '#999' : '#666'} style={{ marginTop: -2 }} />
          </TouchableOpacity>
        </SafeAreaView>
      )}

      {/* ── Km split toast ── */}
      {splitToast && (
        <View style={[styles.splitToast, LIQUID_GLASS && styles.glassSurface]} pointerEvents="none">
          {LIQUID_GLASS && <GlassView glassEffectStyle="regular" colorScheme="dark" tintColor="rgba(12,12,14,0.5)" style={StyleSheet.absoluteFill} />}
          <Ionicons name="flag" size={16} color={CARDIO_ACCENT} />
          <Text style={styles.splitToastText}>{splitToast}</Text>
        </View>
      )}

      {/* ── Right-side buttons ── */}
      <View style={styles.rightBtns}>
        <GlassCircleButton onPress={openCompass} fallbackStyle={styles.compassBtn}>
          <Animated.View style={[{ alignItems: 'center' }, needleStyle]}>
            <Ionicons name="caret-up" size={17} color="#FF3B4A" style={{ marginBottom: -5 }} />
            <Ionicons name="caret-down" size={17} color="#fff" style={{ marginTop: -5 }} />
          </Animated.View>
        </GlassCircleButton>
        <GlassCircleButton icon="locate" draggable onPress={centerOnUser} />
      </View>

      {/* ── Tillbaka-knapp — bara innan passet startats ── */}
      {/* Kantflik — kartan går inte att svepa, knappen byter till detaljvyn */}
      {!statsExpanded && !splitsOpen && (
        <TouchableOpacity style={styles.edgeTab} onPress={openStats} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={26} color="#000" />
        </TouchableOpacity>
      )}

      {/* ── Splits-sidan (tredje sliden) — kilometrar i block ── */}
      <Animated.View
        style={[styles.expandedStats, splitsStyle]}
        pointerEvents={splitsOpen ? 'auto' : 'none'}
      >
        <GestureDetector gesture={splitsCollapseGesture}>
          <View style={{ flex: 1 }}>
            <SafeAreaView style={styles.expandedInner} edges={['top']}>
              <TouchableOpacity style={styles.expandedHandleWrap} onPress={closeSplits} activeOpacity={0.7}>
                <View style={styles.sheetHandle} />
                <Text style={styles.expandedHint}>Svep höger för detaljvyn</Text>
              </TouchableOpacity>
              <Text style={styles.splitsPageTitle}>Splits</Text>
              <ScrollView contentContainerStyle={styles.splitsList} showsVerticalScrollIndicator={false}>
                {/* Pågående kilometer överst, markerad */}
                <View style={[styles.splitBlock, styles.splitBlockActive]}>
                  <Text style={styles.splitBlockLabelActive}>Kilometer {splitTimes.current.length + 1}</Text>
                  <Text style={styles.splitBlockPaceActive}>
                    {currentPaceSec > 0 ? formatPace(1, paceForUnit(currentPaceSec, unit)) : '0:00'}
                    <Text style={styles.splitBlockUnitActive}> /{unitLabel}</Text>
                  </Text>
                  <Text style={styles.splitBlockDistActive}>
                    {Math.max(0, Math.min(1, distanceKm - splitTimes.current.length)).toFixed(2).replace('.', ',')} av 1,00 km
                  </Text>
                </View>
                {[...splitTimes.current].map((sec, i) => ({ sec, km: i + 1 })).reverse().map(sp => (
                  <View key={sp.km} style={styles.splitBlock}>
                    <Text style={styles.splitBlockLabel}>Kilometer {sp.km}</Text>
                    <Text style={styles.splitBlockPace}>
                      {formatPace(1, paceForUnit(sp.sec, unit))}
                      <Text style={styles.splitBlockUnit}> /{unitLabel}</Text>
                    </Text>
                    <Text style={styles.splitBlockDist}>1,00 km</Text>
                  </View>
                ))}
              </ScrollView>
            </SafeAreaView>
          </View>
        </GestureDetector>
      </Animated.View>

      {status === 'idle' && (
        <SafeAreaView style={styles.topRight} edges={['top']}>
          <GlassCircleButton icon="chevron-back" size={40} onPress={() => router.back()} />
        </SafeAreaView>
      )}

      {/* ── Fullskärms-stats (kartan dold) — går att öppna även innan start ── */}
      {(
        <Animated.View
          style={[styles.expandedStats, expandedStyle]}
          pointerEvents={statsExpanded ? 'auto' : 'none'}
        >
          <GestureDetector gesture={collapseGesture}>
            <SafeAreaView style={styles.expandedInner} edges={['top']}>
              <TouchableOpacity style={styles.expandedHandleWrap} onPress={closeStats} activeOpacity={0.7}>
                <View style={styles.sheetHandle} />
                <Text style={styles.expandedHint}>Svep höger för karta · vänster för splits</Text>
              </TouchableOpacity>

              {(goalKmNum > 0 || goalMinNum > 0) && (
                <View style={styles.expandedGoal}>
                  {goalKmNum > 0 && (
                    <View style={styles.goalOne}>
                      <View style={styles.goalTextRow}>
                        <Text style={styles.goalText}>
                          Mål: {toDisplayDistance(goalKmNum, unit).toFixed(1).replace('.', ',')} {unitLabel}
                        </Text>
                        <Text style={styles.goalPct}>
                          {Math.min(100, Math.round((distanceKm / goalKmNum) * 100))}%
                        </Text>
                      </View>
                      <View style={styles.goalTrack}>
                        <View style={[styles.goalFill, { width: `${Math.min(100, (distanceKm / goalKmNum) * 100)}%` as never }]} />
                      </View>
                    </View>
                  )}
                  {goalMinNum > 0 && (
                    <View style={styles.goalOne}>
                      <View style={styles.goalTextRow}>
                        <Text style={styles.goalText}>Mål: {goalMinNum} min</Text>
                        <Text style={[styles.goalPct, { color: CARDIO_ACCENT }]}>
                          {Math.min(100, Math.round((elapsed / (goalMinNum * 60)) * 100))}%
                        </Text>
                      </View>
                      <View style={styles.goalTrack}>
                        <View style={[styles.goalFill, { backgroundColor: CARDIO_ACCENT, width: `${Math.min(100, (elapsed / (goalMinNum * 60)) * 100)}%` as never }]} />
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* ── Guidat pass: hela segmentupplägget — klara ✓, aktuellt
                    markerat med live-återstående, kommande dämpade ── */}
              {guided && (
                <View style={styles.expandedGoal}>
                  <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                    {guidedSegments!.map((seg, i) => {
                      const isDone = engineUi.done || i < engineUi.idx
                      const isCurrent = !engineUi.done && i === engineUi.idx
                      const target = seg.distanceM
                        ? `${seg.distanceM >= 1000 ? `${String(seg.distanceM / 1000).replace('.', ',')} km` : `${seg.distanceM} m`}`
                        : formatTime(seg.durationS ?? 0)
                      const liveRemain = isCurrent
                        ? seg.distanceM
                          ? `${Math.ceil(Math.max(0, seg.distanceM - (distanceKm - engineUi.segStartDistKm) * 1000) / 10) * 10} m kvar`
                          : formatTime(Math.ceil(Math.max(0, (seg.durationS ?? 0) - (elapsed - engineUi.segStartElapsed))))
                        : null
                      return (
                        <View key={i} style={[styles.ivListRow, isCurrent && styles.ivListRowCurrent]}>
                          <View style={[styles.ivListDot, isDone && { backgroundColor: '#3BE862' }, isCurrent && { backgroundColor: CARDIO_ACCENT }]}>
                            {isDone && <Ionicons name="checkmark" size={10} color="#000" />}
                          </View>
                          <Text
                            style={[
                              styles.ivListLabel,
                              isDone && { color: '#666' },
                              isCurrent && { color: '#fff', fontWeight: '700' },
                            ]}
                            numberOfLines={1}
                          >
                            {seg.label}
                          </Text>
                          <Text style={[styles.ivListTarget, isCurrent && { color: CARDIO_ACCENT }]}>
                            {liveRemain ?? target}
                          </Text>
                        </View>
                      )
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Staplade storvärden: tid → nu-tempo → distans → snitt + kcal */}
              <View style={styles.exStack}>
                <View style={styles.exBlock}>
                  <Text style={styles.exValueBig}>{formatTime(elapsed)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.exLabel}>Tid</Text>
                    {status === 'paused' && (
                      <View style={styles.pausedBadge}>
                        <Text style={styles.pausedBadgeText}>PAUSAD</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.exDivider} />

                <View style={styles.exBlock}>
                  <Text style={[styles.exValueBig, currentPaceSec > 0 && { color: CARDIO_ACCENT }]}>
                    {currentPaceSec > 0 ? formatPace(1, paceForUnit(currentPaceSec, unit)) : '--:--'}
                  </Text>
                  <Text style={styles.exLabel}>Nu /{unitLabel}</Text>
                </View>

                <View style={styles.exDivider} />

                <View style={styles.exBlock}>
                  <Text style={styles.exValueBig}>{toDisplayDistance(distanceKm, unit).toFixed(2)}</Text>
                  <Text style={styles.exLabel}>Distans ({unitLabel})</Text>
                </View>

                <View style={styles.exDivider} />

                <View style={styles.exRow}>
                  <View style={styles.exBlockHalf}>
                    <Text style={styles.exValueMed}>
                      {distanceKm > 0.01 ? formatPace(1, paceForUnit(elapsed / distanceKm, unit)) : '--:--'}
                    </Text>
                    <Text style={styles.exLabel}>Snitt /{unitLabel}</Text>
                  </View>
                  <View style={styles.exDividerV} />
                  <View style={styles.exBlockHalf}>
                    <Text style={styles.exValueMed}>{calories}</Text>
                    <Text style={styles.exLabel}>Kcal</Text>
                  </View>
                </View>
              </View>
            </SafeAreaView>
          </GestureDetector>
        </Animated.View>
      )}

      {/* ── Aktivitetsväljare — inline-sheet utan overlay ── */}
      {pickerOpen && (
        <>
          {/* Osynlig yta bakom sheeten: tryck utanför stänger, utan att mörka kartan */}
          <Pressable style={styles.sheetDismiss} onPress={closePicker} />
          <Animated.View style={[styles.sheetWrap, LIQUID_GLASS && styles.glassSurface, sheetStyle]}>
            {LIQUID_GLASS && <GlassView glassEffectStyle="regular" colorScheme="dark" tintColor="rgba(12,12,14,0.5)" style={StyleSheet.absoluteFill} />}
            <GestureDetector gesture={sheetDrag}>
              <View style={styles.sheetGrip}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>Välj aktivitet</Text>
              </View>
            </GestureDetector>
            <SafeAreaView edges={['bottom']}>
              {EXERCISES.map((ex) => {
                const active = exercise === ex.key
                return (
                  <TouchableOpacity
                    key={ex.key}
                    style={[styles.sheetItem, active && styles.sheetItemActive]}
                    onPress={() => {
                      setExercise(ex.key)
                      Haptics.selectionAsync()
                      closePicker()
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.sheetItemIcon, active && { backgroundColor: CARDIO_ACCENT + '2E' }]}>
                      <Ionicons name={ex.icon} size={22} color={active ? CARDIO_ACCENT : '#999'} />
                    </View>
                    <Text style={[styles.sheetItemText, active && styles.sheetItemTextActive]}>{ex.label}</Text>
                    {active && <Ionicons name="checkmark-circle" size={22} color={CARDIO_ACCENT} style={{ marginLeft: 'auto' }} />}
                  </TouchableOpacity>
                )
              })}
            </SafeAreaView>
          </Animated.View>
        </>
      )}

      {/* ── Kartval — slide-up med förhandsbilder ── */}
      {styleMenuOpen && (
        <>
          <Pressable style={styles.sheetDismiss} onPress={closeStyleSheet} />
          <Animated.View style={[styles.sheetWrap, LIQUID_GLASS && styles.glassSurface, styleSheetStyle]}>
            {LIQUID_GLASS && <GlassView glassEffectStyle="regular" colorScheme="dark" tintColor="rgba(12,12,14,0.5)" style={StyleSheet.absoluteFill} />}
            <GestureDetector gesture={styleDrag}>
              <View style={styles.sheetGrip}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>Välj karta</Text>
              </View>
            </GestureDetector>
            <SafeAreaView edges={['bottom']}>
              <View style={styles.mapGrid}>
                {MAP_STYLES.map(ms => {
                  const active = activeStyle === ms.key
                  return (
                    <TouchableOpacity
                      key={ms.key}
                      style={[styles.mapCard, active && styles.mapCardActive]}
                      onPress={() => changeStyle(ms.key)}
                      activeOpacity={0.85}
                    >
                      {initRegion ? (
                        <View style={styles.mapPreview} pointerEvents="none">
                          <MapView
                            style={StyleSheet.absoluteFill}
                            mapType={APPLE_MAP_TYPES[ms.key] ?? 'standard'}
                            userInterfaceStyle={ms.key === 'dark' ? 'dark' : 'light'}
                            initialRegion={{ ...initRegion, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                            scrollEnabled={false}
                            zoomEnabled={false}
                            rotateEnabled={false}
                            pitchEnabled={false}
                          />
                        </View>
                      ) : (
                        <View style={[styles.mapPreview, styles.mapPreviewIcon]}>
                          <Ionicons name={ms.icon} size={26} color={active ? CARDIO_ACCENT : '#9BA0A6'} />
                        </View>
                      )}
                      <View style={styles.mapCardLabelRow}>
                        <Text style={[styles.mapCardLabel, active && { color: CARDIO_ACCENT }]}>{ms.label}</Text>
                        {active && <Ionicons name="checkmark-circle" size={15} color={CARDIO_ACCENT} />}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </SafeAreaView>
          </Animated.View>
        </>
      )}

      {/* ── Workout summary modal ── */}
      <Modal visible={!!summary} animationType="slide" transparent>
        <View style={styles.summaryOverlay}>
          <View style={[styles.summaryContainer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 8 }]}>

            <View style={styles.summaryCheck}>
              <Ionicons name="checkmark" size={36} color="#fff" />
            </View>
            <Text style={styles.summaryTitle}>Träning klar!</Text>
            <Text style={styles.summarySubtitle}>
              {selectedExercise.label} · {new Date().toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })}
            </Text>

            <ScrollView
              style={{ alignSelf: 'stretch', flex: 1 }}
              contentContainerStyle={{ alignItems: 'center', gap: 12, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >

            {/* Namnge passet */}
            <View style={styles.nameField}>
              <Text style={styles.nameFieldLabel}>PASSNAMN</Text>
              <TextInput
                style={styles.nameFieldInput}
                value={workoutName}
                onChangeText={setWorkoutName}
                placeholder={`T.ex. Morgonrunda (annars "${selectedExercise.label}")`}
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>

            {/* Staplade värden — samma stil som fullskärms-statsen */}
            <View style={styles.summaryStack}>
              <View style={styles.exBlock}>
                <Text style={styles.exValueBig}>{formatTime(summary?.elapsed ?? 0)}</Text>
                <Text style={styles.exLabel}>Tid</Text>
              </View>

              <View style={styles.exDivider} />

              <View style={styles.exBlock}>
                <Text style={styles.exValueBig}>{toDisplayDistance(summary?.distanceKm ?? 0, unit).toFixed(2)}</Text>
                <Text style={styles.exLabel}>Distans ({unitLabel})</Text>
              </View>

              <View style={styles.exDivider} />

              <View style={styles.exRow}>
                <View style={styles.exBlockHalf}>
                  <Text style={styles.exValueMed}>
                    {(summary?.distanceKm ?? 0) > 0.01 ? formatPace(1, paceForUnit((summary!.elapsed) / (summary!.distanceKm), unit)) : '--:--'}
                  </Text>
                  <Text style={styles.exLabel}>Snitt /{unitLabel}</Text>
                </View>
                <View style={styles.exDividerV} />
                <View style={styles.exBlockHalf}>
                  <Text style={styles.exValueMed}>{summary?.calories ?? 0}</Text>
                  <Text style={styles.exLabel}>Kcal</Text>
                </View>
              </View>
            </View>

            {/* Kilometersplittar med tempo-staplar */}
            {summary && summary.splits.length > 0 && (() => {
              const fastest = Math.min(...summary.splits.map(s => s.paceSec))
              return (
                <View style={styles.splitsWrap}>
                  <Text style={styles.splitsTitle}>Splittar</Text>
                  {summary.splits.map((sp, i) => (
                    <View key={i} style={styles.splitRow}>
                      <Text style={styles.splitKm}>{sp.label}</Text>
                      <View style={styles.splitBarTrack}>
                        <View style={[styles.splitBar, { width: `${sp.paceSec > 0 ? Math.max(12, (fastest / sp.paceSec) * 100) : 12}%` as never }]} />
                      </View>
                      <Text style={styles.splitPace}>{formatPace(1, sp.paceSec)}</Text>
                    </View>
                  ))}
                </View>
              )
            })()}

            {/* Målresultat — en rad per mål */}
            {summary && goalKmNum > 0 && (() => {
              const pct = summary.distanceKm / goalKmNum
              const reached = pct >= 1
              return (
                <View style={styles.summaryGoalRow}>
                  <Ionicons name={reached ? 'trophy' : 'flag-outline'} size={16} color={reached ? '#FFD54F' : 'rgba(255,255,255,0.6)'} />
                  <Text style={[styles.summaryGoalText, reached && { color: '#FFD54F' }]}>
                    {reached
                      ? 'Distansmål uppnått!'
                      : `${Math.round(pct * 100)}% av distansmålet (${toDisplayDistance(goalKmNum, unit).toFixed(1).replace('.', ',')} ${unitLabel})`}
                  </Text>
                </View>
              )
            })()}
            {summary && goalMinNum > 0 && (() => {
              const pct = summary.elapsed / (goalMinNum * 60)
              const reached = pct >= 1
              return (
                <View style={styles.summaryGoalRow}>
                  <Ionicons name={reached ? 'trophy' : 'flag-outline'} size={16} color={reached ? '#FFD54F' : 'rgba(255,255,255,0.6)'} />
                  <Text style={[styles.summaryGoalText, reached && { color: '#FFD54F' }]}>
                    {reached
                      ? 'Tidsmål uppnått!'
                      : `${Math.round(pct * 100)}% av tidsmålet (${goalMinNum} min)`}
                  </Text>
                </View>
              )
            })()}
            {/* Guidat pass: intervallfacit ("1 av 1" på tempo/maraton är brus → totalWork > 1) */}
            {summary && guided && totalWork > 1 && (() => {
              const all = engineUi.completedWork >= totalWork
              return (
                <View style={styles.summaryGoalRow}>
                  <Ionicons name={all ? 'trophy' : 'flash-outline'} size={16} color={all ? '#FFD54F' : 'rgba(255,255,255,0.6)'} />
                  <Text style={[styles.summaryGoalText, all && { color: '#FFD54F' }]}>
                    {all
                      ? `Alla ${totalWork} intervaller avklarade!`
                      : `${engineUi.completedWork} av ${totalWork} intervaller`}
                  </Text>
                </View>
              )
            })()}

            {/* Ansträngningsbetyg — tryck för att ändra */}
            <TouchableOpacity style={styles.effortRow} onPress={() => setEffortOpen(true)} activeOpacity={0.7}>
              {effort ? (
                <>
                  <View style={[styles.effortBadge, { backgroundColor: effortColor(effort) + '26', borderColor: effortColor(effort) }]}>
                    <Text style={[styles.effortBadgeText, { color: effortColor(effort) }]}>{effort}</Text>
                  </View>
                  <Text style={styles.effortRowText}>Ansträngning · {effortLabel(effort)}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="pulse-outline" size={16} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.effortRowText}>Betygsätt din ansträngning</Text>
                </>
              )}
              <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>

            {/* Poäng-hint */}
            <View style={styles.summaryPoints}>
              <Ionicons name="star" size={13} color={CARDIO_ACCENT} />
              <Text style={styles.summaryPointsText}>+30 p mot din nästa nivå</Text>
            </View>

            </ScrollView>

            <TouchableOpacity
              style={[styles.summaryBtn, saving && { opacity: 0.6 }]}
              onPress={saveSummaryAndExit}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Ionicons name="save-outline" size={20} color="#000" />
              <Text style={styles.summaryBtnText}>{saving ? 'Sparar…' : 'Spara & avsluta'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.summaryDiscard} onPress={() => { setSummary(null); router.back() }}>
              <Text style={styles.summaryDiscardText}>Kasta träningen</Text>
            </TouchableOpacity>

          </View>

          {/* Betygsätt ansträngning — lager över sammanfattningen */}
          <EffortRating
            visible={effortOpen}
            initial={effort}
            onDone={(e) => { setEffort(e); setEffortOpen(false) }}
          />
        </View>
      </Modal>

      {/* Röstguidning — fullskärmsinställningar i Runkeeper-stil */}
      <Modal visible={voiceModalOpen} animationType="slide" onRequestClose={() => setVoiceModalOpen(false)}>
        <View style={styles.voiceRoot}>
          <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
            <View style={styles.voiceHeader}>
              <TouchableOpacity
                onPress={() => (voicePage === 'main' ? setVoiceModalOpen(false) : setVoicePage('main'))}
                hitSlop={12}
              >
                <Ionicons name={voicePage === 'main' ? 'close' : 'chevron-back'} size={26} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.voiceIconWrap}>
              <View style={styles.voiceIconCircle}>
                <Ionicons name="volume-high-outline" size={36} color={CARDIO_ACCENT} />
              </View>
              <Text style={styles.voiceTitle}>
                {voicePage === 'main' ? 'Röstguidning' : voicePage === 'freq' ? 'Hur ofta?' : 'Vilken statistik?'}
              </Text>
            </View>

            {voicePage === 'main' && (
              <View style={styles.voiceList}>
                <View style={styles.voiceRow}>
                  <Text style={styles.voiceRowLabel}>Aktivera</Text>
                  <Switch
                    value={voiceOn}
                    onValueChange={setVoiceEnabled}
                    trackColor={{ false: '#333', true: CARDIO_ACCENT }}
                    thumbColor="#fff"
                  />
                </View>
                <TouchableOpacity style={styles.voiceRow} onPress={() => setVoicePage('freq')} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.voiceRowLabel}>Hur ofta?</Text>
                    <Text style={styles.voiceRowValue}>
                      {[
                        voiceSet.distEvery > 0 ? `Varje ${voiceSet.distEvery === 1 ? '' : `${voiceSet.distEvery}:e `}kilometer` : null,
                        voiceSet.timeEvery > 0 ? `var ${voiceSet.timeEvery}:e minut` : null,
                      ].filter(Boolean).join(' · ') || 'Aldrig'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#666" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.voiceRow} onPress={() => setVoicePage('stats')} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.voiceRowLabel}>Vilken statistik?</Text>
                    <Text style={styles.voiceRowValue} numberOfLines={1}>
                      {[
                        voiceSet.say.time && 'Tid',
                        voiceSet.say.distance && 'Distans',
                        voiceSet.say.avgPace && 'Snittempo',
                        voiceSet.say.curPace && 'Aktuellt tempo',
                        voiceSet.say.splitPace && 'Split-tempo',
                        voiceSet.say.summary && 'Sammanfattning',
                      ].filter(Boolean).join(', ') || 'Ingen'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#666" />
                </TouchableOpacity>
              </View>
            )}

            {voicePage === 'freq' && (
              <View style={styles.voiceList}>
                <View style={styles.voiceFreqBlock}>
                  <View style={styles.voiceRowPlain}>
                    <Text style={styles.voiceRowLabel}>Distans</Text>
                    <Switch
                      value={voiceSet.distEvery > 0}
                      onValueChange={on => updateVoiceSet({ distEvery: on ? 1 : 0 })}
                      trackColor={{ false: '#333', true: CARDIO_ACCENT }}
                      thumbColor="#fff"
                    />
                  </View>
                  <View style={[styles.voiceStepper, voiceSet.distEvery === 0 && { opacity: 0.35 }]}>
                    <TouchableOpacity
                      style={styles.voiceStepBtn}
                      disabled={voiceSet.distEvery <= 1}
                      onPress={() => updateVoiceSet({ distEvery: Math.max(1, voiceSet.distEvery - 1) })}
                    >
                      <Ionicons name="remove" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.voiceStepValue}>{voiceSet.distEvery || 1}</Text>
                      <Text style={styles.voiceStepUnit}>kilometer</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.voiceStepBtn}
                      disabled={voiceSet.distEvery === 0 || voiceSet.distEvery >= 10}
                      onPress={() => updateVoiceSet({ distEvery: Math.min(10, voiceSet.distEvery + 1) })}
                    >
                      <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.voiceFreqBlock}>
                  <View style={styles.voiceRowPlain}>
                    <Text style={styles.voiceRowLabel}>Tid</Text>
                    <Switch
                      value={voiceSet.timeEvery > 0}
                      onValueChange={on => updateVoiceSet({ timeEvery: on ? 5 : 0 })}
                      trackColor={{ false: '#333', true: CARDIO_ACCENT }}
                      thumbColor="#fff"
                    />
                  </View>
                  <View style={[styles.voiceStepper, voiceSet.timeEvery === 0 && { opacity: 0.35 }]}>
                    <TouchableOpacity
                      style={styles.voiceStepBtn}
                      disabled={voiceSet.timeEvery <= 1}
                      onPress={() => updateVoiceSet({ timeEvery: Math.max(1, voiceSet.timeEvery - 1) })}
                    >
                      <Ionicons name="remove" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.voiceStepValue}>{voiceSet.timeEvery || 5}</Text>
                      <Text style={styles.voiceStepUnit}>minuter</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.voiceStepBtn}
                      disabled={voiceSet.timeEvery === 0 || voiceSet.timeEvery >= 60}
                      onPress={() => updateVoiceSet({ timeEvery: Math.min(60, voiceSet.timeEvery + 1) })}
                    >
                      <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {voicePage === 'stats' && (
              <View style={styles.voiceList}>
                {([
                  { key: 'time' as const,      label: 'Tid' },
                  { key: 'distance' as const,  label: 'Distans' },
                  { key: 'avgPace' as const,   label: 'Genomsnittligt tempo' },
                  { key: 'curPace' as const,   label: 'Aktuellt tempo' },
                  { key: 'splitPace' as const, label: 'Split-tempo' },
                  { key: 'summary' as const,   label: 'Sammanfattning vid avslut' },
                ]).map(opt => (
                  <View key={opt.key} style={styles.voiceRow}>
                    <Text style={styles.voiceRowLabel}>{opt.label}</Text>
                    <Switch
                      value={voiceSet.say[opt.key]}
                      onValueChange={on => updateVoiceSet({ say: { [opt.key]: on } })}
                      trackColor={{ false: '#333', true: CARDIO_ACCENT }}
                      thumbColor="#fff"
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Målväljare — stegare i samma stil som röstinställningarna */}
      <Modal visible={goalModalOpen} transparent animationType="slide" onRequestClose={() => setGoalModalOpen(false)}>
        <Pressable style={styles.goalModalOverlay} onPress={() => setGoalModalOpen(false)}>
          <Pressable style={styles.goalModalSheet} onPress={() => {}}>
            <View style={styles.goalIconWrap}>
              <View style={styles.goalIconCircle}>
                <Ionicons name="flag-outline" size={28} color={CARDIO_ACCENT} />
              </View>
              <Text style={styles.goalModalTitle}>Sätt mål</Text>
            </View>

            <View style={styles.voiceFreqBlock}>
              <View style={styles.voiceRowPlain}>
                <Text style={styles.voiceRowLabel}>Distans</Text>
                <Switch
                  value={goalKmDraft > 0}
                  onValueChange={on => setGoalKmDraft(on ? 5 : 0)}
                  trackColor={{ false: '#333', true: CARDIO_ACCENT }}
                  thumbColor="#fff"
                />
              </View>
              <View style={[styles.voiceStepper, goalKmDraft === 0 && { opacity: 0.35 }]}>
                <TouchableOpacity
                  style={styles.voiceStepBtn}
                  disabled={goalKmDraft <= 0.5}
                  onPress={() => setGoalKmDraft(v => Math.max(0.5, Math.round((v - 0.5) * 2) / 2))}
                >
                  <Ionicons name="remove" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.voiceStepValue}>
                    {(goalKmDraft || 5).toFixed(goalKmDraft % 1 === 0 ? 0 : 1).replace('.', ',')}
                  </Text>
                  <Text style={styles.voiceStepUnit}>{unitLabel}</Text>
                </View>
                <TouchableOpacity
                  style={styles.voiceStepBtn}
                  disabled={goalKmDraft === 0 || goalKmDraft >= 100}
                  onPress={() => setGoalKmDraft(v => Math.min(100, Math.round((v + 0.5) * 2) / 2))}
                >
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.voiceFreqBlock}>
              <View style={styles.voiceRowPlain}>
                <Text style={styles.voiceRowLabel}>Tid</Text>
                <Switch
                  value={goalMinDraft > 0}
                  onValueChange={on => setGoalMinDraft(on ? 30 : 0)}
                  trackColor={{ false: '#333', true: CARDIO_ACCENT }}
                  thumbColor="#fff"
                />
              </View>
              <View style={[styles.voiceStepper, goalMinDraft === 0 && { opacity: 0.35 }]}>
                <TouchableOpacity
                  style={styles.voiceStepBtn}
                  disabled={goalMinDraft <= 5}
                  onPress={() => setGoalMinDraft(v => Math.max(5, v - 5))}
                >
                  <Ionicons name="remove" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.voiceStepValue}>{goalMinDraft || 30}</Text>
                  <Text style={styles.voiceStepUnit}>minuter</Text>
                </View>
                <TouchableOpacity
                  style={styles.voiceStepBtn}
                  disabled={goalMinDraft === 0 || goalMinDraft >= 300}
                  onPress={() => setGoalMinDraft(v => Math.min(300, v + 5))}
                >
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.goalModalSave} onPress={saveGoal} activeOpacity={0.85}>
              <Text style={styles.goalModalSaveText}>Spara mål</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.goalModalClear}
              onPress={() => { setGoalKmNum(0); setGoalMinNum(0); setGoalModalOpen(false) }}
            >
              <Text style={styles.goalModalClearText}>Inget mål</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Infosheet: passets upplägg (guidade pass) ── */}
      <Modal visible={infoSheet === 'plan'} transparent animationType="slide" onRequestClose={() => setInfoSheet(null)}>
        <Pressable style={styles.goalModalOverlay} onPress={() => setInfoSheet(null)}>
          <Pressable style={styles.goalModalSheet} onPress={() => {}}>
            <View style={styles.goalIconWrap}>
              <View style={styles.goalIconCircle}>
                <Ionicons name="flash" size={26} color={CARDIO_ACCENT} />
              </View>
              <Text style={styles.goalModalTitle}>Passets upplägg</Text>
              <Text style={styles.infoSheetSub}>
                Följ guidningen — rösten och bannern säger till när det är dags att växla
              </Text>
            </View>
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {guidedSegments?.map((seg, i) => {
                const icon: React.ComponentProps<typeof Ionicons>['name'] =
                  seg.kind === 'work' ? 'flash-outline'
                  : seg.kind === 'rest' ? 'pause-outline'
                  : seg.kind === 'cooldown' ? 'leaf-outline'
                  : 'walk-outline'
                const target = seg.distanceM
                  ? seg.distanceM >= 1000 && seg.distanceM % 100 === 0
                    ? `${String(seg.distanceM / 1000).replace('.', ',')} km`
                    : `${seg.distanceM} m`
                  : (seg.durationS ?? 0) < 120
                    ? `${seg.durationS} s`
                    : `${Math.round((seg.durationS ?? 0) / 60)} min`
                const isWork = seg.kind === 'work'
                return (
                  <View key={i} style={[styles.infoPlanRow, i > 0 && styles.infoPlanRowBorder]}>
                    <View style={[styles.infoPlanIcon, isWork && { backgroundColor: CARDIO_ACCENT + '22' }]}>
                      <Ionicons name={icon} size={15} color={isWork ? CARDIO_ACCENT : '#9BA0A6'} />
                    </View>
                    <Text style={[styles.infoPlanLabel, isWork && { color: '#fff', fontWeight: '700' }]} numberOfLines={1}>
                      {seg.label}
                    </Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.infoPlanTarget, isWork && { color: CARDIO_ACCENT }]}>{target}</Text>
                      {isWork && seg.paceSecLo && (
                        <Text style={styles.infoPlanPace}>
                          ca {formatPace(1, paceForUnit(seg.paceSecLo, unit))}
                          {seg.paceSecHi && seg.paceSecHi !== seg.paceSecLo ? `–${formatPace(1, paceForUnit(seg.paceSecHi, unit))}` : ''} /{unitLabel}
                        </Text>
                      )}
                    </View>
                  </View>
                )
              })}
            </ScrollView>
            <TouchableOpacity style={styles.goalModalSave} onPress={() => setInfoSheet(null)}>
              <Text style={styles.goalModalSaveText}>Jag är redo</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Infosheet: vad aktiviteten går ut på (guidade pass) ── */}
      <Modal visible={infoSheet === 'activity'} transparent animationType="slide" onRequestClose={() => setInfoSheet(null)}>
        <Pressable style={styles.goalModalOverlay} onPress={() => setInfoSheet(null)}>
          <Pressable style={styles.goalModalSheet} onPress={() => {}}>
            <View style={styles.goalIconWrap}>
              <View style={styles.goalIconCircle}>
                <Ionicons name={selectedExercise.icon} size={26} color={CARDIO_ACCENT} />
              </View>
              <Text style={styles.goalModalTitle}>{selectedExercise.label}</Text>
            </View>
            <Text style={styles.infoSheetDesc}>{ACTIVITY_INFO[exercise].desc}</Text>
            <Text style={styles.infoSheetTipsHead}>TÄNK PÅ</Text>
            <View style={{ gap: 10 }}>
              {ACTIVITY_INFO[exercise].tips.map((tip, i) => (
                <View key={i} style={styles.infoTipRow}>
                  <View style={styles.infoTipDot}>
                    <Ionicons name="checkmark" size={11} color={CARDIO_ACCENT} />
                  </View>
                  <Text style={styles.infoTipText}>{tip}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.goalModalSave} onPress={() => setInfoSheet(null)}>
              <Text style={styles.goalModalSaveText}>Jag är redo</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <SafeAreaView
        style={[
          status === 'idle' ? styles.bottomBarIdle : styles.bottomBar,
          status !== 'idle' && LIQUID_GLASS && styles.glassSurface,
        ]}
        edges={['bottom']}
      >
        {status !== 'idle' && LIQUID_GLASS && <GlassView glassEffectStyle="regular" colorScheme="dark" tintColor="rgba(12,12,14,0.5)" style={StyleSheet.absoluteFill} />}
        {/* Tre sidor: Splits · Karta · Statistik */}
        <View style={styles.pageDots}>
          {[0, 1, 2].map(i => {
            const active = splitsOpen ? i === 2 : statsExpanded ? i === 1 : i === 0
            return <View key={i} style={[styles.pageDot, active && styles.pageDotOn]} />
          })}
        </View>
        <View style={styles.bottomInner}>

          {status === 'idle' ? (
            <View style={styles.idleWrap}>
              {/* Inställningsrutnät i eget flytande kort, Start separat under */}
              <View style={styles.idleCard}>
              <View style={styles.idleGrid}>
                {/* Guidade pass: planen äger aktivitet och mål — cellerna öppnar
                    infosheets istället för väljare */}
                <TouchableOpacity
                  style={styles.idleCell}
                  onPress={guided ? () => setInfoSheet('activity') : openPicker}
                  activeOpacity={0.75}
                >
                  <Ionicons name={selectedExercise.icon} size={20} color={CARDIO_ACCENT} />
                  <View style={styles.idleCellText}>
                    <Text style={styles.idleCellLabel}>Aktivitet</Text>
                    <Text style={styles.idleCellValue}>{selectedExercise.label}</Text>
                  </View>
                  {guided && <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.4)" />}
                </TouchableOpacity>
                <View style={styles.idleGridDivV} />
                <TouchableOpacity
                  style={styles.idleCell}
                  onPress={guided ? () => setInfoSheet('plan') : openGoalModal}
                  activeOpacity={0.75}
                >
                  <Ionicons name="flag-outline" size={20} color={CARDIO_ACCENT} />
                  <View style={styles.idleCellText}>
                    <Text style={styles.idleCellLabel}>{guided ? 'Upplägg' : 'Mål'}</Text>
                    <Text style={styles.idleCellValue} numberOfLines={1}>
                      {guided
                        ? totalWork > 1
                          ? `${totalWork} intervaller`
                          : 'Följer passet'
                        : goalKmNum > 0 || goalMinNum > 0
                          ? [
                              goalKmNum > 0 ? `${String(goalKmNum).replace('.', ',')} ${unitLabel}` : null,
                              goalMinNum > 0 ? `${goalMinNum} min` : null,
                            ].filter(Boolean).join(' · ')
                          : 'Inget'}
                    </Text>
                  </View>
                  {guided && <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.4)" />}
                </TouchableOpacity>
              </View>
              <View style={styles.idleGridDivH} />
              <View style={styles.idleGrid}>
                <TouchableOpacity style={styles.idleCell} onPress={() => { setVoicePage('main'); setVoiceModalOpen(true) }} activeOpacity={0.75}>
                  <Ionicons name={voiceOn ? 'volume-high-outline' : 'volume-mute-outline'} size={20} color={CARDIO_ACCENT} />
                  <View style={styles.idleCellText}>
                    <Text style={styles.idleCellLabel}>Röstguidning</Text>
                    <Text style={styles.idleCellValue} numberOfLines={1}>
                      {!voiceOn ? 'Av'
                        : [
                            voiceSet.distEvery > 0 ? `${voiceSet.distEvery} km` : null,
                            voiceSet.timeEvery > 0 ? `${voiceSet.timeEvery} min` : null,
                          ].filter(Boolean).join(' · ') || 'På'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.idleGridDivV} />
                <TouchableOpacity style={styles.idleCell} onPress={openStyleSheet} activeOpacity={0.75}>
                  <Ionicons name="layers-outline" size={20} color={CARDIO_ACCENT} />
                  <View style={styles.idleCellText}>
                    <Text style={styles.idleCellLabel}>Karta</Text>
                    <Text style={styles.idleCellValue}>
                      {MAP_STYLES.find(m => m.key === activeStyle)?.label ?? 'Karta'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              </View>

              <TouchableOpacity style={styles.startWide} onPress={beginCountdown} activeOpacity={0.85}>
                <Text style={styles.startWideText}>Start</Text>
              </TouchableOpacity>
            </View>
          ) : status === 'running' ? (
            // Under passet: bara en bred pausknapp
            <TouchableOpacity style={styles.pausePill} onPress={pauseTracking} activeOpacity={0.85}>
              <Ionicons name="pause" size={24} color="#fff" />
              <Text style={styles.pausePillText}>Pausa</Text>
            </TouchableOpacity>
          ) : (
            // Pausad: bred Återuppta, mindre Avsluta så man inte råkar avsluta
            <>
              <TouchableOpacity style={[styles.pausePill, { flex: 2 }]} onPress={startTracking} activeOpacity={0.85}>
                <Ionicons name="play" size={22} color="#fff" style={{ marginLeft: 2 }} />
                <Text style={styles.pausePillText}>Återuppta</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.finishPill} onPress={handleFinish} activeOpacity={0.85}>
                <Ionicons name="stop" size={18} color="#fff" />
                <Text style={styles.finishPillText}>Avsluta</Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </SafeAreaView>

    </View>
  )
}

const styles = StyleSheet.create({

  // ── Idle: inställningsrutnät + bred Start (Runkeeper-inspirerad) ──
  idleWrap: { width: '100%', gap: 12, paddingBottom: 6 },
  idleCard: {
    backgroundColor: 'rgba(18,18,20,0.92)',
    borderRadius: 20,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  idleGrid: { flexDirection: 'row', alignItems: 'stretch' },
  idleGridDivH: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: -4 },
  idleGridDivV: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
  idleCell: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  idleCellText: { flex: 1 },
  idleCellLabel: { color: '#9BA0A6', fontSize: 11, fontWeight: '600' },
  idleCellValue: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 1 },
  startWide: {
    backgroundColor: CARDIO_ACCENT, borderRadius: 999,
    paddingVertical: 13, alignItems: 'center',
  },
  startWideText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },

  // ── Splits-sidan ──
  splitsPageTitle: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.4, marginTop: 4, marginBottom: 14 },
  splitsList: { gap: 10, paddingBottom: 160 },
  splitBlock: { backgroundColor: '#1C1C1E', borderRadius: 18, padding: 18, gap: 2 },
  splitBlockActive: { backgroundColor: CARDIO_ACCENT },
  splitBlockLabel: { color: '#9BA0A6', fontSize: 14, fontWeight: '600' },
  splitBlockLabelActive: { color: 'rgba(0,0,0,0.6)', fontSize: 14, fontWeight: '700' },
  splitBlockPace: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  splitBlockPaceActive: { color: '#000', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  splitBlockUnit: { fontSize: 17, fontWeight: '700', color: '#9BA0A6' },
  splitBlockUnitActive: { fontSize: 17, fontWeight: '700', color: 'rgba(0,0,0,0.55)' },
  splitBlockDist: { color: '#9BA0A6', fontSize: 14, fontWeight: '600', marginTop: 2 },
  splitBlockDistActive: { color: 'rgba(0,0,0,0.6)', fontSize: 14, fontWeight: '700', marginTop: 2 },

  // Kantflik på kartan → detaljvyn
  edgeTab: {
    position: 'absolute', right: 0, top: '66%',
    width: 46, height: 68,
    backgroundColor: CARDIO_ACCENT,
    borderTopLeftRadius: 18, borderBottomLeftRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 8,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },

  // Punktindikator för de tre sidorna
  pageDots: { flexDirection: 'row', justifyContent: 'center', gap: 7, paddingTop: 8, marginBottom: -2 },
  pageDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  pageDotOn: { backgroundColor: '#fff' },

  // Röstguidning — fullskärm
  voiceRoot: { flex: 1, backgroundColor: '#0A0A0C' },
  voiceHeader: { paddingHorizontal: 20 },
  voiceIconWrap: { alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 22 },
  voiceIconCircle: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: CARDIO_ACCENT + '1C',
    alignItems: 'center', justifyContent: 'center',
  },
  voiceTitle: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  voiceList: { paddingHorizontal: 16, gap: 12 },
  voiceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    backgroundColor: '#161618', borderRadius: 18,
    paddingVertical: 15, paddingHorizontal: 16,
  },
  voiceRowPlain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  voiceRowLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  voiceRowValue: { color: '#9BA0A6', fontSize: 13, marginTop: 3 },
  voiceFreqBlock: {
    backgroundColor: '#161618', borderRadius: 20,
    padding: 18, gap: 18,
  },
  voiceStepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  voiceStepBtn: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  voiceStepValue: { color: CARDIO_ACCENT, fontSize: 46, fontFamily: NUM_FONT, lineHeight: 52 },
  voiceStepUnit: { color: '#9BA0A6', fontSize: 14, fontWeight: '600', marginTop: -4 },

  // Röstguidningsväljare
  voiceOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0A0A0C', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#2C2C2E',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  voiceOptionActive: { borderColor: CARDIO_ACCENT, backgroundColor: CARDIO_ACCENT + '10' },
  voiceOptionLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  voiceOptionSub: { color: '#9BA0A6', fontSize: 12, marginTop: 2 },

  // Målmodal
  goalModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  goalModalSheet: {
    backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40, gap: 14,
  },
  goalModalTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  goalIconWrap: { alignItems: 'center', gap: 10, marginBottom: 4 },
  goalIconCircle: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: CARDIO_ACCENT + '1C',
    alignItems: 'center', justifyContent: 'center',
  },
  goalModalSave: {
    backgroundColor: CARDIO_ACCENT, borderRadius: 999, paddingVertical: 14, alignItems: 'center',
  },
  goalModalSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  goalModalClear: { alignItems: 'center', paddingVertical: 8 },
  goalModalClearText: { color: '#9BA0A6', fontSize: 13 },

  // ── Infosheets för guidade pass ──
  infoSheetSub: {
    color: '#9BA0A6', fontSize: 13, textAlign: 'center',
    lineHeight: 18, marginTop: -2, paddingHorizontal: 16,
  },
  infoSheetDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 21 },
  infoSheetTipsHead: {
    color: '#9BA0A6', fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginTop: 4,
  },
  infoTipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoTipDot: {
    width: 20, height: 20, borderRadius: 10, marginTop: 1,
    backgroundColor: CARDIO_ACCENT + '1E',
    alignItems: 'center', justifyContent: 'center',
  },
  infoTipText: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 19 },

  infoPlanRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
  },
  infoPlanRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)',
  },
  infoPlanIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  infoPlanLabel: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '500' },
  infoPlanTarget: {
    color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: NUM_FONT,
    fontVariant: ['tabular-nums'],
  },
  infoPlanPace: {
    color: '#9BA0A6', fontSize: 11, fontFamily: NUM_FONT_SEMI,
    fontVariant: ['tabular-nums'], marginTop: 1,
  },
  root: { flex: 1, backgroundColor: '#e8e8e8' },

  // ── Stats overlay ──
  statsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  statsCard: {
    backgroundColor: 'rgba(20,20,22,0.94)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  statsCardLight: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowOpacity: 0.12,
  },
  hudMiniLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  hudMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(20,20,22,0.94)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  hudMiniTime: {
    color: '#fff',
    fontSize: 17,
    fontFamily: NUM_FONT,
    fontVariant: ['tabular-nums'],
  },
  hudMiniShow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: CARDIO_ACCENT,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  hudMiniShowText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timerText: {
    color: '#fff',
    fontSize: 42,
    fontFamily: NUM_FONT,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  gpsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  gpsDot: { width: 7, height: 7, borderRadius: 3.5 },
  gpsText: { color: '#999', fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  pausedBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pausedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Målprogress
  goalTrackWrap: { alignSelf: 'stretch', marginBottom: 12, gap: 10 },
  goalOne: { gap: 5 },
  goalTextRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalText:      { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600' },
  goalPct:       { color: CARDIO_BLUE, fontSize: 12, fontWeight: '800' },
  goalTrack: {
    height: 4, borderRadius: 2, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  goalFill: { height: '100%', backgroundColor: CARDIO_BLUE, borderRadius: 2 },

  // ── Intervallguidning: HUD-banner + segmentlista ──
  ivBanner: { alignSelf: 'stretch', gap: 5, marginBottom: 10 },
  ivBannerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  ivBannerLabel: {
    flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700',
  },
  ivBannerRemain: {
    color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: NUM_FONT,
    fontVariant: ['tabular-nums'],
  },
  ivBannerTrack: {
    height: 3, borderRadius: 2, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  ivBannerFill: { height: '100%', borderRadius: 2 },

  ivListRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 7, paddingHorizontal: 4, borderRadius: 8,
  },
  ivListRowCurrent: { backgroundColor: 'rgba(255,255,255,0.06)' },
  ivListDot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  ivListLabel: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500' },
  ivListTarget: {
    color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: NUM_FONT,
    fontVariant: ['tabular-nums'],
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontFamily: NUM_FONT,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#3A3A3C',
  },

  // ── Km split toast ──
  splitToast: {
    position: 'absolute',
    bottom: 140,
    alignSelf: 'center',
    backgroundColor: 'rgba(20,20,20,0.88)',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    zIndex: 50,
  },
  splitToastText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: NUM_FONT,
    fontVariant: ['tabular-nums'],
  },

  // ── Right side buttons ──
  rightBtns: {
    position: 'absolute',
    right: 16,
    bottom: 320,
    gap: 10,
    zIndex: 10,
  },
  // ── Nedräkning ──
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
  },
  countdownNum: {
    color: CARDIO_ACCENT,
    fontSize: 170,
    fontFamily: NUM_FONT,
    fontVariant: ['tabular-nums'],
  },
  countdownHint: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
  },

  // ── Kompass ──
  compassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#161618',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  compassRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  compassClose: {
    alignSelf: 'flex-end',
    padding: 18,
  },
  compassStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  compassDial: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: DIAL / 2,
  },
  tickWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
  },
  tick: {
    width: 1.5,
    height: 11,
    backgroundColor: '#4A4A4C',
  },
  tickMajor: {
    height: 17,
    width: 2,
    backgroundColor: '#fff',
  },
  dialNum: {
    color: '#8A8A8E',
    fontSize: 13,
    fontFamily: NUM_FONT_SEMI,
    marginTop: 24,
    fontVariant: ['tabular-nums'],
  },
  dialCardinal: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 46,
  },
  compassCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassDeg: {
    color: '#fff',
    fontSize: 58,
    fontFamily: NUM_FONT,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  compassCard: {
    color: '#8A8A8E',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },

  // ── Kartval — grid med förhandsbilder ──
  mapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 6,
  },
  mapCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#242426',
    overflow: 'hidden',
  },
  mapCardActive: {
    borderColor: CARDIO_ACCENT,
  },
  mapPreviewIcon: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  mapPreview: {
    overflow: 'hidden',
    width: '100%',
    height: 96,
    backgroundColor: '#2C2C2E',
  },
  mapCardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
  },
  mapCardLabel: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Top right back button ──
  topRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingRight: 16,
    paddingTop: 8,
    zIndex: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },

  // ── Bottom bar ──
  bottomBarIdle: {
    position: 'absolute',
    bottom: 0,
    left: 10,
    right: 10,
    backgroundColor: 'transparent',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(22,22,24,0.97)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    zIndex: 30, // ovanpå fullskärms-statsen så kontrollerna alltid nås
  },
  bottomInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 8,
  },

  // ── Aktivitetsväljare (slide-up) ──
  sheetDismiss: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 39,
  },
  // Glasläge: bakgrundsfärgen släcks och GlassView fyller ytan bakom innehållet
  glassSurface: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetGrip: {
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3A3C',
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  sheetItemActive: {
    backgroundColor: '#242426',
  },
  sheetItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetItemText: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '600',
  },
  sheetItemTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // ── Fullskärms-stats ──
  expandedStats: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#121214',
    zIndex: 20,
  },
  expandedInner: {
    flex: 1,
    paddingHorizontal: 20,
  },
  expandedHandleWrap: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  expandedHint: {
    color: '#555',
    fontSize: 12,
    fontWeight: '600',
  },
  expandedGoal: {
    gap: 10,
    marginTop: 8,
  },
  // Staplade storvärden i fullskärm (inga boxar)
  exStack: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingBottom: 150, // håll sista raden ovanför bottenbaren
  },
  exBlock: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  exBlockHalf: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  exValueBig: {
    color: '#fff',
    fontSize: 50,
    fontFamily: NUM_FONT,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  exValueMed: {
    color: '#fff',
    fontSize: 34,
    fontFamily: NUM_FONT,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  exLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  exDivider: {
    height: 1,
    backgroundColor: '#232325',
    alignSelf: 'stretch',
    marginHorizontal: 24,
  },
  exDividerV: {
    width: 1,
    height: 44,
    backgroundColor: '#232325',
  },

  // ── Startmeny (idle) ──
  idleCol: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  idleColLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  typeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: CARDIO_ACCENT + '2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: CARDIO_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#161618',
  },
  startCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: CARDIO_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: CARDIO_ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  startLabel: {
    color: CARDIO_ACCENT,
    fontSize: 14,
    fontWeight: '800',
  },

  // Breda kontroller under passet
  pausePill: {
    flex: 1,
    height: 60,
    borderRadius: 30,
    backgroundColor: CARDIO_ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: CARDIO_ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  pausePillText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  finishPill: {
    flex: 1,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3A3A3C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  finishPillText: {
    color: '#ddd',
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Summary modal ──
  summaryOverlay: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  summaryContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  summaryCheck: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: CARDIO_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: CARDIO_ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  summarySubtitle: {
    color: '#888',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 16,
  },
  nameField: {
    alignSelf: 'stretch',
    gap: 6,
  },
  nameFieldLabel: {
    color: '#666',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  nameFieldInput: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  summaryStack: {
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  splitsWrap: {
    alignSelf: 'stretch',
    marginTop: 2,
  },
  splitsTitle: {
    color: '#666',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  splitKm: {
    color: '#999',
    fontSize: 13,
    fontFamily: NUM_FONT_SEMI,
    width: 52,
    fontVariant: ['tabular-nums'],
  },
  splitBarTrack: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  splitBar: {
    height: '100%',
    borderRadius: 7,
    backgroundColor: CARDIO_ACCENT,
  },
  splitPace: {
    color: '#fff',
    fontSize: 13,
    fontFamily: NUM_FONT,
    width: 44,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  summaryGoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  summaryGoalText: {
    color: '#ddd',
    fontSize: 14,
    fontWeight: '600',
  },
  effortRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  effortBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  effortBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  effortRowText: {
    flex: 1,
    color: '#ddd',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryPoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  summaryPointsText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
  summaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARDIO_ACCENT,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: '100%',
    justifyContent: 'center',
    shadowColor: CARDIO_ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  summaryBtnText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
  },
  summaryDiscard: {
    marginTop: 8,
    paddingVertical: 12,
  },
  summaryDiscardText: {
    color: '#555',
    fontSize: 14,
    fontWeight: '500',
  },
})
