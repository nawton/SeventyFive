import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, Pressable, ScrollView,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import WebView from 'react-native-webview'
import { BG, CARD, ORANGE, RED, TEXT_PRIMARY, TEXT_SECONDARY, GREEN, NUM_FONT, NUM_FONT_SEMI } from '@/lib/theme'
import { toDisplayDistance, distanceUnitLabel, paceForUnit, type UnitSystem } from '@/lib/units'
import type { CardioWorkout } from '@/services/workouts'
import { effortColor, effortLabel } from '@/components/EffortRating'
import { getDefaultMapStyle } from '@/lib/prefs'
import { GlassCircleButton } from '@/components/GlassButton'
import { GlassView } from 'expo-glass-effect'
import { LIQUID_GLASS } from '@/lib/glass'

const CARDIO_BLUE = '#3BD5FF'
const { height: SCREEN_H } = Dimensions.get('window')

// Apple Fitness-paletten — en neonfärg per mätvärde
const STAT_YELLOW = '#FFE60A'
const STAT_PINK   = '#FF3D73'
const STAT_TEAL   = '#40F5E9'
const STAT_LIME   = '#BDFF3B'

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

// Apple visar alltid h:mm:ss — "0:35:37"
function formatTimeLong(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
function formatSplitTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
// Apple-takt: 5'38''
function formatPaceApple(secs: number): string {
  if (!Number.isFinite(secs) || secs <= 0) return "-'--''"
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}'${String(s).padStart(2, '0')}''`
}
/** "0,4 km" → 0.4 — splittens distans ur etiketten */
function splitDist(label: string): number {
  const v = parseFloat(label.replace(',', '.'))
  return Number.isFinite(v) && v > 0 ? v : 1
}

