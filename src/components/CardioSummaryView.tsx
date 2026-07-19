import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, Pressable,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { clamp, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import MapView, { Polyline, Marker } from 'react-native-maps'
import { BG, CARD, BORDER, ORANGE, RED, TEXT_PRIMARY, TEXT_SECONDARY, GREEN, NUM_FONT, NUM_FONT_SEMI, CARDIO_BLUE } from '@/lib/theme'
import { toDisplayDistance, distanceUnitLabel, paceForUnit, type UnitSystem } from '@/lib/units'
import { fmtTime, fmtPace } from '@/lib/format'
import type { CardioWorkout } from '@/services/workouts'
import { updateCardioEffort } from '@/services/workouts'
import { EffortRating, effortColor, effortLabel } from '@/components/EffortRating'
import { getDefaultMapStyle } from '@/lib/prefs'
import { GlassCircleButton } from '@/components/GlassButton'
import { GlassView } from 'expo-glass-effect'
import { LIQUID_GLASS } from '@/lib/glass'

// Apple Fitness-paletten — en neonfärg per mätvärde
const STAT_YELLOW = '#FFE60A'
const STAT_PINK   = '#FF3D73'
const STAT_TEAL   = '#40F5E9'
const { height: SCREEN_H } = Dimensions.get('window')

const TYPE_META: Record<string, { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  running:  { label: 'Löpning',    icon: 'fitness-outline' },
  cycling:  { label: 'Cykling',    icon: 'bicycle-outline' },
  walking:  { label: 'Promenad',   icon: 'walk-outline' },
  interval: { label: 'Intervaller', icon: 'flash-outline' },
}

// Tre stigande staplar som fylls efter betyget — som Apples ansträngningsikon
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

// Apple Maps — samma stilmappning som liveskärmen ('terrain' föll bort)
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

  // Ansträngningsbetyget — klickbart kort längst ner, ändras via betygslagret
  const [effort, setEffort] = useState<number | null>(
    typeof d.effort === 'number' && d.effort >= 1 ? d.effort : null
  )
  const [effortOpen, setEffortOpen] = useState(false)
  async function handleEffortDone(val: number | null) {
    setEffortOpen(false)
    if (typeof val !== 'number' || val === effort) return
    const prev = effort
    setEffort(val)
    try {
      await updateCardioEffort(workout.id, val)
    } catch {
      setEffort(prev)
    }
  }

  // Kartstil + slide-up-väljare — startar på användarens standardkarta
  const mapRef = useRef<MapView>(null)
  const [activeStyle, setActiveStyle] = useState('satellite')
  const [styleLoaded, setStyleLoaded] = useState(false)
  useEffect(() => {
    getDefaultMapStyle().then(k => {
      setActiveStyle(k === 'terrain' ? 'standard' : k)
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
    if (!APPLE_MAP_TYPES[key]) return
    setActiveStyle(key)
    closeStyleSheet()
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

  const stats: { label: string; value: string; color: string }[] = [
    { label: `Distans (${unitLabel})`, value: toDisplayDistance(distKm, unit).toFixed(2), color: CARDIO_BLUE },
    { label: 'Tid',                    value: fmtTime(dur),                            color: STAT_YELLOW },
    { label: `Snitt /${unitLabel}`,    value: fmtPace(avgPaceSec),                     color: STAT_TEAL },
    { label: 'Kcal',                   value: String(d.calories ?? 0),                    color: STAT_PINK },
  ]
  const splits = d.splits ?? []
  const fastestSplit = splits.length ? Math.min(...splits.map(sp => sp.paceSec)) : 0

  return (
    <View style={s.root}>
      {hasRoute && styleLoaded && (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          mapType={APPLE_MAP_TYPES[activeStyle] ?? 'standard'}
          userInterfaceStyle={activeStyle === 'dark' ? 'dark' : 'light'}
          showsCompass
          compassOffset={{ x: -6, y: insets.top + 52 }}
          onMapReady={() => {
            mapRef.current?.fitToCoordinates(
              route.map(([la, ln]) => ({ latitude: la, longitude: ln })),
              { edgePadding: { top: insets.top + 80, bottom: SCREEN_H - MID + 30, left: 50, right: 50 }, animated: false },
            )
          }}
        >
          <Polyline
            coordinates={route.map(([la, ln]) => ({ latitude: la, longitude: ln }))}
            strokeColor="#FC4C02"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
          <Marker coordinate={{ latitude: route[0][0], longitude: route[0][1] }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[s.routeDot, { backgroundColor: '#22C55E' }]} />
          </Marker>
          <Marker
            coordinate={{ latitude: route[route.length - 1][0], longitude: route[route.length - 1][1] }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[s.routeDot, { backgroundColor: '#EF4444' }]} />
          </Marker>
        </MapView>
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
                <Text style={[s.statValue, { color: st.color }]}>{st.value}</Text>
              </View>
            ))}
          </View>

          {splits.length > 0 && (
            <View style={s.splitsCard}>
              <Text style={s.splitsTitle}>Kilometersplittar</Text>
              {splits.map((sp, i) => (
                <View key={i} style={s.splitRow}>
                  <Text style={s.splitKm}>{sp.label}</Text>
                  <View style={s.splitBarTrack}>
                    <View style={[s.splitBar, { width: `${sp.paceSec > 0 ? Math.max(10, (fastestSplit / sp.paceSec) * 100) : 10}%` as never }]} />
                  </View>
                  <Text style={s.splitPace}>{fmtPace(sp.paceSec)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Ansträngning — Apple Fitness-stil, tryck för att sätta/ändra betyget */}
          <TouchableOpacity style={s.effortCard} activeOpacity={0.8} onPress={() => setEffortOpen(true)}>
            <View style={{ flex: 1 }}>
              <Text style={s.effortHeading}>Ansträngning</Text>
              {effort ? (
                <View style={s.effortValueRow}>
                  <View style={[s.effortCircle, { backgroundColor: effortColor(effort) }]}>
                    <Text style={s.effortCircleText}>{effort}</Text>
                  </View>
                  <Text style={[s.effortBigLabel, { color: effortColor(effort) }]}>{effortLabel(effort)}</Text>
                </View>
              ) : (
                <Text style={s.effortEmpty}>Tryck för att betygsätta</Text>
              )}
            </View>
            <EffortBars effort={effort ?? 0} color={effort ? effortColor(effort) : TEXT_SECONDARY} />
            <Ionicons name="chevron-forward" size={17} color={TEXT_SECONDARY} style={{ marginLeft: 10 }} />
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>

      {effortOpen && (
        <EffortRating visible initial={effort} onDone={handleEffortDone} />
      )}

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
                      <View style={[s.mapPreview, s.mapPreviewIcon]}>
                        <Ionicons name={ms.icon} size={26} color={active ? ORANGE : '#9BA0A6'} />
                      </View>
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
  effortCard: {
    backgroundColor: CARD, borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center',
  },
  effortHeading: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '500', opacity: 0.92 },
  effortValueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 7 },
  effortCircle: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  effortCircleText: { color: '#000', fontSize: 14, fontFamily: NUM_FONT },
  effortBigLabel: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  effortEmpty: { color: TEXT_SECONDARY, fontSize: 15, fontWeight: '600', marginTop: 7 },
  effortBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  effortBar: { width: 7, borderRadius: 3 },
  statCell: { width: '50%', gap: 3, alignItems: 'center' },
  statValue: { color: TEXT_PRIMARY, fontSize: 20, fontFamily: NUM_FONT, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  statLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  splitsCard: {
    backgroundColor: CARD, borderRadius: 20,
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
  mapPreviewIcon: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  routeDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: '#fff' },
  mapPreview: { width: '100%', height: 96, backgroundColor: '#2C2C2E' },
  mapCardLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9 },
  mapCardLabel: { color: '#ccc', fontSize: 13, fontWeight: '700' },
})
