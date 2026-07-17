import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import WebView from 'react-native-webview'
import { supabase } from '@/lib/supabase'
import { getCardioWorkoutByDate, type CardioWorkout } from '@/services/workouts'
import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, GREEN } from '@/lib/theme'
import { parseLocalDate } from '@/lib/date'
import {
  getUnitSystem, toDisplayDistance, distanceUnitLabel, paceForUnit, type UnitSystem,
} from '@/lib/units'

const CARDIO_BLUE = '#4AA8E0'
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const MAP_H = Math.round(SCREEN_H * 0.56)   // kartbakgrundens höjd
const PEEK  = Math.round(SCREEN_H * 0.42)   // synlig del innan arket börjar

const TYPE_META: Record<string, { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  running:  { label: 'Löpning',    icon: 'fitness-outline' },
  cycling:  { label: 'Cykling',    icon: 'bicycle-outline' },
  walking:  { label: 'Promenad',   icon: 'walk-outline' },
  interval: { label: 'Intervaller', icon: 'flash-outline' },
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

/** sek/enhet → "m:ss" */
function formatPace(secs: number): string {
  if (!Number.isFinite(secs) || secs <= 0) return '--:--'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Ljus, Strava-lik ruttkarta. `overlapBottom` = hur många pixlar arket täcker
 * kartans nederkant, så rutten hålls i den synliga delen. interactive=true ger
 * pan/zoom (helskärm), annars låst.
 */
function routeMapHtml(route: Array<[number, number]>, opts: { interactive: boolean; overlapBottom: number; topInset: number }): string {
  const step = Math.max(1, Math.floor(route.length / 800))
  const pts = route.filter((_, i) => i % step === 0 || i === route.length - 1)
  const locked = opts.interactive
    ? ''
    : 'dragging:false,touchZoom:false,doubleClickZoom:false,scrollWheelZoom:false,boxZoom:false,keyboard:false,tap:false,'
  return `<!DOCTYPE html><html><head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>*{margin:0;padding:0}#map{width:100vw;height:100vh;background:#e6e3dd}.leaflet-control-attribution{display:none}</style>
  </head><body><div id="map"></div><script>
    var pts = ${JSON.stringify(pts)};
    var map = L.map('map',{zoomControl:false,attributionControl:false,${locked}});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd'}).addTo(map);
    var glow = L.polyline(pts,{color:'#FF6A00',weight:9,opacity:0.25,lineCap:'round',lineJoin:'round'}).addTo(map);
    var line = L.polyline(pts,{color:'#FC4C02',weight:5,lineCap:'round',lineJoin:'round'}).addTo(map);
    L.circleMarker(pts[0],{radius:7,color:'#fff',weight:3,fillColor:'#22C55E',fillOpacity:1}).addTo(map);
    L.circleMarker(pts[pts.length-1],{radius:7,color:'#fff',weight:3,fillColor:'#EF4444',fillOpacity:1}).addTo(map);
    map.fitBounds(line.getBounds(),{paddingTopLeft:[36,${opts.topInset}],paddingBottomRight:[36,${opts.overlapBottom + 24}]});
  </script></body></html>`
}

export default function CardioSummaryScreen() {
  const params = useLocalSearchParams<{ name?: string; cardioType?: string; date?: string }>()
  const type = params.cardioType ?? 'running'
  const meta = TYPE_META[type] ?? TYPE_META.running

  const [unit, setUnit] = useState<UnitSystem>('metric')
  const [workout, setWorkout] = useState<CardioWorkout | null>(null)
  const [loading, setLoading] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)

  const unitLabel = distanceUnitLabel(unit)

  useEffect(() => { getUnitSystem().then(setUnit) }, [])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || !params.date) { setLoading(false); return }
      const w = await getCardioWorkoutByDate(session.user.id, type, params.date).catch(() => null)
      setWorkout(w)
      setLoading(false)
    }
    load()
  }, [type, params.date])

  const dateLabel = params.date
    ? parseLocalDate(params.date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

  const d = workout?.data
  const distKm = d?.distance_km ?? 0
  const dur = d?.duration_seconds ?? 0
  const route = d?.route ?? []
  const hasRoute = route.length > 1
  const avgPaceSec = distKm > 0.01 ? paceForUnit(dur / distKm, unit) : 0
  const overlap = MAP_H - PEEK

  const stats: { label: string; value: string }[] = [
    { label: `Distans (${unitLabel})`, value: toDisplayDistance(distKm, unit).toFixed(2) },
    { label: 'Tid',                    value: formatTime(dur) },
    { label: `Snitt /${unitLabel}`,    value: formatPace(avgPaceSec) },
    { label: 'Kcal',                   value: String(d?.calories ?? 0) },
  ]

  return (
    <View style={s.root}>
      {/* ── Kartbakgrund högst upp ── */}
      {hasRoute && (
        <View style={s.mapBg} pointerEvents="none">
          <WebView
            style={{ flex: 1, backgroundColor: '#e6e3dd' }}
            source={{ html: routeMapHtml(route, { interactive: false, overlapBottom: overlap, topInset: 96 }) }}
            scrollEnabled={false}
            javaScriptEnabled
            originWhitelist={['*']}
          />
        </View>
      )}

      {/* ── Header-overlay (tillbaka + helskärm) ── */}
      <SafeAreaView style={s.headerOverlay} edges={['top']} pointerEvents="box-none">
        <TouchableOpacity onPress={() => router.back()} style={s.circleBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        {hasRoute && (
          <TouchableOpacity onPress={() => setFullscreen(true)} style={s.circleBtn} activeOpacity={0.8}>
            <Ionicons name="expand-outline" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={CARDIO_BLUE} /></View>
      ) : !workout ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={TEXT_SECONDARY} />
          <Text style={s.emptyText}>Kunde inte hitta det sparade passet.</Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={{ minHeight: SCREEN_H + MAP_H * 0.4 }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
        >
          {/* Genomskinlig yta över kartan — tryck för helskärm */}
          {hasRoute ? (
            <TouchableOpacity
              style={{ height: PEEK }}
              activeOpacity={1}
              onPress={() => setFullscreen(true)}
            />
          ) : (
            <View style={{ height: 90 }} />
          )}

          {/* ── Innehålls-ark som glider över kartan ── */}
          <View style={s.sheet}>
            <View style={s.grip} />

            <View style={s.hero}>
              <View style={s.heroIcon}>
                <Ionicons name={meta.icon} size={24} color={CARDIO_BLUE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.heroTitle}>{params.name ?? meta.label}</Text>
                {dateLabel && <Text style={s.heroDate}>{dateLabel}</Text>}
              </View>
              <View style={s.donePill}>
                <Ionicons name="checkmark-circle" size={13} color={GREEN} />
                <Text style={s.donePillText}>Avklarat</Text>
              </View>
            </View>

            {/* Stats i 2×2 rutnät */}
            <View style={s.statsGrid}>
              {stats.map((st, i) => (
                <View key={st.label} style={[s.statCell, i % 2 === 0 && s.statCellLeft, i >= 2 && s.statCellTop]}>
                  <Text style={s.statValue}>{st.value}</Text>
                  <Text style={s.statLabel}>{st.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* ── Helskärmskarta ── */}
      <Modal visible={fullscreen} animationType="fade" onRequestClose={() => setFullscreen(false)}>
        <View style={{ flex: 1, backgroundColor: '#e6e3dd' }}>
          {hasRoute && (
            <WebView
              style={{ flex: 1 }}
              source={{ html: routeMapHtml(route, { interactive: true, overlapBottom: 0, topInset: 100 }) }}
              javaScriptEnabled
              originWhitelist={['*']}
            />
          )}
          <SafeAreaView style={s.fsClose} edges={['top']} pointerEvents="box-none">
            <TouchableOpacity onPress={() => setFullscreen(false)} style={s.circleBtn} activeOpacity={0.8}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  mapBg: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: MAP_H,
    backgroundColor: '#e6e3dd',
  },

  headerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  circleBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center' },

  scroll: { flex: 1, backgroundColor: 'transparent' },

  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
    minHeight: SCREEN_H,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  grip: {
    alignSelf: 'center',
    width: 40, height: 5, borderRadius: 3,
    backgroundColor: '#3A3A3C',
    marginBottom: 8,
  },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: CARDIO_BLUE + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  heroDate: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '500', marginTop: 3, textTransform: 'capitalize' },
  donePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: GREEN + '1E', borderRadius: 10,
    paddingHorizontal: 9, paddingVertical: 5,
  },
  donePillText: { color: GREEN, fontSize: 12, fontWeight: '700' },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1, borderColor: BORDER,
    overflow: 'hidden',
  },
  statCell: {
    width: '50%',
    paddingVertical: 22,
    paddingHorizontal: 20,
    gap: 4,
  },
  statCellLeft: { borderRightWidth: 1, borderRightColor: BORDER },
  statCellTop:  { borderTopWidth: 1, borderTopColor: BORDER },
  statValue: { color: TEXT_PRIMARY, fontSize: 28, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  statLabel: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  fsClose: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    alignItems: 'flex-end',
    paddingHorizontal: 16, paddingTop: 6,
  },
})