function mapHtml(route: Array<[number, number]>, o: { compassTop: number; topPad: number; bottomPad: number; style: string; interactive: boolean }): string {
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
    var map = L.map('map',{zoomControl:false,attributionControl:false,
      ${o.interactive
        ? "rotate:true,touchRotate:true,rotateControl:{closeOnZeroBearing:false, position:'topright'}"
        : 'rotate:false,rotateControl:false,dragging:false,touchZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,scrollWheelZoom:false'}});
    var tileLayer = L.tileLayer(${JSON.stringify(tile.url)}, ${JSON.stringify(tile.opts)}).addTo(map);
    var glow  = L.polyline(pts,{color:'#FF6A00',weight:9,opacity:0.25,lineCap:'round',lineJoin:'round'}).addTo(map);
    var line  = L.polyline(pts,{color:'#FC4C02',weight:5,lineCap:'round',lineJoin:'round'}).addTo(map);
    var startM = L.circleMarker(pts[0],{radius:7,color:'#fff',weight:3,fillColor:'#22C55E',fillOpacity:1}).addTo(map);
    var endM   = L.circleMarker(pts[pts.length-1],{radius:7,color:'#fff',weight:3,fillColor:'#EF4444',fillOpacity:1}).addTo(map);
    map.fitBounds(line.getBounds(),{paddingTopLeft:[${o.interactive ? 36 : 24},${o.topPad}],paddingBottomRight:[${o.interactive ? 36 : 24},${o.bottomPad}]});
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

// Tre stigande staplar som fylls efter ansträngningsgraden (som Apples ikon)
function EffortBars({ effort, color }: { effort: number; color: string }) {
  return (
    <View style={s.effortBars}>
      {[0.45, 0.7, 1].map((h, i) => {
        const filled = effort >= (i + 1) * 3
        return (
          <View
            key={i}
            style={[s.effortBar, { height: 26 * h, backgroundColor: filled ? color : 'rgba(255,255,255,0.18)' }]}
          />
        )
      })}
    </View>
  )
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

  // Kartstil — startar på användarens standardkarta
  const webRef = useRef<InstanceType<typeof WebView>>(null)
  const [activeStyle, setActiveStyle] = useState('satellite')
  const [styleLoaded, setStyleLoaded] = useState(false)
  useEffect(() => {
    getDefaultMapStyle().then(k => {
      setActiveStyle(k)
      setStyleLoaded(true)
    })
  }, [])
  const [mapFull, setMapFull] = useState(false)
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

  const unitLabel = distanceUnitLabel(unit)
  const distKm = d.distance_km ?? 0
  const dur = d.duration_seconds ?? 0
  const route = d.route ?? []
  const hasRoute = route.length > 1
  const avgPaceSec = distKm > 0.01 ? paceForUnit(dur / distKm, unit) : 0
  const splits = d.splits ?? []
  const fastestSplit = splits.length ? Math.min(...splits.map(sp => sp.paceSec)) : 0

  // Träningsdetaljer — Apple-stil: etikett ovanför stort färgat värde
  const details: Array<{ label: string; value: string; suffix?: string; color: string }> = [
    { label: 'Träningstid', value: formatTimeLong(dur), color: STAT_YELLOW },
    { label: 'Distans', value: toDisplayDistance(distKm, unit).toFixed(2).replace('.', ','), suffix: unitLabel.toUpperCase(), color: CARDIO_BLUE },
    { label: 'Kilokalorier', value: String(d.calories ?? 0), suffix: 'KCAL', color: STAT_PINK },
    { label: 'Snittakt', value: formatPaceApple(avgPaceSec), suffix: `/${unitLabel.toUpperCase()}`, color: STAT_TEAL },
  ]
  if (fastestSplit > 0) {
    details.push({ label: `Snabbaste ${unitLabel}`, value: formatPaceApple(paceForUnit(fastestSplit, unit)), suffix: `/${unitLabel.toUpperCase()}`, color: STAT_LIME })
  }

  const effColor = typeof d.effort === 'number' ? effortColor(d.effort) : GREEN

  return (
    <View style={s.root}>
      {/* Toppbar: tillbaka + datum + radera */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <GlassCircleButton icon="chevron-back" onPress={onClose} />
        {dateLabel ? <Text style={s.topBarDate}>{dateLabel}</Text> : <View />}
        {onDelete
          ? <GlassCircleButton icon="trash-outline" iconColor={RED} onPress={onDelete} />
          : <View style={{ width: 44 }} />}
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
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
            <Text style={s.heroSub}>{meta.label}</Text>
          </View>
          <View style={s.donePill}>
            <Ionicons name="checkmark-circle" size={13} color={GREEN} />
            <Text style={s.donePillText}>Avklarat</Text>
          </View>
        </View>

        {/* ── Träningsdetaljer ── */}
        <Text style={s.sectionHeader}>Träningsdetaljer</Text>
        <View style={s.card}>
          {Array.from({ length: Math.ceil(details.length / 2) }, (_, row) => (
            <View key={row} style={[s.detailRow, row > 0 && s.detailRowBorder]}>
              {[details[row * 2], details[row * 2 + 1]].map((st, col) =>
                st ? (
                  <View key={st.label} style={s.detailCell}>
                    <Text style={s.detailLabel}>{st.label}</Text>
                    <Text style={[s.detailValue, { color: st.color }]}>
                      {st.value}
                      {st.suffix ? <Text style={[s.detailSuffix, { color: st.color }]}>{' '}{st.suffix}</Text> : null}
                    </Text>
                  </View>
                ) : (
                  <View key={`empty-${col}`} style={s.detailCell} />
                )
              )}
            </View>
          ))}
        </View>

        {/* ── Ansträngning ── */}
        {typeof d.effort === 'number' && d.effort >= 1 && (
          <View style={[s.card, s.effortCard]}>
            <View style={{ flex: 1 }}>
              <Text style={s.effortHeading}>Ansträngning</Text>
              <View style={s.effortValueRow}>
                <View style={[s.effortCircle, { backgroundColor: effColor }]}>
                  <Text style={s.effortCircleText}>{d.effort}</Text>
                </View>
                <Text style={[s.effortLabel, { color: effColor }]}>{effortLabel(d.effort)}</Text>
              </View>
            </View>
            <EffortBars effort={d.effort} color={effColor} />
          </View>
        )}

        {/* ── Differenser ── */}
        {splits.length > 0 && (
          <>
            <Text style={s.sectionHeader}>Differenser</Text>
            <View style={[s.card, s.tableCard]}>
              <View style={s.tableHead}>
                <Text style={[s.tableHeadCell, s.colIdx]} />
                <Text style={[s.tableHeadCell, s.colTime]}>Tid</Text>
                <Text style={[s.tableHeadCell, s.colPace]}>Takt</Text>
              </View>
              {splits.map((sp, i) => (
                <View key={i} style={[s.tableRow, i > 0 && s.detailRowBorder]}>
                  <Text style={[s.tableIdx, s.colIdx]}>{i + 1}</Text>
                  <Text style={[s.tableTime, s.colTime]}>{formatSplitTime(sp.paceSec * splitDist(sp.label))}</Text>
                  <Text style={[s.tablePace, s.colPace]}>{formatPaceApple(paceForUnit(sp.paceSec, unit))}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Karta ── */}
        {hasRoute && styleLoaded && (
          <>
            <View style={s.sectionHeaderRow}>
              <Text style={[s.sectionHeader, s.sectionHeaderInline]}>Karta</Text>
              <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
            </View>
            <Pressable style={s.mapCard} onPress={() => setMapFull(true)}>
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <WebView
                  key={`preview-${activeStyle}`}
                  style={StyleSheet.absoluteFill}
                  source={{ html: mapHtml(route, { compassTop: 0, topPad: 24, bottomPad: 24, style: activeStyle, interactive: false }) }}
                  javaScriptEnabled
                  originWhitelist={['*']}
                  scrollEnabled={false}
                />
              </View>
              <View style={s.mapExpandHint}>
                <Ionicons name="expand-outline" size={15} color="#fff" />
              </View>
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* Fullskärmskarta med interaktion + kartvalsark */}
      {mapFull && hasRoute && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: BG, zIndex: 30 }]}>
          <WebView
            ref={webRef}
            style={StyleSheet.absoluteFill}
            source={{ html: mapHtml(route, { compassTop: insets.top + 68, topPad: insets.top + 70, bottomPad: 40, style: activeStyle, interactive: true }) }}
            javaScriptEnabled
            originWhitelist={['*']}
          />
          <View style={[s.topBar, { paddingTop: insets.top + 8, position: 'absolute', left: 0, right: 0 }]} pointerEvents="box-none">
            <GlassCircleButton icon="chevron-back" onPress={() => setMapFull(false)} />
            <GlassCircleButton icon="layers-outline" draggable onPress={openStyleSheet} />
          </View>

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
                          style={[s.mapStyleCard, active && s.mapStyleCardActive]}
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
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8, zIndex: 5,
  },
  topBarDate: {
    color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', textTransform: 'capitalize',
  },
  scroll: { paddingHorizontal: 20 },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  heroIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: CARDIO_BLUE + '22', alignItems: 'center', justifyContent: 'center',
  },
  heroAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: CARD, borderWidth: 2, borderColor: CARDIO_BLUE + '55',
  },
  heroTitle: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  heroSub: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '500', marginTop: 3 },
  donePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: GREEN + '1E', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5,
  },
  donePillText: { color: GREEN, fontSize: 12, fontWeight: '700' },

  sectionHeader: {
    color: TEXT_PRIMARY, fontSize: 26, fontWeight: '800', letterSpacing: -0.4,
    marginTop: 26, marginBottom: 12,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 26, marginBottom: 12 },
  sectionHeaderInline: { marginTop: 0, marginBottom: 0 },
  card: {
    backgroundColor: CARD, borderRadius: 20,
    paddingHorizontal: 18,
  },

  detailRow: { flexDirection: 'row', paddingVertical: 16 },
  detailRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.14)' },
  detailCell: { flex: 1, gap: 3 },
  detailLabel: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '500', opacity: 0.92 },
  detailValue: { fontSize: 28, fontFamily: NUM_FONT, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  detailSuffix: { fontSize: 15, fontFamily: NUM_FONT_SEMI, letterSpacing: 0.3 },

  effortCard: {
    marginTop: 22, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  effortHeading: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '500', opacity: 0.92 },
  effortValueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  effortCircle: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  effortCircleText: { color: '#000', fontSize: 15, fontFamily: NUM_FONT },
  effortLabel: { fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  effortBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  effortBar: { width: 7, borderRadius: 3 },

  tableCard: { paddingVertical: 6 },
  tableHead: { flexDirection: 'row', paddingVertical: 10 },
  tableHeadCell: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  colIdx: { width: 34 },
  colTime: { flex: 1 },
  colPace: { flex: 1, textAlign: 'right' },
  tableIdx: { color: TEXT_SECONDARY, fontSize: 15, fontFamily: NUM_FONT_SEMI, fontVariant: ['tabular-nums'] },
  tableTime: { color: STAT_YELLOW, fontSize: 19, fontFamily: NUM_FONT, fontVariant: ['tabular-nums'] },
  tablePace: { color: STAT_TEAL, fontSize: 19, fontFamily: NUM_FONT, fontVariant: ['tabular-nums'] },

  mapCard: {
    height: 230, borderRadius: 20, overflow: 'hidden', backgroundColor: CARD,
  },
  mapExpandHint: {
    position: 'absolute', right: 12, bottom: 12,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(12,12,14,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },

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
  mapStyleCard: {
    flexBasis: '48%', flexGrow: 1,
    borderRadius: 16, borderWidth: 2, borderColor: 'transparent',
    backgroundColor: '#242426', overflow: 'hidden',
  },
  mapStyleCardActive: { borderColor: ORANGE },
  mapPreview: { width: '100%', height: 96, backgroundColor: '#2C2C2E' },
  mapCardLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9 },
  mapCardLabel: { color: '#ccc', fontSize: 13, fontWeight: '700' },
})
