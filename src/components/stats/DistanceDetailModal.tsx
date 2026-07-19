import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Modal, ScrollView, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Text as SvgText, Line as SvgLine, Rect, G } from 'react-native-svg'
import { GlassSegment } from '@/components/GlassSegment'
import { GlassCircleButton } from '@/components/GlassButton'
import { BG, CARD, ORANGE, GREEN, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, NUM_FONT_SEMI } from '@/lib/theme'
import { toLocalDateString, weekdayOf, startOfWeek } from '@/lib/date'
import { toDisplayDistance, distanceUnitLabel, type UnitSystem } from '@/lib/units'
import type { CardioWorkout } from '@/services/workouts'

// =============================================================================
// DISTANS I DETALJ — öppnas när man trycker på distansgrafen på Framsteg.
// Apple Hälsa-känsla: växla upplösning (dag/vecka/månad), tryck på staplar
// för att inspektera en period, med fördelning och nyckeltal under grafen.
// =============================================================================

const BLUE = '#3FBBFF'
const SCREEN_W = Dimensions.get('window').width

type Res = 'day' | 'week' | 'month'

interface Bucket {
  key: string
  label: string        // kort etikett under stapeln
  fullLabel: string    // rubrik när stapeln är vald
  run: number
  cycle: number
  walk: number
  total: number
  passes: number
  isCurrent: boolean
}

function isoWeekNum(mon: Date): number {
  const jan4 = new Date(mon.getFullYear(), 0, 4)
  return Math.ceil((((mon.getTime() - jan4.getTime()) / 86400000) + weekdayOf(jan4) - 1) / 7)
}

function buildBuckets(workouts: CardioWorkout[], res: Res): Bucket[] {
  const catOf = (t: string) => t === 'cycling' ? 'cycle' as const : t === 'walking' ? 'walk' as const : 'run' as const
  const add = (buckets: Bucket[], key: string, w: CardioWorkout) => {
    const b = buckets.find(x => x.key === key)
    if (!b) return
    b[catOf(w.data.type ?? 'running')] += w.data.distance_km
    b.total += w.data.distance_km
    b.passes += 1
  }

  if (res === 'day') {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const buckets = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - (13 - i))
      const key = toLocalDateString(d)
      return {
        key,
        label: String(d.getDate()),
        fullLabel: d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }),
        run: 0, cycle: 0, walk: 0, total: 0, passes: 0,
        isCurrent: i === 13,
      }
    })
    workouts.forEach(w => add(buckets, toLocalDateString(new Date(w.created_at)), w))
    return buckets
  }

  if (res === 'week') {
    const cur = startOfWeek()
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const mon = new Date(cur); mon.setDate(mon.getDate() - (11 - i) * 7)
      const wn = isoWeekNum(mon)
      return {
        key: toLocalDateString(mon),
        label: String(wn),
        fullLabel: `Vecka ${wn}`,
        run: 0, cycle: 0, walk: 0, total: 0, passes: 0,
        isCurrent: i === 11,
      }
    })
    workouts.forEach(w => add(buckets, toLocalDateString(startOfWeek(new Date(w.created_at))), w))
    return buckets
  }

  const now = new Date()
  const buckets = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('sv-SE', { month: 'narrow' }),
      fullLabel: d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' }),
      run: 0, cycle: 0, walk: 0, total: 0, passes: 0,
      isCurrent: i === 11,
    }
  })
  workouts.forEach(w => {
    const d = new Date(w.created_at)
    add(buckets, `${d.getFullYear()}-${d.getMonth()}`, w)
  })
  return buckets
}

