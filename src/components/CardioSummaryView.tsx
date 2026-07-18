import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, Pressable,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { clamp, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import WebView from 'react-native-webview'
import { BG, CARD, BORDER, ORANGE, RED, TEXT_PRIMARY, TEXT_SECONDARY, GREEN, NUM_FONT, NUM_FONT_SEMI } from '@/lib/theme'
import { toDisplayDistance, distanceUnitLabel, paceForUnit, type UnitSystem } from '@/lib/units'
import type { CardioWorkout } from '@/services/workouts'
import { effortColor, effortLabel } from '@/components/EffortRating'
import { getDefaultMapStyle } from '@/lib/prefs'
import { GlassCircleButton } from '@/components/GlassButton'
import { GlassView } from 'expo-glass-effect'
import { LIQUID_GLASS } from '@/lib/glass'

const CARDIO_BLUE = '#3BD5FF'
const { height: SCREEN_H } = Dimensions.get('window')

const TILE_URLS: Record<string, { url: string; opts: object }> = {
  standard:  { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',    opts: { maxZoom:20, subdomains:'abcd' } },
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
const PREVIEW_TILE = { z: 13, x: 4506, y: 2409 }
function previewUrl(key: string): string {
  return TILE_URLS[key].url
    .replace('{s}', 'a').replace('{r}', '')
    .replace('{z}', String(PREVIEW_TILE.z))
    .replace('{x}', String(PREVIEW_TILE.x))
    .replace('{y}', String(PREVIEW_TILE.y))
}

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
function formatPace(secs: number): string {
  if (!Number.isFinite(secs) || secs <= 0) return '--:--'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function mapHtml(route: Array<[number, number]>, o: { compassTop: number; topPad: number; bottomPad: number; style: string }): string {
  const step = Math.max(1, Math.floor(route.length / 800))
  const pts = route.filter((_, i) => i % step === 0 || i === route.length - 1)
  const tile = TILE_URLS[o.style] ?? TILE_URLS.standard
  return `<!DOCTYPE html><html><head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate-src.js"></script>
  <style>
    *{margin:0;padding:0}#map{width:100vw;height:100vh;background:#e6e3dd}
    .leaflet-control-attribution{display:none}
    .leaflet-top.leaflet-right{ top:${o.compassTop}px; right:16px; }
    .leaflet-control-rotate{ margin:0!important; border:none!important; border-radius:50%!important;
      overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.35); pointer-events:none!important; }
    .leaflet-control-rotate .leaflet-control-rotate-toggle{ display:block; width:44px!important; height:44px!important;
      background:#161618!important; border:none!important; border-radius:50%!important; }
    .leaflet-control-rotate-arrow{ background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='29' height='29' viewBox='0 0 29 29' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10.5 14l4-8 4 8h-8z' fill='%23FF453A'/%3E%3Cpath d='M10.5 16l4 8 4-8h-8z' fill='%23fff'/%3E%3C/svg%3E")!important; }
  </style>
  </head><body><div id="map"></div><script>
    var pts = ${JSON.stringify(pts)};
    var map = L.map('map',{zoomControl:false,attributionControl:false,rotate:true,touchRotate:true,
      rotateControl:{closeOnZeroBearing:false, position:'topright'}});
    var tileLayer = L.tileLayer(${JSON.stringify(tile.url)}, ${JSON.stringify(tile.opts)}).addTo(map);
    var glow  = L.polyline(pts,{color:'#FF6A00',weight:9,opacity:0.25,lineCap:'round',lineJoin:'round'}).addTo(map);
    var line  = L.polyline(pts,{color:'#FC4C02',weight:5,lineCap:'round',lineJoin:'round'}).addTo(map);
    var startM = L.circleMarker(pts[0],{radius:7,color:'#fff',weight:3,fillColor:'#22C55E',fillOpacity:1}).addTo(map);
    var endM   = L.circleMarker(pts[pts.length-1],{radius:7,color:'#fff',weight:3,fillColor:'#EF4444',fillOpacity:1}).addTo(map);
    map.fitBounds(line.getBounds(),{paddingTopLeft:[36,${o.topPad}],paddingBottomRight:[36,${o.bottomPad}]});
    function reprojectVectors(){ [glow, line, startM, endM].forEach(function(l){ try { l._project(); l._update(); } catch(e){} }); }
    map.on('rotate', reprojectVectors);
    window.addEventListener('message', function(e){
      try { var msg = JSON.parse(e.data);
        if (msg.type === 'style') { map.removeLayer(tileLayer);
          tileLayer = L.tileLayer(msg.url, msg.opts).addTo(map); tileLayer.bringToBack(); }
      } catch(err){}
    });
  </script></body></html>`
}

export function CardioSummaryView({ workout, title, dateLabel, avatarUrl, unit, onClose, onDelete }: {
  workout: CardioWorkout
  title: string
  dateLabel: string | null
  avatarUrl: string | null
  unit: UnitSystem
  onClose: () => void
  onDelete?: () => void
}) {
  const insets = useSafeAreaInsets()
  const d = workout.data
  const meta = TYPE_META[d.type] ?? TYPE_META.running

  // Kartstil + slide-up-väljare — startar på användarens standardkarta
  const webRef = useRef<InstanceType<typeof WebView>>(null)
  const startStyle = useRef('satellite')
  const [activeStyle, setActiveStyle] = useState('satellite')
  const [styleLoaded, setStyleLoaded] = useState(false)
  useEffect(() => {
    getDefaultMapStyle().then(k => {
      startStyle.current = k
      setActiveStyle(k)
      setStyleLoaded(true)
    })
  }, [])
  const [styleMenuOpen, setStyleMenuOpen] = useState(false)
  const styleY = useSharedValue(420)
  function openStyleSheet() { setStyleMenuOpen(true); styleY.value = 420; styleY.value = withTiming(0, { duration: 260 }) }
  function closeStyleSheet() { styleY.value = withTiming(420, { duration: 200 }, (f) => { if (f) runOnJS(setStyleMenuOpen)(false) }) }
  const styleDrag = Gesture.Pan()
    .onUpdate(e => { styleY.value = e.translationY > 0 ? e.translationY : e.translationY * 0.15 })
    .onEnd(e => {
      if (e.translationY > 90 || e.velocityY > 600) styleY.value = withTiming(420, { duration: 200 }, (f) => { if (f) runOnJS(setStyleMenuOpen)(false) })
      else styleY.value = withTiming(0, { duration: 180 })
    })
  const styleSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: styleY.value }] }))
  function changeStyle(key: string) {
    const st = TILE_URLS[key]; if (!st) return
    setActiveStyle(key); closeStyleSheet()
    webRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'style',url:${JSON.stringify(st.url)},opts:${JSON.stringify(st.opts)}})}));true;`
    )
  }

  // Detalj-ark: FULL / MID / PEEK
  const FULL = insets.top
  const MID  = Math.round(SCREEN_H * 0.44)
  const PEEK = SCREEN_H - (108 + insets.bottom)
  const ty = useSharedValue(MID)
  const startY = useSharedValue(MID)
  const detailPan = Gesture.Pan()
    .onStart(() => { startY.value = ty.value })
    .onUpdate(e => { ty.value = clamp(startY.value + e.translationY, FULL, PEEK) })
    .onEnd(e => {
      'worklet'
      let target: number
      if (e.velocityY < -600)      target = ty.value > MID ? MID : FULL
      else if (e.velocityY > 600)  target = ty.value < MID ? MID : PEEK
      else {
        const dF = Math.abs(ty.value - FULL)
        const dM = Math.abs(ty.value - MID)
        const dP = Math.abs(ty.value - PEEK)
        target = dF < dM && dF < dP ? FULL : dP < dM ? PEEK : MID
      }
      ty.value = withTiming(target, { duration: 280 })
    })
  const detailStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }))

  const unitLabel = distanceUnitLabel(unit)
  const distKm = d.distance_km ?? 0
  const dur = d.duration_seconds ?? 0
  const route = d.route ?? []
  const hasRoute = route.length > 1
  const avgPaceSec = distKm > 0.01 ? paceForUnit(dur / distKm, unit) : 0

  const stats: { label: string; value: string }[] = [
    { label: `Distans (${unitLabel})`, value: toDisplayDistance(distKm, unit).toFixed(2) },
    { label: 'Tid',                    value: formatTime(dur) },
    { label: `Snitt /${unitLabel}`,    value: formatPace(avgPaceSec) },
    { label: 'Kcal',                   value: String(d.calories ?? 0) },
  ]
  const splits = d.splits ?? []
  const fastestSplit = splits.length ? Math.min(...splits.map(sp => sp.paceSec)) : 0

  return (
    <View style={s.root}>
      {hasRoute && styleLoaded && (
        <WebView
          ref={webRef}
          style={StyleSheet.absoluteFill}
          source={{ html: mapHtml(route, { compassTop: insets.top + 68, topPad: insets.top + 70, bottomPad: SCREEN_H - MID, style: startStyle.current }) }}
          javaScriptEnabled
          originWhitelist={['*']}
        />
      )}

      {/* Tillbaka + (radera) + lager — liquid glass över kartan (iOS 26) */}
      <View style={[s.controls, { top: insets.top + 12 }]} pointerEvents="box-none">
        <GlassCircleButton icon="chevron-back" onPress={onClose} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {onDelete && (
            <GlassCircleButton icon="trash-outline" iconColor={RED} onPress={onDelete} />
          )}
          {hasRoute && (
            <GlassCircleButton icon="layers-outline" draggable onPress={openStyleSheet} />
          )}
        </View>
      </View>

      {!hasRoute && (
        // Utan rutt: fyll toppen med en mörk yta så arket inte visar tom karta
        <View style={StyleSheet.absoluteFill} />
      )}

      <GestureDetector gesture={detailPan}>
        <Animated.View style={[s.sheet, { height: SCREEN_H }, detailStyle]}>
          <View style={s.grip} />

          <View style={s.hero}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={s.heroAvatar} />
            ) : (
              <View style={s.heroIcon}>
                <Ionicons name={meta.icon} size={24} color={CARDIO_BLUE} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{title}</Text>
              {dateLabel && <Text style={s.heroDate}>{dateLabel}</Text>}
            </View>
            <View style={s.donePill}>
              <Ionicons name="checkmark-circle" size={13} color={GREEN} />
              <Text style={s.donePillText}>Avklarat</Text>
            </View>
          </View>

          <View style={s.statsGrid}>
            {stats.map((st) => (
              <View key={st.label} style={s.statCell}>
                <Text style={s.statLabel}>{st.label}</Text>
                <Text style={s.statValue}>{st.value}</Text>
              </View>
            ))}
          </View>

          {typeof d.effort === 'number' && d.effort >= 1 && (
            <View style={s.effortRow}>
              <View style={[s.effortBadge, { backgroundColor: effortColor(d.effort) + '26', borderColor: effortColor(d.effort) }]}>
                <Text style={[s.effortBadgeText, { color: effortColor(d.effort) }]}>{d.effort}</Text>
              </View>
              <Text style={s.effortText}>Ansträngning · {effortLabel(d.effort)}</Text>
            </View>
          )}

          {splits.length > 0 && (
            <View style={s.splitsCard}>
              <Text style={s.splitsTitle}>Kilometersplittar</Text>
              {splits.map((sp, i) => (
                <View key={i} style={s.splitRow}>
                  <Text style={s.splitKm}>{sp.label}</Text>
                  <View style={s.splitBarTrack}>
                    <View style={[s.splitBar, { width: `${sp.paceSec > 0 ? Math.max(10, (fastestSplit / sp.paceSec) * 100) : 10}%` as never }]} />
                  </View>
                  <Text style={s.splitPace}>{formatPace(sp.paceSec)}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      {styleMenuOpen && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeStyleSheet} />
          <Animated.View style={[s.styleSheet, LIQUID_GLASS && s.styleSheetGlass, styleSheetStyle]}>
            {LIQUID_GLASS && <GlassView glassEffectStyle="regular" colorScheme="dark" style={StyleSheet.absoluteFill} />}
            <GestureDetector gesture={styleDrag}>
              <View style={s.styleGrip}>
                <View style={s.sheetHandle} />
                <Text style={s.sheetTitle}>Välj karta</Text>
              </View>
            </GestureDetector>
            <SafeAreaView edges={['bottom']}>
              <View style={s.mapGrid}>
                {MAP_STYLES.map(ms => {
                  const active = activeStyle === ms.key
                  return (
                    <TouchableOpacity
                      key={ms.key}
                      style={[s.mapCard, active && s.mapCardActive]}
                      onPress={() => changeStyle(ms.key)}
                      activeOpacity={0.85}
                    >
                      <Image source={{ uri: previewUrl(ms.key) }} style={s.mapPreview} />
                      <View style={s.mapCardLabelRow}>
                        <Text style={[s.mapCardLabel, active && { color: ORANGE }]}>{ms.label}</Text>
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
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  controls: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, zIndex: 5,
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: BG,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10,
    gap: 18, zIndex: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4, shadowRadius: 16,
  },
  grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#3A3A3C' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: CARDIO_BLUE + '22', alignItems: 'center', justifyContent: 'center',
  },
  heroAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: CARD, borderWidth: 2, borderColor: CARDIO_BLUE + '55',
  },
  heroTitle: { color: TEXT_PRIMARY, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  heroDate: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '500', marginTop: 3, textTransform: 'capitalize' },
  donePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: GREEN + '1E', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5,
  },
  donePillText: { color: GREEN, fontSize: 12, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 20, paddingHorizontal: 4, marginTop: 14 },
  effortRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center',
    marginTop: 20, paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20,
  },
  effortBadge: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  effortBadgeText: { fontSize: 12, fontWeight: '800' },
  effortText: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  statCell: { width: '50%', gap: 3, alignItems: 'center' },
  statValue: { color: TEXT_PRIMARY, fontSize: 20, fontFamily: NUM_FONT, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  statLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  splitsCard: {
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 18, paddingVertical: 16, gap: 4,
  },
  splitsTitle: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
  },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  splitKm: { color: TEXT_SECONDARY, fontSize: 14, fontFamily: NUM_FONT_SEMI, width: 56, fontVariant: ['tabular-nums'] },
  splitBarTrack: { flex: 1, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  splitBar: { height: '100%', borderRadius: 8, backgroundColor: ORANGE },
  splitPace: { color: TEXT_PRIMARY, fontSize: 14, fontFamily: NUM_FONT, width: 48, textAlign: 'right', fontVariant: ['tabular-nums'] },
  styleSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingBottom: 12, zIndex: 40,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.35, shadowRadius: 16,
  },
  styleSheetGlass: { backgroundColor: 'transparent', overflow: 'hidden' },
  styleGrip: { paddingTop: 10, paddingBottom: 4 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3C' },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 14, marginBottom: 6 },
  mapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 6 },
  mapCard: {
    flexBasis: '48%', flexGrow: 1,
    borderRadius: 16, borderWidth: 2, borderColor: 'transparent',
    backgroundColor: '#242426', overflow: 'hidden',
  },
  mapCardActive: { borderColor: ORANGE },
  mapPreview: { width: '100%', height: 96, backgroundColor: '#2C2C2E' },
  mapCardLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9 },
  mapCardLabel: { color: '#ccc', fontSize: 13, fontWeight: '700' },
})
