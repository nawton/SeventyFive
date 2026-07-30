import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@/components/Icon'
import { GlassSegment } from '@/components/GlassSegment'
import { GlassCircleButton } from '@/components/GlassButton'
import { BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, useThemeStrings, useCardChrome } from '@/lib/theme'
import { toLocalDateString } from '@/lib/date'
import { fmtPace, fmtDuration } from '@/lib/format'
import { toDisplayDistance, distanceUnitLabel, paceForUnit, type UnitSystem } from '@/lib/units'
import type { CardioWorkout } from '@/services/workouts'
import { useT, dateLocale } from '@/lib/i18n'

// =============================================================================
// DISTANS I DETALJ — månadsvyn efter förlagan: räckviddsväljare
// (3 mån/6 mån/1 år), mörk totalpanel med pass/tid/snittempo,
// staplar per månad och listan månad för månad med en insiktsrad.
// =============================================================================

const HERO = { bg: '#151B33', sub: '#9AA3BC' }

type Range = 3 | 6 | 12

interface MonthBucket {
  key: string
  /** Kort etikett under stapeln, t.ex. "juli" */
  short: string
  /** Radnamn i listan, t.ex. "Juli" */
  name: string
  km: number
  passes: number
  secs: number
  isCurrent: boolean
}

function buildMonths(workouts: CardioWorkout[], count: Range): MonthBucket[] {
  const now = new Date()
  const nowKey = `${now.getFullYear()}-${now.getMonth()}`
  const buckets: MonthBucket[] = Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1)
    const name = d.toLocaleDateString(dateLocale(), { month: 'long' })
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      short: d.toLocaleDateString(dateLocale(), { month: 'short' }).replace('.', ''),
      name: name.charAt(0).toUpperCase() + name.slice(1),
      km: 0, passes: 0, secs: 0,
      isCurrent: `${d.getFullYear()}-${d.getMonth()}` === nowKey,
    }
  })
  for (const w of workouts) {
    const d = new Date(w.created_at)
    const b = buckets.find(x => x.key === `${d.getFullYear()}-${d.getMonth()}`)
    if (!b) continue
    b.km += w.data.distance_km
    b.passes += 1
    b.secs += w.data.duration_seconds
  }
  return buckets
}

