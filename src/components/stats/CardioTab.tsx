// CARDIO-fliken på Framsteg: periodfilter med bläddring, nyckeltal,
// tempo- och distansgrafer, rekordkort och sessionslistan — med sina
// detaljmodaler. Skalet (stats.tsx) äger rådatan och skickar in den.
import { useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import Animated, { LinearTransition, FadeOut } from 'react-native-reanimated'
import Svg, { Line as SvgLine, Polyline, Circle } from 'react-native-svg'
import { BG, CARD, ORANGE, GREEN, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { toLocalDateString, parseLocalDate, startOfWeek, weekdayOf, isoWeekNum } from '@/lib/date'
import { fmtPace, fmtDuration } from '@/lib/format'
import { toDisplayDistance, distanceUnitLabel, paceForUnit, type UnitSystem } from '@/lib/units'
import { effortColor } from '@/components/EffortRating'
import { GlassSegment } from '@/components/GlassSegment'
import { GlassCircleButton } from '@/components/GlassButton'
import type { CardioWorkout } from '@/services/workouts'
import type { CompletedSessionItem } from '@/services/workoutSchedule'
import {
  GRID_PADDING, STATS_SCREEN_W, BLUE, RED, YELLOW, PURPLE, TEAL, LIME,
  monthLabel, sessDateLabel, s,
} from './statsShared'
import { SwipeRow } from './SwipeRow'
import { DistanceDetailModal } from './DistanceDetailModal'
import { DistanceAreaChart } from './DistanceAreaChart'

interface WeekBar {
  label:     string
  run:       number
  cycle:     number
  walk:      number
  total:     number
  isCurrent: boolean
  /** Snittempo (sek/km) för veckans pass med distans — 0 om inget */
  paceSec:   number
  pacedKm:   number
  pacedSecs: number
}

function buildWeeklyBars(workouts: CardioWorkout[]): WeekBar[] {
  const todayMon = toLocalDateString(startOfWeek())

  const byWeek = new Map<string, WeekBar>()

  for (const w of workouts) {
    const mon = startOfWeek(new Date(w.created_at))
    const key = toLocalDateString(mon)

    if (!byWeek.has(key)) {
      // ISO week number
      const jan4 = new Date(mon.getFullYear(), 0, 4)
      const wn = Math.ceil(
        (((mon.getTime() - jan4.getTime()) / 86400000) + weekdayOf(jan4) - 1) / 7,
      )
      byWeek.set(key, {
        label: `V${wn}`,
        run: 0, cycle: 0, walk: 0, total: 0,
        isCurrent: key === todayMon,
        paceSec: 0, pacedKm: 0, pacedSecs: 0,
      })
    }
    const entry = byWeek.get(key)!
    const km   = w.data.distance_km
    const type = w.data.type ?? 'running'
    if (type === 'cycling')       entry.cycle += km
    else if (type === 'walking')  entry.walk  += km
    else                          entry.run   += km
    entry.total += km
    if (km > 0.1) {
      entry.pacedKm   += km
      entry.pacedSecs += w.data.duration_seconds
    }
  }

  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([, v]) => ({ ...v, paceSec: v.pacedKm > 0 ? v.pacedSecs / v.pacedKm : 0 }))
}

export function CardioTab({
  workouts, completedSessions, unit,
  pagerRef, onTabScroll, onTabScrollEnd,
  onOpenWorkout, onDeleteWorkout, onDeleteCompletion,
}: {
  workouts: CardioWorkout[]
  completedSessions: CompletedSessionItem[]
  unit: UnitSystem
  /** Radsvepen måste blockera flik-pagern */
  pagerRef: React.RefObject<unknown>
  onTabScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => void
  onTabScrollEnd: () => void
  onOpenWorkout: (w: CardioWorkout) => void
  onDeleteWorkout: (id: string) => void
  onDeleteCompletion: (id: string) => void
}) {
  const insets = useSafeAreaInsets()
  const unitLabel = distanceUnitLabel(unit)

  const [cardioRange, setCardioRange]           = useState<'week' | 'month' | 'all'>('all')
  const [cardioOffset, setCardioOffset]         = useState(0)
  const [cardioDetailsOpen, setCardioDetailsOpen] = useState(false)
  const [distDetailOpen, setDistDetailOpen]     = useState(false)

  // Optimistisk radering — skalet äger listorna och databasanropen
  function performDeleteSessionRow(r: { key: string; name: string; workout?: CardioWorkout }) {
    if (r.workout) onDeleteWorkout(r.workout.id)
    else if (r.key.startsWith('g:')) onDeleteCompletion(r.key.slice(2))
  }

  // Periodfilter för cardio-fliken: kalendervecka / kalendermånad / totalt,
  // med pilbläddring bakåt precis som på gympass-fliken
  const cardioBounds = (() => {
    if (cardioRange === 'week') {
      const mon = startOfWeek()
      mon.setDate(mon.getDate() + cardioOffset * 7)
      const end = new Date(mon); end.setDate(end.getDate() + 7)
      const sun = new Date(mon); sun.setDate(sun.getDate() + 6)
      const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '')
      return {
        start: toLocalDateString(mon) as string | null,
        end: toLocalDateString(end) as string | null,
        label: cardioOffset === 0 ? 'Denna vecka' : `${fmt(mon)} till ${fmt(sun)}`,
      }
    }
    if (cardioRange === 'month') {
      const now = new Date()
      const first = new Date(now.getFullYear(), now.getMonth() + cardioOffset, 1)
      const next  = new Date(first.getFullYear(), first.getMonth() + 1, 1)
      return {
        start: toLocalDateString(first) as string | null,
        end: toLocalDateString(next) as string | null,
        label: cardioOffset === 0
          ? 'Denna månad'
          : first.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' }),
      }
    }
    return { start: null as string | null, end: null as string | null, label: 'Hela historiken' }
  })()
  const cardioW = useMemo(() => workouts.filter(w => {
    const d = toLocalDateString(new Date(w.created_at))
    return (cardioBounds.start === null || d >= cardioBounds.start)
      && (cardioBounds.end === null || d < cardioBounds.end)
  }), [workouts, cardioBounds.start, cardioBounds.end])

  // Snittansträngning (RPE) och aktiva dagar för perioden
  const effortVals = cardioW
    .map(w => w.data.effort)
    .filter((e): e is number => typeof e === 'number' && e >= 1)
  const avgEffort = effortVals.length ? effortVals.reduce((a, b) => a + b, 0) / effortVals.length : 0
  const activeCardioDays = new Set(cardioW.map(w => toLocalDateString(new Date(w.created_at)))).size

  const totalKm    = cardioW.reduce((sum, w) => sum + w.data.distance_km, 0)
  const totalSecs  = cardioW.reduce((sum, w) => sum + w.data.duration_seconds, 0)
  const totalCals  = cardioW.reduce((sum, w) => sum + w.data.calories, 0)
  const pacedW     = cardioW.filter(w => w.data.distance_km > 0.1)
  const bestPaceSec = pacedW
    .map(w => w.data.duration_seconds / w.data.distance_km)
    .reduce((b, p) => p < b ? p : b, Infinity)
  const pacedKm    = pacedW.reduce((s, w) => s + w.data.distance_km, 0)
  const pacedSecs  = pacedW.reduce((s, w) => s + w.data.duration_seconds, 0)
  // Tempo per vald enhet (sek/km → sek/mi vid imperial)
  const avgPace    = pacedKm > 0 ? fmtPace(paceForUnit(pacedSecs / pacedKm, unit)) : '--:--'
  const bestPace   = bestPaceSec === Infinity ? '--:--' : fmtPace(paceForUnit(bestPaceSec, unit))

  // Tempoutvecklingen räknas alltid på ALLA pass, oavsett periodfilter
  const weeklyBars  = useMemo(() => buildWeeklyBars(workouts), [workouts])

  // Extra periodstatistik till Träningsdetaljer
  const avgDistKm      = cardioW.length ? totalKm / cardioW.length : 0
  const longestPassKm  = cardioW.reduce((b, w) => Math.max(b, w.data.distance_km), 0)

  // ── Distansgraf: staplar per dag/vecka/månad beroende på periodfiltret ──
  type DistBucket = { key: string; label: string; run: number; cycle: number; walk: number; total: number; isCurrent: boolean }
  const distBuckets: DistBucket[] = useMemo(() => {
    const catOf = (t: string) => t === 'cycling' ? 'cycle' as const : t === 'walking' ? 'walk' as const : 'run' as const
    const add = (buckets: DistBucket[], key: string, w: CardioWorkout) => {
      const b = buckets.find(x => x.key === key)
      if (!b) return
      b[catOf(w.data.type ?? 'running')] += w.data.distance_km
      b.total += w.data.distance_km
    }
    if (cardioRange === 'week') {
      // Den valda kalenderveckans sju dagar
      const start = parseLocalDate(cardioBounds.start!)
      const today = toLocalDateString(new Date())
      const buckets = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start); d.setDate(d.getDate() + i)
        const key = toLocalDateString(d)
        return { key, label: ['M', 'T', 'O', 'T', 'F', 'L', 'S'][i], run: 0, cycle: 0, walk: 0, total: 0, isCurrent: key === today }
      })
      workouts.forEach(w => add(buckets, toLocalDateString(new Date(w.created_at)), w))
      return buckets
    }
    if (cardioRange === 'month') {
      // Den valda kalendermånadens veckor
      const thisMon = toLocalDateString(startOfWeek())
      const buckets: DistBucket[] = []
      const mon = startOfWeek(parseLocalDate(cardioBounds.start!))
      while (toLocalDateString(mon) < cardioBounds.end!) {
        const key = toLocalDateString(mon)
        buckets.push({ key, label: `V${isoWeekNum(mon)}`, run: 0, cycle: 0, walk: 0, total: 0, isCurrent: key === thisMon })
        mon.setDate(mon.getDate() + 7)
      }
      workouts.forEach(w => add(buckets, toLocalDateString(startOfWeek(new Date(w.created_at))), w))
      return buckets
    }
    const now = new Date()
    const buckets = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', ''),
        run: 0, cycle: 0, walk: 0, total: 0, isCurrent: i === 5,
      }
    })
    workouts.forEach(w => {
      const d = new Date(w.created_at)
      add(buckets, `${d.getFullYear()}-${d.getMonth()}`, w)
    })
    return buckets
  }, [workouts, cardioRange, cardioBounds.start, cardioBounds.end])

  // ── Cardiorekord (all-time) — vi sparar även PASSET bakom varje rekord så
  // korten kan öppna det direkt ──
  const allPaced = workouts.filter(w => w.data.distance_km > 0.1)
  const recLongestW = workouts.reduce<CardioWorkout | null>(
    (b, w) => w.data.distance_km > (b?.data.distance_km ?? 0) ? w : b, null)
  const recLongestKm = recLongestW?.data.distance_km ?? 0
  const recBestPaceW = allPaced.reduce<CardioWorkout | null>((b, w) => {
    const p  = w.data.duration_seconds / w.data.distance_km
    const bp = b ? b.data.duration_seconds / b.data.distance_km : Infinity
    return p < bp ? w : b
  }, null)
  const recBestPaceSec = recBestPaceW
    ? recBestPaceW.data.duration_seconds / recBestPaceW.data.distance_km
    : Infinity
  // Snabbaste hela km från sparade splits ("1 km", "2 km" …)
  let recFastestSplitSec = Infinity
  let recFastestSplitW: CardioWorkout | null = null
  for (const w of workouts) {
    for (const sp of w.data.splits ?? []) {
      if (/^\d+\s*(km|mi)$/.test(sp.label) && sp.paceSec > 0 && sp.paceSec < recFastestSplitSec) {
        recFastestSplitSec = sp.paceSec
        recFastestSplitW = w
      }
    }
  }
  const { recBiggestWeek, recBiggestWeekW } = (() => {
    const byWeek = new Map<string, number>()
    for (const w of workouts) {
      const key = toLocalDateString(startOfWeek(new Date(w.created_at)))
      byWeek.set(key, (byWeek.get(key) ?? 0) + w.data.distance_km)
    }
    let max = 0, maxKey = ''
    byWeek.forEach((v, k) => { if (v > max) { max = v; maxKey = k } })
    // Längsta passet under rekordveckan blir kortets mål
    const inWeek = workouts.filter(w => toLocalDateString(startOfWeek(new Date(w.created_at))) === maxKey)
    const best = inWeek.reduce<CardioWorkout | null>(
      (b, w) => w.data.distance_km > (b?.data.distance_km ?? 0) ? w : b, null)
    return { recBiggestWeek: max, recBiggestWeekW: best }
  })()
  const hasRecords = workouts.length > 0

  // ── Tempoutveckling: veckosnitt (endast veckor med distanspass) ──
  const paceWeeks = weeklyBars.filter(b => b.paceSec > 0)
  const paceVals  = paceWeeks.map(b => paceForUnit(b.paceSec, unit))

  // ── Sessioner: blandad lista av cardio-pass + avklarade schemapass ──
  const CARDIO_META: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
    running:  { icon: 'fitness',  color: ORANGE },
    cycling:  { icon: 'bicycle',  color: BLUE },
    walking:  { icon: 'walk',     color: GREEN },
    interval: { icon: 'flash',    color: YELLOW },
  }
  type SessRow = {
    key: string
    name: string
    value: string
    icon: React.ComponentProps<typeof Ionicons>['name']
    color: string
    sortKey: number
    dateStr: string
    workout?: CardioWorkout
  }
  const sessionRows: SessRow[] = useMemo(() => [
    ...cardioW.map((w): SessRow => {
      const meta = CARDIO_META[w.data.type] ?? { icon: 'fitness' as const, color: ORANGE }
      return {
        key: `c:${w.id}`,
        name: w.name,
        // Alltid distans — aldrig tid — som stort värde
        value: `${toDisplayDistance(w.data.distance_km, unit).toFixed(2).replace('.', ',')} ${unitLabel.toUpperCase()}`,
        icon: meta.icon,
        color: meta.color,
        sortKey: new Date(w.created_at).getTime(),
        dateStr: toLocalDateString(new Date(w.created_at)),
        workout: w,
      }
    }),
    // GPS-loggade cardiopass ligger redan i user_workouts — här tar vi bara
    // manuellt avbockade cardiopass (utan sparad distans) från schemat
    ...completedSessions
      .filter(c =>
        c.sessionType === 'cardio' && c.distanceKm == null &&
        (cardioBounds.start === null || c.completedDate >= cardioBounds.start) &&
        (cardioBounds.end === null || c.completedDate < cardioBounds.end))
      .map((c): SessRow => {
        const meta = CARDIO_META[c.cardioType ?? ''] ?? { icon: 'fitness' as const, color: BLUE }
        return {
          key: `g:${c.id}`,
          name: c.name,
          value: 'Klart',
          icon: meta.icon,
          color: meta.color,
          sortKey: new Date(`${c.completedDate}T12:00:00`).getTime(),
          dateStr: c.completedDate,
        }
      }),
  ].sort((a, b) => b.sortKey - a.sortKey).slice(0, 30),
  [cardioW, completedSessions, unit, unitLabel, cardioBounds.start, cardioBounds.end])

  return (
    <>
        <ScrollView
          style={{ width: STATS_SCREEN_W }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          onScroll={onTabScroll}
          onScrollEndDrag={onTabScrollEnd}
          scrollEventThrottle={16}
        >
          {workouts.length === 0 ? (
            <View style={s.tabEmpty}>
              <View style={s.tabEmptyIcon}><Ionicons name="walk-outline" size={30} color={ORANGE} /></View>
              <Text style={s.tabEmptyTitle}>Inget cardio ännu</Text>
              <Text style={s.tabEmptyText}>
                Starta ett GPS-pass från schemat så vaknar statistiken: distans, tempo, grafer och rekord.
              </Text>
              <TouchableOpacity style={s.tabEmptyBtn} activeOpacity={0.85} onPress={() => router.push('/(app)/add')}>
                <Text style={s.tabEmptyBtnText}>Till schemat</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <>
            {/* Periodfilter — dragbar glasslider som i Anpassning */}
            <GlassSegment
              value={cardioRange}
              options={[
                { key: 'week',  label: 'Vecka' },
                { key: 'month', label: 'Månad' },
                { key: 'all',   label: 'Totalt' },
              ]}
              onChange={k => { setCardioRange(k); setCardioOffset(0) }}
            />

            {/* Bläddra bakåt i tiden — samma pilar som på gympass-fliken */}
            {cardioRange !== 'all' && (
              <View style={s.weekNav}>
                <TouchableOpacity style={s.weekNavBtn} onPress={() => setCardioOffset(o => o - 1)} activeOpacity={0.7}>
                  <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
                </TouchableOpacity>
                <Text style={s.weekNavLabel}>{cardioBounds.label}</Text>
                <TouchableOpacity
                  style={s.weekNavBtn}
                  onPress={() => setCardioOffset(o => o + 1)}
                  disabled={cardioOffset >= 0}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-forward" size={20} color={cardioOffset >= 0 ? 'rgba(255,255,255,0.18)' : TEXT_PRIMARY} />
                </TouchableOpacity>
              </View>
            )}

            {/* Träningsdetaljer — kompakt på fliken, tryck för alla detaljer */}
            <View style={s.sectionHeadRow}>
              <Text style={[s.sectionHead, s.sectionHeadInline]}>Träningsdetaljer</Text>
              <Ionicons name="chevron-forward" size={19} color={TEXT_SECONDARY} />
            </View>
            <TouchableOpacity
              style={[s.card, s.cardPlain]}
              activeOpacity={0.85}
              onPress={() => setCardioDetailsOpen(true)}
            >
              <View style={[s.dtlRow, { paddingTop: 0 }]}>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Träningstid</Text>
                  <Text style={[s.dtlVal, { color: YELLOW }]}>{fmtDuration(totalSecs)}</Text>
                </View>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Distans</Text>
                  <Text style={[s.dtlVal, { color: BLUE }]}>
                    {toDisplayDistance(totalKm, unit).toFixed(2).replace('.', ',')}
                    <Text style={s.dtlUnit}> {unitLabel.toUpperCase()}</Text>
                  </Text>
                </View>
              </View>
              <View style={s.dtlSep} />
              <View style={[s.dtlRow, { paddingBottom: 0 }]}>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Antal pass</Text>
                  <Text style={[s.dtlVal, { color: GREEN }]}>{cardioW.length}</Text>
                </View>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Snittempo</Text>
                  <Text style={[s.dtlVal, { color: TEAL }]}>
                    {avgPace}
                    <Text style={s.dtlUnit}> /{unitLabel}</Text>
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Tempoutveckling */}
            {paceWeeks.length >= 2 && (() => {
              const CH_W = STATS_SCREEN_W - 84
              const CH_H = 120
              const minV = Math.min(...paceVals)
              const maxV = Math.max(...paceVals)
              const span = Math.max(maxV - minV, 1)
              const px = (i: number) =>
                paceWeeks.length === 1 ? CH_W / 2 : (i / (paceWeeks.length - 1)) * (CH_W - 16) + 8
              // Lägre tempo = bättre → snabbast överst
              const py = (v: number) => 12 + ((v - minV) / span) * (CH_H - 24)
              const pts = paceVals.map((v, i) => `${px(i)},${py(v)}`).join(' ')
              return (
                <>
                <View style={s.sectionHeadRow}>
                  <Text style={[s.sectionHead, s.sectionHeadInline]}>Tempoutveckling</Text>
                  <Ionicons name="chevron-forward" size={19} color={TEXT_SECONDARY} />
                </View>
                <TouchableOpacity
                  style={[s.card, s.cardPlain]}
                  activeOpacity={0.85}
                  onPress={() => setCardioDetailsOpen(true)}
                >
                  <Text style={[s.cardSub, { marginTop: 0 }]}>snitt min/{unitLabel} per vecka · snabbare är högre upp</Text>
                  <View style={s.paceChartRow}>
                    <View style={s.paceAxis}>
                      <Text style={s.paceAxisLbl}>{fmtPace(minV)}</Text>
                      <Text style={s.paceAxisLbl}>{fmtPace(maxV)}</Text>
                    </View>
                    <Svg width={CH_W} height={CH_H}>
                      {[0.25, 0.5, 0.75].map(f => (
                        <SvgLine
                          key={f}
                          x1={0} x2={CH_W}
                          y1={12 + f * (CH_H - 24)} y2={12 + f * (CH_H - 24)}
                          stroke="rgba(255,255,255,0.06)" strokeWidth={1}
                        />
                      ))}
                      <Polyline points={pts} fill="none" stroke={BLUE} strokeWidth={2.5} strokeLinejoin="round" />
                      {paceVals.map((v, i) => (
                        <Circle key={i} cx={px(i)} cy={py(v)} r={4} fill={BLUE} stroke={CARD} strokeWidth={2} />
                      ))}
                    </Svg>
                  </View>
                  <View style={s.paceWeekRow}>
                    {paceWeeks.map((b, i) => (
                      <Text key={i} style={[s.paceWeekLbl, b.isCurrent && { color: BLUE }]}>{b.label}</Text>
                    ))}
                  </View>
                </TouchableOpacity>
                </>
              )
            })()}

            {/* Distansgraf — linje med fylld yta och adaptiv skala; tryck för detaljvyn
                (fördelningen per aktivitet bor därinne) */}
            {distBuckets.some(b => b.total > 0) && (
              <>
              <View style={s.sectionHeadRow}>
                <Text style={[s.sectionHead, s.sectionHeadInline]}>Distans</Text>
                <Ionicons name="chevron-forward" size={19} color={TEXT_SECONDARY} />
              </View>
              <TouchableOpacity
                style={[s.card, s.cardPlain]}
                activeOpacity={0.85}
                onPress={() => setDistDetailOpen(true)}
              >
                <Text style={[s.cardSub, { marginTop: 0 }]}>
                  {unitLabel} {cardioRange === 'week' ? 'per dag, vald vecka' : cardioRange === 'month' ? 'per vecka, vald månad' : 'per månad, senaste 6 månaderna'}
                </Text>
                <DistanceAreaChart
                  buckets={distBuckets}
                  width={STATS_SCREEN_W - 80}
                  height={170}
                  unit={unit}
                />
              </TouchableOpacity>
              </>
            )}

            {/* Cardiorekord (all-time) — lista med ikon, etikett och färgat värde */}
            {hasRecords && (
              <>
              <Text style={s.sectionHead}>Cardiorekord</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -GRID_PADDING }}
                contentContainerStyle={s.recScroll}
              >
                {([
                  {
                    icon: 'map-outline' as const, color: ORANGE, label: 'Längsta pass',
                    value: recLongestKm > 0 ? `${toDisplayDistance(recLongestKm, unit).toFixed(2)} ${unitLabel}` : '–',
                    workout: recLongestW,
                  },
                  {
                    icon: 'flash-outline' as const, color: YELLOW, label: 'Snabbaste km',
                    value: recFastestSplitSec === Infinity ? '–' : fmtPace(recFastestSplitSec),
                    workout: recFastestSplitW,
                  },
                  {
                    icon: 'stopwatch-outline' as const, color: RED, label: `Bästa tempo /${unitLabel}`,
                    value: recBestPaceSec === Infinity ? '–' : fmtPace(paceForUnit(recBestPaceSec, unit)),
                    workout: recBestPaceW,
                  },
                  {
                    icon: 'trending-up-outline' as const, color: GREEN, label: 'Längsta vecka',
                    value: recBiggestWeek > 0 ? `${toDisplayDistance(recBiggestWeek, unit).toFixed(1)} ${unitLabel}` : '–',
                    workout: recBiggestWeekW,
                  },
                ]).map(r => (
                  <TouchableOpacity
                    key={r.label}
                    style={s.recCard}
                    activeOpacity={0.75}
                    disabled={!r.workout}
                    onPress={() => r.workout && onOpenWorkout(r.workout)}
                  >
                    <View style={s.recCardTop}>
                      <View style={[s.recIconWrap, { backgroundColor: r.color + '1A' }]}>
                        <Ionicons name={r.icon} size={16} color={r.color} />
                      </View>
                      {r.workout && <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.28)" />}
                    </View>
                    <Text style={[s.recCardVal, { color: r.color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {r.value}
                    </Text>
                    <Text style={s.recCardLbl} numberOfLines={2}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              </>
            )}

            {/* Sessioner — blandad lista i Apple Fitness-stil */}
            {sessionRows.length > 0 ? (
              <View style={{ gap: 10 }}>
                <Text style={[s.sectionHead, { marginBottom: -14 }]}>Sessioner</Text>
                {sessionRows.map((r, i) => {
                  const m = monthLabel(r.dateStr)
                  const showMonth = i === 0 || monthLabel(sessionRows[i - 1].dateStr) !== m
                  return (
                    <Animated.View
                      key={r.key}
                      style={{ gap: 10 }}
                      layout={LinearTransition.duration(220)}
                      exiting={FadeOut.duration(160)}
                    >
                      {showMonth && <Text style={s.sessMonth}>{m}</Text>}
                      <SwipeRow
                        name={r.name}
                        onDelete={() => performDeleteSessionRow(r)}
                        pagerRef={pagerRef}
                      >
                        <TouchableOpacity
                          style={s.sessRow}
                          activeOpacity={0.7}
                          onPress={r.workout ? () => onOpenWorkout(r.workout!) : undefined}
                          disabled={!r.workout}
                        >
                          <View style={[s.sessIcon, { backgroundColor: r.color + '1E' }]}>
                            <Ionicons name={r.icon} size={20} color={r.color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.sessName} numberOfLines={1}>{r.name}</Text>
                            <Text style={s.sessValue}>{r.value}</Text>
                          </View>
                          <Text style={s.sessDate}>{sessDateLabel(r.dateStr)}</Text>
                        </TouchableOpacity>
                      </SwipeRow>
                    </Animated.View>
                  )
                })}
              </View>
            ) : (
              <View style={s.empty}>
                <Ionicons name="walk-outline" size={40} color="rgba(255,255,255,0.12)" />
                <Text style={s.emptyText}>
                  {workouts.length === 0 ? 'Inga pass sparade ännu' : 'Inga pass under vald period'}
                </Text>
              </View>
            )}
          </>
          )}
        </ScrollView>

      <DistanceDetailModal
        visible={distDetailOpen}
        onClose={() => setDistDetailOpen(false)}
        workouts={workouts}
        unit={unit}
      />
      {/* Alla cardiodetaljer för vald period */}
      <Modal visible={cardioDetailsOpen} animationType="slide" onRequestClose={() => setCardioDetailsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: BG }}>
          <View style={[s.modalTopBar, { paddingTop: insets.top + 8 }]}>
            <GlassCircleButton icon="chevron-back" onPress={() => setCardioDetailsOpen(false)} />
            <Text style={s.modalTopTitle}>Träningsdetaljer</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <Text style={s.sessionsWeekLabel}>{cardioBounds.label}</Text>
            <View style={[s.card, s.cardPlain, { marginTop: 12, paddingVertical: 4 }]}>
              {([
                { label: 'Träningstid', value: fmtDuration(totalSecs), color: YELLOW },
                { label: 'Distans', value: `${toDisplayDistance(totalKm, unit).toFixed(2).replace('.', ',')} ${unitLabel}`, color: BLUE },
                { label: 'Kilokalorier', value: `${totalCals.toLocaleString('sv-SE')} kcal`, color: RED },
                { label: 'Antal pass', value: String(cardioW.length), color: GREEN },
                { label: 'Aktiva dagar', value: String(activeCardioDays), color: TEXT_PRIMARY },
                { label: 'Snittempo', value: `${avgPace} /${unitLabel}`, color: TEAL },
                { label: 'Bästa tempo', value: `${bestPace} /${unitLabel}`, color: PURPLE },
                { label: 'Snittdistans', value: `${toDisplayDistance(avgDistKm, unit).toFixed(2).replace('.', ',')} ${unitLabel}`, color: LIME },
                { label: 'Längsta pass', value: `${toDisplayDistance(longestPassKm, unit).toFixed(2).replace('.', ',')} ${unitLabel}`, color: ORANGE },
                {
                  label: 'Snittansträngning',
                  value: avgEffort > 0 ? `${avgEffort.toFixed(1).replace('.', ',')} / 10` : '–',
                  color: avgEffort > 0 ? effortColor(Math.round(avgEffort)) : TEXT_SECONDARY,
                },
              ]).map((r, i) => (
                <View key={r.label} style={[s.cdRow, i > 0 && s.cdRowBorder]}>
                  <Text style={s.cdLbl}>{r.label}</Text>
                  <Text style={[s.cdVal, { color: r.color }]}>{r.value}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  )
}
