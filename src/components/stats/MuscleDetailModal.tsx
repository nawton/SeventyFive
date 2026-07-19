import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Modal, ScrollView, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Text as SvgText, Polygon, Line as SvgLine } from 'react-native-svg'
import { GlassCircleButton } from '@/components/GlassButton'
import { GlassSegment } from '@/components/GlassSegment'
import { BG, CARD, ORANGE, GREEN, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, NUM_FONT_SEMI } from '@/lib/theme'
import { toLocalDateString } from '@/lib/date'
import { getMusclesForName, type Slug } from '@/lib/muscles'
import type { StrengthWorkout } from '@/services/workouts'

// =============================================================================
// MUSKELSTATISTIK — räknar EXAKT på loggade set (inte schemanamn):
// varje sparat set tillskrivs övningens muskelgrupper. Periodväljare
// 1V/1M/3M/1ÅR/ALLT, alltid jämfört med föregående lika lång period.
// =============================================================================

const SCREEN_W = Dimensions.get('window').width
const BLUE   = '#3FBBFF'
const TEAL   = '#40F5E9'
const YELLOW = '#FFE60A'
const PURPLE = '#D65CFF'

type Period = 'w' | 'm' | '3m' | 'y' | 'all'
const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = { w: 7, m: 30, '3m': 90, y: 365 }

const MUSCLE_GROUPS_6: Array<{ label: string; slugs: Slug[] }> = [
  { label: 'Bröst', slugs: ['chest'] as Slug[] },
  { label: 'Rygg',  slugs: ['upper-back', 'lower-back', 'trapezius'] as Slug[] },
  { label: 'Ben',   slugs: ['quadriceps', 'hamstring', 'gluteal', 'calves'] as Slug[] },
  { label: 'Axlar', slugs: ['deltoids'] as Slug[] },
  { label: 'Armar', slugs: ['biceps', 'triceps'] as Slug[] },
  { label: 'Mage',  slugs: ['abs', 'obliques'] as Slug[] },
]

function workoutDate(w: StrengthWorkout): string {
  return w.data.workout_date ?? toLocalDateString(new Date(w.created_at))
}

interface PeriodStats {
  sets: number
  reps: number
  volume: number
  activeDays: number
  perGroup: number[]
  topExercises: Array<{ name: string; sets: number; volume: number }>
}

function computeStats(workouts: StrengthWorkout[], from: string | null, to: string | null): PeriodStats {
  const inRange = workouts.filter(w => {
    const d = workoutDate(w)
    return (from === null || d >= from) && (to === null || d < to)
  })
  const perGroup = MUSCLE_GROUPS_6.map(() => 0)
  const byExercise = new Map<string, { sets: number; volume: number }>()
  let sets = 0, reps = 0, volume = 0
  const days = new Set<string>()

  for (const w of inRange) {
    const muscles = getMusclesForName(w.data.exercise_name)
    const wSets = w.data.sets.length
    const wReps = w.data.sets.reduce((s, r) => s + r.reps, 0)
    const wVol  = w.data.sets.reduce((s, r) => s + r.reps * (r.weight_kg || 0), 0)
    sets += wSets
    reps += wReps
    volume += wVol
    days.add(workoutDate(w))
    MUSCLE_GROUPS_6.forEach((g, i) => {
      if (muscles.some(sl => g.slugs.includes(sl))) perGroup[i] += wSets
    })
    const ex = byExercise.get(w.data.exercise_name) ?? { sets: 0, volume: 0 }
    ex.sets += wSets
    ex.volume += wVol
    byExercise.set(w.data.exercise_name, ex)
  }

  const topExercises = Array.from(byExercise.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 6)

  return { sets, reps, volume, activeDays: days.size, perGroup, topExercises }
}

