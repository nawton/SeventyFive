// ÖVERSIKT-fliken på Framsteg: mörk hjältepanel med dagsring och CTA,
// veckoremsan, fyra nyckeltalskort och nästa milstolpe. Hela kalendern
// fälls ut via länken i veckokortet. Skalet (stats.tsx) äger rådatan.
import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import type { GestureType } from 'react-native-gesture-handler'
import Svg, { Circle, Text as SvgText } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import {
  GREEN, CARD, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT, ACCENT_CONTRAST,
  accentAlpha, useThemeStrings, useCardChrome,
} from '@/lib/theme'
import { toLocalDateString, parseLocalDate, startOfWeek } from '@/lib/date'
import { toDisplayDistance, distanceUnitLabel, type UnitSystem } from '@/lib/units'
import type { DaySummary } from '@/services/dailyLog'
import type { CardioWorkout, StrengthWorkout } from '@/services/workouts'
import type { CompletedSessionItem } from '@/services/workoutSchedule'
import { STATS_SCREEN_W, nextMilestone, s, useStatsColors } from './statsShared'
import { DayWorkoutsModal } from './DayWorkoutsModal'
import { MilestoneAnalysisModal } from './MilestoneAnalysisModal'
import { useT, dateLocale } from '@/lib/i18n'

// Hjältepanelen är mörk marinblå i BÅDA lägena (som förlagan) — färgerna
// är statiska strängar, inte temafärger
const HERO = {
  bg: '#151B33',
  track: '#2B3352',
  arc: '#F2A25F',
  cta: '#F2A25F',
  ctaText: '#16204A',
  sub: '#9AA3BC',
  missed: '#E5484D',
}

function HeroRing({ currentDay, completedDays }: { currentDay: number; completedDays: number }) {
  const t = useT()
  const R = 38
  const C = 2 * Math.PI * R
  const completedArc = (completedDays / 75) * C
  const elapsedArc   = (currentDay / 75) * C
  const missedArc    = Math.max(0, elapsedArc - completedArc)

  return (
    <Svg width={92} height={92} viewBox="0 0 92 92">
      <Circle cx={46} cy={46} r={R} fill="none" stroke={HERO.track} strokeWidth={7.5} />
      {completedArc > 0 && (
        <Circle
          cx={46} cy={46} r={R}
          fill="none" stroke={HERO.arc} strokeWidth={7.5}
          strokeDasharray={`${Math.max(completedArc, 2)} ${C}`}
          strokeLinecap="round"
          rotation={-90} origin="46,46"
        />
      )}
      {missedArc > 0 && (
        <Circle
          cx={46} cy={46} r={R}
          fill="none" stroke={HERO.missed} strokeWidth={7.5}
          strokeDasharray={`${Math.max(missedArc, 2)} ${C}`}
          strokeDashoffset={-Math.max(completedArc, 2)}
          strokeLinecap="round"
          rotation={-90} origin="46,46"
          opacity={0.5}
        />
      )}
      {/* Dagens position: liten prick på ringen även innan något är klart */}
      {completedArc === 0 && missedArc === 0 && (
        <Circle
          cx={46} cy={46} r={R}
          fill="none" stroke={HERO.arc} strokeWidth={7.5}
          strokeDasharray={`2 ${C}`}
          strokeLinecap="round"
          rotation={-90 + (elapsedArc / C) * 360} origin="46,46"
        />
      )}
      <SvgText
        x={46} y={44}
        textAnchor="middle" fontSize={22} fontWeight="900"
        fill="#FFFFFF" fontFamily="-apple-system,sans-serif"
      >
        {currentDay}
      </SvgText>
      <SvgText
        x={46} y={60}
        textAnchor="middle" fontSize={10}
        fill={HERO.sub} fontFamily="-apple-system,sans-serif"
      >
        {t('av 75')}
      </SvgText>
    </Svg>
  )
}

