// CARDIO-fliken på Framsteg: periodfilter med bläddring, nyckeltal,
// tempo- och distansgrafer, rekordkort och sessionslistan — med sina
// detaljmodaler. Skalet (stats.tsx) äger rådatan och skickar in den.
import { useMemo, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@/components/Icon'
import { router } from 'expo-router'
import Animated, { LinearTransition, FadeOut } from 'react-native-reanimated'
import Svg, { Line as SvgLine, Polyline, Circle } from 'react-native-svg'
import { BG, CARD, GREEN, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT, useThemeStrings, useCardChrome } from '@/lib/theme'
import { toLocalDateString, parseLocalDate, startOfWeek, weekdayOf, isoWeekNum } from '@/lib/date'
import { fmtPace, fmtDuration } from '@/lib/format'
import { toDisplayDistance, distanceUnitLabel, paceForUnit, type UnitSystem } from '@/lib/units'
import { effortColor } from '@/components/EffortRating'
import { GlassSegment } from '@/components/GlassSegment'
import { GlassCircleButton } from '@/components/GlassButton'
import { buildIntervalTrend } from '@/lib/intervalTrend'
import type { CardioWorkout } from '@/services/workouts'
import type { CompletedSessionItem } from '@/services/workoutSchedule'
import {
  GRID_PADDING, STATS_SCREEN_W, BLUE, RED, YELLOW, PURPLE, TEAL, LIME,
  monthLabel, sessDateLabel, s,
  useStatsColors,
} from './statsShared'
import { SwipeRow } from './SwipeRow'
import { DistanceDetailModal } from './DistanceDetailModal'
import { useT, dateLocale } from '@/lib/i18n'

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
  pagerRef, onTabScroll, refreshControl,
  onOpenWorkout, onDeleteWorkout, onDeleteCompletion,
}: {
  workouts: CardioWorkout[]
  completedSessions: CompletedSessionItem[]
  unit: UnitSystem
  /** Radsvepen måste blockera flik-pagern */
  pagerRef: React.RefObject<unknown>
  onTabScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => void
  /** Appens gemensamma dra-för-att-uppdatera — samma i alla tre flikarna */
  refreshControl: React.ReactElement<import('react-native').RefreshControlProps>
  onOpenWorkout: (w: CardioWorkout) => void
  onDeleteWorkout: (id: string) => void
  onDeleteCompletion: (id: string) => void
}) {
  const t = useT()
  const P = useStatsColors()
  const chrome = useCardChrome()
  const T = useThemeStrings()
  const insets = useSafeAreaInsets()
  const unitLabel = distanceUnitLabel(unit)

  const [cardioRange, setCardioRange]           = useState<'week' | 'month' | 'all'>('all')
  const [cardioOffset, setCardioOffset]         = useState(0)
  const [cardioDetailsOpen, setCardioDetailsOpen] = useState(false)
  const [distDetailOpen, setDistDetailOpen]     = useState(false)
  // Totalt-läget visar bara senaste månadens sessioner tills Alla trycks
  const [showAllSessions, setShowAllSessions]   = useState(false)

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
      const fmt = (d: Date) => d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }).replace('.', '')
      return {
        start: toLocalDateString(mon) as string | null,
        end: toLocalDateString(end) as string | null,
        label: cardioOffset === 0 ? t('Denna vecka') : t('{a} till {b}', { a: fmt(mon), b: fmt(sun) }),
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
          ? t('Denna månad')
          : first.toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' }),
      }
    }
    return { start: null as string | null, end: null as string | null, label: t('Hela historiken') }
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
  // Intervalltrend över hela historiken — oberoende av periodfiltret
  const ivTrend     = useMemo(() => buildIntervalTrend(workouts), [workouts])

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
        return { key, label: t(['M', 'T', 'O', 'T', 'F', 'L', 'S'][i]), run: 0, cycle: 0, walk: 0, total: 0, isCurrent: key === today }
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
        buckets.push({ key, label: t('V{n}', { n: isoWeekNum(mon) }), run: 0, cycle: 0, walk: 0, total: 0, isCurrent: key === thisMon })
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
        label: d.toLocaleDateString(dateLocale(), { month: 'short' }).replace('.', ''),
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
    running:  { icon: 'fitness',  color: T.ACCENT },
    cycling:  { icon: 'bicycle',  color: P.BLUE },
    walking:  { icon: 'walk',     color: P.GREEN },
    interval: { icon: 'flash',    color: P.YELLOW },
  }
  type SessRow = {
    key: string
    name: string
    value: string
    valueSub: string
    sub: string
    icon: React.ComponentProps<typeof Ionicons>['name']
    color: string
    sortKey: number
    dateStr: string
    workout?: CardioWorkout
  }
  const sessionRows: SessRow[] = useMemo(() => [
    ...cardioW.map((w): SessRow => {
      const meta = CARDIO_META[w.data.type] ?? { icon: 'fitness' as const, color: T.ACCENT }
      const km = w.data.distance_km
      const time = new Date(w.created_at).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
      return {
        key: `c:${w.id}`,
        name: w.name,
        // Distanspass: km stort + tempo under; pass utan GPS-distans: tiden
        value: km > 0.1
          ? `${toDisplayDistance(km, unit).toFixed(2).replace('.', ',')} ${unitLabel}`
          : fmtDuration(w.data.duration_seconds),
        valueSub: km > 0.1
          ? `${fmtPace(paceForUnit(w.data.duration_seconds / km, unit))} /${unitLabel}`
          : t('utan GPS'),
        sub: `${sessDateLabel(toLocalDateString(new Date(w.created_at)))} · ${time}`,
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
        const meta = CARDIO_META[c.cardioType ?? ''] ?? { icon: 'fitness' as const, color: P.BLUE }
        return {
          key: `g:${c.id}`,
          name: c.name,
          value: c.durationSeconds ? fmtDuration(c.durationSeconds) : t('Klart'),
          valueSub: t('utan GPS'),
          sub: sessDateLabel(c.completedDate),
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
          refreshControl={refreshControl}
          scrollEventThrottle={16}
        >
          {workouts.length === 0 ? (
            <View style={s.tabEmpty}>
              <View style={s.tabEmptyIcon}><Ionicons name="walk-outline" size={30} color={ACCENT} /></View>
              <Text style={s.tabEmptyTitle}>{t('Inget cardio ännu')}</Text>
              <Text style={s.tabEmptyText}>
                {t('Starta ett GPS-pass från schemat så vaknar statistiken: distans, tempo, grafer och rekord.')}
              </Text>
              <TouchableOpacity style={s.tabEmptyBtn} activeOpacity={0.85} onPress={() => router.push('/(app)/add')}>
                <Text style={s.tabEmptyBtnText}>{t('Till schemat')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <>
            {/* Periodfilter — dragbar glasslider som i Anpassning */}
            <GlassSegment
              value={cardioRange}
              options={[
                { key: 'week',  label: t('Vecka') },
                { key: 'month', label: t('Månad') },
                { key: 'all',   label: t('Totalt') },
              ]}
              onChange={k => { setCardioRange(k); setCardioOffset(0); setShowAllSessions(false) }}
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

            {/* Nyckeltalen 2x2 som förlagan — tryck öppnar alla detaljer */}
            <TouchableOpacity style={[l.statCard, chrome]} activeOpacity={0.85} onPress={() => setCardioDetailsOpen(true)} testID="cardioStats">
              <View style={l.statRow}>
                <View style={l.statCell}>
                  <Text style={l.statLbl}>{t('Distans')}</Text>
                  <Text style={[l.statVal, { color: P.BLUE }]}>
                    {toDisplayDistance(totalKm, unit).toFixed(2).replace('.', ',')}
                    <Text style={[l.statUnit, { color: P.BLUE }]}> {unitLabel}</Text>
                  </Text>
                </View>
                <View style={l.statCell}>
                  <Text style={l.statLbl}>{t('Träningstid')}</Text>
                  <Text style={[l.statVal, { color: P.BLUE }]}>{fmtDuration(totalSecs)}</Text>
                </View>
              </View>
              <View style={[l.statRow, { marginTop: 18 }]}>
                <View style={l.statCell}>
                  <Text style={l.statLbl}>{t('Antal pass')}</Text>
                  <Text style={l.statVal}>{cardioW.length}</Text>
                </View>
                <View style={l.statCell}>
                  <Text style={l.statLbl}>{t('Snittempo')}</Text>
                  <Text style={l.statVal}>
                    {avgPace}
                    <Text style={l.statUnit}> /{unitLabel}</Text>
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Distansstaplar — per dag/vecka/månad efter periodfiltret */}
            <TouchableOpacity style={[l.chartCard, chrome]} activeOpacity={0.85} onPress={() => setDistDetailOpen(true)} testID="distChart">
              <View style={l.chartHead}>
                <Text style={l.chartTitle}>
                  {cardioRange === 'week' ? t('Distans per dag')
                    : cardioRange === 'month' ? t('Distans per vecka')
                    : t('Distans per månad')}
                </Text>
                {cardioRange === 'all' && <Text style={l.chartHint}>{t('senaste 6 mån')}</Text>}
              </View>
              <View style={l.barRow}>
                {(() => {
                  const max = Math.max(...distBuckets.map(x => x.total), 0.01)
                  return distBuckets.map(b => (
                    <View key={b.key} style={l.barCell}>
                      <View style={l.barSlot}>
                        {b.total > 0
                          ? <View style={[l.bar, { height: Math.max(16, (b.total / max) * 150), backgroundColor: b.isCurrent ? T.ACCENT : `${T.ACCENT}55` }]} />
                          : <View style={l.barEmpty} />}
                      </View>
                      <Text style={[l.barLbl, b.isCurrent && { color: T.ACCENT, fontWeight: '700' }]}>{b.label}</Text>
                    </View>
                  ))
                })()}
              </View>
            </TouchableOpacity>

            {/* Sessioner — kortrader som förlagan; Totalt visar senaste
                månaden tills Alla trycks */}
            {sessionRows.length > 0 ? (() => {
              const latestMonth = monthLabel(sessionRows[0].dateStr)
              const hasOlder = sessionRows.some(r => monthLabel(r.dateStr) !== latestMonth)
              const shown = cardioRange === 'all' && !showAllSessions
                ? sessionRows.filter(r => monthLabel(r.dateStr) === latestMonth)
                : sessionRows
              return (
                <View style={{ gap: 10 }}>
                  <View style={l.sessHead}>
                    <Text style={l.sessTitle}>
                      {cardioRange === 'all' ? `${t('Sessioner')} · ${latestMonth.split(' ')[0]}` : t('Sessioner')}
                    </Text>
                    {cardioRange === 'all' && hasOlder && (
                      <TouchableOpacity onPress={() => setShowAllSessions(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="toggleSessions">
                        <Text style={[l.sessLink, { color: T.ACCENT }]}>
                          {showAllSessions ? t('Visa färre') : `${t('Alla')} ›`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {shown.map((r, i) => {
                    const m = monthLabel(r.dateStr)
                    const showMonth = showAllSessions && i > 0 && monthLabel(shown[i - 1].dateStr) !== m
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
                            style={[l.sessRow, chrome]}
                            activeOpacity={0.7}
                            onPress={r.workout ? () => onOpenWorkout(r.workout!) : undefined}
                            disabled={!r.workout}
                          >
                            <View style={[l.sessIcon, { backgroundColor: r.color + '1E' }]}>
                              <Ionicons name={r.icon} size={20} color={r.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={l.sessName} numberOfLines={1}>{r.name}</Text>
                              <Text style={l.sessSub}>{r.sub}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={[l.sessVal, { color: P.BLUE }]}>{r.value}</Text>
                              <Text style={l.sessSub}>{r.valueSub}</Text>
                            </View>
                          </TouchableOpacity>
                        </SwipeRow>
                      </Animated.View>
                    )
                  })}
                </View>
              )
            })() : (
              <View style={s.empty}>
                <Ionicons name="walk-outline" size={40} color="rgba(255,255,255,0.12)" />
                <Text style={s.emptyText}>
                  {workouts.length === 0 ? t('Inga pass sparade ännu') : t('Inga pass under vald period')}
                </Text>
              </View>
            )}

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
                <TouchableOpacity style={s.sectionHeadRow} activeOpacity={0.7} onPress={() => setCardioDetailsOpen(true)}>
                  <Text style={[s.sectionHead, s.sectionHeadInline]}>{t('Tempoutveckling')}</Text>
                  <Ionicons name="chevron-forward" size={19} color={TEXT_SECONDARY} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.card, s.cardPlain]}
                  activeOpacity={0.85}
                  onPress={() => setCardioDetailsOpen(true)}
                >
                  <Text style={[s.cardSub, { marginTop: 0 }]}>{t('snitt min/{u} per vecka · snabbare är högre upp', { u: unitLabel })}</Text>
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
                      <Polyline points={pts} fill="none" stroke={P.BLUE} strokeWidth={2.5} strokeLinejoin="round" />
                      {paceVals.map((v, i) => (
                        <Circle key={i} cx={px(i)} cy={py(v)} r={4} fill={P.BLUE} stroke={CARD} strokeWidth={2} />
                      ))}
                    </Svg>
                  </View>
                  <View style={s.paceWeekRow}>
                    {paceWeeks.map((b, i) => (
                      <Text key={i} style={[s.paceWeekLbl, b.isCurrent && { color: P.BLUE }]}>{b.label}</Text>
                    ))}
                  </View>
                </TouchableOpacity>
                </>
              )
            })()}

            {/* Intervalltrend — guidade pass sparar per-intervall-tempo;
                här syns utvecklingen pass för pass: "5:10 → 4:52" */}
            {ivTrend && (() => {
              const CH_W = STATS_SCREEN_W - 84
              const CH_H = 110
              const vals = ivTrend.points.map(p => paceForUnit(p.paceSec, unit))
              const minV = Math.min(...vals)
              const maxV = Math.max(...vals)
              const span = Math.max(maxV - minV, 1)
              const px = (i: number) =>
                vals.length === 1 ? CH_W / 2 : (i / (vals.length - 1)) * (CH_W - 16) + 8
              // Lägre tempo = bättre → snabbast överst, som tempografen
              const py = (v: number) => 12 + ((v - minV) / span) * (CH_H - 24)
              const pts = vals.map((v, i) => `${px(i)},${py(v)}`).join(' ')
              const distLbl = ivTrend.distanceM >= 1000
                ? `${String(ivTrend.distanceM / 1000).replace('.', ',')} km`
                : `${ivTrend.distanceM} m`
              return (
                <>
                <View style={s.sectionHeadRow}>
                  <Text style={[s.sectionHead, s.sectionHeadInline]}>{t('Intervaller')}</Text>
                </View>
                <View style={[s.card, s.cardPlain]}>
                  <View style={s.ivTrendHeadRow}>
                    <Text style={[s.cardSub, { marginTop: 0, flex: 1 }]}>
                      {t('{d}-intervaller · snitt per pass', { d: distLbl })}
                    </Text>
                    <Text style={[
                      s.ivTrendDelta,
                      ivTrend.improvementSec > 0 && { color: P.GREEN },
                    ]}>
                      {ivTrend.improvementSec > 0
                        ? t('−{n} s snabbare', { n: ivTrend.improvementSec })
                        : ivTrend.improvementSec < 0
                          ? t('+{n} s', { n: -ivTrend.improvementSec })
                          : t('oförändrat')}
                    </Text>
                  </View>
                  <Text style={s.ivTrendHeadline}>
                    {fmtPace(paceForUnit(ivTrend.first, unit))} → {fmtPace(paceForUnit(ivTrend.last, unit))}
                    <Text style={s.dtlUnit}> /{unitLabel}</Text>
                  </Text>
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
                      <Polyline points={pts} fill="none" stroke={P.BLUE} strokeWidth={2.5} strokeLinejoin="round" />
                      {vals.map((v, i) => (
                        <Circle key={i} cx={px(i)} cy={py(v)} r={4} fill={P.BLUE} stroke={CARD} strokeWidth={2} />
                      ))}
                    </Svg>
                  </View>
                  <View style={s.paceWeekRow}>
                    {ivTrend.points.map((p, i) => (
                      <Text key={i} style={s.paceWeekLbl}>
                        {new Date(p.date).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'numeric' })}
                      </Text>
                    ))}
                  </View>
                </View>
                </>
              )
            })()}

            {/* Cardiorekord (all-time) — lista med ikon, etikett och färgat värde */}
            {hasRecords && (
              <>
              <Text style={s.sectionHead}>{t('Cardiorekord')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -GRID_PADDING }}
                contentContainerStyle={s.recScroll}
              >
                {([
                  {
                    icon: 'map-outline' as const, color: T.ACCENT, label: t('Längsta pass'),
                    value: recLongestKm > 0 ? `${toDisplayDistance(recLongestKm, unit).toFixed(2)} ${unitLabel}` : '–',
                    workout: recLongestW,
                  },
                  {
                    icon: 'flash-outline' as const, color: P.YELLOW, label: t('Snabbaste km'),
                    value: recFastestSplitSec === Infinity ? '–' : fmtPace(recFastestSplitSec),
                    workout: recFastestSplitW,
                  },
                  {
                    icon: 'stopwatch-outline' as const, color: P.RED, label: t('Bästa tempo /{u}', { u: unitLabel }),
                    value: recBestPaceSec === Infinity ? '–' : fmtPace(paceForUnit(recBestPaceSec, unit)),
                    workout: recBestPaceW,
                  },
                  {
                    icon: 'trending-up-outline' as const, color: P.GREEN, label: t('Längsta vecka'),
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
            <Text style={s.modalTopTitle}>{t('Träningsdetaljer')}</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <Text style={s.sessionsWeekLabel}>{cardioBounds.label}</Text>
            <View style={[s.card, s.cardPlain, { marginTop: 12, paddingVertical: 4 }]}>
              {([
                { label: t('Träningstid'), value: fmtDuration(totalSecs), color: P.YELLOW },
                { label: t('Distans'), value: `${toDisplayDistance(totalKm, unit).toFixed(2).replace('.', ',')} ${unitLabel}`, color: P.BLUE },
                { label: t('Kilokalorier'), value: `${totalCals.toLocaleString(dateLocale())} kcal`, color: P.RED },
                { label: t('Antal pass'), value: String(cardioW.length), color: P.GREEN },
                { label: t('Aktiva dagar'), value: String(activeCardioDays), color: TEXT_PRIMARY },
                { label: t('Snittempo'), value: `${avgPace} /${unitLabel}`, color: P.TEAL },
                { label: t('Bästa tempo'), value: `${bestPace} /${unitLabel}`, color: P.PURPLE },
                { label: t('Snittdistans'), value: `${toDisplayDistance(avgDistKm, unit).toFixed(2).replace('.', ',')} ${unitLabel}`, color: P.LIME },
                { label: t('Längsta pass'), value: `${toDisplayDistance(longestPassKm, unit).toFixed(2).replace('.', ',')} ${unitLabel}`, color: ACCENT },
                {
                  label: t('Snittansträngning'),
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


// Lokala stilar för den nya kostymen — delade s-stilar rörs inte (GymTab)
const l = StyleSheet.create({
  statCard: { backgroundColor: CARD, borderRadius: 20, padding: 18, marginBottom: 14 },
  statRow: { flexDirection: 'row' },
  statCell: { flex: 1, gap: 3 },
  statLbl: { color: TEXT_SECONDARY, fontSize: 14 },
  statVal: { color: TEXT_PRIMARY, fontSize: 26, fontWeight: '800' },
  statUnit: { fontSize: 14, fontWeight: '700', color: TEXT_SECONDARY },

  chartCard: { backgroundColor: CARD, borderRadius: 20, padding: 16, marginBottom: 14 },
  chartHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  chartTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '800' },
  chartHint: { color: TEXT_SECONDARY, fontSize: 13 },
  barRow: { flexDirection: 'row', alignItems: 'flex-end' },
  barCell: { flex: 1, alignItems: 'center', gap: 8 },
  barSlot: { height: 150, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 26, borderRadius: 13 },
  barEmpty: { width: 22, height: 5, borderRadius: 3, backgroundColor: 'rgba(128,128,128,0.22)' },
  barLbl: { color: TEXT_SECONDARY, fontSize: 12.5, fontWeight: '600' },

  sessHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 8, paddingHorizontal: 2,
  },
  sessTitle: { color: TEXT_PRIMARY, fontSize: 19, fontWeight: '800' },
  sessLink: { fontSize: 14, fontWeight: '700' },
  sessRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 18, padding: 14,
  },
  sessIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  sessName: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  sessSub: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
  sessVal: { fontSize: 16, fontWeight: '800' },
})
