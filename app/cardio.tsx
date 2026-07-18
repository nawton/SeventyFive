import * as Haptics from 'expo-haptics'
import * as Location from 'expo-location'
import * as Speech from 'expo-speech'
import { useKeepAwake } from 'expo-keep-awake'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import WebView from 'react-native-webview'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { ORANGE } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { saveCardioWorkout } from '@/services/workouts'
import { completeCardioSession } from '@/services/workoutSchedule'
import { toLocalDateString } from '@/lib/date'
import { getUnitSystem, toDisplayDistance, distanceUnitLabel, paceForUnit, type UnitSystem } from '@/lib/units'
import { getCardioStatsTheme, getVoiceCues, type CardioStatsTheme } from '@/lib/prefs'

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

const DIAL = Math.min(Dimensions.get('window').width - 70, 320)

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

const TILE_URLS: Record<string, { url: string; opts: object }> = {
  standard:  { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',    opts: { maxZoom:20, subdomains:'abcd' } },
  // Skala upp från maxNativeZoom i glesbygd istället för saknade tiles
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', opts: { maxZoom:20, maxNativeZoom:18 } },
  terrain:   { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',                           opts: { maxZoom:20, maxNativeZoom:17, subdomains:'abc' } },
  dark:      { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',              opts: { maxZoom:20, subdomains:'abcd' } },
}

const MAP_STYLES = [
  { key: 'standard',  label: 'Karta' },
  { key: 'satellite', label: 'Satellit' },
  { key: 'terrain',   label: 'Terräng' },
  { key: 'dark',      label: 'Natt' },
]

// Förhandsvisning: en riktig kartruta från respektive leverantör (Stockholm)
const PREVIEW_TILE = { z: 13, x: 4506, y: 2409 }
function previewUrl(key: string): string {
  return TILE_URLS[key].url
    .replace('{s}', 'a')
    .replace('{r}', '')
    .replace('{z}', String(PREVIEW_TILE.z))
    .replace('{x}', String(PREVIEW_TILE.x))
    .replace('{y}', String(PREVIEW_TILE.y))
}

const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate-src.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#f0ede8; }
    #map { width:100vw; height:100vh; }
    .leaflet-control-attribution { display:none; }
    .gps-wrap { position:relative; width:22px; height:22px; }
    .gps-dot {
      width:18px; height:18px;
      background:#FF8F00; border:3px solid #fff; border-radius:50%;
      box-shadow:0 2px 10px rgba(255,143,0,0.5);
      position:absolute; top:2px; left:2px;
    }
    .gps-ring {
      width:22px; height:22px;
      border:2px solid #FF8F00; border-radius:50%;
      position:absolute; top:0; left:0;
      animation:gps-pulse 2s ease-out infinite;
    }
    @keyframes gps-pulse {
      0%   { transform:scale(1);   opacity:0.7; }
      100% { transform:scale(2.8); opacity:0; }
    }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', {
    zoomControl:false, attributionControl:false,
    rotate:true, touchRotate:true, rotateControl:false
  }).setView([59.33, 18.06], 4);

  var tileLayer = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    { maxZoom:19, subdomains:'abcd' }
  ).addTo(map);

  var gpsIcon = L.divIcon({
    html: '<div class="gps-wrap"><div class="gps-ring"></div><div class="gps-dot"></div></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    className: ''
  });

  var marker = null;
  var polyline = L.polyline([], { color:'#FF8F00', weight:5, lineCap:'round', lineJoin:'round' }).addTo(map);

  window.addEventListener('message', function(e) {
    try {
      var msg = JSON.parse(e.data);

      if (msg.type === 'style') {
        map.removeLayer(tileLayer);
        tileLayer = L.tileLayer(msg.url, msg.opts).addTo(map);
        tileLayer.bringToBack();
        return;
      }

      var ll = [msg.lat, msg.lng];

      if (msg.type === 'center') {
        map.setBearing(0);
        map.setView(ll, 16, { animate:true });
        return;
      }

      if (msg.type === 'init') {
        if (!marker) {
          marker = L.marker(ll, { icon: gpsIcon, zIndexOffset: 1000 }).addTo(map);
        } else {
          marker.setLatLng(ll);
        }
        map.setView(ll, 16, { animate:true });
        return;
      }

      if (msg.type === 'loc') {
        if (marker) marker.setLatLng(ll);
        if (msg.track) {
          var coords = polyline.getLatLngs();
          coords.push(ll);
          polyline.setLatLngs(coords);
        }
      }
    } catch(err) {}
  });
