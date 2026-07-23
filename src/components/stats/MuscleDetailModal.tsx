import { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Modal, ScrollView, Dimensions, ActivityIndicator, useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Text as SvgText, Polygon, Line as SvgLine } from 'react-native-svg'
import { GlassCircleButton } from '@/components/GlassButton'
import { GlassSegment } from '@/components/GlassSegment'
import { BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, DIVIDER, ACCENT, accentAlpha } from '@/lib/theme'
import { toLocalDateString, parseLocalDate } from '@/lib/date'
import { getMusclesForName, MUSCLE_GROUPS_6 } from '@/lib/muscles'
import { getCompletedExerciseNamesBetween } from '@/services/workoutSchedule'
import type { StrengthWorkout } from '@/services/workouts'

// =============================================================================
// MUSKELFÖRDELNING — öppnas med flikens valda vecka/dag som förvalt läge så
// grafen alltid visar det man just tittade på. Radarn räknar på samma källa
// som kroppskartan (avbockade övningar); set-tabellen på loggade set.
// =============================================================================

const SCREEN_W = Dimensions.get('window').width

type Period = 'sel' | 'm' | '3m' | 'y' | 'all'
const ROLLING_DAYS: Record<'m' | '3m' | 'y', number> = { m: 30, '3m': 90, y: 365 }

function addDays(iso: string, n: number): string {
  const d = parseLocalDate(iso)
  d.setDate(d.getDate() + n)
  return toLocalDateString(d)
}

function groupHits(names: string[]): number[] {
  return MUSCLE_GROUPS_6.map(g =>
    names.reduce((s, n) => s + (getMusclesForName(n).some(sl => g.slugs.includes(sl)) ? 1 : 0), 0))
}

