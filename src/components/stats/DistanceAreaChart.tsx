import Svg, { Polygon, Polyline, Circle, Line as SvgLine, Text as SvgText, Rect, G } from 'react-native-svg'
import { CARD, ORANGE } from '@/lib/theme'
import { toDisplayDistance, distanceUnitLabel, type UnitSystem } from '@/lib/units'

// =============================================================================
// DISTANSGRAF — linje med fylld yta i Strava-stil, i stället för staplar.
// Skalan anpassar sig efter hur mycket man rör sig: taket är periodens
// maxvärde (rör man sig 0–5 km går skalan till 5, inte till 30), med runda
// rutnätssteg och etiketter i högerkanten.
// =============================================================================

export interface AreaBucket {
  key:       string
  label:     string
  total:     number   // km — konverteras till vald enhet vid rendering
  isCurrent: boolean
}

const AXIS_W  = 44   // högermarginal för skaletiketterna
const X_LBL_H = 20   // utrymme för periodetiketterna under plotten
const TOP_PAD = 10

// Runda rutnätssteg så att 1–3 mellanlinjer får plats under taket
function niceStep(yMax: number): number {
  for (const c of [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 500]) {
    if (yMax / c <= 3.2) return c
  }
  return 1000
}

export function DistanceAreaChart({
  buckets, width, height, unit, color = ORANGE, selectedKey, onSelect,
}: {
  buckets: AreaBucket[]
  width:   number
  height:  number
  unit:    UnitSystem
  color?:  string
  /** Vald punkt markeras med guide-linje och punkt — styrs av föräldern */
  selectedKey?: string | null
  onSelect?:    (key: string) => void
}) {
  const unitLabel = distanceUnitLabel(unit)
  const vals    = buckets.map(b => toDisplayDistance(b.total, unit))
  const dataMax = Math.max(...vals, 0)
  const yMax    = dataMax > 0 ? dataMax : 1

  const plotW = width - AXIS_W
  const baseY = height - X_LBL_H
  const plotH = baseY - TOP_PAD
  const n     = buckets.length
  const px = (i: number) => n === 1 ? plotW / 2 : (i / (n - 1)) * (plotW - 10) + 5
  const py = (v: number) => TOP_PAD + (1 - v / yMax) * plotH

  const step = niceStep(yMax)
  // Mellanlinjer upp till strax under taket — toppetiketten ska inte krocka
  const grids: number[] = []
  for (let v = step; v <= yMax * 0.94 + 1e-9; v += step) grids.push(v)

  const fmtV = (v: number) =>
    v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10).replace('.', ',')

  const linePts = vals.map((v, i) => `${px(i)},${py(v)}`).join(' ')
  const areaPts = `${px(0)},${baseY} ${linePts} ${px(n - 1)},${baseY}`
  const selIdx  = selectedKey ? buckets.findIndex(b => b.key === selectedKey) : -1

  // Träffytor: kolumnen kring varje punkt, delad vid mittpunkterna
  const hitLeft  = (i: number) => i === 0 ? 0 : (px(i - 1) + px(i)) / 2
  const hitRight = (i: number) => i === n - 1 ? plotW : (px(i) + px(i + 1)) / 2

  return (
    <Svg width={width} height={height}>
      {/* Baslinje + rutnät med skaletiketter i högerkanten */}
      {[0, ...grids].map(v => (
        <G key={v}>
          <SvgLine x1={0} x2={plotW} y1={py(v)} y2={py(v)} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
          <SvgText x={width - 2} y={py(v) + 3.5} fontSize={10} textAnchor="end" fill="rgba(255,255,255,0.45)">
            {`${fmtV(v)} ${unitLabel}`}
          </SvgText>
        </G>
      ))}
      {/* Toppetikett = periodens max — det är detta som gör skalan adaptiv */}
      {dataMax > 0 && (
        <SvgText x={width - 2} y={py(yMax) + 3.5} fontSize={10} fontWeight="700" textAnchor="end" fill="rgba(255,255,255,0.7)">
          {`${fmtV(yMax)} ${unitLabel}`}
        </SvgText>
      )}

      <Polygon points={areaPts} fill={color} fillOpacity={0.18} />
      <Polyline points={linePts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {selIdx >= 0 && (
        <G>
          <SvgLine x1={px(selIdx)} x2={px(selIdx)} y1={TOP_PAD} y2={baseY} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
          <Circle cx={px(selIdx)} cy={py(vals[selIdx])} r={5} fill={color} stroke={CARD} strokeWidth={2} />
        </G>
      )}

      {/* Periodetiketter under plotten, i linje med punkterna */}
      {buckets.map((b, i) => (
        <SvgText
          key={b.key}
          x={px(i)} y={height - 6}
          fontSize={10} textAnchor="middle"
          fontWeight={b.isCurrent || selectedKey === b.key ? '700' : '400'}
          fill={selectedKey === b.key ? '#fff' : b.isCurrent ? color : 'rgba(255,255,255,0.45)'}
        >
          {b.label}
        </SvgText>
      ))}

      {/* Osynliga träffytor gör punkterna lätta att pricka */}
      {onSelect && buckets.map((b, i) => (
        <Rect
          key={`hit-${b.key}`}
          x={hitLeft(i)} y={0}
          width={hitRight(i) - hitLeft(i)} height={height}
          fill="transparent"
          onPress={() => onSelect(b.key)}
        />
      ))}
    </Svg>
  )
}
