import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
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

/** Statisk ruttkarta: mörka plattor, orange linje, grön start / röd mål */
function routeMapHtml(route: Array<[number, number]>): string {
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

export default function CardioSummaryScreen() {
  const params = useLocalSearchParams<{ name?: string; cardioType?: string; date?: string }>()
  const type = params.cardioType ?? 'running'
  const meta = TYPE_META[type] ?? TYPE_META.running

  const [unit, setUnit] = useState<UnitSystem>('metric')
  const [workout, setWorkout] = useState<CardioWorkout | null>(null)
  const [loading, setLoading] = useState(true)

  const unitLabel = distanceUnitLabel(unit)

  useEffect(() => {
    getUnitSystem().then(setUnit)
  }, [])

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
  const avgPaceSec = distKm > 0.01 ? paceForUnit(dur / distKm, unit) : 0

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{params.name ?? meta.label}</Text>
          <View style={s.iconBtn} />
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={CARDIO_BLUE} />
          </View>
        ) : !workout ? (
          <View style={s.center}>
            <Ionicons name="cloud-offline-outline" size={40} color={TEXT_SECONDARY} />
            <Text style={s.emptyText}>Kunde inte hitta det sparade passet.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <View style={s.hero}>
              <View style={s.heroIcon}>
                <Ionicons name={meta.icon} size={26} color={CARDIO_BLUE} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.donePill}>
                  <Ionicons name="checkmark-circle" size={13} color={GREEN} />
                  <Text style={s.donePillText}>Avklarat</Text>
                </View>
                {dateLabel && <Text style={s.heroDate}>{dateLabel}</Text>}
              </View>
            </View>

            {/* Ruttkarta */}
            {route.length > 1 && (
              <View style={s.mapWrap} pointerEvents="none">
                <WebView
                  style={{ flex: 1, backgroundColor: '#111' }}
                  source={{ html: routeMapHtml(route) }}
                  scrollEnabled={false}
                  javaScriptEnabled
                  originWhitelist={['*']}
                />
              </View>
            )}

            {/* Statistik */}
            <View style={s.statsCard}>
              <View style={s.statRow}>
                <View style={s.stat}>
                  <Text style={s.statValue}>{toDisplayDistance(distKm, unit).toFixed(2)}</Text>
                  <Text style={s.statLabel}>Distans ({unitLabel})</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.stat}>
                  <Text style={s.statValue}>{formatTime(dur)}</Text>
                  <Text style={s.statLabel}>Tid</Text>
                </View>
              </View>
              <View style={s.statRowDivider} />
              <View style={s.statRow}>
                <View style={s.stat}>
                  <Text style={s.statValue}>{formatPace(avgPaceSec)}</Text>
                  <Text style={s.statLabel}>Snitt /{unitLabel}</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.stat}>
                  <Text style={s.statValue}>{d?.calories ?? 0}</Text>
                  <Text style={s.statLabel}>Kcal</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center' },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: CARDIO_BLUE + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  donePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: GREEN + '1E', borderRadius: 10,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  donePillText: { color: GREEN, fontSize: 12, fontWeight: '700' },
  heroDate: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '500', marginTop: 5, textTransform: 'capitalize' },

  mapWrap: {
    height: 220, borderRadius: 20, overflow: 'hidden',
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },

  statsCard: {
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER,
    paddingVertical: 8,
  },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 18 },
  statValue: { color: TEXT_PRIMARY, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  statLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 40, backgroundColor: BORDER },
  statRowDivider: { height: 1, backgroundColor: BORDER, marginHorizontal: 20 },
})