export function MuscleDetailModal({ visible, onClose, userId, workouts, weekStart, weekLabel, day, dayLabel }: {
  visible: boolean
  onClose: () => void
  userId: string | null
  workouts: StrengthWorkout[]
  /** Flikens valda vecka (måndagens datum) och dess etikett */
  weekStart: string
  weekLabel: string
  /** Vald dag på fliken — null när hela veckan visas */
  day: string | null
  dayLabel: string | null
}) {
  // Radar: spindelnät, förra veckans yta och etiketter — vit-alfa syns
  // inte på ljus botten (SVG kräver strängfärger)
  const radarLight = useColorScheme() === 'light'
  const webStroke = radarLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'
  const prevFill  = radarLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)'
  const prevLine  = radarLight ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.30)'
  const axisText  = radarLight ? 'rgba(0,0,0,0.60)' : 'rgba(255,255,255,0.65)'
  const insets = useSafeAreaInsets()
  const [period, setPeriod] = useState<Period>('sel')
  const [curNames, setCurNames] = useState<string[]>([])
  const [prevNames, setPrevNames] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(false)

  // Öppnas alltid i det läge man kom ifrån (vald dag/vecka)
  useEffect(() => {
    if (visible) setPeriod('sel')
  }, [visible])

  // Periodens datumintervall + jämförelseperiod av samma längd
  const range = useMemo(() => {
    if (period === 'sel') {
      if (day) {
        return {
          from: day, to: addDays(day, 1),
          prevFrom: addDays(day, -7), prevTo: addDays(day, -6),
          label: dayLabel ?? day,
          curLegend: 'Vald dag', prevLegend: 'Samma dag förra veckan',
        }
      }
      return {
        from: weekStart, to: addDays(weekStart, 7),
        prevFrom: addDays(weekStart, -7), prevTo: weekStart,
        label: weekLabel,
        curLegend: 'Vald vecka', prevLegend: 'Förra veckan',
      }
    }
    if (period === 'all') {
      return {
        from: null, to: null, prevFrom: null, prevTo: null,
        label: 'Hela historiken', curLegend: 'Alla pass', prevLegend: '',
      }
    }
    const days = ROLLING_DAYS[period]
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayIso = toLocalDateString(today)
    const from = addDays(todayIso, -(days - 1))
    const labels = { m: 'Senaste 30 dagarna', '3m': 'Senaste 3 månaderna', y: 'Senaste året' } as const
    return {
      from, to: addDays(todayIso, 1),
      prevFrom: addDays(from, -days), prevTo: from,
      label: labels[period],
      curLegend: 'Perioden', prevLegend: 'Föregående period',
    }
  }, [period, day, dayLabel, weekStart, weekLabel])

  // Avbockade övningar för perioden — samma källa som kroppskartan
  useEffect(() => {
    if (!visible || !userId) return
    let active = true
    setLoading(true)
    Promise.all([
      getCompletedExerciseNamesBetween(userId, range.from, range.to).catch(() => [] as string[]),
      range.prevFrom !== null || period !== 'all'
        ? getCompletedExerciseNamesBetween(userId, range.prevFrom, range.prevTo).catch(() => [] as string[])
        : Promise.resolve(null),
    ]).then(([cur, prev]) => {
      if (!active) return
      setCurNames(cur)
      setPrevNames(period === 'all' ? null : prev)
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [visible, userId, range, period])

  const radarCur  = groupHits(curNames)
  const radarPrev = prevNames ? groupHits(prevNames) : null

  // Loggade set i perioden — vikterna man faktiskt skrivit in
  const setsPerGroup = useMemo(() => {
    const inRange = workouts.filter(w => {
      const d = w.data.workout_date ?? toLocalDateString(new Date(w.created_at))
      return (range.from === null || d >= range.from) && (range.to === null || d < range.to)
    })
    return MUSCLE_GROUPS_6.map(g =>
      inRange.reduce((s, w) =>
        s + (getMusclesForName(w.data.exercise_name).some(sl => g.slugs.includes(sl)) ? w.data.sets.length : 0), 0))
  }, [workouts, range])
  const totalSets = setsPerGroup.reduce((a, b) => a + b, 0)
  const maxGroupSets = Math.max(...setsPerGroup, 1)

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
          <GlassCircleButton icon="chevron-back" onPress={onClose} />
          <Text style={s.topTitle}>Muskelfördelning</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
          <GlassSegment
            value={period}
            options={[
              { key: 'sel', label: day ? 'Dag' : 'Vecka' },
              { key: 'm',   label: '1 M' },
              { key: '3m',  label: '3 M' },
              { key: 'y',   label: '1 ÅR' },
              { key: 'all', label: 'Allt' },
            ]}
            onChange={setPeriod}
          />
          <Text style={s.periodLabel}>{range.label}</Text>

          {/* Radar — övningar per muskelgrupp, samma räkning som kroppskartan */}
          <View style={[s.card, { alignItems: 'center', paddingVertical: 12, marginTop: 14 }]}>
            {loading ? (
              <ActivityIndicator color={ACCENT} style={{ marginVertical: 110 }} />
            ) : (() => {
              const W = SCREEN_W - 72
              const H = 260
              const cx = W / 2
              const cy = H / 2
              const R = 90
              const prevVals = radarPrev ?? MUSCLE_GROUPS_6.map(() => 0)
              const maxV = Math.max(...radarCur, ...prevVals, 1)
              const pt = (i: number, v: number) => {
                const a = (-90 + i * 60) * (Math.PI / 180)
                const r = (v / maxV) * R
                return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
              }
              const ring = (f: number) => MUSCLE_GROUPS_6.map((_, i) => pt(i, maxV * f)).join(' ')
              return (
                <Svg width={W} height={H}>
                  {[0.25, 0.5, 0.75, 1].map(f => (
                    <Polygon key={f} points={ring(f)} fill="none" stroke={webStroke} strokeWidth={1} />
                  ))}
                  {MUSCLE_GROUPS_6.map((_, i) => {
                    const a = (-90 + i * 60) * (Math.PI / 180)
                    return (
                      <SvgLine
                        key={i}
                        x1={cx} y1={cy}
                        x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)}
                        stroke={webStroke} strokeWidth={1}
                      />
                    )
                  })}
                  {radarPrev && radarPrev.some(v => v > 0) && (
                    <Polygon
                      points={radarPrev.map((v, i) => pt(i, v)).join(' ')}
                      fill={prevFill} stroke={prevLine} strokeWidth={1.5}
                    />
                  )}
                  {radarCur.some(v => v > 0) && (
                    <Polygon
                      points={radarCur.map((v, i) => pt(i, v)).join(' ')}
                      fill={accentAlpha('33')} stroke={ACCENT} strokeWidth={2}
                    />
                  )}
                  {MUSCLE_GROUPS_6.map((g, i) => {
                    const a = (-90 + i * 60) * (Math.PI / 180)
                    return (
                      <SvgText
                        key={g.label}
                        x={cx + (R + 24) * Math.cos(a)} y={cy + (R + 24) * Math.sin(a) + 4}
                        fontSize={12} fontWeight="600" textAnchor="middle"
                        fill={axisText}
                      >
                        {g.label}
                      </SvgText>
                    )
                  })}
                </Svg>
              )
            })()}
            <View style={s.legend}>
              <View style={s.legItem}>
                <View style={[s.legDot, { backgroundColor: ACCENT }]} />
                <Text style={s.legText}>{range.curLegend}</Text>
              </View>
              {radarPrev && !!range.prevLegend && (
                <View style={s.legItem}>
                  <View style={[s.legDot, { backgroundColor: prevLine }]} />
                  <Text style={s.legText}>{range.prevLegend}</Text>
                </View>
              )}
            </View>
          </View>
          {!loading && curNames.length === 0 && (
            <Text style={s.hint}>Inga avbockade övningar i perioden.</Text>
          )}

          {/* Set per muskelgrupp — från loggade set med reps/vikt */}
          <Text style={s.sectionHead}>Set per muskelgrupp</Text>
          <View style={[s.card, { paddingVertical: 6 }]}>
            <View style={s.grpRow}>
              <Text style={[s.grpLbl, { fontWeight: '700' }]}>Totalt</Text>
              <View style={s.grpTrack} />
              <Text style={s.grpVal}>{totalSets}</Text>
            </View>
            {MUSCLE_GROUPS_6.map((g, i) => (
              <View key={g.label} style={[s.grpRow, s.grpRowBorder]}>
                <Text style={s.grpLbl}>{g.label}</Text>
                <View style={s.grpTrack}>
                  {setsPerGroup[i] > 0 && (
                    <View style={[s.grpFill, { width: `${Math.max(6, (setsPerGroup[i] / maxGroupSets) * 100)}%` as never }]} />
                  )}
                </View>
                <Text style={[s.grpVal, setsPerGroup[i] === 0 && { color: TEXT_SECONDARY }]}>
                  {setsPerGroup[i]}
                </Text>
              </View>
            ))}
          </View>
          {totalSets === 0 && (
            <Text style={s.hint}>
              Set räknas från reps och vikt du loggar i passen, fyll i dem så växer tabellen.
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  topTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  periodLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600', marginTop: 12, textTransform: 'capitalize' },

  sectionHead: {
    color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', letterSpacing: -0.4,
    marginTop: 20, marginBottom: 12,
  },
  card: { backgroundColor: CARD, borderRadius: 20, paddingHorizontal: 18 },

  legend: { flexDirection: 'row', gap: 16, paddingBottom: 6 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legDot: { width: 8, height: 8, borderRadius: 2 },
  legText: { color: TEXT_SECONDARY, fontSize: 11 },

  grpRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  grpRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER },
  grpLbl: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '500', width: 62 },
  grpTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: DIVIDER, overflow: 'hidden' },
  grpFill: { height: '100%', borderRadius: 5, backgroundColor: ACCENT },
  grpVal: { color: TEXT_PRIMARY, fontSize: 15, fontFamily: NUM_FONT, width: 34, textAlign: 'right', fontVariant: ['tabular-nums'] },

  hint: { color: TEXT_SECONDARY, fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: 'center' },
})
