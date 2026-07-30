import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@/components/Icon'
import { GlassCircleButton } from '@/components/GlassButton'
import { BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, useCardChrome, useHeroChrome } from '@/lib/theme'
import { toLocalDateString, parseLocalDate } from '@/lib/date'
import type { StrengthWorkout } from '@/services/workouts'
import { getWeekBounds } from './statsShared'
import { useT, dateLocale } from '@/lib/i18n'

// =============================================================================
// VOLYM I DETALJ — veckovyn efter förlagan: mörk totalpanel med pass,
// set, reps och snitt per set, kg lyft per dag som orange staplar och
// veckans tyngsta övningar sorterade på volym.
// =============================================================================

const HERO = { bg: '#151B33', sub: '#9AA3BC' }
const GYM = '#EE7C4B'

function workoutDate(w: StrengthWorkout): string {
  return w.data.workout_date ?? toLocalDateString(new Date(w.created_at))
}

export function VolumeDetailModal({ visible, onClose, workouts }: {
  visible: boolean
  onClose: () => void
  workouts: StrengthWorkout[]
}) {
  const t = useT()
  const chrome = useCardChrome()
  const H = useHeroChrome()
  const insets = useSafeAreaInsets()
  const [offset, setOffset] = useState(0)

  const bounds = getWeekBounds(offset)
  const week = useMemo(
    () => workouts.filter(w => {
      const d = workoutDate(w)
      return d >= bounds.start && d <= bounds.end
    }),
    [workouts, bounds.start, bounds.end])

  const volume = week.reduce((s, w) => s + w.data.sets.reduce((x, r) => x + r.reps * (r.weight_kg || 0), 0), 0)
  const sets   = week.reduce((s, w) => s + w.data.sets.length, 0)
  const reps   = week.reduce((s, w) => s + w.data.sets.reduce((x, r) => x + r.reps, 0), 0)
  const passes = new Set(week.map(w => `${workoutDate(w)}|${w.data.pass_key ?? ''}`)).size
  const perSet = sets > 0 ? Math.round(volume / sets) : 0

  const fmtKg  = (v: number) => `${Math.round(v).toLocaleString(dateLocale())} kg`
  const fmtVol = (kg: number) => kg >= 1000
    ? `${(kg / 1000).toFixed(1).replace('.', ',')} t`
    : fmtKg(kg)

  // Staplar per dag i vald vecka — värdet skrivs över den högsta stapeln
  const dayVols = Array.from({ length: 7 }, (_, i) => {
    const d = parseLocalDate(bounds.start)
    d.setDate(d.getDate() + i)
    const iso = toLocalDateString(d)
    return week
      .filter(w => workoutDate(w) === iso)
      .reduce((sum, w) => sum + w.data.sets.reduce((x, r) => x + r.reps * (r.weight_kg || 0), 0), 0)
  })
  const maxV = Math.max(...dayVols, 1)
  const maxIdx = dayVols.indexOf(Math.max(...dayVols))

  // Tyngsta övningar: aggregerat per övning, sorterat på volym
  const byExercise = useMemo(() => {
    const map = new Map<string, { sets: number; reps: number; top: number; volume: number }>()
    for (const w of week) {
      const e = map.get(w.data.exercise_name) ?? { sets: 0, reps: 0, top: 0, volume: 0 }
      e.sets += w.data.sets.length
      for (const st of w.data.sets) {
        e.reps += st.reps
        e.top = Math.max(e.top, st.weight_kg || 0)
        e.volume += st.reps * (st.weight_kg || 0)
      }
      map.set(w.data.exercise_name, e)
    }
    return Array.from(map.entries())
      .map(([name, e]) => ({ name, ...e }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10)
  }, [week])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
          <GlassCircleButton icon="chevron-back" onPress={onClose} />
          <Text style={s.topTitle}>{t('Volym')}</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
          {/* Veckobläddring */}
          <View style={s.navRow}>
            <TouchableOpacity style={s.navBtn} onPress={() => setOffset(o => o - 1)} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={s.navLabel}>{bounds.label}</Text>
            <TouchableOpacity style={s.navBtn} onPress={() => setOffset(o => o + 1)} disabled={offset >= 0} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={20} color={offset >= 0 ? 'rgba(128,128,128,0.35)' : TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>

          {/* Totalpanelen */}
          <View style={[s.hero, H.card]}>
            <Text style={[s.heroLabel, { color: H.sub }]}>
              {offset === 0 ? t('Totalt denna vecka') : t('Totalt {w}', { w: bounds.label.toLowerCase() })}
            </Text>
            <Text style={[s.heroValue, { color: GYM }]}>
              {Math.round(volume).toLocaleString(dateLocale())}
              <Text style={s.heroUnit}> kg</Text>
            </Text>
            <View style={[s.heroDivider, { backgroundColor: H.divider }]} />
            <View style={s.heroRow}>
              <View style={s.heroCell}>
                <Text style={[s.heroCellLbl, { color: H.sub }]}>{t('PASS')}</Text>
                <Text style={s.heroCellVal}>{passes}</Text>
              </View>
              <View style={s.heroCell}>
                <Text style={[s.heroCellLbl, { color: H.sub }]}>SET</Text>
                <Text style={s.heroCellVal}>{sets}</Text>
              </View>
              <View style={s.heroCell}>
                <Text style={[s.heroCellLbl, { color: H.sub }]}>REPS</Text>
                <Text style={s.heroCellVal}>{reps.toLocaleString(dateLocale())}</Text>
              </View>
              <View style={[s.heroCell, { flex: 1.3 }]}>
                <Text style={[s.heroCellLbl, { color: H.sub }]}>{t('SNITT/SET')}</Text>
                <Text style={s.heroCellVal}>{fmtKg(perSet)}</Text>
              </View>
            </View>
          </View>

          {/* kg lyft per dag */}
          <View style={[s.card, chrome]}>
            <Text style={s.cardTitle}>{t('kg lyft per dag')}</Text>
            <View style={s.barRow}>
              {dayVols.map((v, i) => (
                <View key={i} style={s.barCell}>
                  <View style={s.barSlot}>
                    {v > 0 && i === maxIdx && (
                      <Text style={[s.barValue, { color: GYM }]} numberOfLines={1}>{fmtVol(v)}</Text>
                    )}
                    {v > 0
                      ? <View style={[s.bar, { height: Math.max(18, (v / maxV) * 150), backgroundColor: GYM }]} />
                      : <View style={s.barEmpty} />}
                  </View>
                  <Text style={[s.barLbl, v > 0 && { color: GYM, fontWeight: '700' }]}>
                    {t(['M', 'T', 'O', 'T', 'F', 'L', 'S'][i])}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Tyngsta övningar */}
          <View style={[s.card, chrome]}>
            <Text style={s.cardTitle}>{t('Tyngsta övningar')}</Text>
            {byExercise.length === 0 && (
              <Text style={s.emptyText}>{t('Inga lyft loggade den här veckan.')}</Text>
            )}
            {byExercise.map((e, i) => (
              <View key={e.name} style={[s.exRow, i > 0 && s.exRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.exName} numberOfLines={1}>{t(e.name)}</Text>
                  <Text style={s.exSub} numberOfLines={1}>
                    {t('{sets} set · {reps} reps · tyngsta {kg} kg', {
                      sets: e.sets, reps: e.reps, kg: e.top % 1 === 0 ? e.top : e.top.toFixed(1).replace('.', ','),
                    })}
                  </Text>
                </View>
                <Text style={[s.exVol, { color: GYM }]}>{fmtKg(e.volume)}</Text>
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
  scroll: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },

  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: CARD,
    alignItems: 'center', justifyContent: 'center',
  },
  navLabel: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },

  hero: { borderRadius: 22, padding: 20 },
  heroLabel: { color: HERO.sub, fontSize: 14, fontWeight: '600' },
  heroValue: { fontSize: 42, fontFamily: NUM_FONT, letterSpacing: -0.5, marginTop: 2 },
  heroUnit: { fontSize: 20 },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 14 },
  heroRow: { flexDirection: 'row' },
  heroCell: { flex: 1, gap: 3 },
  heroCellLbl: { color: HERO.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  heroCellVal: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },

  card: { backgroundColor: CARD, borderRadius: 20, padding: 16 },
  cardTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '800', marginBottom: 14 },
  barRow: { flexDirection: 'row', alignItems: 'flex-end' },
  barCell: { flex: 1, alignItems: 'center', gap: 8 },
  barSlot: { height: 176, justifyContent: 'flex-end', alignItems: 'center', gap: 6 },
  barValue: { fontSize: 13, fontWeight: '800' },
  bar: { width: 26, borderRadius: 13 },
  barEmpty: { width: 22, height: 5, borderRadius: 3, backgroundColor: 'rgba(128,128,128,0.22)' },
  barLbl: { color: TEXT_SECONDARY, fontSize: 12.5, fontWeight: '600' },

  exRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  exRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.2)' },
  exName: { color: TEXT_PRIMARY, fontSize: 15.5, fontWeight: '700' },
  exSub: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
  exVol: { fontSize: 16, fontWeight: '800' },
  emptyText: { color: TEXT_SECONDARY, fontSize: 14 },
})
