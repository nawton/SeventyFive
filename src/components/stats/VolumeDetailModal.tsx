import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Modal, ScrollView, Dimensions, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Text as SvgText, Line as SvgLine, Rect, G } from 'react-native-svg'
import { GlassSegment } from '@/components/GlassSegment'
import { GlassCircleButton } from '@/components/GlassButton'
import { BG, CARD, ORANGE, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, NUM_FONT_SEMI, DIVIDER } from '@/lib/theme'
import { toLocalDateString, parseLocalDate, startOfWeek, isoWeekNum } from '@/lib/date'
import type { StrengthWorkout } from '@/services/workouts'

// =============================================================================
// VOLYM I DETALJ — samma mönster som Distans-detaljvyn men för lyft volym:
// dag/vecka/månad, bläddring bakåt, tryck på staplar för att inspektera.
// =============================================================================

const SCREEN_W = Dimensions.get('window').width

type Res = 'day' | 'week' | 'month'

interface Bucket {
  key: string
  label: string
  fullLabel: string
  volume: number
  sets: number
  days: Set<string>
  isCurrent: boolean
}

function workoutDate(w: StrengthWorkout): string {
  return w.data.workout_date ?? toLocalDateString(new Date(w.created_at))
}

/** Bygger staplarna för en "sida": offset 0 = nu, -1 = föregående sida osv. */
function buildBuckets(workouts: StrengthWorkout[], res: Res, offset: number): Bucket[] {
  const add = (buckets: Bucket[], key: string, w: StrengthWorkout) => {
    const b = buckets.find(x => x.key === key)
    if (!b) return
    b.volume += w.data.sets.reduce((s, r) => s + r.reps * (r.weight_kg || 0), 0)
    b.sets += w.data.sets.length
    b.days.add(workoutDate(w))
  }

  if (res === 'day') {
    const mon = startOfWeek()
    mon.setDate(mon.getDate() + offset * 7)
    const today = toLocalDateString(new Date())
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon); d.setDate(d.getDate() + i)
      const key = toLocalDateString(d)
      return {
        key,
        label: ['M', 'T', 'O', 'T', 'F', 'L', 'S'][i],
        fullLabel: d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }),
        volume: 0, sets: 0, days: new Set<string>(),
        isCurrent: key === today,
      }
    })
    workouts.forEach(w => add(buckets, workoutDate(w), w))
    return buckets
  }

  if (res === 'week') {
    const cur = startOfWeek()
    cur.setDate(cur.getDate() + offset * 7 * 7)
    const thisMon = toLocalDateString(startOfWeek())
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const mon = new Date(cur); mon.setDate(mon.getDate() - (6 - i) * 7)
      const wn = isoWeekNum(mon)
      const key = toLocalDateString(mon)
      return {
        key,
        label: String(wn),
        fullLabel: `Vecka ${wn}`,
        volume: 0, sets: 0, days: new Set<string>(),
        isCurrent: key === thisMon,
      }
    })
    workouts.forEach(w => add(buckets, toLocalDateString(startOfWeek(parseLocalDate(workoutDate(w)))), w))
    return buckets
  }

  const now = new Date()
  const nowKey = `${now.getFullYear()}-${now.getMonth()}`
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset * 6 - (5 - i), 1)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    return {
      key,
      label: d.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', ''),
      fullLabel: d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' }),
      volume: 0, sets: 0, days: new Set<string>(),
      isCurrent: key === nowKey,
    }
  })
  workouts.forEach(w => {
    const d = parseLocalDate(workoutDate(w))
    add(buckets, `${d.getFullYear()}-${d.getMonth()}`, w)
  })
  return buckets
}

function pageLabel(res: Res, buckets: Bucket[], offset: number): string {
  if (res === 'day') {
    if (offset === 0) return 'Denna vecka'
    const first = parseLocalDate(buckets[0].key)
    const last  = parseLocalDate(buckets[6].key)
    const sameMonth = first.getMonth() === last.getMonth()
    const fmt = (d: Date, withMonth: boolean) =>
      withMonth ? d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '') : String(d.getDate())
    return `${fmt(first, !sameMonth)}–${fmt(last, true)}`
  }
  const last = buckets[buckets.length - 1]
  if (res === 'week') return `V${buckets[0].label} – V${last.label}`
  const short = (b: Bucket) => b.fullLabel.replace(/^(\w{3})\w*/, '$1')
  return `${short(buckets[0])} – ${short(last)}`
}

function fmtKg(v: number): string {
  return Math.round(v).toLocaleString('sv-SE')
}

