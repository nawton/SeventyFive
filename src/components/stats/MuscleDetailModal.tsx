import { View, Text, StyleSheet, Modal, ScrollView, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Text as SvgText, Polygon, Line as SvgLine } from 'react-native-svg'
import { GlassCircleButton } from '@/components/GlassButton'
import { BG, CARD, ORANGE, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT } from '@/lib/theme'

// =============================================================================
// MUSKELFÖRDELNING I DETALJ — öppnas från "Tränade muskler" på gympass-fliken.
// Radar (vald vecka mot förra) + set per muskelgrupp, i Apple-stilen.
// =============================================================================

const SCREEN_W = Dimensions.get('window').width

export function MuscleDetailModal({
  visible, onClose, weekLabel, groups, radarCur, radarPrev, setsPerGroup, totalSets,
}: {
  visible: boolean
  onClose: () => void
  weekLabel: string
  groups: string[]
  radarCur: number[]
  radarPrev: number[]
  setsPerGroup: number[]
  totalSets: number
}) {
  const insets = useSafeAreaInsets()
  const maxGroupSets = Math.max(...setsPerGroup, 1)

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
          <GlassCircleButton icon="chevron-back" onPress={onClose} />
          <Text style={s.topTitle}>Muskler</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
          <Text style={s.weekLabel}>{weekLabel}</Text>

          {/* Radar — vald vecka (orange) mot förra veckan (grå) */}
          <Text style={s.sectionHead}>Muskelfördelning</Text>
          <View style={[s.card, { alignItems: 'center', paddingVertical: 12 }]}>
            {(() => {
              const W = SCREEN_W - 72
              const H = 260
              const cx = W / 2
              const cy = H / 2
              const R = 90
              const maxV = Math.max(...radarCur, ...radarPrev, 1)
              const pt = (i: number, v: number) => {
                const a = (-90 + i * 60) * (Math.PI / 180)
                const r = (v / maxV) * R
                return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
              }
              const ring = (f: number) => groups.map((_, i) => pt(i, maxV * f)).join(' ')
              return (
                <Svg width={W} height={H}>
                  {[0.25, 0.5, 0.75, 1].map(f => (
                    <Polygon key={f} points={ring(f)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
                  ))}
                  {groups.map((_, i) => {
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
                  {radarPrev.some(v => v > 0) && (
                    <Polygon
                      points={radarPrev.map((v, i) => pt(i, v)).join(' ')}
                      fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.30)" strokeWidth={1.5}
                    />
                  )}
                  {radarCur.some(v => v > 0) && (
                    <Polygon
                      points={radarCur.map((v, i) => pt(i, v)).join(' ')}
                      fill={ORANGE + '33'} stroke={ORANGE} strokeWidth={2}
                    />
                  )}
                  {groups.map((g, i) => {
                    const a = (-90 + i * 60) * (Math.PI / 180)
                    return (
                      <SvgText
                        key={g}
                        x={cx + (R + 24) * Math.cos(a)} y={cy + (R + 24) * Math.sin(a) + 4}
                        fontSize={12} fontWeight="600" textAnchor="middle"
                        fill="rgba(255,255,255,0.65)"
                      >
                        {g}
                      </SvgText>
                    )
                  })}
                </Svg>
              )
            })()}
            <View style={s.legend}>
              <View style={s.legItem}>
                <View style={[s.legDot, { backgroundColor: ORANGE }]} />
                <Text style={s.legText}>Vald vecka</Text>
              </View>
              <View style={s.legItem}>
                <View style={[s.legDot, { backgroundColor: 'rgba(255,255,255,0.35)' }]} />
                <Text style={s.legText}>Förra veckan</Text>
              </View>
            </View>
          </View>

          {/* Set per muskelgrupp */}
          <Text style={s.sectionHead}>Set per muskelgrupp</Text>
          <View style={[s.card, { paddingVertical: 6 }]}>
            <View style={s.grpRow}>
              <Text style={[s.grpLbl, { fontWeight: '700' }]}>Totalt</Text>
              <View style={s.grpTrack} />
              <Text style={s.grpVal}>{totalSets}</Text>
            </View>
            {groups.map((g, i) => (
              <View key={g} style={[s.grpRow, s.grpRowBorder]}>
                <Text style={s.grpLbl}>{g}</Text>
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
              Logga set med vikt i dina gympass så fylls staplarna på — grafen bygger på dina sparade set.
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
  scroll: { paddingHorizontal: 20, paddingTop: 4 },
  weekLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },

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
  grpRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  grpLbl: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '500', width: 62 },
  grpTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  grpFill: { height: '100%', borderRadius: 5, backgroundColor: ORANGE },
  grpVal: { color: TEXT_PRIMARY, fontSize: 15, fontFamily: NUM_FONT, width: 34, textAlign: 'right', fontVariant: ['tabular-nums'] },

  hint: { color: TEXT_SECONDARY, fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: 'center' },
})