export function DistanceDetailModal({ visible, onClose, workouts, unit }: {
  visible: boolean
  onClose: () => void
  workouts: CardioWorkout[]
  unit: UnitSystem
}) {
  const t = useT()
  const T = useThemeStrings()
  const chrome = useCardChrome()
  const insets = useSafeAreaInsets()
  const unitLabel = distanceUnitLabel(unit)
  const [range, setRange] = useState<Range>(6)

  const months = useMemo(() => buildMonths(workouts, range), [workouts, range])

  const totalKm = months.reduce((s, b) => s + b.km, 0)
  const totalPasses = months.reduce((s, b) => s + b.passes, 0)
  const totalSecs = months.reduce((s, b) => s + b.secs, 0)
  const avgPace = totalKm > 0.1 ? fmtPace(paceForUnit(totalSecs / totalKm, unit)) : '--:--'
  const fmtKm = (v: number) => toDisplayDistance(v, unit).toFixed(2).replace('.', ',')

  // Insiktsraden: ärlig jämförelse istället för dekoration
  const active = months.filter(b => b.passes > 0)
  const current = months[months.length - 1]
  const prevActive = [...months].slice(0, -1).reverse().find(b => b.passes > 0)
  const insight = active.length === 0
    ? t('Inga cardiopass under perioden ännu.')
    : active.length === 1 && current.passes > 0
      ? t('{m} är din första aktiva månad. Fortsätt logga så växer trenden fram här.', { m: current.name })
      : prevActive && current.passes > 0
        ? current.km >= prevActive.km
          ? t('Du ligger {d} {u} före {m}.', { d: fmtKm(current.km - prevActive.km), u: unitLabel, m: prevActive.name.toLowerCase() })
          : t('Du ligger {d} {u} efter {m}.', { d: fmtKm(prevActive.km - current.km), u: unitLabel, m: prevActive.name.toLowerCase() })
        : t('Senast aktiva månad: {m}.', { m: active[active.length - 1].name })

  // Värdesiffran över stapeln: aktuella månaden om den har distans, annars den högsta
  const maxKm = Math.max(...months.map(b => b.km), 0.01)
  const labeledKey = current.km > 0 ? current.key : (active.length ? active.reduce((b, x) => x.km > b.km ? x : b).key : null)

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
          <GlassCircleButton icon="chevron-back" onPress={onClose} />
          <Text style={s.topTitle}>{t('Distans')}</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
          <GlassSegment
            value={String(range)}
            options={[
              { key: '3',  label: t('3 mån') },
              { key: '6',  label: t('6 mån') },
              { key: '12', label: t('1 år') },
            ]}
            onChange={k => setRange(Number(k) as Range)}
          />

          {/* Totalpanelen — mörk marinblå i båda lägena, som översikten */}
          <View style={s.hero}>
            <Text style={s.heroLabel}>
              {range === 12 ? t('Totalt senaste året') : t('Totalt senaste {n} månaderna', { n: range })}
            </Text>
            <Text style={s.heroValue}>
              {fmtKm(totalKm)}
              <Text style={s.heroUnit}> {unitLabel}</Text>
            </Text>
            <View style={s.heroDivider} />
            <View style={s.heroRow}>
              <View style={s.heroCell}>
                <Text style={s.heroCellLbl}>{t('PASS')}</Text>
                <Text style={s.heroCellVal}>{totalPasses}</Text>
              </View>
              <View style={s.heroCell}>
                <Text style={s.heroCellLbl}>{t('TID')}</Text>
                <Text style={s.heroCellVal}>{fmtDuration(totalSecs)}</Text>
              </View>
              <View style={[s.heroCell, { flex: 1.4 }]}>
                <Text style={s.heroCellLbl}>{t('SNITTEMPO')}</Text>
                <Text style={s.heroCellVal}>{avgPace} /{unitLabel}</Text>
              </View>
            </View>
          </View>

          {/* Staplar per månad */}
          <View style={[s.chartCard, chrome]}>
            <Text style={s.cardTitle}>{t('{u} per månad', { u: unitLabel })}</Text>
            <View style={s.barRow}>
              {months.map((b, i) => {
                const showLabel = range <= 6 || b.isCurrent || i % 2 === (months.length - 1) % 2
                return (
                  <View key={b.key} style={s.barCell}>
                    <View style={s.barSlot}>
                      {b.key === labeledKey && b.km > 0 && (
                        <Text style={[s.barValue, { color: T.ACCENT }]} numberOfLines={1}>
                          {toDisplayDistance(b.km, unit).toFixed(2).replace('.', ',')}
                        </Text>
                      )}
                      {b.km > 0
                        ? <View style={[s.bar, {
                            height: Math.max(18, (b.km / maxKm) * 170),
                            backgroundColor: b.isCurrent ? T.ACCENT : `${T.ACCENT}55`,
                            width: range === 12 ? 14 : 26,
                          }]} />
                        : <View style={s.barEmpty} />}
                    </View>
                    <Text style={[s.barLbl, b.isCurrent && { color: T.ACCENT, fontWeight: '700' }]} numberOfLines={1}>
                      {showLabel ? b.short : ''}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>

          {/* Månad för månad — nyaste överst, aktuell månad markerad */}
          <View style={[s.listCard, chrome]}>
            <Text style={s.cardTitle}>{t('Månad för månad')}</Text>
            {[...months].reverse().map(b => (
              <View
                key={b.key}
                style={[s.monthRow, b.isCurrent && { backgroundColor: `${T.ACCENT}10`, borderRadius: 12 }]}
              >
                <Text style={[s.monthName, b.passes === 0 && { color: TEXT_SECONDARY }, b.isCurrent && { fontWeight: '800' }]}>
                  {b.name}
                </Text>
                <Text style={s.monthPasses}>
                  {b.passes === 1 ? t('1 pass') : t('{n} pass', { n: b.passes })}
                </Text>
                <Text style={[
                  s.monthKm,
                  b.passes > 0 ? { color: T.ACCENT } : { color: TEXT_SECONDARY },
                  b.isCurrent && { fontWeight: '800' },
                ]}>
                  {b.km > 0 ? fmtKm(b.km) : '0'} {unitLabel}
                </Text>
              </View>
            ))}

            <View style={[s.insight, { backgroundColor: `${T.ACCENT}0E` }]}>
              <Ionicons name="trending-up" size={17} color={T.ACCENT} />
              <Text style={s.insightText}>{insight}</Text>
            </View>
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
  scroll: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },

  hero: { backgroundColor: HERO.bg, borderRadius: 22, padding: 20 },
  heroLabel: { color: HERO.sub, fontSize: 14, fontWeight: '600' },
  heroValue: { color: '#FFFFFF', fontSize: 44, fontFamily: NUM_FONT, letterSpacing: -0.5, marginTop: 2 },
  heroUnit: { fontSize: 20, color: HERO.sub },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 14 },
  heroRow: { flexDirection: 'row' },
  heroCell: { flex: 1, gap: 3 },
  heroCellLbl: { color: HERO.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  heroCellVal: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },

  chartCard: { backgroundColor: CARD, borderRadius: 20, padding: 16 },
  cardTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '800', marginBottom: 14 },
  barRow: { flexDirection: 'row', alignItems: 'flex-end' },
  barCell: { flex: 1, alignItems: 'center', gap: 8 },
  barSlot: { height: 196, justifyContent: 'flex-end', alignItems: 'center', gap: 6 },
  barValue: { fontSize: 13, fontWeight: '800' },
  bar: { borderRadius: 13 },
  barEmpty: { width: 22, height: 5, borderRadius: 3, backgroundColor: 'rgba(128,128,128,0.22)' },
  barLbl: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },

  listCard: { backgroundColor: CARD, borderRadius: 20, padding: 16 },
  monthRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 10, marginHorizontal: -10,
  },
  monthName: { flex: 1, color: TEXT_PRIMARY, fontSize: 15.5, fontWeight: '600' },
  monthPasses: { width: 74, color: TEXT_SECONDARY, fontSize: 14 },
  monthKm: { minWidth: 76, textAlign: 'right', fontSize: 15.5, fontWeight: '700' },

  insight: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, padding: 13, marginTop: 10,
  },
  insightText: { flex: 1, color: TEXT_PRIMARY, fontSize: 13.5, lineHeight: 19 },
})
