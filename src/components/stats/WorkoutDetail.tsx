import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import WebView from 'react-native-webview'
import { ORANGE, GREEN, RED, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { deleteCardioWorkout, type CardioWorkout } from '@/services/workouts'

const EXERCISE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  running:  'fitness-outline',
  cycling:  'bicycle-outline',
  interval: 'flash-outline',
  walking:  'walk-outline',
}

function fmtTime(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtPace(secsPerKm: number): string {
  const m = Math.floor(secsPerKm / 60)
  const s = Math.floor(secsPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function buildRouteHtml(route: Array<[number, number]>): string {
  const coords = JSON.stringify(route)
  const start  = JSON.stringify(route[0])
  const end    = JSON.stringify(route[route.length - 1])
  return `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate-src.js"></script>
    <style>*{margin:0;padding:0}html,body,#map{width:100%;height:100%}.leaflet-control-attribution{display:none}</style>
  </head><body><div id="map"></div><script>
    var map=L.map('map',{zoomControl:false,attributionControl:false,rotate:true,touchRotate:true});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd'}).addTo(map);
    var line=L.polyline(${coords},{color:'#FF8F00',weight:4,lineCap:'round',lineJoin:'round'}).addTo(map);
    var si=L.divIcon({html:'<div style="width:12px;height:12px;background:#22C55E;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>',iconSize:[12,12],iconAnchor:[6,6],className:''});
    var ei=L.divIcon({html:'<div style="width:12px;height:12px;background:#FF8F00;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>',iconSize:[12,12],iconAnchor:[6,6],className:''});
    L.marker(${start},{icon:si}).addTo(map);
    L.marker(${end},{icon:ei}).addTo(map);
    map.fitBounds(line.getBounds(),{padding:[24,24]});
  </script></body></html>`
}

function GlassBtn({
  icon, size = 20, color = TEXT_PRIMARY, style, onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  size?: number; color?: string; style?: object; onPress?: () => void
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={style}>
      <BlurView intensity={24} tint="dark" style={s.glassBtn}>
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.glassBtnBorder} />
        <Ionicons name={icon} size={size} color={color} />
      </BlurView>
    </TouchableOpacity>
  )
}

export function WorkoutRow({ workout, last, onPress }: {
  workout: CardioWorkout; last: boolean; onPress: () => void
}) {
  const d    = workout.data
  const pace = d.distance_km > 0.1
    ? fmtPace(d.duration_seconds / d.distance_km) + ' /km' : null
  const date = new Date(workout.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })

  return (
    <TouchableOpacity
      style={[s.workoutRow, !last && s.workoutRowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={s.rowIcon}>
        <Ionicons name={EXERCISE_ICONS[d.type] ?? 'fitness-outline'} size={18} color={ORANGE} />
      </View>
      <View style={s.rowBody}>
        <View style={s.rowTop}>
          <Text style={s.rowName}>{workout.name}</Text>
          <Text style={s.rowDate}>{date}</Text>
        </View>
        <View style={s.rowMeta}>
          <Text style={s.rowStat}>{d.distance_km.toFixed(2)} km</Text>
          <Text style={s.rowDot}>·</Text>
          <Text style={s.rowStat}>{fmtTime(d.duration_seconds)}</Text>
          {pace && (
            <>
              <Text style={s.rowDot}>·</Text>
              <Text style={[s.rowStat, { color: ORANGE }]}>{pace}</Text>
            </>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" style={{ alignSelf: 'center' }} />
    </TouchableOpacity>
  )
}

export function WorkoutDetail({ workout, allWorkouts, onClose, onDeleted }: {
  workout: CardioWorkout
  allWorkouts: CardioWorkout[]
  onClose: () => void
  onDeleted: (id: string) => void
}) {
  const [deleting, setDeleting]       = useState(false)
  const [mapFullscreen, setMapFullscreen] = useState(false)
  const insets = useSafeAreaInsets()
  const d      = workout.data

  const date    = new Date(workout.created_at)
  const dateStr = date.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })

  const paceSecPerKm = d.distance_km > 0.1 ? d.duration_seconds / d.distance_km : 0
  const speedKmH     = d.duration_seconds > 0 ? (d.distance_km / d.duration_seconds) * 3600 : 0

  const others        = allWorkouts.filter(w => w.id !== workout.id)
  const bestDistOther = others.length > 0 ? Math.max(...others.map(w => w.data.distance_km)) : 0
  const bestPaceOther = others.length > 0
    ? Math.min(...others.filter(w => w.data.distance_km > 0.1).map(w => w.data.duration_seconds / w.data.distance_km), Infinity)
    : Infinity
  const isPRDist = d.distance_km > 0.1 && d.distance_km > bestDistOther && others.length > 0
  const isPRPace = paceSecPerKm > 0 && paceSecPerKm < bestPaceOther && others.length > 0

  const stats = [
    { label: 'Distans',   value: d.distance_km.toFixed(2),                                  unit: 'km',     icon: 'map-outline' as const,         color: ORANGE },
    { label: 'Tid',       value: fmtTime(d.duration_seconds),                               unit: '',       icon: 'time-outline' as const,        color: '#4A90D9' },
    { label: 'Tempo',     value: paceSecPerKm > 0 ? fmtPace(paceSecPerKm) : '--:--',        unit: 'min/km', icon: 'stopwatch-outline' as const,   color: GREEN },
    { label: 'Hastighet', value: speedKmH.toFixed(1),                                       unit: 'km/h',   icon: 'speedometer-outline' as const, color: '#7C5CBF' },
    { label: 'Kalorier',  value: String(d.calories),                                        unit: 'kcal',   icon: 'flame-outline' as const,       color: '#FF6B35' },
  ]

  function confirmDelete() {
    Alert.alert('Radera träning', 'Det här går inte att ångra.', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Radera', style: 'destructive',
        onPress: async () => {
          setDeleting(true)
          await deleteCardioWorkout(workout.id)
          onDeleted(workout.id)
          onClose()
        },
      },
    ])
  }

  return (
    <View style={s.screen}>
      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <GlassBtn icon="close" onPress={onClose} />
          <Text style={s.headerTitle}>Träningsdetaljer</Text>
          <GlassBtn icon="trash-outline" color={RED} onPress={confirmDelete} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {(isPRDist || isPRPace) && (
          <View style={s.prRow}>
            {isPRDist && <View style={s.prBadge}><Text style={s.prBadgeText}>🏆 Distansrekord</Text></View>}
            {isPRPace && <View style={s.prBadge}><Text style={s.prBadgeText}>⚡ Temporekord</Text></View>}
          </View>
        )}

        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Ionicons name={EXERCISE_ICONS[d.type] ?? 'fitness-outline'} size={36} color="#fff" />
          </View>
          <Text style={s.heroName}>{workout.name}</Text>
          <Text style={s.heroDate}>{dateStr}</Text>
          <Text style={s.heroTime}>{timeStr}</Text>
        </View>

        {d.route && d.route.length > 1 && (
          <View style={s.mapWrap}>
            <WebView
              source={{ html: buildRouteHtml(d.route) }}
              style={s.map}
              scrollEnabled={false}
              javaScriptEnabled
              originWhitelist={['*']}
            />
            <View style={s.mapExpandBtn}>
              <GlassBtn icon="expand-outline" size={18} onPress={() => setMapFullscreen(true)} />
            </View>
          </View>
        )}

        <View style={s.grid}>
          {stats.map(stat => (
            <View key={stat.label} style={s.gridCell}>
              <View style={[s.gridIcon, { backgroundColor: stat.color + '22' }]}>
                <Ionicons name={stat.icon} size={18} color={stat.color} />
              </View>
              <Text style={[s.gridValue, { color: stat.color }]}>
                {stat.value}
                {stat.unit ? <Text style={s.gridUnit}> {stat.unit}</Text> : null}
              </Text>
              <Text style={s.gridLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {d.route && d.route.length > 1 && (
        <Modal visible={mapFullscreen} animationType="fade" statusBarTranslucent>
          <View style={{ flex: 1 }}>
            <WebView
              source={{ html: buildRouteHtml(d.route) }}
              style={{ flex: 1 }}
              scrollEnabled={false}
              javaScriptEnabled
              originWhitelist={['*']}
            />
            <View style={[s.mapFsClose, { top: insets.top + 8, right: 16 }]}>
              <GlassBtn icon="close" onPress={() => setMapFullscreen(false)} />
            </View>
          </View>
        </Modal>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  scroll:      { padding: 20, gap: 20 },

  glassBtn: {
    width: 36, height: 36, borderRadius: 18,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  glassBtnBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },

  prRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  prBadge:     { backgroundColor: ORANGE + '22', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: ORANGE + '44' },
  prBadgeText: { color: ORANGE, fontSize: 13, fontWeight: '700' },

  hero:     { alignItems: 'center', gap: 6, paddingVertical: 8 },
  heroIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: ORANGE,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 18,
  },
  heroName: { color: TEXT_PRIMARY, fontSize: 26, fontWeight: '800' },
  heroDate: { color: TEXT_SECONDARY, fontSize: 14, textTransform: 'capitalize' },
  heroTime: { color: TEXT_SECONDARY, fontSize: 13 },

  mapWrap:     { borderRadius: 20, overflow: 'hidden', height: 300, borderWidth: 1, borderColor: BORDER },
  map:         { flex: 1, backgroundColor: '#f0ede8' },
  mapExpandBtn:{ position: 'absolute', top: 12, right: 12 },
  mapFsClose:  { position: 'absolute' },

  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCell:  { width: '47%', backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 6, alignItems: 'center' },
  gridIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  gridValue: { fontSize: 22, fontWeight: '800' },
  gridUnit:  { fontSize: 13, fontWeight: '500' },
  gridLabel: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '500' },

  workoutRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  workoutRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  rowIcon:  { width: 38, height: 38, borderRadius: 10, backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowBody:  { flex: 1, gap: 4 },
  rowTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName:  { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  rowDate:  { color: TEXT_SECONDARY, fontSize: 12 },
  rowMeta:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowStat:  { color: TEXT_SECONDARY, fontSize: 13 },
  rowDot:   { color: 'rgba(255,255,255,0.15)', fontSize: 13 },
})