</script>
</body>
</html>`

/** Liten statisk ruttkarta till sammanfattningen: mörka plattor, orange linje, start/mål-prickar */
function routeMapHtml(route: Array<[number, number]>): string {
  // Glesa ut långa rutter så HTML-strängen hålls rimlig
  const step = Math.max(1, Math.floor(route.length / 600))
  const pts = route.filter((_, i) => i % step === 0 || i === route.length - 1)
  return `<!DOCTYPE html><html><head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>*{margin:0;padding:0}#map{width:100vw;height:100vh;background:#111}.leaflet-control-attribution{display:none}</style>
  </head><body><div id="map"></div><script>
    var pts = ${JSON.stringify(pts)};
    var map = L.map('map',{zoomControl:false,attributionControl:false,dragging:false,touchZoom:false,doubleClickZoom:false,scrollWheelZoom:false,boxZoom:false,keyboard:false});
    L.tileLayer('https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
    var line = L.polyline(pts,{color:'#FF8F00',weight:4,lineCap:'round',lineJoin:'round'}).addTo(map);
    L.circleMarker(pts[0],{radius:5,color:'#fff',weight:2,fillColor:'#4CAF50',fillOpacity:1}).addTo(map);
    L.circleMarker(pts[pts.length-1],{radius:5,color:'#fff',weight:2,fillColor:'#FF453A',fillOpacity:1}).addTo(map);
    map.fitBounds(line.getBounds(),{padding:[24,24]});
  </script></body></html>`
}

export default function CardioScreen() {
  // Skärmen släcks inte medan GPS-skärmen är öppen (som Strava under pass)
  useKeepAwake()

  const { name, sessionId, sessionDate, goalKm, goalMin } = useLocalSearchParams<{ name?: string; sessionId?: string; sessionDate?: string; goalKm?: string; goalMin?: string }>()
  const goalKmNum  = goalKm  ? parseFloat(goalKm)  : 0
  const goalMinNum = goalMin ? parseInt(goalMin, 10) : 0

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
  useEffect(() => {
    getVoiceCues().then(on => { voiceRef.current = on })
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

  const webRef = useRef<InstanceType<typeof WebView>>(null)
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
  const [statsExpanded, setStatsExpanded] = useState(false)
  const expandV = useSharedValue(0)
  // Dölj statskortet till en liten tidspill när man vill se kartan
  const [hudHidden, setHudHidden] = useState(false)
  const [styleMenuOpen, setStyleMenuOpen] = useState(false)
  const [activeStyle, setActiveStyle] = useState<string>('standard')
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

  const selectedExercise = EXERCISES.find(e => e.key === exercise)!
  const calories = Math.round(distanceKm * 65)

  function openStats() {
    setStatsExpanded(true)
    expandV.value = withTiming(1, { duration: 260 })
  }
  function closeStats() {
    setStatsExpanded(false)
    expandV.value = withTiming(0, { duration: 220 })
  }

  // Dra ner på statskortet → fullskärms-stats; dra upp i fullskärm → karta igen
  const expandGesture = Gesture.Pan()
    .activeOffsetY([-15, 15])
    .onEnd(e => {
      if (e.translationY > 30) runOnJS(openStats)()
    })
  const collapseGesture = Gesture.Pan()
    .activeOffsetY([-15, 15])
    .onEnd(e => {
      if (e.translationY < -30) runOnJS(closeStats)()
    })

  const expandedStyle = useAnimatedStyle(() => ({
    opacity: expandV.value,
    transform: [{ translateY: interpolate(expandV.value, [0, 1], [-50, 0]) }],
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
    const js = `window.dispatchEvent(new MessageEvent('message', {
      data: JSON.stringify({ type:'init', lat:${coord.latitude}, lng:${coord.longitude} })
    })); true;`
    if (mapReady.current) {
      webRef.current?.injectJavaScript(js)
    } else {
      // Kö tills kartan är redo
      setTimeout(() => webRef.current?.injectJavaScript(js), 800)
    }
  }

  function changeStyle(key: string) {
    const s = TILE_URLS[key]
    if (!s) return
    setActiveStyle(key)
    closeStyleSheet()
    webRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({ type:'style', url:${JSON.stringify(s.url)}, opts:${JSON.stringify(s.opts)} })
      })); true;`
    )
  }

  function centerOnUser() {
    const c = latestCoord.current
    if (!c) return
    webRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({ type:'center', lat:${c.latitude}, lng:${c.longitude} })
      })); true;`
    )
  }

  function sendToMap(lat: number, lng: number, track: boolean) {
    webRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({ type:'loc', lat:${lat}, lng:${lng}, track:${track} })
      })); true;`
    )
  }

  async function startTracking() {
    // Talat besked vid start (med mål) respektive återupptagning
    if (elapsedRef.current === 0) {
      const kmTxt = goalKmNum > 0
        ? `${(goalKmNum % 1 === 0 ? String(goalKmNum) : goalKmNum.toFixed(1).replace('.', ','))} kilometer`
        : ''
      const minTxt = goalMinNum > 0 ? `${goalMinNum} minuter` : ''
      const goalTxt = kmTxt && minTxt
        ? ` Mål: ${kmTxt} på ${minTxt}.`
        : kmTxt ? ` Mål: ${kmTxt}.` : minTxt ? ` Mål: ${minTxt}.` : ''
      speak(`${selectedExercise.label} startad.${goalTxt}`)
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
            const label = `${splitKm.current} km  —  ${formatPace(1, splitTime)} /km`
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            if (splitToastTimer.current) clearTimeout(splitToastTimer.current)
            setSplitToast(label)
            splitToastTimer.current = setTimeout(() => setSplitToast(null), 3500)
            speak(`Kilometer ${splitKm.current}. Total tid: ${spokenTime(elapsedRef.current)}. Senaste kilometern: ${spokenTime(splitTime)}.`)
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
    speak('Träning avslutad. Bra jobbat!')

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

      {/* ── Fullscreen map ── */}
      <WebView
        ref={webRef}
        style={StyleSheet.absoluteFill}
        source={{ html: MAP_HTML }}
        scrollEnabled={false}
        javaScriptEnabled
        originWhitelist={['*']}
        onLoadEnd={() => { mapReady.current = true }}
      />

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
              <Ionicons name="caret-down" size={24} color="#FF453A" style={{ marginBottom: 8 }} />

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
                      <Text style={[styles.dialCardinal, letter === 'N' && { color: '#FF453A' }]}>{letter}</Text>
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
          <TouchableOpacity
            style={[styles.hudMini, lightCard && styles.statsCardLight]}
            onPress={() => setHudHidden(false)}
            activeOpacity={0.8}
          >
            <Text style={[styles.hudMiniTime, lightCard && { color: '#000' }]}>{formatTime(elapsed)}</Text>
            <View style={styles.hudMiniShow}>
              <Text style={styles.hudMiniShowText}>Visa statistik</Text>
              <Ionicons name="chevron-down" size={13} color="#fff" />
            </View>
          </TouchableOpacity>
        </SafeAreaView>
      ) : (
        <SafeAreaView style={styles.statsOverlay} edges={['top']} pointerEvents="box-none">
          <GestureDetector gesture={expandGesture}>
          <View style={[styles.statsCard, lightCard && styles.statsCardLight]}>
            {/* Dölj-knapp — krymper kortet så kartan syns */}
            <TouchableOpacity
              style={[styles.hudHideBtn, lightCard && { backgroundColor: 'rgba(0,0,0,0.07)' }]}
              onPress={() => setHudHidden(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="eye-off-outline" size={13} color={lightCard ? '#555' : '#bbb'} />
              <Text style={[styles.hudHideText, lightCard && { color: '#555' }]}>Dölj</Text>
            </TouchableOpacity>
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
                    backgroundColor: gpsCat === 2 ? '#4CAF50' : gpsCat === 1 ? '#FFC107' : '#FF453A',
                  }]} />
                  <Text style={[styles.gpsText, lightCard && { color: '#777' }]}>
                    {gpsCat === -1 ? 'Ingen GPS' : gpsCat === 0 ? 'Svag GPS' : 'GPS'}
                  </Text>
                </View>
              )}
            </View>
            {/* Mål från passdetaljen — live-progress, en rad per mål */}
            {(goalKmNum > 0 || goalMinNum > 0) && (
              <View style={styles.goalTrackWrap}>
                {goalKmNum > 0 && (
                  <View style={styles.goalOne}>
                    <View style={styles.goalTextRow}>
                      <Text style={[styles.goalText, lightCard && { color: '#555' }]}>
                        Mål: {toDisplayDistance(goalKmNum, unit).toFixed(1).replace('.', ',')} {unitLabel}
                      </Text>
                      <Text style={styles.goalPct}>
                        {Math.min(100, Math.round((distanceKm / goalKmNum) * 100))}%
                      </Text>
                    </View>
                    <View style={[styles.goalTrack, lightCard && { backgroundColor: 'rgba(0,0,0,0.08)' }]}>
                      <View style={[styles.goalFill, { width: `${Math.min(100, (distanceKm / goalKmNum) * 100)}%` as never }]} />
                    </View>
                  </View>
                )}
                {goalMinNum > 0 && (
                  <View style={styles.goalOne}>
                    <View style={styles.goalTextRow}>
                      <Text style={[styles.goalText, lightCard && { color: '#555' }]}>
                        Mål: {goalMinNum} min
                      </Text>
                      <Text style={[styles.goalPct, { color: ORANGE }]}>
                        {Math.min(100, Math.round((elapsed / (goalMinNum * 60)) * 100))}%
                      </Text>
                    </View>
                    <View style={[styles.goalTrack, lightCard && { backgroundColor: 'rgba(0,0,0,0.08)' }]}>
                      <View style={[styles.goalFill, { backgroundColor: ORANGE, width: `${Math.min(100, (elapsed / (goalMinNum * 60)) * 100)}%` as never }]} />
                    </View>
                  </View>
                )}
              </View>
            )}

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
                <Text style={[styles.statValue, lightCard && { color: '#000' }, currentPaceSec > 0 && { color: ORANGE }]}>
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
          </View>
          </GestureDetector>
        </SafeAreaView>
      )}

      {/* ── Km split toast ── */}
      {splitToast && (
        <View style={styles.splitToast} pointerEvents="none">
          <Ionicons name="flag" size={16} color={ORANGE} />
          <Text style={styles.splitToastText}>{splitToast}</Text>
        </View>
      )}

      {/* ── Right-side buttons ── */}
      <View style={styles.rightBtns}>
        <TouchableOpacity style={styles.compassBtn} onPress={openCompass} activeOpacity={0.8}>
          <Animated.View style={[{ alignItems: 'center' }, needleStyle]}>
            <Ionicons name="caret-up" size={17} color="#FF453A" style={{ marginBottom: -5 }} />
            <Ionicons name="caret-down" size={17} color="#fff" style={{ marginTop: -5 }} />
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapBtn}
          onPress={() => (styleMenuOpen ? closeStyleSheet() : openStyleSheet())}
          activeOpacity={0.8}
        >
          <Ionicons name="layers-outline" size={20} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapBtn} onPress={centerOnUser} activeOpacity={0.8}>
          <Ionicons name="locate" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {/* ── Tillbaka-knapp — bara innan passet startats ── */}
      {status === 'idle' && (
        <SafeAreaView style={styles.topRight} edges={['top']}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#000" />
          </TouchableOpacity>
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
                <Text style={styles.expandedHint}>Svep upp för karta</Text>
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
                        <Text style={[styles.goalPct, { color: ORANGE }]}>
                          {Math.min(100, Math.round((elapsed / (goalMinNum * 60)) * 100))}%
                        </Text>
                      </View>
                      <View style={styles.goalTrack}>
                        <View style={[styles.goalFill, { backgroundColor: ORANGE, width: `${Math.min(100, (elapsed / (goalMinNum * 60)) * 100)}%` as never }]} />
                      </View>
                    </View>
                  )}
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
                  <Text style={[styles.exValueBig, currentPaceSec > 0 && { color: ORANGE }]}>
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
          <Animated.View style={[styles.sheetWrap, sheetStyle]}>
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
                    <View style={[styles.sheetItemIcon, active && { backgroundColor: ORANGE + '2E' }]}>
                      <Ionicons name={ex.icon} size={22} color={active ? ORANGE : '#999'} />
                    </View>
                    <Text style={[styles.sheetItemText, active && styles.sheetItemTextActive]}>{ex.label}</Text>
                    {active && <Ionicons name="checkmark-circle" size={22} color={ORANGE} style={{ marginLeft: 'auto' }} />}
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
          <Animated.View style={[styles.sheetWrap, styleSheetStyle]}>
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
                      <Image source={{ uri: previewUrl(ms.key) }} style={styles.mapPreview} />
                      <View style={styles.mapCardLabelRow}>
                        <Text style={[styles.mapCardLabel, active && { color: ORANGE }]}>{ms.label}</Text>
                        {active && <Ionicons name="checkmark-circle" size={15} color={ORANGE} />}
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
          <SafeAreaView style={styles.summaryContainer} edges={['top', 'bottom']}>

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

            {/* Rutten på karta */}
            {summary && summary.route.length > 1 && (
              <View style={styles.summaryMapWrap} pointerEvents="none">
                <WebView
                  style={{ flex: 1, backgroundColor: '#111' }}
                  source={{ html: routeMapHtml(summary.route) }}
                  scrollEnabled={false}
                  javaScriptEnabled
                  originWhitelist={['*']}
                />
              </View>
            )}

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

            {/* Poäng-hint */}
            <View style={styles.summaryPoints}>
              <Ionicons name="star" size={13} color={ORANGE} />
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

          </SafeAreaView>
        </View>
      </Modal>

      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        <View style={styles.bottomInner}>

          {status === 'idle' ? (
            <>
              <TouchableOpacity
                style={styles.idleCol}
                onPress={openPicker}
                activeOpacity={0.8}
              >
                <View style={styles.typeCircle}>
                  <Ionicons name={selectedExercise.icon} size={26} color={ORANGE} />
                  <View style={styles.typeBadge}>
                    <Ionicons name="checkmark" size={11} color="#fff" />
                  </View>
                </View>
                <Text style={styles.idleColLabel}>{selectedExercise.label}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.idleCol} onPress={beginCountdown} activeOpacity={0.85}>
                <View style={styles.startCircle}>
                  <Ionicons name="play" size={36} color="#fff" style={{ marginLeft: 4 }} />
                </View>
                <Text style={styles.startLabel}>Starta</Text>
              </TouchableOpacity>
            </>
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
  hudHideBtn: {
    position: 'absolute',
    top: 10,
    right: 12,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  hudHideText: {
    color: '#bbb',
    fontSize: 12,
    fontWeight: '700',
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
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  hudMiniShow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: ORANGE,
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
    fontWeight: '800',
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
  goalPct:       { color: '#4AA8E0', fontSize: 12, fontWeight: '800' },
  goalTrack: {
    height: 4, borderRadius: 2, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  goalFill: { height: '100%', backgroundColor: '#4AA8E0', borderRadius: 2 },

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
    fontWeight: '700',
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
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // ── Right side buttons ──
  rightBtns: {
    position: 'absolute',
    right: 16,
    bottom: 235,
    gap: 10,
    zIndex: 10,
  },
  mapBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
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
    color: ORANGE,
    fontSize: 170,
    fontWeight: '900',
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
    fontWeight: '600',
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
    fontWeight: '800',
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
    borderColor: ORANGE,
  },
  mapPreview: {
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
    fontWeight: '800',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  exValueMed: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
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
    backgroundColor: ORANGE + '2E',
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
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#161618',
  },
  startCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  startLabel: {
    color: ORANGE,
    fontSize: 14,
    fontWeight: '800',
  },

  // Breda kontroller under passet
  pausePill: {
    flex: 1,
    height: 60,
    borderRadius: 30,
    backgroundColor: ORANGE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: ORANGE,
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
    backgroundColor: '#111111',
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
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: ORANGE,
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
  summaryMapWrap: {
    alignSelf: 'stretch',
    height: 150,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
    marginTop: 4,
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
    fontWeight: '600',
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
    backgroundColor: ORANGE,
  },
  splitPace: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: ORANGE,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: '100%',
    justifyContent: 'center',
    shadowColor: ORANGE,
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
