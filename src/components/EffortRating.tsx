import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native'
import Animated, { FadeIn, runOnJS } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { BG, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, DIVIDER, THEME_DARK, THEME_LIGHT, useThemeStrings, ACCENT } from '@/lib/theme'

// =============================================================================
// BETYGSÄTT DIN ANSTRÄNGNING (RPE 1–10)
// Fullskärmslager som visas efter avslutat pass. Egen design: stigande staplar
// som fylls i zonfärg (grön → gul → orange → röd) upp till valt betyg.
// =============================================================================

export function effortLabel(n: number): string {
  if (n <= 1) return 'Mycket lätt'
  if (n <= 3) return 'Lätt'
  if (n <= 6) return 'Måttlig'
  if (n <= 8) return 'Svår'
  return 'Maximal'
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
    return Math.round(255 * c).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** Gradvis färgskala 1–10: grönt → gulgrönt → gult → orange → rött.
 *  Ett litet nyansskifte per steg — subtilt men tydligt över hela skalan. */
export function effortColor(n: number): string {
  const t = (Math.min(10, Math.max(1, n)) - 1) / 9
  const hue = 140 - t * 140   // 140° (grön) → 0° (röd)
  return hslToHex(hue, 0.82, 0.58)
}

const BARS = Array.from({ length: 10 }, (_, i) => i + 1)
const BAR_MIN_H = 30
const BAR_MAX_H = 130

interface Props {
  visible: boolean
  initial?: number | null
  /** null = hoppade över */
  onDone: (effort: number | null) => void
}

export function EffortRating({ visible, initial, onDone }: Props) {
  const [sel, setSel] = useState<number | null>(initial ?? null)
  const lastSel = useRef<number | null>(initial ?? null)
  const rowW = useRef(0)

  useEffect(() => {
    if (visible) {
      setSel(initial ?? null)
      lastSel.current = initial ?? null
    }
  }, [visible])

  // Dra fingret över staplarna för att öka/minska — tap fungerar också
  function slideTo(x: number) {
    if (rowW.current <= 0) return
    const n = Math.min(10, Math.max(1, Math.ceil((x / rowW.current) * 10)))
    if (n !== lastSel.current) {
      lastSel.current = n
      Haptics.selectionAsync()
      setSel(n)
    }
  }
  const slide = Gesture.Pan()
    .minDistance(0)
    .onBegin(e => { runOnJS(slideTo)(e.x) })
    .onUpdate(e => { runOnJS(slideTo)(e.x) })

  if (!visible) return null

  const T = useThemeStrings()
  const accent = sel ? effortColor(sel) : T.ACCENT
  // Gradienten kräver riktiga strängfärger — dynamiska färgobjekt går inte
  const bgStr = T.BG

  return (
    <Animated.View entering={FadeIn.duration(200)} style={[s.root, { backgroundColor: bgStr }]}>
      {/* Hela bakgrunden tonas i betygets färg */}
      <LinearGradient
        colors={sel ? [accent + '8C', accent + '26', bgStr] : [bgStr, bgStr]}
        locations={sel ? [0, 0.55, 1] : [0, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Text style={s.title}>Betygsätt din{'\n'}ansträngning</Text>
      <Text style={s.sub}>Hur kändes passet?</Text>

      <View style={s.readout}>
        {sel ? (
          <>
            <View style={[s.numBadge, { backgroundColor: accent + '26', borderColor: accent }]}>
              <Text style={[s.numText, { color: accent }]}>{sel}</Text>
            </View>
            <Text style={s.readoutLabel}>{effortLabel(sel)}</Text>
          </>
        ) : (
          <Text style={s.readoutHint}>Dra eller tryck på staplarna</Text>
        )}
      </View>

      <GestureDetector gesture={slide}>
        <View
          style={s.barRow}
          onLayout={e => { rowW.current = e.nativeEvent.layout.width }}
        >
          {BARS.map(n => {
            const h = BAR_MIN_H + ((n - 1) / 9) * (BAR_MAX_H - BAR_MIN_H)
            const filled = sel !== null && n <= sel
            return (
              <View key={n} style={s.barHit} pointerEvents="none">
                <View
                  style={[
                    s.bar,
                    { height: h },
                    filled
                      ? { backgroundColor: accent }
                      : { backgroundColor: 'rgba(255,255,255,0.14)' },
                  ]}
                />
              </View>
            )
          })}
        </View>
      </GestureDetector>

      <View style={s.btnRow}>
        <TouchableOpacity style={s.skipBtn} onPress={() => onDone(null)} activeOpacity={0.7}>
          <Text style={s.skipText}>Hoppa över</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.doneBtn, { backgroundColor: sel ? accent : DIVIDER }]}
          onPress={() => { if (sel) onDone(sel) }}
          activeOpacity={0.8}
          disabled={!sel}
        >
          <Text style={[s.doneText, !sel && { color: TEXT_SECONDARY }]}>Klar</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: { color: TEXT_PRIMARY, fontSize: 28, fontWeight: '800', textAlign: 'center', lineHeight: 34 },
  sub:   { color: TEXT_SECONDARY, fontSize: 14, marginTop: 8 },

  readout:      { height: 64, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12, marginTop: 26 },
  numBadge:     { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  numText:      { fontSize: 20, fontFamily: NUM_FONT },
  readoutLabel: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '700' },
  readoutHint:  { color: TEXT_SECONDARY, fontSize: 15 },

  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 18, height: BAR_MAX_H },
  barHit: { justifyContent: 'flex-end' },
  bar:    { width: 24, borderRadius: 8 },

  btnRow:   { flexDirection: 'row', gap: 12, marginTop: 44, alignSelf: 'stretch' },
  skipBtn:  { flex: 1, paddingVertical: 15, borderRadius: 16, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  skipText: { color: TEXT_SECONDARY, fontSize: 15, fontWeight: '600' },
  doneBtn:  { flex: 1, paddingVertical: 15, borderRadius: 16, alignItems: 'center' },
  doneText: { color: '#0B0B0D', fontSize: 15, fontWeight: '800' },
})
