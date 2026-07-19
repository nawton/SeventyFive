import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { GlassCircleButton } from '@/components/GlassButton'
import { BG, CARD, ORANGE, GREEN, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, NUM_FONT_SEMI } from '@/lib/theme'
import type { StrengthWorkout } from '@/services/workouts'

// =============================================================================
// GYMPASSETS DETALJVY — samma Apple Fitness-stil som cardiopassens:
// färgkodat statsrutnät, sektionsrubriker och övningslista med alla set.
// =============================================================================

const PURPLE = '#D65CFF'
const BLUE   = '#3FBBFF'

export function GymSummaryView({ name, dateLabel, logged, plannedNames, onClose }: {
  name: string
  dateLabel: string | null
  /** Loggade övningar med set och vikter */
  logged: StrengthWorkout[]
  /** Passets planerade övningsnamn — visas som "ej loggad" om de saknar data */
  plannedNames: string[]
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()

  const totalSets = logged.reduce((s, w) => s + w.data.sets.length, 0)
  const totalReps = logged.reduce((s, w) => s + w.data.sets.reduce((x, r) => x + r.reps, 0), 0)
  const totalKg   = logged.reduce((s, w) => s + w.data.sets.reduce((x, r) => x + r.reps * (r.weight_kg || 0), 0), 0)
  const loggedNames = new Set(logged.map(w => w.data.exercise_name))
  const unlogged = plannedNames.filter(n => !loggedNames.has(n))
  const exerciseCount = loggedNames.size + unlogged.length

  return (
    <View style={s.root}>
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <GlassCircleButton icon="chevron-back" onPress={onClose} />
        {dateLabel ? <Text style={s.topBarDate}>{dateLabel}</Text> : <View />}
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Ionicons name="barbell-outline" size={24} color={ORANGE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{name}</Text>
            <Text style={s.heroSub}>Gympass</Text>
          </View>
          <View style={s.donePill}>
            <Ionicons name="checkmark-circle" size={13} color={GREEN} />
            <Text style={s.donePillText}>Avklarat</Text>
          </View>
        </View>

        {/* Träningsdetaljer */}
        <Text style={s.sectionHead}>Träningsdetaljer</Text>
        <View style={s.card}>
          <View style={s.dtlRow}>
            <View style={s.dtlCell}>
              <Text style={s.dtlLbl}>Övningar</Text>
              <Text style={[s.dtlVal, { color: ORANGE }]}>{exerciseCount}</Text>
            </View>
            <View style={s.dtlCell}>
              <Text style={s.dtlLbl}>Set</Text>
              <Text style={[s.dtlVal, { color: PURPLE }]}>{totalSets}</Text>
            </View>
          </View>
          <View style={s.dtlSep} />
          <View style={s.dtlRow}>
            <View style={s.dtlCell}>
              <Text style={s.dtlLbl}>Reps totalt</Text>
              <Text style={[s.dtlVal, { color: GREEN }]}>{totalReps}</Text>
            </View>
            <View style={s.dtlCell}>
              <Text style={s.dtlLbl}>Volym</Text>
              <Text style={[s.dtlVal, { color: BLUE }]}>
                {Math.round(totalKg).toLocaleString('sv-SE')}
                <Text style={s.dtlUnit}> KG</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Övningar med alla set */}
        {(logged.length > 0 || unlogged.length > 0) && (
          <>
            <Text style={s.sectionHead}>Övningar</Text>
            <View style={s.card}>
              {logged.map((w, i) => {
                const topKg = w.data.sets.reduce((m, r) => Math.max(m, r.weight_kg || 0), 0)
                return (
                  <View key={w.id} style={[s.exBlock, i > 0 && s.rowBorder]}>
                    <View style={s.exHead}>
                      <Text style={s.exName} numberOfLines={1}>{w.data.exercise_name}</Text>
                      {topKg > 0 && (
                        <Text style={s.exTop}>
                          topp {topKg} kg
                        </Text>
                      )}
                    </View>
                    <View style={s.setWrap}>
                      {w.data.sets.map((set, j) => (
                        <View key={j} style={s.setChip}>
                          <Text style={s.setChipText}>
                            {set.weight_kg > 0 ? `${set.weight_kg} kg × ${set.reps}` : `${set.reps} reps`}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )
              })}
              {unlogged.map((n, i) => (
                <View key={n} style={[s.exBlock, (logged.length > 0 || i > 0) && s.rowBorder]}>
                  <View style={s.exHead}>
                    <Text style={[s.exName, { color: TEXT_SECONDARY }]} numberOfLines={1}>{n}</Text>
                    <Text style={s.exUnlogged}>Ej loggad</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  topBarDate: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', textTransform: 'capitalize' },
  scroll: { paddingHorizontal: 20 },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  heroIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  heroSub: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '500', marginTop: 3 },
  donePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: GREEN + '1E', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5,
  },
  donePillText: { color: GREEN, fontSize: 12, fontWeight: '700' },

  sectionHead: {
    color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', letterSpacing: -0.4,
    marginTop: 26, marginBottom: 12,
  },
  card: { backgroundColor: CARD, borderRadius: 20, paddingHorizontal: 18 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },

  dtlRow: { flexDirection: 'row', paddingVertical: 14 },
  dtlCell: { flex: 1, gap: 3 },
  dtlLbl: { color: TEXT_SECONDARY, fontSize: 14 },
  dtlVal: { fontSize: 26, fontFamily: NUM_FONT },
  dtlUnit: { fontSize: 14, fontFamily: NUM_FONT_SEMI },
  dtlSep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)' },

  exBlock: { paddingVertical: 13, gap: 9 },
  exHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  exName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600', flex: 1 },
  exTop: { color: ORANGE, fontSize: 12, fontFamily: NUM_FONT_SEMI },
  exUnlogged: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '500' },
  setWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  setChip: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 9,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  setChipText: { color: TEXT_PRIMARY, fontSize: 12, fontFamily: NUM_FONT_SEMI, fontVariant: ['tabular-nums'] },
})
