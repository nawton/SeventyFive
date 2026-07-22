import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Modal, ScrollView, Dimensions, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { GlassSegment } from '@/components/GlassSegment'
import { GlassCircleButton } from '@/components/GlassButton'
import { DistanceAreaChart } from './DistanceAreaChart'
import { BG, CARD, GREEN, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, NUM_FONT_SEMI, DIVIDER, ACCENT } from '@/lib/theme'
import { toLocalDateString, parseLocalDate, startOfWeek, isoWeekNum } from '@/lib/date'
import { fmtPace, fmtDuration } from '@/lib/format'
import { toDisplayDistance, distanceUnitLabel, paceForUnit, type UnitSystem } from '@/lib/units'
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
  secs: number
  cals: number
  longest: number      // längsta enskilda pass (km) i perioden
  isCurrent: boolean
}

/** Bygger staplarna för en "sida": offset 0 = nu, -1 = föregående sida osv. */
function buildBuckets(workouts: CardioWorkout[], res: Res, offset: number): Bucket[] {
  const catOf = (t: string) => t === 'cycling' ? 'cycle' as const : t === 'walking' ? 'walk' as const : 'run' as const
  const add = (buckets: Bucket[], key: string, w: CardioWorkout) => {
    const b = buckets.find(x => x.key === key)
    if (!b) return
    b[catOf(w.data.type ?? 'running')] += w.data.distance_km
    b.total += w.data.distance_km
    b.passes += 1
    b.secs += w.data.duration_seconds
    b.cals += w.data.calories
    b.longest = Math.max(b.longest, w.data.distance_km)
  }

  if (res === 'day') {
    // En vecka i taget, Mån–Sön — som i träningsappar
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
        run: 0, cycle: 0, walk: 0, total: 0, passes: 0, secs: 0, cals: 0, longest: 0,
        isCurrent: key === today,
      }
    })
    workouts.forEach(w => add(buckets, toLocalDateString(new Date(w.created_at)), w))
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
        run: 0, cycle: 0, walk: 0, total: 0, passes: 0, secs: 0, cals: 0, longest: 0,
        isCurrent: key === thisMon,
      }
    })
    workouts.forEach(w => add(buckets, toLocalDateString(startOfWeek(new Date(w.created_at))), w))
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
      run: 0, cycle: 0, walk: 0, total: 0, passes: 0, secs: 0, cals: 0, longest: 0,
      isCurrent: key === nowKey,
    }
  })
  workouts.forEach(w => {
    const d = new Date(w.created_at)
    add(buckets, `${d.getFullYear()}-${d.getMonth()}`, w)
  })
  return buckets
}

/** Rubrik för sidan man bläddrat till, t.ex. "14–20 juli" eller "V18 – V29" */
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