export function MuscleDetailModal({ visible, onClose, workouts }: {
  visible: boolean
  onClose: () => void
  workouts: StrengthWorkout[]
}) {
  const insets = useSafeAreaInsets()
  const [period, setPeriod] = useState<Period>('m')

  const { cur, prev, periodLabel } = useMemo(() => {
    if (period === 'all') {
      return {
        cur: computeStats(workouts, null, null),
        prev: null,
        periodLabel: 'Hela historiken',
      }
    }
    const days = PERIOD_DAYS[period]
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const from = new Date(today); from.setDate(from.getDate() - (days - 1))
    const prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate() - days)
    const fromStr = toLocalDateString(from)
    const prevFromStr = toLocalDateString(prevFrom)
    const labels: Record<Exclude<Period, 'all'>, string> = {
      w: 'Senaste 7 dagarna', m: 'Senaste 30 dagarna', '3m': 'Senaste 3 månaderna', y: 'Senaste året',
    }
    return {
      cur: computeStats(workouts, fromStr, null),
      prev: computeStats(workouts, prevFromStr, fromStr),
      periodLabel: labels[period],
    }
  }, [workouts, period])

  const maxGroupSets = Math.max(...cur.perGroup, 1)

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
              { key: 'w',   label: '1 V' },
              { key: 'm',   label: '1 M' },
              { key: '3m',  label: '3 M' },
              { key: 'y',   label: '1 ÅR' },
              { key: 'all', label: 'Allt' },
            ]}
            onChange={setPeriod}
          />
          <Text style={s.periodLabel}>{periodLabel}</Text>

          {/* Radar — set per muskelgrupp, denna period mot föregående */}
          <Text style={s.sectionHead}>Muskelfördelning</Text>
          <View style={[s.card, { alignItems: 'center', paddingVertical: 12 }]}>
            {(() => {
              const W = SCREEN_W - 72
              const H = 260
              const cx = W / 2
              const cy = H / 2
              const R = 90
              const prevGroups = prev?.perGroup ?? MUSCLE_GROUPS_6.map(() => 0)
              const maxV = Math.max(...cur.perGroup, ...prevGroups, 1)
              const pt = (i: number, v: number) => {
                const a = (-90 + i * 60) * (Math.PI / 180)
                const r = (v / maxV) * R
                return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
              }
              const ring = (f: number) => MUSCLE_GROUPS_6.map((_, i) => pt(i, maxV * f)).join(' ')
              return (
                <Svg width={W} height={H}>
                  {[0.25, 0.5, 0.75, 1].map(f => (
                    <Polygon key={f} points={ring(f)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
                  ))}
                  {MUSCLE_GROUPS_6.map((_, i) => {
                    const a = (-90 + i * 60) * (Math.PI / 180)
                    return (
                      <SvgLine
                        key={i}
                        x1={cx} y1={cy}
                        x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)}
                        stroke="rgba(255,255,255,0.07)" strokeWidth={1}
                      />
                    )
                  })}
                  {prev && prev.perGroup.some(v => v > 0) && (
                    <Polygon
                      points={prev.perGroup.map((v, i) => pt(i, v)).join(' ')}
                      fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.30)" strokeWidth={1.5}
                    />
                  )}
                  {cur.perGroup.some(v => v > 0) && (
                    <Polygon
                      points={cur.perGroup.map((v, i) => pt(i, v)).join(' ')}
                      fill={ORANGE + '33'} stroke={ORANGE} strokeWidth={2}
                    />
                  )}
                  {MUSCLE_GROUPS_6.map((g, i) => {
                    const a = (-90 + i * 60) * (Math.PI / 180)
                    return (
                      <SvgText
                        key={g.label}
                        x={cx + (R + 24) * Math.cos(a)} y={cy + (R + 24) * Math.sin(a) + 4}
                        fontSize={12} fontWeight="600" textAnchor="middle"
                        fill="rgba(255,255,255,0.65)"
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
                <View style={[s.legDot, { backgroundColor: ORANGE }]} />
                <Text style={s.legText}>Denna period</Text>
              </View>
              {prev && (
                <View style={s.legItem}>
                  <View style={[s.legDot, { backgroundColor: 'rgba(255,255,255,0.35)' }]} />
                  <Text style={s.legText}>Föregående period</Text>
                </View>
              )}
            </View>
          </View>

          {/* Set per muskelgrupp */}
          <Text style={s.sectionHead}>Set per muskelgrupp</Text>
          <View style={[s.card, { paddingVertical: 6 }]}>
            <View style={s.grpRow}>
              <Text style={[s.grpLbl, { fontWeight: '700' }]}>Totalt</Text>
              <View style={s.grpTrack} />
              <Text style={s.grpVal}>{cur.sets}</Text>
            </View>
            {MUSCLE_GROUPS_6.map((g, i) => (
              <View key={g.label} style={[s.grpRow, s.grpRowBorder]}>
                <Text style={s.grpLbl}>{g.label}</Text>
                <View style={s.grpTrack}>
                  {cur.perGroup[i] > 0 && (
                    <View style={[s.grpFill, { width: `${Math.max(6, (cur.perGroup[i] / maxGroupSets) * 100)}%` as never }]} />
                  )}
                </View>
                <Text style={[s.grpVal, cur.perGroup[i] === 0 && { color: TEXT_SECONDARY }]}>
                  {cur.perGroup[i]}
                </Text>
              </View>
            ))}
          </View>

          {cur.sets === 0 && (
            <Text style={s.hint}>
              Inga loggade set i perioden. Logga reps och vikt i dina gympass så byggs statistiken av exakt det du lyft.
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
  periodLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600', marginTop: 12 },

  sectionHead: {
    color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', letterSpacing: -0.4,
    marginTop: 20, marginBottom: 12,
  },
  card: { backgroundColor: CARD, borderRadius: 20, paddingHorizontal: 18 },

  dtlRow: { flexDirection: 'row', paddingVertical: 14 },
  dtlCell: { flex: 1, gap: 3 },
  dtlLbl: { color: TEXT_SECONDARY, fontSize: 14 },
  dtlVal: { fontSize: 26, fontFamily: NUM_FONT },
  dtlUnit: { fontSize: 14, fontFamily: NUM_FONT_SEMI },
  dtlSep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)' },
  dtlPrev: { color: TEXT_SECONDARY, fontSize: 11, fontFamily: NUM_FONT_SEMI, marginTop: 1 },

  legend: { flexDirection: 'row', gap: 16, paddingBottom: 6 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legDot: { width: 8, height: 8, borderRadius: 2 },
  legText: { color: TEXT_SECONDARY, fontSize: 11 },

  grpRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  grpRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  grpLbl: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '500', width: 62 },
  grpTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  grpFill: { height: '100%', borderRadius: 5, backgroundColor: ORANGE },
  grpVal: { color: TEXT_PRIMARY, fontSize: 15, fontFamily: NUM_FONT, width: 34, textAlign: 'right', fontVariant: ['tabular-nums'] },

  exRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  exRank: { fontSize: 15, fontFamily: NUM_FONT, width: 20, textAlign: 'center' },
  exName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '500', flex: 1 },
  exSets: { color: TEXT_PRIMARY, fontSize: 14, fontFamily: NUM_FONT, fontVariant: ['tabular-nums'] },
  exVol: { color: TEXT_SECONDARY, fontSize: 11, fontFamily: NUM_FONT_SEMI, marginTop: 1 },

  hint: { color: TEXT_SECONDARY, fontSize: 12, lineHeight: 18, marginTop: 16, textAlign: 'center' },
})
