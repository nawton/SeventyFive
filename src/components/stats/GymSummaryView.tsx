import { useState, useEffect } from 'react'
import { View, Text, Image, StyleSheet, ScrollView, Modal, TouchableOpacity, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@/components/Icon'
import Svg, { Polyline, Circle, Line as SvgLine } from 'react-native-svg'
import { GlassCircleButton } from '@/components/GlassButton'
import { PostSocialBar } from '@/components/PostSocialBar'
import { BG, CARD, GREEN, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, NUM_FONT_SEMI, DIVIDER, ACCENT, accentAlpha } from '@/lib/theme'
import { exerciseStillUrlFor, EXERCISE_IMAGES } from '@/lib/exerciseInfo/images'
import { EXERCISE_INFO } from '@/lib/exerciseInfo'
import { ExerciseInfoSheet } from '@/components/ExerciseInfoSheet'
import type { Exercise } from '@/services/exercises'
import { getPassMeta, passPhotoUrl, type GymPassMeta } from '@/services/gymPassMeta'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { toLocalDateString, parseLocalDate } from '@/lib/date'
import type { StrengthWorkout } from '@/services/workouts'
import { useStatsColors } from '@/components/stats/statsShared'
import { useT, dateLocale } from '@/lib/i18n'

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


export function GymSummaryView({ authorName, avatarUrl, ownerId, workoutDate, passKey, name, dateLabel, logged, plannedNames, allWorkouts, onClose, social }: {
  /** Visar Hevy-toppen med avatar när inläggets ägare är känd */
  authorName?: string
  avatarUrl?: string | null
  /** Tillsammans med workoutDate hämtas titel, kommentar och foto */
  ownerId?: string
  workoutDate?: string
  passKey?: string
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
  const t = useT()
  const P = useStatsColors()
  // Titel, kommentar och foto från granskningen — hämtas när ägaren är känd
  const [meta, setMeta] = useState<GymPassMeta | null>(null)
  useEffect(() => {
    let alive = true
    if (ownerId && workoutDate) {
      getPassMeta(ownerId, workoutDate, passKey ?? '')
        .then(m => { if (alive) setMeta(m) })
        .catch(() => {})
    } else {
      setMeta(null)
    }
    return () => { alive = false }
  }, [ownerId, workoutDate, passKey])
  const insets = useSafeAreaInsets()
  const [progressEx, setProgressEx] = useState<string | null>(null)
  // Infobladet: tryck på övningens namn eller bild
  const [infoEx, setInfoEx] = useState<Exercise | null>(null)

  function openExerciseInfo(name: string) {
    if (!EXERCISE_INFO[name] && !EXERCISE_IMAGES[name]) return
    setInfoEx({
      id: `summary-${name}`, name, description: null, category: 'strength',
      difficulty: 'beginner', video_url: null, image_path: EXERCISE_IMAGES[name] ?? null,
    })
  }
  const progression = progressEx && allWorkouts ? progressionFor(allWorkouts, progressEx) : []
  const progWeighted = progression.filter(p => p.topKg > 0)
  const bestOrm = progression.reduce((b, p) => Math.max(b, p.bestOrm), 0)
  const bestTop = progression.reduce<{ topKg: number; topReps: number } | null>(
    (b, p) => (p.topKg > (b?.topKg ?? 0) ? { topKg: p.topKg, topReps: p.topReps } : b), null)

  const totalSets = logged.reduce((s, w) => s + w.data.sets.length, 0)
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
        {/* Hero: avatar + namn när inläggets ägare är känd, annars ikonen */}
        <View style={s.hero}>
          {authorName ? (
            <FeedAvatar url={avatarUrl ?? null} fallback={authorName.charAt(0).toUpperCase()} size={46} />
          ) : (
            <View style={s.heroIcon}>
              <Ionicons name="barbell-outline" size={24} color={ACCENT} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
              {authorName ?? t(name)}
            </Text>
            <Text style={s.heroSub}>{dateLabel ? `${t('Gympass')} · ${dateLabel}` : t('Gympass')}</Text>
          </View>
          <View style={s.donePill}>
            <Ionicons name="checkmark-circle" size={13} color={GREEN} />
            <Text style={s.donePillText}>{t('Avklarat')}</Text>
          </View>
        </View>

        {/* Titel, kommentar och foto från granskningen */}
        {meta && (meta.title || meta.note || meta.photo_path) && (
          <View style={s.metaWrap} testID="passMeta">
            {meta.title ? <Text style={s.metaTitle}>{meta.title}</Text> : null}
            {meta.note ? <Text style={s.metaNote}>{meta.note}</Text> : null}
            {meta.photo_path && passPhotoUrl(meta.photo_path) ? (
              <Image source={{ uri: passPhotoUrl(meta.photo_path)! }} style={s.metaPhoto} />
            ) : null}
          </View>
        )}

        {/* Träningsdetaljer */}
        <Text style={s.sectionHead}>{t('Träningsdetaljer')}</Text>
        <View style={s.card}>
          <View style={s.dtlRow}>
            <View style={s.dtlCell}>
              <Text style={s.dtlLbl}>{t('Övningar')}</Text>
              <Text style={[s.dtlVal, { color: ACCENT }]}>{exerciseCount}</Text>
            </View>
            <View style={s.dtlCell}>
              <Text style={s.dtlLbl}>Set</Text>
              <Text style={[s.dtlVal, { color: P.PURPLE }]}>{totalSets}</Text>
            </View>
            <View style={s.dtlCell}>
              <Text style={s.dtlLbl}>{t('Volym')}</Text>
              <Text style={[s.dtlVal, { color: P.BLUE }]}>
                {Math.round(totalKg).toLocaleString(dateLocale())}
                <Text style={s.dtlUnit}> KG</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Övningar med alla set */}
        {(logged.length > 0 || unlogged.length > 0) && (
          <>
            <Text style={s.sectionHead}>{t('Övningar')}</Text>
            <View style={s.card}>
              {logged.map((w, i) => {
                const topKg = w.data.sets.reduce((m, r) => Math.max(m, r.weight_kg || 0), 0)
                return (
                  <View
                    key={w.id}
                    style={[s.exBlock, i > 0 && s.rowBorder]}
                  >
                    <View style={s.exHead}>
                      {/* Namn och bild öppnar övningens infoblad, högersidan progressionen */}
                      <TouchableOpacity
                        style={s.exHeadLeft}
                        onPress={() => openExerciseInfo(w.data.exercise_name)}
                        activeOpacity={0.7}
                        testID={`exInfo-${w.id}`}
                      >
                        {(() => {
                          const still = exerciseStillUrlFor(w.data.exercise_name)
                          return still
                            ? <Image source={{ uri: still }} style={s.exThumb} />
                            : null
                        })()}
                        <Text style={s.exName} numberOfLines={2}>{t(w.data.exercise_name)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.exHeadRight}
                        disabled={!allWorkouts}
                        onPress={() => setProgressEx(w.data.exercise_name)}
                        activeOpacity={0.7}
                        testID={`exProg-${w.id}`}
                      >
                        {topKg > 0 && (
                          <Text style={s.exTop}>
                            {t('topp {kg} kg', { kg: topKg })}
                          </Text>
                        )}
                        {allWorkouts && <Ionicons name="chevron-forward" size={14} color={TEXT_SECONDARY} />}
                      </TouchableOpacity>
                    </View>
                    <View style={s.tableHead}>
                      <Text style={[s.th, { width: 40 }]}>{t('SET')}</Text>
                      <Text style={s.th}>{t('VIKT & REPS')}</Text>
                    </View>
                    {w.data.sets.map((set, j) => (
                      <View key={j} style={[s.setLine, j % 2 === 1 && s.setLineAlt]}>
                        <Text style={s.setNum}>{j + 1}</Text>
                        <Text style={s.setVal}>
                          {set.weight_kg > 0 ? `${set.weight_kg} kg × ${set.reps}` : `${set.reps} reps`}
                        </Text>
                      </View>
                    ))}
                  </View>
                )
              })}
              {unlogged.map((n, i) => (
                <View key={n} style={[s.exBlock, (logged.length > 0 || i > 0) && s.rowBorder]}>
                  <View style={s.exHead}>
                    <Text style={[s.exName, { color: TEXT_SECONDARY }]} numberOfLines={1}>{n}</Text>
                    <Text style={s.exUnlogged}>{t('Ej loggad')}</Text>
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
            shareText={logged.length === 1
              ? t('Gympass · {n} övning, loggat med SeventyFive', { n: logged.length })
              : t('Gympass · {n} övningar, loggat med SeventyFive', { n: logged.length })}
          />
        )}
      </ScrollView>

      {/* Övningsprogression — toppvikt per pass över tid */}
      {infoEx !== null && (
        <ExerciseInfoSheet exercise={infoEx} onClose={() => setInfoEx(null)} />
      )}

      <Modal visible={!!progressEx} animationType="slide" onRequestClose={() => setProgressEx(null)}>
        <View style={s.root}>
          <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
            <GlassCircleButton icon="chevron-back" onPress={() => setProgressEx(null)} />
            <Text style={s.progTitle} numberOfLines={1}>{progressEx ? t(progressEx) : progressEx}</Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
            <Text style={s.sectionHead}>{t('Progression')}</Text>
            {progWeighted.length >= 2 ? (
              <View style={[s.card, { paddingVertical: 16 }]}>
                <Text style={s.progSub}>{t('toppvikt per pass · senaste {n} passen', { n: Math.min(progWeighted.length, 12) })}</Text>
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
                          fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinejoin="round"
                        />
                        {pts.map((p, i) => (
                          <Circle key={p.date} cx={px(i)} cy={py(p.topKg)} r={4} fill={ACCENT} stroke={CARD} strokeWidth={2} />
                        ))}
                      </Svg>
                      <View style={s.progAxisRow}>
                        <Text style={s.progAxisLbl}>
                          {parseLocalDate(pts[0].date).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }).replace('.', '')}
                        </Text>
                        <Text style={s.progAxisLbl}>
                          {minV === maxV ? `${maxV} kg` : `${minV}–${maxV} kg`}
                        </Text>
                        <Text style={s.progAxisLbl}>
                          {parseLocalDate(pts[pts.length - 1].date).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }).replace('.', '')}
                        </Text>
                      </View>
                    </>
                  )
                })()}
              </View>
            ) : (
              <Text style={s.progHint}>
                {t('Logga vikt på övningen i minst två pass så ritas progressionen här.')}
              </Text>
            )}

            <Text style={s.sectionHead}>{t('Rekord')}</Text>
            <View style={[s.card, { paddingVertical: 6 }]}>
              {([
                {
                  label: t('Bästa set'),
                  value: bestTop && bestTop.topKg > 0 ? `${bestTop.topKg} kg × ${bestTop.topReps}` : '–',
                },
                { label: t('Beräknad 1RM'), value: bestOrm > 0 ? `${Math.round(bestOrm)} kg` : '–' },
                { label: t('Pass med övningen'), value: String(progression.length) },
                {
                  label: t('Senaste passet'),
                  value: progression.length > 0
                    ? `${parseLocalDate(progression[progression.length - 1].date).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }).replace('.', '')}${progression[progression.length - 1].topKg > 0 ? ` · ${progression[progression.length - 1].topKg} kg` : ''}`
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
    backgroundColor: accentAlpha('22'), alignItems: 'center', justifyContent: 'center',
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
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER },

  dtlRow: { flexDirection: 'row', paddingVertical: 14 },
  dtlCell: { flex: 1, gap: 3 },
  dtlLbl: { color: TEXT_SECONDARY, fontSize: 14 },
  dtlVal: { fontSize: 26, fontFamily: NUM_FONT },
  dtlUnit: { fontSize: 14, fontFamily: NUM_FONT_SEMI },
  dtlSep: { height: StyleSheet.hairlineWidth, backgroundColor: DIVIDER },

  exBlock: { paddingVertical: 13, gap: 9 },
  exHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  exHeadLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  exHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  exName: { color: ACCENT, fontSize: 17, fontWeight: '800', flex: 1 },
  // exHeadLeft äger flexen — namnet fyller vänstersidan
  metaWrap: { paddingHorizontal: 2, gap: 8, marginTop: 2 },
  metaTitle: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800' },
  metaNote: { color: TEXT_SECONDARY, fontSize: 15, lineHeight: 21 },
  metaPhoto: {
    width: '100%', aspectRatio: 4 / 3, borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.10)', marginTop: 4,
  },
  exThumb: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#FFFFFF', resizeMode: 'contain',
    borderWidth: StyleSheet.hairlineWidth, borderColor: DIVIDER,
  },
  exTop: { color: ACCENT, fontSize: 12, fontFamily: NUM_FONT_SEMI },
  exUnlogged: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '500' },
  tableHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  th: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  setLine: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 9, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 10,
  },
  setLineAlt: { backgroundColor: 'rgba(128,128,128,0.09)' },
  setNum: { width: 40, color: TEXT_PRIMARY, fontSize: 16, fontFamily: NUM_FONT_SEMI, paddingLeft: 4 },
  setVal: { color: TEXT_PRIMARY, fontSize: 16, fontFamily: NUM_FONT, fontVariant: ['tabular-nums'] },
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
