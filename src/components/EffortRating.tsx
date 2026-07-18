import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { BG, GREEN, ORANGE, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT } from '@/lib/theme'

// =============================================================================
// BETYGSÄTT DIN ANSTRÄNGNING (RPE 1–10)
// Fullskärmslager som visas efter avslutat pass. Egen design: stigande staplar
// som fylls i zonfärg (grön → gul → orange → röd) upp till valt betyg.
// =============================================================================

const YELLOW = '#F5A623'
const RED    = '#FF3B4A'

export function effortLabel(n: number): string {
  if (n <= 1) return 'Mycket lätt'
  if (n <= 3) return 'Lätt'
  if (n <= 6) return 'Måttlig'
  if (n <= 8) return 'Svår'
  return 'Maximal'
}

export function effortColor(n: number): string {
  if (n <= 3) return GREEN
  if (n <= 6) return YELLOW
  if (n <= 8) return ORANGE
  return RED
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

  useEffect(() => {
    if (visible) setSel(initial ?? null)
  }, [visible])

  if (!visible) return null

  const accent = sel ? effortColor(sel) : ORANGE

  function pick(n: number) {
    Haptics.selectionAsync()
    setSel(n)
  }

  return (
    <Animated.View entering={FadeIn.duration(200)} style={s.root}>
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
          <Text style={s.readoutHint}>Tryck på en stapel</Text>
        )}
      </View>

      <View style={s.barRow}>
        {BARS.map(n => {
          const h = BAR_MIN_H + ((n - 1) / 9) * (BAR_MAX_H - BAR_MIN_H)
          const filled = sel !== null && n <= sel
          return (
            <TouchableOpacity
              key={n}
              style={s.barHit}
              onPress={() => pick(n)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  s.bar,
                  { height: h },
                  filled
                    ? { backgroundColor: accent }
                    : { backgroundColor: 'rgba(255,255,255,0.10)' },
                ]}
              />
            </TouchableOpacity>
          )
        })}
      </View>

      <View style={s.btnRow}>
        <TouchableOpacity style={s.skipBtn} onPress={() => onDone(null)} activeOpacity={0.7}>
          <Text style={s.skipText}>Hoppa över</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.doneBtn, { backgroundColor: sel ? accent : 'rgba(255,255,255,0.12)' }]}
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
    backgroundColor: BG,
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
