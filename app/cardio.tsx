import * as Location from 'expo-location'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import WebView from 'react-native-webview'
import { ORANGE } from '@/lib/theme'

type Coord = { latitude: number; longitude: number }
type Status = 'idle' | 'running' | 'paused'
type ExerciseType = 'running' | 'cycling' | 'interval' | 'walking'

const EXERCISES: { key: ExerciseType; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'running',  label: 'Löpning',  icon: 'walk-outline' },
  { key: 'cycling',  label: 'Cykling',  icon: 'bicycle-outline' },
  { key: 'interval', label: 'Intervall', icon: 'flash-outline' },
  { key: 'walking',  label: 'Promenad', icon: 'footsteps-outline' },
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

const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate-src.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#f5f5f5; }
    #map { width:100vw; height:100vh; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl:false, attributionControl:false, rotate:true, touchRotate:true })
    .setView([59.33, 18.06], 5);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(map);

  var marker = null;
  var polyline = L.polyline([], { color:'#FF8F00', weight:5, lineCap:'round', lineJoin:'round' }).addTo(map);

  window.addEventListener('message', function(e) {
    try {
      var msg = JSON.parse(e.data);
      var ll = [msg.lat, msg.lng];

      if (msg.type === 'center') {
        map.setView(ll, 16, { animate:true });
        return;
      }

      if (msg.type === 'init') {
        if (!marker) {
          marker = L.circleMarker(ll, {
            radius:10, fillColor:'#FF8F00', color:'#fff', weight:3, fillOpacity:1
          }).addTo(map);
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
  const [distanceKm, setDistanceKm] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const lastCoord = useRef<Coord | null>(null)
  const latestCoord = useRef<Coord | null>(null)
  const mapReady = useRef(false)

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
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
      (loc) => {
        const coord: Coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
        if (lastCoord.current) {
          setDistanceKm(prev => prev + haversineDistance(lastCoord.current!, coord))
        }
        lastCoord.current = coord
        latestCoord.current = coord
        sendToMap(coord.latitude, coord.longitude, true)
      }
    )
  }

  function pauseTracking() {
    setStatus('paused')
    locationSub.current?.remove()
    locationSub.current = null
    if (timerRef.current) clearInterval(timerRef.current)
  }

  function cleanup() {
    locationSub.current?.remove()
    if (timerRef.current) clearInterval(timerRef.current)
  }

  function handleFinish() {
    Alert.alert(
      'Avsluta pass',
      `${distanceKm.toFixed(2)} km · ${formatTime(elapsed)}`,
      [
        { text: 'Fortsätt', style: 'cancel' },
        { text: 'Avsluta', style: 'destructive', onPress: () => { cleanup(); router.back() } },
      ]
    )
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
            <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{distanceKm.toFixed(2)}</Text>
                <Text style={styles.statLabel}>km</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{pace}</Text>
                <Text style={styles.statLabel}>min/km</Text>
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

      {/* ── Center button (right side of map) ── */}
      <TouchableOpacity style={styles.centerBtn} onPress={centerOnUser} activeOpacity={0.8}>
        <Ionicons name="locate" size={20} color="#000" />
      </TouchableOpacity>

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
  timerText: {
    color: '#000',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
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

  // ── Center button ──
  centerBtn: {
    position: 'absolute',
    right: 16,
    bottom: 160,
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
    zIndex: 10,
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
})