export function DistanceDetailModal({ visible, onClose, workouts, unit }: {
  visible: boolean
  onClose: () => void
  workouts: CardioWorkout[]
  unit: UnitSystem
}) {
  const insets = useSafeAreaInsets()
  const [res, setRes] = useState<Res>('day')
  const [offset, setOffset] = useState(0)
  const [selKey, setSelKey] = useState<string | null>(null)

  const buckets = useMemo(() => buildBuckets(workouts, res, offset), [workouts, res, offset])
  const unitLabel = distanceUnitLabel(unit)

  const sel = selKey ? buckets.find(b => b.key === selKey) ?? null : null
  const periodTotal  = buckets.reduce((s, b) => s + b.total, 0)
  const periodPasses = buckets.reduce((s, b) => s + b.passes, 0)
  const periodSecs   = buckets.reduce((s, b) => s + b.secs, 0)
  const periodCals   = buckets.reduce((s, b) => s + b.cals, 0)
  const pageLongest  = buckets.reduce((s, b) => Math.max(s, b.longest), 0)
  const activeCount  = buckets.filter(b => b.total > 0).length
  const best = buckets.reduce<Bucket | null>((b, x) => (x.total > (b?.total ?? 0) ? x : b), null)

  // Det som visas i rubriken + fördelningen: vald stapel eller hela sidan
  const shown = sel ?? {
    fullLabel: 'Totalt',
    run:   buckets.reduce((s, b) => s + b.run, 0),
    cycle: buckets.reduce((s, b) => s + b.cycle, 0),
    walk:  buckets.reduce((s, b) => s + b.walk, 0),
    total: periodTotal,
    passes: periodPasses,
    secs: periodSecs,
    cals: periodCals,
  }

  const resAvgLabel = res === 'day' ? 'Snitt per aktiv dag' : res === 'week' ? 'Snitt per aktiv vecka' : 'Snitt per aktiv månad'

  function changeRes(r: Res) {
    setRes(r)
    setOffset(0)
    setSelKey(null)
  }
  function nav(dir: -1 | 1) {
    setOffset(o => Math.min(0, o + dir))
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

          {/* Bläddra bakåt/framåt i tiden — som i träningsappar */}
          <View style={s.navRow}>
            <TouchableOpacity style={s.navBtn} onPress={() => nav(-1)} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={s.navLabel}>{pageLabel(res, buckets, offset)}</Text>
            <TouchableOpacity
              style={s.navBtn}
              onPress={() => nav(1)}
              disabled={offset >= 0}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={20} color={offset >= 0 ? 'rgba(255,255,255,0.18)' : TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>

          {/* Rubrik: vald stapel eller hela perioden */}
          <View style={s.readout}>
            <Text style={s.readoutLabel}>{shown.fullLabel}</Text>
            <Text style={s.readoutValue}>
              {toDisplayDistance(shown.total, unit).toFixed(2).replace('.', ',')}
              <Text style={s.readoutUnit}> {unitLabel.toUpperCase()}</Text>
            </Text>
            <Text style={s.readoutSub}>
              {shown.passes} pass · {fmtDuration(shown.secs)}
              {shown.total > 0.1 ? ` · ${fmtPace(paceForUnit(shown.secs / shown.total, unit))} /${unitLabel}` : ''}
            </Text>
          </View>

          {/* Graf — linje med fylld yta och adaptiv skala; tryck på en punkt
              för att inspektera perioden */}
          <View style={s.chartCard}>
            <DistanceAreaChart
              buckets={buckets}
              width={SCREEN_W - 40 - 32}
              height={220}
              unit={unit}
              selectedKey={selKey}
              onSelect={key => setSelKey(k => k === key ? null : key)}
              onScrub={setSelKey}
            />
          </View>

          {/* Fördelning per aktivitet — för valet eller hela perioden */}
          <Text style={s.sectionHead}>Fördelning</Text>
          <View style={s.card}>
            {([
              { color: ACCENT, label: 'Löpning',  v: shown.run },
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
              { label: 'Total tid', value: periodSecs > 0 ? fmtDuration(periodSecs) : '–' },
              { label: 'Kalorier', value: periodCals > 0 ? `${periodCals.toLocaleString('sv-SE')} kcal` : '–' },
              {
                label: 'Snittempo',
                value: periodTotal > 0.1 ? `${fmtPace(paceForUnit(periodSecs / periodTotal, unit))} /${unitLabel}` : '–',
              },
              {
                label: 'Längsta pass',
                value: pageLongest > 0 ? `${toDisplayDistance(pageLongest, unit).toFixed(2)} ${unitLabel}` : '–',
              },
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

  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  navBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  navLabel: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },

  readout: { gap: 2, marginTop: -4 },
  readoutLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  readoutValue: { color: TEXT_PRIMARY, fontSize: 40, fontFamily: NUM_FONT, letterSpacing: -0.5 },
  readoutUnit: { fontSize: 18, fontFamily: NUM_FONT_SEMI, color: TEXT_SECONDARY },
  readoutSub: { color: TEXT_SECONDARY, fontSize: 12 },

  chartCard: { backgroundColor: CARD, borderRadius: 20, padding: 16 },

  sectionHead: {
    color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', letterSpacing: -0.4,
    marginTop: 6, marginBottom: -6,
  },
  card: { backgroundColor: CARD, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 6 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER },

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