export function VolumeDetailModal({ visible, onClose, workouts }: {
  visible: boolean
  onClose: () => void
  workouts: StrengthWorkout[]
}) {
  const insets = useSafeAreaInsets()
  const [res, setRes] = useState<Res>('day')
  const [offset, setOffset] = useState(0)
  const [selKey, setSelKey] = useState<string | null>(null)

  const buckets = useMemo(() => buildBuckets(workouts, res, offset), [workouts, res, offset])

  const sel = selKey ? buckets.find(b => b.key === selKey) ?? null : null
  const periodVolume = buckets.reduce((s, b) => s + b.volume, 0)
  const periodSets   = buckets.reduce((s, b) => s + b.sets, 0)
  const activeCount  = buckets.filter(b => b.volume > 0 || b.sets > 0).length
  const best = buckets.reduce<Bucket | null>((b, x) => (x.volume > (b?.volume ?? 0) ? x : b), null)

  const shown = sel ?? {
    fullLabel: 'Totalt',
    volume: periodVolume,
    sets: periodSets,
  }

  const resAvgLabel = res === 'day' ? 'Snitt per aktiv dag' : res === 'week' ? 'Snitt per aktiv vecka' : 'Snitt per aktiv månad'

  function changeRes(r: Res) { setRes(r); setOffset(0); setSelKey(null) }
  function nav(dir: -1 | 1) { setOffset(o => Math.min(0, o + dir)); setSelKey(null) }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
          <GlassCircleButton icon="chevron-back" onPress={onClose} />
          <Text style={s.topTitle}>Volym</Text>
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

          <View style={s.navRow}>
            <TouchableOpacity style={s.navBtn} onPress={() => nav(-1)} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={s.navLabel}>{pageLabel(res, buckets, offset)}</Text>
            <TouchableOpacity style={s.navBtn} onPress={() => nav(1)} disabled={offset >= 0} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={20} color={offset >= 0 ? 'rgba(255,255,255,0.18)' : TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>

          <View style={s.readout}>
            <Text style={s.readoutLabel}>{shown.fullLabel}</Text>
            <Text style={s.readoutValue}>
              {fmtKg(shown.volume)}
              <Text style={s.readoutUnit}> KG</Text>
            </Text>
            <Text style={s.readoutSub}>{shown.sets} set</Text>
          </View>

          {/* Staplar — tryck för att inspektera en period */}
          <View style={s.chartCard}>
            {(() => {
              const CH_W = SCREEN_W - 40 - 32
              const CH_H = 220
              const n = buckets.length
              const slot = CH_W / n
              const barW = Math.max(8, Math.min(30, Math.round(slot * 0.5)))
              const maxV = Math.max(...buckets.map(b => b.volume), 1)
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
                      if (b.volume <= 0) {
                        return <Rect key={b.key} x={x} y={CH_H - 7} width={barW} height={3} rx={1.5} fill="rgba(255,255,255,0.10)" />
                      }
                      const h = Math.max(3, b.volume * scale)
                      const y = CH_H - 4 - h
                      return (
                        <G key={b.key} onPress={() => setSelKey(k => k === b.key ? null : b.key)}>
                          <Rect x={i * slot} y={0} width={slot} height={CH_H} fill="transparent" />
                          <Rect x={x} y={y} width={barW} height={h} rx={3} fill={ORANGE} opacity={dimmed ? 0.28 : 1} />
                          {sel?.key === b.key && (
                            <SvgText x={x + barW / 2} y={y - 8} fontSize={11} fontWeight="700" textAnchor="middle" fill="#fff">
                              {fmtKg(b.volume)}
                            </SvgText>
                          )}
                        </G>
                      )
                    })}
                  </Svg>
                  <View style={s.lblRow}>
                    {buckets.map(b => (
                      <Text key={b.key} style={[s.lbl, b.isCurrent && { color: ORANGE }, sel?.key === b.key && { color: TEXT_PRIMARY }]}>
                        {b.label}
                      </Text>
                    ))}
                  </View>
                </>
              )
            })()}
          </View>

          {/* Nyckeltal för sidan */}
          <Text style={s.sectionHead}>Nyckeltal</Text>
          <View style={s.card}>
            {([
              {
                label: resAvgLabel,
                value: activeCount > 0 ? `${fmtKg(periodVolume / activeCount)} kg` : '–',
              },
              {
                label: res === 'day' ? 'Bästa dagen' : res === 'week' ? 'Bästa veckan' : 'Bästa månaden',
                value: best && best.volume > 0 ? `${best.fullLabel} · ${fmtKg(best.volume)} kg` : '–',
              },
              {
                label: res === 'day' ? 'Aktiva dagar' : res === 'week' ? 'Aktiva veckor' : 'Aktiva månader',
                value: `${activeCount} av ${buckets.length}`,
              },
              { label: 'Set under perioden', value: String(periodSets) },
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

  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  navBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  navLabel: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },

  readout: { gap: 2, marginTop: -4 },
  readoutLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  readoutValue: { color: TEXT_PRIMARY, fontSize: 40, fontFamily: NUM_FONT, letterSpacing: -0.5 },
  readoutUnit: { fontSize: 18, fontFamily: NUM_FONT_SEMI, color: TEXT_SECONDARY },
  readoutSub: { color: TEXT_SECONDARY, fontSize: 12, fontFamily: NUM_FONT_SEMI },

  chartCard: { backgroundColor: CARD, borderRadius: 20, padding: 16 },
  lblRow: { flexDirection: 'row', marginTop: 4 },
  lbl: { flex: 1, textAlign: 'center', color: TEXT_SECONDARY, fontSize: 10, fontFamily: NUM_FONT_SEMI },

  sectionHead: {
    color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', letterSpacing: -0.4,
    marginTop: 6, marginBottom: -6,
  },
  card: { backgroundColor: CARD, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 6 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER },
  kpiRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 13 },
  kpiLbl: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500' },
  kpiVal: { color: TEXT_PRIMARY, fontSize: 15, fontFamily: NUM_FONT, flexShrink: 1, textAlign: 'right', textTransform: 'capitalize' },
})
