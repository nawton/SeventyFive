import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Polyline, Circle, Line as SvgLine } from 'react-native-svg'
import { GlassCircleButton } from '@/components/GlassButton'
import { PostSocialBar } from '@/components/PostSocialBar'
import { BG, CARD, ORANGE, GREEN, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, NUM_FONT_SEMI } from '@/lib/theme'
import { toLocalDateString, parseLocalDate } from '@/lib/date'
import type { StrengthWorkout } from '@/services/workouts'

const SCREEN_W = Dimensions.get('window').width

// Toppvikt per pass för en övning — underlaget till progressionsgrafen
function progressionFor(all: StrengthWorkout[], exerciseName: string) {
  const byDate = new Map<string, { topKg: number; topReps: number; bestOrm: number }>()
  for (const w of all) {
    if (w.data.exercise_name !== exerciseName) continue
    const date = w.data.workout_date ?? toLocalDateString(new Date(w.created_at))
    const entry = byDate.get(date) ?? { topKg: 0, topReps: 0, bestOrm: 0 }
    for (const st of w.data.sets) {
      if (st.weight_kg > entry.topKg) { entry.topKg = st.weight_kg; entry.topReps = st.reps }
      const orm = st.weight_kg > 0 && st.reps > 0 ? st.weight_kg * (1 + st.reps / 30) : 0
      entry.bestOrm = Math.max(entry.bestOrm, orm)
    }
    byDate.set(date, entry)
  }
  return Array.from(byDate.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

// =============================================================================
// GYMPASSETS DETALJVY — samma Apple Fitness-stil som cardiopassens:
// färgkodat statsrutnät, sektionsrubriker och övningslista med alla set.
// =============================================================================

const PURPLE = '#D65CFF'
const BLUE   = '#3FBBFF'

export function GymSummaryView({ name, dateLabel, logged, plannedNames, allWorkouts, onClose, social }: {
  name: string
  dateLabel: string | null
  /** Loggade övningar med set och vikter */
  logged: StrengthWorkout[]
  /** Passets planerade övningsnamn — visas som "ej loggad" om de saknar data */
  plannedNames: string[]
  /** Hela styrkehistoriken — gör övningsraderna klickbara till progressionen */
  allWorkouts?: StrengthWorkout[]
  onClose: () => void
  /** Community: gilla/kommentera/dela-raden under övningarna */
  social?: { postKey: string; ownerId: string; onOpenComments?: () => void }
}) {
  const insets = useSafeAreaInsets()
  const [progressEx, setProgressEx] = useState<string | null>(null)
  const progression = progressEx && allWorkouts ? progressionFor(allWorkouts, progressEx) : []
  const progWeighted = progression.filter(p => p.topKg > 0)
  const bestOrm = progression.reduce((b, p) => Math.max(b, p.bestOrm), 0)
  const bestTop = progression.reduce<{ topKg: number; topReps: number } | null>(
    (b, p) => (p.topKg > (b?.topKg ?? 0) ? { topKg: p.topKg, topReps: p.topReps } : b), null)

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
                  <TouchableOpacity
                    key={w.id}
                    style={[s.exBlock, i > 0 && s.rowBorder]}
                    activeOpacity={0.7}
                    disabled={!allWorkouts}
                    onPress={() => setProgressEx(w.data.exercise_name)}
                  >
                    <View style={s.exHead}>
                      <Text style={s.exName} numberOfLines={1}>{w.data.exercise_name}</Text>
                      {topKg > 0 && (
                        <Text style={s.exTop}>
                          topp {topKg} kg
                        </Text>
                      )}
                      {allWorkouts && <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.28)" />}
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
                  </TouchableOpacity>
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

        {/* Gilla/kommentera/dela — bara när passet öppnas som inlägg */}
        {social && (
          <PostSocialBar
            postKey={social.postKey}
            ownerId={social.ownerId}
            onOpenComments={social.onOpenComments}
            shareText={`Gympass · ${logged.length} ${logged.length === 1 ? 'övning' : 'övningar'} — loggat med SeventyFive`}
          />
        )}
      </ScrollView>

      {/* Övningsprogression — toppvikt per pass över tid */}
      <Modal visible={!!progressEx} animationType="slide" onRequestClose={() => setProgressEx(null)}>
        <View style={s.root}>
          <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
            <GlassCircleButton icon="chevron-back" onPress={() => setProgressEx(null)} />
            <Text style={s.progTitle} numberOfLines={1}>{progressEx}</Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
            <Text style={s.sectionHead}>Progression</Text>
            {progWeighted.length >= 2 ? (
              <View style={[s.card, { paddingVertical: 16 }]}>
                <Text style={s.progSub}>toppvikt per pass · senaste {Math.min(progWeighted.length, 12)} passen</Text>
                {(() => {
                  const pts = progWeighted.slice(-12)
                  const CH_W = SCREEN_W - 40 - 36
                  const CH_H = 150
                  const minV = Math.min(...pts.map(p => p.topKg))
                  const maxV = Math.max(...pts.map(p => p.topKg))
                  const span = Math.max(maxV - minV, 1)
                  const px = (i: number) => pts.length === 1 ? CH_W / 2 : (i / (pts.length - 1)) * (CH_W - 16) + 8
                  const py = (v: number) => 14 + (1 - (v - minV) / span) * (CH_H - 28)
                  return (
                    <>
                      <Svg width={CH_W} height={CH_H}>
                        {[0.25, 0.5, 0.75].map(f => (
                          <SvgLine
                            key={f}
                            x1={0} x2={CH_W}
                            y1={14 + f * (CH_H - 28)} y2={14 + f * (CH_H - 28)}
                            stroke="rgba(255,255,255,0.06)" strokeWidth={1}
                          />
                        ))}
                        <Polyline
                          points={pts.map((p, i) => `${px(i)},${py(p.topKg)}`).join(' ')}
                          fill="none" stroke={ORANGE} strokeWidth={2.5} strokeLinejoin="round"
                        />
                        {pts.map((p, i) => (
                          <Circle key={p.date} cx={px(i)} cy={py(p.topKg)} r={4} fill={ORANGE} stroke={CARD} strokeWidth={2} />
                        ))}
                      </Svg>
                      <View style={s.progAxisRow}>
                        <Text style={s.progAxisLbl}>
                          {parseLocalDate(pts[0].date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '')}
                        </Text>
                        <Text style={s.progAxisLbl}>
                          {minV === maxV ? `${maxV} kg` : `${minV}–${maxV} kg`}
                        </Text>
                        <Text style={s.progAxisLbl}>
                          {parseLocalDate(pts[pts.length - 1].date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '')}
                        </Text>
                      </View>
                    </>
                  )
                })()}
              </View>
            ) : (
              <Text style={s.progHint}>
                Logga vikt på övningen i minst två pass så ritas progressionen här.
              </Text>
            )}

            <Text style={s.sectionHead}>Rekord</Text>
            <View style={[s.card, { paddingVertical: 6 }]}>
              {([
                {
                  label: 'Bästa set',
                  value: bestTop && bestTop.topKg > 0 ? `${bestTop.topKg} kg × ${bestTop.topReps}` : '–',
                },
                { label: 'Beräknad 1RM', value: bestOrm > 0 ? `${Math.round(bestOrm)} kg` : '–' },
                { label: 'Pass med övningen', value: String(progression.length) },
                {
                  label: 'Senaste passet',
                  value: progression.length > 0
                    ? `${parseLocalDate(progression[progression.length - 1].date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '')}${progression[progression.length - 1].topKg > 0 ? ` · ${progression[progression.length - 1].topKg} kg` : ''}`
                    : '–',
                },
              ]).map((r, i) => (
                <View key={r.label} style={[s.progKpiRow, i > 0 && s.rowBorder]}>
                  <Text style={s.progKpiLbl}>{r.label}</Text>
                  <Text style={s.progKpiVal}>{r.value}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
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

  // Progression
  progTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  progSub: { color: TEXT_SECONDARY, fontSize: 12, marginBottom: 10 },
  progAxisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progAxisLbl: { color: TEXT_SECONDARY, fontSize: 11, fontFamily: NUM_FONT_SEMI, textTransform: 'capitalize' },
  progHint: { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 19, textAlign: 'center', paddingVertical: 24, paddingHorizontal: 12 },
  progKpiRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12 },
  progKpiLbl: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500' },
  progKpiVal: { color: TEXT_PRIMARY, fontSize: 15, fontFamily: NUM_FONT, fontVariant: ['tabular-nums'], textTransform: 'capitalize' },
})