export function DistanceDetailModal({ visible, onClose, workouts, unit }: {
  visible: boolean
  onClose: () => void
  workouts: CardioWorkout[]
  unit: UnitSystem
}) {
  const insets = useSafeAreaInsets()
  const [res, setRes] = useState<Res>('day')
  const [selKey, setSelKey] = useState<string | null>(null)

  const buckets = useMemo(() => buildBuckets(workouts, res), [workouts, res])
  const unitLabel = distanceUnitLabel(unit)

  const sel = selKey ? buckets.find(b => b.key === selKey) ?? null : null
  const periodTotal  = buckets.reduce((s, b) => s + b.total, 0)
  const periodPasses = buckets.reduce((s, b) => s + b.passes, 0)
  const activeCount  = buckets.filter(b => b.total > 0).length
  const best = buckets.reduce<Bucket | null>((b, x) => (x.total > (b?.total ?? 0) ? x : b), null)

  // Det som visas i rubriken + fördelningen: vald stapel eller hela perioden
  const shown = sel ?? {
    fullLabel: res === 'day' ? 'Senaste 14 dagarna' : res === 'week' ? 'Senaste 12 veckorna' : 'Senaste 12 månaderna',
    run:   buckets.reduce((s, b) => s + b.run, 0),
    cycle: buckets.reduce((s, b) => s + b.cycle, 0),
    walk:  buckets.reduce((s, b) => s + b.walk, 0),
    total: periodTotal,
    passes: periodPasses,
  }

  const resAvgLabel = res === 'day' ? 'Snitt per aktiv dag' : res === 'week' ? 'Snitt per aktiv vecka' : 'Snitt per aktiv månad'

  function changeRes(r: Res) {
    setRes(r)
    setSelKey(null)
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
          <GlassCircleButton icon="chevron-back" onPress={onClose} />
          <Text style={s.topTitle}>Distans</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
          <GlassSegment
            value={res}
            options={[
              { key: 'day',   label: 'Dag' },
              { key: 'week',  label: 'Vecka' },
              { key: 'month', label: 'Månad' },
            ]}
            onChange={changeRes}
          />

          {/* Rubrik: vald stapel eller hela perioden */}
          <View style={s.readout}>
            <Text style={s.readoutLabel}>{shown.fullLabel}</Text>
            <Text style={s.readoutValue}>
              {toDisplayDistance(shown.total, unit).toFixed(2).replace('.', ',')}
              <Text style={s.readoutUnit}> {unitLabel.toUpperCase()}</Text>
            </Text>
            <Text style={s.readoutSub}>{shown.passes} pass{sel ? ' · tryck utanför staplarna för att nollställa' : ''}</Text>
          </View>

          {/* Graf — tryck på en stapel för att inspektera */}
          <View style={s.chartCard}>
            {(() => {
              const CH_W = SCREEN_W - 40 - 32
              const CH_H = 220
              const n = buckets.length
              const slot = CH_W / n
              const barW = Math.max(6, Math.min(26, Math.round(slot * 0.55)))
              const maxV = Math.max(...buckets.map(b => b.total), 0.1)
              const scale = (CH_H - 34) / maxV
              return (
                <>
                  <Svg width={CH_W} height={CH_H} onPress={() => setSelKey(null)}>
                    {[0.25, 0.5, 0.75, 1].map(f => (
                      <SvgLine
                        key={f}
                        x1={0} x2={CH_W}
                        y1={CH_H - 4 - f * (CH_H - 34)} y2={CH_H - 4 - f * (CH_H - 34)}
                        stroke="rgba(255,255,255,0.06)" strokeWidth={1}
                      />
                    ))}
                    {buckets.map((b, i) => {
                      const x = i * slot + (slot - barW) / 2
                      const dimmed = sel !== null && sel.key !== b.key
                      if (b.total <= 0) {
                        return <Rect key={b.key} x={x} y={CH_H - 7} width={barW} height={3} rx={1.5} fill="rgba(255,255,255,0.10)" />
                      }
                      const segs = ([
                        [b.run, ORANGE], [b.cycle, BLUE], [b.walk, GREEN],
                      ] as const).filter(sg => sg[0] > 0)
                      let y = CH_H - 4
                      const rects = segs.map(([v, color], j) => {
                        const h = Math.max(3, v * scale)
                        y -= h
                        return (
                          <Rect
                            key={j}
                            x={x} y={y + (j > 0 ? 0.75 : 0)}
                            width={barW} height={h - (j > 0 ? 1.5 : 0)} rx={3}
                            fill={color} opacity={dimmed ? 0.28 : 1}
                          />
                        )
                      })
                      return (
                        <G key={b.key} onPress={() => setSelKey(k => k === b.key ? null : b.key)}>
                          {/* Osynlig träffyta över hela kolumnen gör stapeln lätt att pricka */}
                          <Rect x={i * slot} y={0} width={slot} height={CH_H} fill="transparent" />
                          {rects}
                          {sel?.key === b.key && (
                            <SvgText
                              x={x + barW / 2} y={y - 8}
                              fontSize={11} fontWeight="700" textAnchor="middle" fill="#fff"
                            >
                              {toDisplayDistance(b.total, unit).toFixed(1)}
                            </SvgText>
                          )}
                        </G>
                      )
                    })}
                  </Svg>
                  <View style={s.lblRow}>
                    {buckets.map((b, i) => (
                      <Text key={b.key} style={[s.lbl, b.isCurrent && { color: ORANGE }, sel?.key === b.key && { color: TEXT_PRIMARY }]}>
                        {res === 'day' && n > 7 && i % 2 === 1 ? '' : b.label}
                      </Text>
                    ))}
                  </View>
                </>
              )
            })()}
          </View>

          {/* Fördelning per aktivitet — för valet eller hela perioden */}
          <Text style={s.sectionHead}>Fördelning</Text>
          <View style={s.card}>
            {([
              { color: ORANGE, label: 'Löpning',  v: shown.run },
              { color: BLUE,   label: 'Cykling',  v: shown.cycle },
              { color: GREEN,  label: 'Promenad', v: shown.walk },
            ] as const).map((r, i) => {
              const pct = shown.total > 0 ? (r.v / shown.total) * 100 : 0
              return (
                <View key={r.label} style={[s.splitRow, i > 0 && s.rowBorder]}>
                  <View style={[s.dot, { backgroundColor: r.color }]} />
                  <Text style={s.splitLbl}>{r.label}</Text>
                  <View style={s.splitTrack}>
                    <View style={[s.splitFill, { width: `${Math.max(pct, r.v > 0 ? 4 : 0)}%` as never, backgroundColor: r.color }]} />
                  </View>
                  <Text style={[s.splitVal, { color: r.color }]}>
                    {toDisplayDistance(r.v, unit).toFixed(1)}
                  </Text>
                </View>
              )
            })}
          </View>

          {/* Nyckeltal för hela perioden */}
          <Text style={s.sectionHead}>Nyckeltal</Text>
          <View style={s.card}>
            {([
              {
                label: resAvgLabel,
                value: activeCount > 0 ? `${toDisplayDistance(periodTotal / activeCount, unit).toFixed(1)} ${unitLabel}` : '–',
              },
              {
                label: res === 'day' ? 'Bästa dagen' : res === 'week' ? 'Bästa veckan' : 'Bästa månaden',
                value: best && best.total > 0 ? `${best.fullLabel} · ${toDisplayDistance(best.total, unit).toFixed(1)} ${unitLabel}` : '–',
              },
              {
                label: res === 'day' ? 'Aktiva dagar' : res === 'week' ? 'Aktiva veckor' : 'Aktiva månader',
                value: `${activeCount} av ${buckets.length}`,
              },
              { label: 'Pass under perioden', value: String(periodPasses) },
            ]).map((r, i) => (
              <View key={r.label} style={[s.kpiRow, i > 0 && s.rowBorder]}>
                <Text style={s.kpiLbl}>{r.label}</Text>
                <Text style={s.kpiVal} numberOfLines={1}>{r.value}</Text>
              </View>
            ))}
          </View>
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
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },

  readout: { gap: 2, marginTop: 6 },
  readoutLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  readoutValue: { color: TEXT_PRIMARY, fontSize: 40, fontFamily: NUM_FONT, letterSpacing: -0.5 },
  readoutUnit: { fontSize: 18, fontFamily: NUM_FONT_SEMI, color: TEXT_SECONDARY },
  readoutSub: { color: TEXT_SECONDARY, fontSize: 12 },

  chartCard: { backgroundColor: CARD, borderRadius: 20, padding: 16 },
  lblRow: { flexDirection: 'row', marginTop: 4 },
  lbl: { flex: 1, textAlign: 'center', color: TEXT_SECONDARY, fontSize: 10, fontFamily: NUM_FONT_SEMI },

  sectionHead: {
    color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', letterSpacing: -0.4,
    marginTop: 6, marginBottom: -6,
  },
  card: { backgroundColor: CARD, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 6 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },

  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },
  dot: { width: 9, height: 9, borderRadius: 3 },
  splitLbl: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '500', width: 82 },
  splitTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  splitFill: { height: '100%', borderRadius: 5 },
  splitVal: { fontSize: 16, fontFamily: NUM_FONT, width: 52, textAlign: 'right', fontVariant: ['tabular-nums'] },

  kpiRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 13 },
  kpiLbl: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500' },
  kpiVal: { color: TEXT_PRIMARY, fontSize: 15, fontFamily: NUM_FONT, flexShrink: 1, textAlign: 'right', textTransform: 'capitalize' },
})