export function OverviewTab({
  days, startDate, challengeId, currentDay, streak,
  workouts, strengthWorkouts, completedSessions, unit, avatarUrl,
  calSwipeRef, onTabScroll, refreshControl, onOpenWorkout, onRemoveWorkoutLocal,
  onDayEdited,
}: {
  days: DaySummary[]
  startDate: string | null
  challengeId: string | null
  currentDay: number
  streak: number
  workouts: CardioWorkout[]
  strengthWorkouts: StrengthWorkout[]
  completedSessions: CompletedSessionItem[]
  unit: UnitSystem
  avatarUrl: string | null
  /** Delas med flik-pagerns waitFor så kalendersvepet vinner över sidbytet */
  calSwipeRef: React.MutableRefObject<GestureType | undefined>
  onTabScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => void
  /** Appens gemensamma dra-för-att-uppdatera — samma i alla tre flikarna */
  refreshControl: React.ReactElement<import('react-native').RefreshControlProps>
  onOpenWorkout: (w: CardioWorkout) => void
  onRemoveWorkoutLocal: (id: string) => void
  /** Efter en efterhandsredigering av en dags uppgifter — ladda om statistiken */
  onDayEdited?: () => void
}) {
  const t = useT()
  const P = useStatsColors()
  const unitLabel = distanceUnitLabel(unit)
  const T = useThemeStrings()
  const chrome = useCardChrome()
  const [selectedDay, setSelectedDay]     = useState<DaySummary | null>(null)
  const [milestoneOpen, setMilestoneOpen] = useState(false)

  const completedDays = days.filter(d => d.status === 'completed').length

  // ── Veckans nyckeltal + jämförelsen mot förra veckan ──────────────────────
  const weekStartOf = (offset: number) => {
    const d = startOfWeek()
    d.setDate(d.getDate() + offset * 7)
    return toLocalDateString(d)
  }
  const nowWeekStart = weekStartOf(0)
  const nowWeekEnd   = weekStartOf(1)
  const prevWeekStart = weekStartOf(-1)
  const inRange = (iso: string, from: string, to: string) => iso >= from && iso < to

  const cardioIso = (w: CardioWorkout) => toLocalDateString(new Date(w.created_at))
  const gymIso    = (w: StrengthWorkout) => w.data.workout_date ?? toLocalDateString(new Date(w.created_at))

  const weekCardio = workouts.filter(w => inRange(cardioIso(w), nowWeekStart, nowWeekEnd))
  const weekGym    = strengthWorkouts.filter(w => inRange(gymIso(w), nowWeekStart, nowWeekEnd))
  const passes = weekCardio.length
    + completedSessions.filter(c => c.sessionType === 'gym' && inRange(c.completedDate, nowWeekStart, nowWeekEnd)).length
  const prevPasses = workouts.filter(w => inRange(cardioIso(w), prevWeekStart, nowWeekStart)).length
    + completedSessions.filter(c => c.sessionType === 'gym' && inRange(c.completedDate, prevWeekStart, nowWeekStart)).length
  const passDiff = passes - prevPasses

  const km = weekCardio.reduce((sum, w) => sum + w.data.distance_km, 0)
  const volume    = weekGym.reduce((sum, w) => sum + w.data.sets.reduce((x, r) => x + r.reps * (r.weight_kg || 0), 0), 0)
  const totalSets = weekGym.reduce((sum, w) => sum + w.data.sets.length, 0)
  const totalReps = weekGym.reduce((sum, w) => sum + w.data.sets.reduce((x, r) => x + r.reps, 0), 0)

  // ── Veckoremsan: må-sö med idag markerad, framtiden streckad ──────────────
  const todayIso = toLocalDateString(new Date())
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = startOfWeek()
    d.setDate(d.getDate() + i)
    const iso = toLocalDateString(d)
    return {
      iso,
      letter: d.toLocaleDateString(dateLocale(), { weekday: 'narrow' }).toUpperCase(),
      num: d.getDate(),
      isToday: iso === todayIso,
      isPast: iso < todayIso,
    }
  })

  function openDayFor(iso: string) {
    if (!startDate) return
    const diff = Math.round((parseLocalDate(iso).getTime() - parseLocalDate(startDate).getTime()) / 86400000)
    const day = days.find(d => d.dayNumber === diff + 1)
    if (day) {
      Haptics.selectionAsync()
      setSelectedDay(day)
    }
  }

  const milestone = nextMilestone(Math.max(0, currentDay - 1))
  const msProgress = milestone ? Math.min(1, Math.max(0.02, currentDay / milestone.day)) : 0

  return (
    <>
        <ScrollView
          style={{ width: STATS_SCREEN_W }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          onScroll={onTabScroll}
          refreshControl={refreshControl}
          scrollEventThrottle={16}
        >
          <>
            {/* ── Hjältepanelen: ring, dagsläge och CTA till dagens uppgifter ── */}
            <View style={l.hero}>
              <HeroRing currentDay={currentDay} completedDays={completedDays} />
              <View style={l.heroBody}>
                <Text style={l.heroTitle} numberOfLines={1} adjustsFontSizeToFit>
                  {t('Dag {n} är igång!', { n: currentDay })}
                </Text>
                <Text style={l.heroSub} numberOfLines={2}>{t('Klara dagens uppgifter för att tända din streak.')}</Text>
                <TouchableOpacity
                  style={l.heroCta}
                  onPress={() => router.push('/(app)/dashboard' as never)}
                  activeOpacity={0.85}
                  testID="heroCta"
                >
                  <Text style={l.heroCtaText} numberOfLines={1}>{t('Dagens uppgifter')}</Text>
                  <Ionicons name="arrow-forward" size={14} color={HERO.ctaText} />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Denna vecka: må-sö med idag markerad ── */}
            <View style={[l.card, chrome]}>
              <View style={l.weekHead}>
                <Text style={l.cardTitle}>{t('Denna vecka')}</Text>
                <TouchableOpacity onPress={() => router.push('/(app)/calendar' as never)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="openCalendar">
                  <Text style={[l.weekLink, { color: T.ACCENT }]}>{t('Hela kalendern')} ›</Text>
                </TouchableOpacity>
              </View>
              <View style={l.weekRow}>
                {weekDays.map(d => (
                  <TouchableOpacity
                    key={d.iso}
                    style={l.weekCell}
                    onPress={() => openDayFor(d.iso)}
                    activeOpacity={0.7}
                    testID={`weekDay-${d.iso}`}
                  >
                    <Text style={l.weekLetter}>{d.letter}</Text>
                    <View style={[
                      l.weekCircle,
                      d.isPast && l.weekCirclePast,
                      !d.isPast && !d.isToday && l.weekCircleFuture,
                      d.isToday && { backgroundColor: T.ACCENT },
                    ]}>
                      <Text style={[
                        l.weekNum,
                        d.isPast && { color: TEXT_SECONDARY },
                        d.isToday && { color: ACCENT_CONTRAST, fontWeight: '800' },
                      ]}>
                        {d.num}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Fyra nyckeltal i rutnät ── */}
            <View style={l.grid}>
              <View style={[l.card, l.gridCell, chrome]}>
                <Text style={l.cellLabel}>{t('Träningspass')}</Text>
                <Text style={l.cellValue}>{passes}</Text>
                <Text style={[l.cellSub, passDiff > 0 && { color: GREEN }]}>
                  {passDiff === 0
                    ? t('Samma som förra veckan')
                    : t('{n} mot förra veckan', { n: passDiff > 0 ? `+${passDiff}` : passDiff })}
                </Text>
              </View>
              <View style={[l.card, l.gridCell, chrome]}>
                <Text style={l.cellLabel}>{t('Distans')}</Text>
                <Text style={[l.cellValue, { color: P.BLUE }]}>
                  {toDisplayDistance(km, unit).toFixed(2).replace('.', ',')}
                  <Text style={l.cellUnit}> {unitLabel}</Text>
                </Text>
                <Text style={l.cellSub}>
                  {weekCardio.length === 1 ? t('1 cardiopass') : t('{n} cardiopass', { n: weekCardio.length })}
                </Text>
              </View>
              <View style={[l.card, l.gridCell, chrome]}>
                <Text style={l.cellLabel}>{t('Volym')}</Text>
                <Text style={[l.cellValue, { color: P.YELLOW }]} numberOfLines={1} adjustsFontSizeToFit>
                  {Math.round(volume).toLocaleString(dateLocale())}
                  <Text style={l.cellUnit}> kg</Text>
                </Text>
                <Text style={l.cellSub}>{t('{sets} set · {reps} reps', { sets: totalSets, reps: totalReps.toLocaleString(dateLocale()) })}</Text>
              </View>
              <View style={[l.card, l.gridCell, chrome]}>
                <Text style={l.cellLabel}>{t('Klarade dagar')}</Text>
                <Text style={[l.cellValue, { color: GREEN }]}>
                  {completedDays}
                  <Text style={l.cellUnit}> {t('av 75')}</Text>
                </Text>
                <Text style={l.cellSub}>{t('Dag {n} pågår', { n: currentDay })}</Text>
              </View>
            </View>

            {/* ── Nästa milstolpe med progressbar ── */}
            {milestone && (
              <TouchableOpacity style={[l.card, l.msRow, chrome]} activeOpacity={0.8} onPress={() => setMilestoneOpen(true)} testID="milestoneCard">
                <View style={[l.msIcon, { backgroundColor: accentAlpha('12') }]}>
                  <Ionicons name="flag-outline" size={22} color={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[l.msEyebrow, { color: T.ACCENT }]}>{t('NÄSTA MILSTOLPE')}</Text>
                  <Text style={l.msTitle}>{milestone.label}</Text>
                  <View style={l.msTrack}>
                    <View style={[l.msFill, { backgroundColor: T.ACCENT, width: `${Math.round(msProgress * 100)}%` as never }]} />
                  </View>
                  <Text style={l.msSub}>{t('Dag {n} av {m}', { n: currentDay, m: milestone.day })}</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            )}
          </>
        </ScrollView>

      <Modal visible={!!selectedDay} animationType="none" transparent onRequestClose={() => setSelectedDay(null)}>
        {selectedDay && startDate && (
          <DayWorkoutsModal
            day={selectedDay}
            startDate={startDate}
            challengeId={challengeId}
            workouts={workouts}
            strengthWorkouts={strengthWorkouts}
            completedSessions={completedSessions}
            unit={unit}
            onClose={() => setSelectedDay(null)}
            onSelectWorkout={onOpenWorkout}
            onTasksChanged={onDayEdited}
          />
        )}
      </Modal>
      <MilestoneAnalysisModal
        visible={milestoneOpen}
        onClose={() => setMilestoneOpen(false)}
        days={days}
        currentDay={currentDay}
        streak={streak}
        milestone={milestone}
        startDate={startDate}
        workouts={workouts}
        completedSessions={completedSessions}
        unit={unit}
      />
    </>
  )
}

const l = StyleSheet.create({
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: HERO.bg, borderRadius: 22,
    paddingVertical: 16, paddingHorizontal: 16, marginBottom: 14,
  },
  heroBody: { flex: 1, gap: 4 },
  heroTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  heroSub: { color: HERO.sub, fontSize: 13, lineHeight: 18 },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: HERO.cta, borderRadius: 999,
    paddingHorizontal: 15, paddingVertical: 9, marginTop: 5,
  },
  heroCtaText: { color: HERO.ctaText, fontSize: 14, fontWeight: '800' },

  card: { backgroundColor: CARD, borderRadius: 20, padding: 16, marginBottom: 14 },
  cardTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '800' },

  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  weekLink: { fontSize: 14, fontWeight: '700' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekCell: { alignItems: 'center', gap: 8, flex: 1 },
  weekLetter: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  weekCircle: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  weekCirclePast: { backgroundColor: 'rgba(128,128,128,0.14)' },
  weekCircleFuture: { borderWidth: 1.5, borderColor: 'rgba(128,128,128,0.4)', borderStyle: 'dashed' },
  weekNum: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCell: { width: '48.4%', gap: 4 },
  cellLabel: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  cellValue: { color: TEXT_PRIMARY, fontSize: 27, fontWeight: '800' },
  cellUnit: { fontSize: 14, fontWeight: '700', color: TEXT_SECONDARY },
  cellSub: { color: TEXT_SECONDARY, fontSize: 12.5 },

  msRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  msIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  msEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  msTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '800', marginTop: 2 },
  msTrack: {
    height: 6, borderRadius: 3, backgroundColor: 'rgba(128,128,128,0.18)',
    marginTop: 8, overflow: 'hidden',
  },
  msFill: { height: 6, borderRadius: 3 },
  msSub: { color: TEXT_SECONDARY, fontSize: 12.5, marginTop: 6 },
})
