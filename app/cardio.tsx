import * as Haptics from 'expo-haptics'
import * as Location from 'expo-location'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import WebView from 'react-native-webview'
import { ORANGE } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import { saveCardioWorkout } from '@/services/workouts'

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

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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
  standard:  { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',    opts: { maxZoom:19, subdomains:'abcd' } },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', opts: { maxZoom:19 } },
  terrain:   { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',                           opts: { maxZoom:17, subdomains:'abc' } },
  dark:      { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',              opts: { maxZoom:19, subdomains:'abcd' } },
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
  var map = L.map('map', { zoomControl:false, attributionControl:false, rotate:true, touchRotate:true })
    .setView([59.33, 18.06], 4);

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

export default function CardioScreen() {
  const { name } = useLocalSearchParams<{ name?: string }>()

  const webRef = useRef<WebView>(null)
  const locationSub = useRef<Location.LocationSubscription | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [status, setStatus] = useState<Status>('idle')
  const [exercise, setExercise] = useState<ExerciseType>(() => nameToType(name ?? ''))
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [styleMenuOpen, setStyleMenuOpen] = useState(false)
  const [activeStyle, setActiveStyle] = useState<string>('standard')
  const [summary, setSummary] = useState<{ distanceKm: number; elapsed: number; calories: number; route: Array<[number, number]> } | null>(null)
  const [saving, setSaving] = useState(false)
  const [distanceKm, setDistanceKm] = useState(0)
  const [elapsed, setElapsed] = useState(0)
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
  const paceTs = useRef(0)
  const smoothedPaceRef = useRef(0)
  const splitToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedExercise = EXERCISES.find(e => e.key === exercise)!
  const pace = formatPace(distanceKm, elapsed)
  const calories = Math.round(distanceKm * 65)

  useEffect(() => {
    initLocation()
    return () => cleanup()
  }, [])

  async function initLocation() {
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
    const last = await Location.getLastKnownPositionAsync()
    if (last) {
      const c = { latitude: last.coords.latitude, longitude: last.coords.longitude }
      latestCoord.current = c
      sendInit(c)
    }

    // Exakt: hämta aktuell position
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
    latestCoord.current = c
    sendInit(c)
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
    setStyleMenuOpen(false)
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
    setStatus('running')
    paceTs.current = 0
    timerRef.current = setInterval(() => {
      setElapsed(s => {
        const v = s + 1
        elapsedRef.current = v
        return v
      })
      // Nollställ nu/km om ingen GPS-rörelse på 5 sekunder
      if (paceTs.current > 0 && Date.now() - paceTs.current > 5000) {
        smoothedPaceRef.current = 0
        setCurrentPaceSec(0)
      }
    }, 1000)
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 3 },
      (loc) => {
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
            lastSplitElapsed.current = elapsedRef.current
            splitKm.current += 1
          }

          distanceRef.current = newKm
          setDistanceKm(newKm)
        }

        lastCoord.current = coord
        latestCoord.current = coord
        routeCoords.current.push([coord.latitude, coord.longitude])
        sendToMap(coord.latitude, coord.longitude, true)
      }
    )
  }

  function pauseTracking() {
    setStatus('paused')
    locationSub.current?.remove()
    locationSub.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    paceTs.current = 0 // reset so resume doesn't produce a stale pace
  }

  function cleanup() {
    locationSub.current?.remove()
    if (timerRef.current) clearInterval(timerRef.current)
    if (splitToastTimer.current) clearTimeout(splitToastTimer.current)
  }

  function handleFinish() {
    cleanup()
    setSummary({ distanceKm, elapsed, calories, route: routeCoords.current })
    setStatus('idle')
  }

  async function saveSummaryAndExit() {
    if (!summary) return
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await saveCardioWorkout({
          userId: session.user.id,
          name: selectedExercise.label,
          type: exercise,
          distanceKm: summary.distanceKm,
          durationSeconds: summary.elapsed,
          calories: summary.calories,
          route: summary.route,
        })
      }
    } finally {
      setSaving(false)
      setSummary(null)
      router.back()
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

      {/* ── Stats overlay (only while active) ── */}
      {status !== 'idle' && (
        <SafeAreaView style={styles.statsOverlay} edges={['top']} pointerEvents="none">
          <View style={styles.statsCard}>
            <View style={styles.timerRow}>
              <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
              {status === 'paused' && (
                <View style={styles.pausedBadge}>
                  <Text style={styles.pausedBadgeText}>PAUSAD</Text>
                </View>
              )}
            </View>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{distanceKm.toFixed(2)}</Text>
                <Text style={styles.statLabel}>km</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{pace}</Text>
                <Text style={styles.statLabel}>snitt /km</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, currentPaceSec > 0 && { color: ORANGE }]}>
                  {currentPaceSec > 0 ? formatPace(1, currentPaceSec) : '--:--'}
                </Text>
                <Text style={styles.statLabel}>nu /km</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{calories}</Text>
                <Text style={styles.statLabel}>kcal</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      )}

      {/* ── Km split toast ── */}
      {splitToast && (
        <View style={styles.splitToast} pointerEvents="none">
          <Ionicons name="flag" size={16} color={ORANGE} />
          <Text style={styles.splitToastText}>{splitToast}</Text>
        </View>
      )}

      {/* ── Style menu ── */}
      {styleMenuOpen && (
        <View style={styles.styleMenu}>
          {[
            { key: 'standard',  label: 'Karta',    icon: 'map-outline' },
            { key: 'satellite', label: 'Satellit',  icon: 'earth-outline' },
            { key: 'terrain',   label: 'Terräng',   icon: 'triangle-outline' },
            { key: 'dark',      label: 'Natt',      icon: 'moon-outline' },
          ].map(s => (
            <TouchableOpacity
              key={s.key}
              style={[styles.styleItem, activeStyle === s.key && styles.styleItemActive]}
              onPress={() => changeStyle(s.key)}
              activeOpacity={0.8}
            >
              <Ionicons name={s.icon as any} size={18} color={activeStyle === s.key ? '#fff' : '#333'} />
              <Text style={[styles.styleItemText, activeStyle === s.key && styles.styleItemTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Right-side buttons ── */}
      <View style={styles.rightBtns}>
        <TouchableOpacity style={styles.mapBtn} onPress={() => setStyleMenuOpen(o => !o)} activeOpacity={0.8}>
          <Ionicons name="layers-outline" size={20} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapBtn} onPress={centerOnUser} activeOpacity={0.8}>
          <Ionicons name="locate" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {/* ── Back button top-right ── */}
      <SafeAreaView style={styles.topRight} edges={['top']}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (status !== 'idle' ? handleFinish() : router.back())}
        >
          <Ionicons name="chevron-back" size={20} color="#000" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* ── Bottom bar ── */}
      {/* Dropdown menu — visas ovanför bottom-baren */}
      {dropdownOpen && (
        <View style={styles.dropdown}>
          {EXERCISES.map((ex) => {
            const active = exercise === ex.key
            return (
              <TouchableOpacity
                key={ex.key}
                style={styles.dropdownItem}
                onPress={() => { setExercise(ex.key); setDropdownOpen(false) }}
                activeOpacity={0.75}
              >
                <Ionicons name={ex.icon} size={20} color={active ? ORANGE : '#444'} />
                <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>
                  {ex.label}
                </Text>
                {active && <Ionicons name="checkmark" size={18} color={ORANGE} style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
            )
          })}
        </View>
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

            <View style={styles.summaryGrid}>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryCellValue}>{formatTime(summary?.elapsed ?? 0)}</Text>
                <Text style={styles.summaryCellLabel}>Tid</Text>
              </View>
              <View style={styles.summaryCellDivider} />
              <View style={styles.summaryCell}>
                <Text style={styles.summaryCellValue}>{(summary?.distanceKm ?? 0).toFixed(2)}</Text>
                <Text style={styles.summaryCellLabel}>Kilometer</Text>
              </View>
              <View style={styles.summaryCellDivider} />
              <View style={styles.summaryCell}>
                <Text style={styles.summaryCellValue}>{formatPace(summary?.distanceKm ?? 0, summary?.elapsed ?? 0)}</Text>
                <Text style={styles.summaryCellLabel}>min/km</Text>
              </View>
              <View style={styles.summaryCellDivider} />
              <View style={styles.summaryCell}>
                <Text style={styles.summaryCellValue}>{summary?.calories ?? 0}</Text>
                <Text style={styles.summaryCellLabel}>kcal</Text>
              </View>
            </View>

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
              {/* Dropdown trigger — cirkel */}
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setDropdownOpen(o => !o)}
                activeOpacity={0.8}
              >
                <Ionicons name={selectedExercise.icon} size={26} color={dropdownOpen ? '#fff' : ORANGE} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.startBtn} onPress={startTracking} activeOpacity={0.85}>
                <Ionicons name="play" size={30} color="#000" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.sideBtn}
                onPress={status === 'running' ? pauseTracking : startTracking}
                activeOpacity={0.8}
              >
                <Ionicons name={status === 'running' ? 'pause' : 'play'} size={20} color="#fff" />
                <Text style={styles.sideBtnText}>{status === 'running' ? 'Pausa' : 'Fortsätt'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.startBtn} onPress={handleFinish} activeOpacity={0.85}>
                <Ionicons name="stop" size={28} color="#000" />
              </TouchableOpacity>

              <View style={styles.exerciseActive}>
                <Ionicons name={selectedExercise.icon} size={20} color={ORANGE} />
                <Text style={styles.exerciseActiveLabel}>{selectedExercise.label}</Text>
              </View>
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
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timerText: {
    color: '#000',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
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
    color: '#000',
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
    backgroundColor: '#E0E0E0',
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
    bottom: 160,
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

  // ── Style menu ──
  styleMenu: {
    position: 'absolute',
    right: 68,
    bottom: 200,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 16,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    zIndex: 20,
    minWidth: 140,
  },
  styleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  styleItemActive: {
    backgroundColor: ORANGE,
    marginHorizontal: 6,
    borderRadius: 10,
  },
  styleItemText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  styleItemTextActive: {
    color: '#fff',
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
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  bottomInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 8,
  },

  // ── Dropdown ──
  dropdown: {
    position: 'absolute',
    bottom: 130,
    left: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 6,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    zIndex: 30,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  dropdownItemText: {
    color: '#333',
    fontSize: 15,
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: ORANGE,
    fontWeight: '700',
  },
  dropdownTrigger: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },

  // Start button
  startBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
    flexShrink: 0,
  },

  // Active controls (running/paused)
  sideBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1C1C1E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sideBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  exerciseActive: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  exerciseActiveLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
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
  summaryGrid: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 8,
    width: '100%',
    marginBottom: 16,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryCellDivider: {
    width: 1,
    backgroundColor: '#2C2C2E',
    marginVertical: 4,
  },
  summaryCellValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  summaryCellLabel: {
    color: '#666',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
