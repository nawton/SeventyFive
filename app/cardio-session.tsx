import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getCardioWorkouts, type CardioWorkout } from '@/services/workouts'
import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { parseLocalDate } from '@/lib/date'

const CARDIO_BLUE = '#4AA8E0'

/** Egen slider: track + blå fyllnad + tumme, snäpper till steg med haptiskt tick */
function GoalSlider({ value, max, step, onChange }: {
  value: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  const [trackW, setTrackW] = useState(0)
  const last = useRef(value)
  useEffect(() => { last.current = value }, [value])

  function setFromX(x: number) {
    if (trackW <= 0) return
    const raw = (x / trackW) * max
    const v = Math.min(max, Math.max(0, Math.round(raw / step) * step))
    const rounded = Math.round(v * 10) / 10
    if (rounded !== last.current) {
      last.current = rounded
      Haptics.selectionAsync()
      onChange(rounded)
    }
  }

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(e => { runOnJS(setFromX)(e.x) })
    .onUpdate(e => { runOnJS(setFromX)(e.x) })

  const pct = max > 0 ? Math.min(1, value / max) : 0

  return (
    <GestureDetector gesture={pan}>
      <View style={sl.hit} onLayout={e => setTrackW(e.nativeEvent.layout.width)}>
        <View style={sl.track}>
          <View style={[sl.fill, { width: `${pct * 100}%` as never }]} />
        </View>
        <View style={[sl.thumb, { left: Math.max(0, Math.min(trackW - 22, pct * trackW - 11)) }]} />
      </View>
    </GestureDetector>
  )
}

const sl = StyleSheet.create({
  hit:   { alignSelf: 'stretch', height: 34, justifyContent: 'center', marginHorizontal: 16 },
  track: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  fill:  { height: '100%', backgroundColor: CARDIO_BLUE, borderRadius: 3 },
  thumb: {
    position: 'absolute', width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 2, borderColor: CARDIO_BLUE,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: 4, elevation: 4,
  },
})

const TYPE_META: Record<string, { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  running:  { label: 'Löpning',    icon: 'fitness-outline' },
  cycling:  { label: 'Cykling',    icon: 'bicycle-outline' },
  walking:  { label: 'Promenad',   icon: 'walk-outline' },
  interval: { label: 'Intervaller', icon: 'flash-outline' },
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function CardioSessionScreen() {
  const params = useLocalSearchParams<{
    sessionId?: string
    name?: string
    cardioType?: string
    notes?: string
    date?: string
  }>()
  const type = params.cardioType ?? 'running'
  const meta = TYPE_META[type] ?? TYPE_META.running

  const [goalKm, setGoalKm]   = useState(0)
  const [goalMin, setGoalMin] = useState(0)
  const [last, setLast]       = useState<CardioWorkout | null>(null)

  useEffect(() => {
    async function loadLast() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const workouts = await getCardioWorkouts(session.user.id, 100).catch(() => [])
      setLast(workouts.find(w => w.data.type === type) ?? null)
    }
    loadLast()
  }, [type])

  const dateLabel = params.date
    ? parseLocalDate(params.date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

  const KM_PRESETS  = [3, 5, 10]
  const MIN_PRESETS = [20, 30, 60]

  function handleStart() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.replace({
      pathname: '/cardio',
      params: {
        name: type,
        ...(params.sessionId ? { sessionId: params.sessionId, sessionDate: params.date } : {}),
        ...(goalKm > 0 ? { goalKm: String(goalKm) } : {}),
        ...(goalMin > 0 ? { goalMin: String(goalMin) } : {}),
      },
    })
  }

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Topp: tillbaka + datum ── */}
        <View style={s.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
          </TouchableOpacity>
          {dateLabel && <Text style={s.dateLabel}>{dateLabel}</Text>}
          <View style={{ width: 40 }} />
        </View>

        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Ionicons name={meta.icon} size={34} color={CARDIO_BLUE} />
          </View>
          <Text style={s.heroTitle}>{params.name ?? meta.label}</Text>
          <View style={s.heroMetaRow}>
            <View style={s.typePill}>
              <Text style={s.typePillText}>{meta.label.toUpperCase()}</Text>
            </View>
            {!!params.notes && <Text style={s.heroNotes}>{params.notes}</Text>}
          </View>
        </View>

        {/* ── Mål för passet: två stora tiles ── */}
        <Text style={s.sectionTitle}>MÅL FÖR PASSET</Text>
        <View style={s.goalTiles}>
          <View style={[s.goalTile, goalKm > 0 && s.goalTileActive]}>
            <Text style={s.goalTileLabel}>DISTANS</Text>
            <TouchableOpacity onPress={() => { if (goalKm > 0) { Haptics.selectionAsync(); setGoalKm(0) } }} activeOpacity={0.7}>
              <Text style={[s.goalTileValue, goalKm > 0 && { color: CARDIO_BLUE }]}>
                {goalKm > 0 ? goalKm.toFixed(1).replace('.', ',') : '—'}
              </Text>
              <Text style={s.goalTileUnit}>km</Text>
            </TouchableOpacity>
            <View style={s.presetRow}>
              {KM_PRESETS.map(km => (
                <TouchableOpacity
                  key={km}
                  style={[s.presetChip, goalKm === km && s.presetChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setGoalKm(goalKm === km ? 0 : km) }}
                  activeOpacity={0.75}
                >
                  <Text style={[s.presetText, goalKm === km && s.presetTextActive]}>{km}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <GoalSlider value={goalKm} max={15} step={0.5} onChange={setGoalKm} />
          </View>

          <View style={[s.goalTile, goalMin > 0 && s.goalTileActive]}>
            <Text style={s.goalTileLabel}>TID</Text>
            <TouchableOpacity onPress={() => { if (goalMin > 0) { Haptics.selectionAsync(); setGoalMin(0) } }} activeOpacity={0.7}>
              <Text style={[s.goalTileValue, goalMin > 0 && { color: CARDIO_BLUE }]}>
                {goalMin > 0 ? goalMin : '—'}
              </Text>
              <Text style={s.goalTileUnit}>min</Text>
            </TouchableOpacity>
            <View style={s.presetRow}>
              {MIN_PRESETS.map(min => (
                <TouchableOpacity
                  key={min}
                  style={[s.presetChip, goalMin === min && s.presetChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setGoalMin(goalMin === min ? 0 : min) }}
                  activeOpacity={0.75}
                >
                  <Text style={[s.presetText, goalMin === min && s.presetTextActive]}>{min}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <GoalSlider value={goalMin} max={90} step={5} onChange={setGoalMin} />
          </View>
        </View>
        <Text style={s.goalHint}>
          {goalKm > 0 || goalMin > 0
            ? 'Målet visas live under passet · tryck på siffran för att rensa'
            : 'Valfritt — välj ett förval eller dra i reglaget för att sätta ett mål'}
        </Text>

        {/* ── Senast ── */}
        <Text style={s.sectionTitle}>SENAST DU {meta.label === 'Cykling' ? 'CYKLADE' : meta.label === 'Promenad' ? 'PROMENERADE' : 'SPRANG'}</Text>
        <View style={s.card}>
          {last ? (
            <View style={s.lastRow}>
              <View style={s.lastStat}>
                <Text style={s.lastValue}>{last.data.distance_km.toFixed(2)}</Text>
                <Text style={s.lastLabel}>km</Text>
              </View>
              <View style={s.lastDivider} />
              <View style={s.lastStat}>
                <Text style={s.lastValue}>{fmtTime(last.data.duration_seconds)}</Text>
                <Text style={s.lastLabel}>tid</Text>
              </View>
              <View style={s.lastDivider} />
              <View style={s.lastStat}>
                <Text style={s.lastValue}>
                  {last.data.distance_km > 0.1 ? fmtTime(Math.round(last.data.duration_seconds / last.data.distance_km)) : '--:--'}
                </Text>
                <Text style={s.lastLabel}>/km</Text>
              </View>
            </View>
          ) : (
            <Text style={s.lastEmpty}>Inget tidigare pass av den här typen — dags att sätta ribban!</Text>
          )}
        </View>

        {/* ── Poäng-hint ── */}
        <View style={s.pointsRow}>
          <Ionicons name="star-outline" size={14} color={CARDIO_BLUE} />
          <Text style={s.pointsText}>GPS-spårat pass ger 30 p · max 1 per dag</Text>
        </View>

      </ScrollView>

      {/* ── Starta — fastnålad ── */}
      <View style={s.startWrap} pointerEvents="box-none">
        <TouchableOpacity style={s.startBtn} onPress={handleStart} activeOpacity={0.9}>
          <Ionicons name="play" size={18} color="#fff" />
          <Text style={s.startBtnText}>Starta {meta.label.toLowerCase()}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  scroll: { padding: 20, paddingTop: 8, paddingBottom: 120, gap: 10 },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  dateLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },

  hero: { alignItems: 'center', gap: 10, paddingVertical: 14 },
  heroIcon: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: CARDIO_BLUE + '1C',
    borderWidth: 1.5, borderColor: CARDIO_BLUE + '50',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle:   { color: TEXT_PRIMARY, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typePill: {
    backgroundColor: CARDIO_BLUE + '1C', borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  typePillText: { color: CARDIO_BLUE, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heroNotes:    { color: TEXT_SECONDARY, fontSize: 14 },

  sectionTitle: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginTop: 8,
  },
  card: {
    backgroundColor: CARD, borderRadius: 18,
    borderWidth: 1, borderColor: BORDER,
    padding: 16, gap: 12,
  },

  goalTiles: { flexDirection: 'row', gap: 12 },
  goalTile: {
    flex: 1, alignItems: 'center', gap: 8,
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1.5, borderColor: BORDER,
    paddingVertical: 18,
  },
  goalTileActive: { borderColor: CARDIO_BLUE + '70', backgroundColor: CARDIO_BLUE + '0C' },
  goalTileLabel:  { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  goalTileValue:  { color: TEXT_SECONDARY, fontSize: 38, fontWeight: '800', textAlign: 'center', lineHeight: 42 },
  goalTileUnit:   { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', marginTop: -2 },
  presetRow: { flexDirection: 'row', gap: 6 },
  presetChip: {
    minWidth: 34, alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 14,
    borderWidth: 1.5, borderColor: BORDER,
  },
  presetChipActive: { borderColor: CARDIO_BLUE, backgroundColor: CARDIO_BLUE + '1C' },
  presetText:       { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '700' },
  presetTextActive: { color: CARDIO_BLUE },

  goalHint: { color: TEXT_SECONDARY, fontSize: 12, lineHeight: 17, textAlign: 'center' },

  lastRow:     { flexDirection: 'row', alignItems: 'center' },
  lastStat:    { flex: 1, alignItems: 'center', gap: 2 },
  lastValue:   { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800' },
  lastLabel:   { color: TEXT_SECONDARY, fontSize: 11 },
  lastDivider: { width: 1, height: 30, backgroundColor: BORDER },
  lastEmpty:   { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 19, textAlign: 'center' },

  pointsRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 2 },
  pointsText: { color: TEXT_SECONDARY, fontSize: 12 },

  startWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 24,
    paddingHorizontal: 20,
  },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: CARDIO_BLUE, borderRadius: 28, paddingVertical: 16,
    shadowColor: CARDIO_BLUE, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
