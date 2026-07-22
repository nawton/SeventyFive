import { useRef } from 'react'
import { View } from 'react-native'
import { useColorScheme } from 'react-native'
import Svg, { Path, Circle, Line as SvgLine, Text as SvgText, Rect, G } from 'react-native-svg'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { CARD, ACCENT } from '@/lib/theme'
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

// Mjuk kurva genom punkterna (Catmull-Rom → bezier). Kontrollpunkterna kläms
// till plottens höjd så kurvan aldrig dippar under nollinjen vid en ensam
// topp eller skjuter över taket — platta nollperioder förblir helt platta.
function smoothLine(pts: Array<{ x: number; y: number }>, minY: number, maxY: number): string {
  if (pts.length === 0) return ''
  const clamp = (y: number) => Math.min(maxY, Math.max(minY, y))
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6)
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6)
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`
  }
  return d
}

export function DistanceAreaChart({
  buckets, width, height, unit, color = ACCENT, selectedKey, onSelect, onScrub, onScrubEnd, pagerRef,
}: {
  buckets: AreaBucket[]
  width:   number
  height:  number
  unit:    UnitSystem
  color?:  import('react-native').ColorValue
  /** Vald punkt markeras med guide-linje och punkt — styrs av föräldern */
  selectedKey?: string | null
  onSelect?:    (key: string) => void
  /** Håll fingret på grafen och dra mellan punkterna — sätter valet löpande */
  onScrub?:     (key: string) => void
  /** Anropas när fingret släpper — utelämna för att låta valet ligga kvar */
  onScrubEnd?:  () => void
  /** Flik-pagern måste vänta på scrubben — annars byter man sida i stället */
  pagerRef?:    React.RefObject<unknown>
}) {
  // Linjen och ytan går i turkos medan punkterna behåller accentfärgen.
  // SVG + ljust läge kräver strängfärger — vit-alfa syns inte på vitt.
  const light = useColorScheme() === 'light'
  const lineColor = light ? '#2CA6AB' : '#40D6DB'
  const gridStroke = light ? 'rgba(0,0,0,0.07)'  : 'rgba(255,255,255,0.07)'
  const yLabel     = light ? 'rgba(0,0,0,0.45)'  : 'rgba(255,255,255,0.45)'
  const yMaxLabel  = light ? 'rgba(0,0,0,0.65)'  : 'rgba(255,255,255,0.7)'
  const selGuide   = light ? 'rgba(0,0,0,0.18)'  : 'rgba(255,255,255,0.18)'
  const selText    = light ? '#111214' : '#fff'
  const axisDim    = light ? 'rgba(0,0,0,0.45)'  : 'rgba(255,255,255,0.45)'
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

  const pts      = vals.map((v, i) => ({ x: px(i), y: py(v) }))
  const linePath = smoothLine(pts, TOP_PAD, baseY)
  const areaPath = linePath
    ? `${linePath} L ${px(n - 1)} ${baseY} L ${px(0)} ${baseY} Z`
    : ''
  const selIdx = selectedKey ? buckets.findIndex(b => b.key === selectedKey) : -1

  // Träffytor: kolumnen kring varje punkt, delad vid mittpunkterna
  const hitLeft  = (i: number) => i === 0 ? 0 : (px(i - 1) + px(i)) / 2
  const hitRight = (i: number) => i === n - 1 ? plotW : (px(i) + px(i + 1)) / 2

  // ── Scrub: håll och dra över grafen → närmaste punkt väljs löpande ──
  const scrubKey = useRef<string | null>(null)
  function scrubAt(x: number) {
    if (!onScrub || n === 0) return
    const i = n === 1 ? 0 : Math.min(n - 1, Math.max(0, Math.round((x - 5) / ((plotW - 10) / (n - 1)))))
    const key = buckets[i].key
    if (key !== scrubKey.current) {
      scrubKey.current = key
      Haptics.selectionAsync().catch(() => {})
      onScrub(key)
    }
  }
  function scrubDone() {
    scrubKey.current = null
    onScrubEnd?.()
  }
  // Kort tryck-och-håll aktiverar — snabba svep lämnas åt scroll och pager
  let scrubGesture = Gesture.Pan()
    .enabled(!!onScrub)
    .minDistance(0)
    .activateAfterLongPress(180)
    .onStart(e => { runOnJS(scrubAt)(e.x) })
    .onUpdate(e => { runOnJS(scrubAt)(e.x) })
    .onFinalize(() => { runOnJS(scrubDone)() })
  if (pagerRef) scrubGesture = scrubGesture.blocksExternalGesture(pagerRef as never)

  const chart = (
    <Svg width={width} height={height}>
      {/* Baslinje + rutnät med skaletiketter i högerkanten */}
      {[0, ...grids].map(v => (
        <G key={v}>
          <SvgLine x1={0} x2={plotW} y1={py(v)} y2={py(v)} stroke={gridStroke} strokeWidth={1} />
          <SvgText x={width - 2} y={py(v) + 3.5} fontSize={10} textAnchor="end" fill={yLabel}>
            {`${fmtV(v)} ${unitLabel}`}
          </SvgText>
        </G>
      ))}
      {/* Toppetikett = periodens max — det är detta som gör skalan adaptiv */}
      {dataMax > 0 && (
        <SvgText x={width - 2} y={py(yMax) + 3.5} fontSize={10} fontWeight="700" textAnchor="end" fill={yMaxLabel}>
          {`${fmtV(yMax)} ${unitLabel}`}
        </SvgText>
      )}

      <Path d={areaPath} fill={lineColor} fillOpacity={0.18} />
      <Path d={linePath} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {/* Punkter på varje mätvärde — alltid synliga (Strava-stil), den valda
          ritas större ovanpå längre ner */}
      {pts.map((p, i) => (
        <Circle
          key={`dot-${buckets[i].key}`}
          cx={p.x} cy={p.y} r={3.5}
          fill={color} stroke={CARD} strokeWidth={1.5}
        />
      ))}

      {selIdx >= 0 && (
        <G>
          <SvgLine x1={px(selIdx)} x2={px(selIdx)} y1={TOP_PAD} y2={baseY} stroke={selGuide} strokeWidth={1} />
          <Circle cx={px(selIdx)} cy={py(vals[selIdx])} r={5} fill={color} stroke={CARD} strokeWidth={2} />
          {/* Värdebubbla vid punkten — klämd så den inte hamnar utanför plotten */}
          <SvgText
            x={Math.min(plotW - 26, Math.max(26, px(selIdx)))}
            y={Math.max(10, py(vals[selIdx]) - 13)}
            fontSize={11} fontWeight="700" textAnchor="middle" fill={selText}
          >
            {`${fmtV(vals[selIdx])} ${unitLabel}`}
          </SvgText>
        </G>
      )}

      {/* Periodetiketter under plotten, i linje med punkterna */}
      {buckets.map((b, i) => (
        <SvgText
          key={b.key}
          x={px(i)} y={height - 6}
          fontSize={10} textAnchor="middle"
          fontWeight={b.isCurrent || selectedKey === b.key ? '700' : '400'}
          fill={selectedKey === b.key ? selText : b.isCurrent ? color : axisDim}
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

  return (
    <GestureDetector gesture={scrubGesture}>
      <View>{chart}</View>
    </GestureDetector>
  )
}
