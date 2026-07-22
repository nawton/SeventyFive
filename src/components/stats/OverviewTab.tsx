// ÖVERSIKT-fliken på Framsteg: utmaningsring, milstolpe, Din vecka,
// kalender och deras detaljvyer. Skalet (stats.tsx) äger rådatan.
import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native'
import { Ionicons } from '@/components/Icon'
import type { GestureType } from 'react-native-gesture-handler'
import Svg, { Circle, Text as SvgText } from 'react-native-svg'
import { GREEN, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, ACCENT } from '@/lib/theme'
import { toLocalDateString, parseLocalDate, startOfWeek } from '@/lib/date'
import { toDisplayDistance, distanceUnitLabel, type UnitSystem } from '@/lib/units'
import type { DaySummary } from '@/services/dailyLog'
import type { CardioWorkout, StrengthWorkout } from '@/services/workouts'
import type { CompletedSessionItem } from '@/services/workoutSchedule'
import { STATS_SCREEN_W, BLUE, RED, YELLOW, nextMilestone, s , useStatsColors} from './statsShared'
import { CalendarView } from './CalendarView'
import { DayWorkoutsModal } from './DayWorkoutsModal'
import { MilestoneAnalysisModal } from './MilestoneAnalysisModal'


function RingChart({ currentDay, completedDays }: { currentDay: number; completedDays: number }) {
  const P = useStatsColors()
  const R = 48
  const C = 2 * Math.PI * R
  const completedArc = (completedDays / 75) * C
  const elapsedArc   = (currentDay / 75) * C
  const missedArc    = Math.max(0, elapsedArc - completedArc)

  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      <Circle cx={60} cy={60} r={R} fill="none" stroke={BORDER} strokeWidth={11} />
      {completedArc > 0 && (
        <Circle
          cx={60} cy={60} r={R}
          fill="none" stroke={ACCENT} strokeWidth={11}
          strokeDasharray={`${completedArc} ${C}`}
          strokeLinecap="round"
          rotation={-90} origin="60,60"
        />
      )}
      {missedArc > 0 && (
        <Circle
          cx={60} cy={60} r={R}
          fill="none" stroke={P.RED} strokeWidth={11}
          strokeDasharray={`${missedArc} ${C}`}
          strokeDashoffset={-completedArc}
          strokeLinecap="round"
          rotation={-90} origin="60,60"
          opacity={0.45}
        />
      )}
      <SvgText
        x={60} y={53}
        textAnchor="middle" fontSize={26} fontWeight="900"
        fill={TEXT_PRIMARY} fontFamily="-apple-system,sans-serif"
      >
        {currentDay}
      </SvgText>
      <SvgText
        x={60} y={73}
        textAnchor="middle" fontSize={11}
        fill={TEXT_SECONDARY} fontFamily="-apple-system,sans-serif"
      >
        av 75
      </SvgText>
    </Svg>
  )
}

export function OverviewTab({
  days, startDate, challengeId, currentDay, streak,
  workouts, strengthWorkouts, completedSessions, unit, avatarUrl,
  calSwipeRef, onTabScroll, refreshControl, onOpenWorkout, onRemoveWorkoutLocal,
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
}) {
  const P = useStatsColors()
  const unitLabel = distanceUnitLabel(unit)
  const [selectedDay, setSelectedDay]           = useState<DaySummary | null>(null)
  const [milestoneOpen, setMilestoneOpen]       = useState(false)

  const completedDays = days.filter(d => d.status === 'completed').length
  const missedDays    = days.filter(d => d.status === 'failed').length

  // ── Din vecka: tvärsummering över cardio + gym, innevarande kalendervecka ──
  const nowWeekStart = toLocalDateString(startOfWeek())
  const nowWeekEnd = (() => { const d = startOfWeek(); d.setDate(d.getDate() + 7); return toLocalDateString(d) })()
  const inNowWeek = (iso: string) => iso >= nowWeekStart && iso < nowWeekEnd
  const reportCardio = workouts.filter(w => inNowWeek(toLocalDateString(new Date(w.created_at))))
  const weekReport = {
    passes: reportCardio.length
      + completedSessions.filter(c => c.sessionType === 'gym' && inNowWeek(c.completedDate)).length,
    km: reportCardio.reduce((s, w) => s + w.data.distance_km, 0),
    volume: strengthWorkouts
      .filter(w => inNowWeek(w.data.workout_date ?? toLocalDateString(new Date(w.created_at))))
      .reduce((s, w) => s + w.data.sets.reduce((x, r) => x + r.reps * (r.weight_kg || 0), 0), 0),
    daysCleared: startDate
      ? days.filter(d => {
          if (d.status !== 'completed') return false
          const dt = parseLocalDate(startDate)
          dt.setDate(dt.getDate() + d.dayNumber - 1)
          return inNowWeek(toLocalDateString(dt))
        }).length
      : 0,
  }

  const milestone   = nextMilestone(Math.max(0, currentDay - 1))
  const isEarlyDays = currentDay <= 7

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
            {/* Ring chart */}
            <Text style={s.sectionHead}>Utmaningen</Text>
            <View style={[s.card, s.cardPlain]}>
              <View style={s.ringWrap}>
                <RingChart currentDay={currentDay} completedDays={completedDays} />
                <View style={s.ringInfo}>
                  <View>
                    <Text style={s.ringDay}>Dag {currentDay}</Text>
                    <Text style={s.ringOfN}>
                      {currentDay > 0 ? Math.round((currentDay / 75) * 100) : 0}% av utmaningen
                    </Text>
                  </View>
                  <View style={s.ringRows}>
                    <View style={s.ringRow}>
                      <Text style={s.ringRowLabel}>Klarade dagar</Text>
                      <Text style={[s.ringRowVal, { color: GREEN }]}>{completedDays} ✓</Text>
                    </View>
                    {!isEarlyDays && (
                      <>
                        <View style={s.ringRow}>
                          <Text style={s.ringRowLabel}>Missade dagar</Text>
                          <Text style={[s.ringRowVal, { color: P.RED }]}>{missedDays}</Text>
                        </View>
                        <View style={s.ringRow}>
                          <Text style={s.ringRowLabel}>Framgång</Text>
                          <Text style={[s.ringRowVal, { color: ACCENT }]}>
                            {currentDay > 1 ? Math.round((completedDays / (currentDay - 1)) * 100) : 0}%
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* Milestone — framträdande dag 1–7 */}
            {isEarlyDays && milestone && (
              <TouchableOpacity style={s.milestone} activeOpacity={0.8} onPress={() => setMilestoneOpen(true)}>
                <View style={s.msIcon}><Text style={s.msEmoji}>🏔</Text></View>
                <View style={s.msBody}>
                  <Text style={s.msEyebrow}>NÄSTA MILSTOLPE</Text>
                  <Text style={s.msTitle}>{milestone.label}</Text>
                  <Text style={s.msSub}>
                    {milestone.daysLeft === 1 ? '1 dag kvar' : `${milestone.daysLeft} dagar kvar`} · Du är på väg!
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={ACCENT} />
              </TouchableOpacity>
            )}

            {/* Din vecka — tvärsummering över cardio och gym */}
            <Text style={s.sectionHead}>Din vecka</Text>
            <View style={[s.card, s.cardPlain]}>
              <View style={[s.dtlRow, { paddingTop: 0 }]}>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Träningspass</Text>
                  <Text style={[s.dtlVal, { color: ACCENT }]}>{weekReport.passes}</Text>
                </View>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Distans</Text>
                  <Text style={[s.dtlVal, { color: P.BLUE }]}>
                    {toDisplayDistance(weekReport.km, unit).toFixed(1).replace('.', ',')}
                    <Text style={s.dtlUnit}> {unitLabel.toUpperCase()}</Text>
                  </Text>
                </View>
              </View>
              <View style={s.dtlSep} />
              <View style={[s.dtlRow, { paddingBottom: 0 }]}>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Volym</Text>
                  <Text style={[s.dtlVal, { color: P.YELLOW }]} numberOfLines={1} adjustsFontSizeToFit>
                    {Math.round(weekReport.volume).toLocaleString('sv-SE')}
                    <Text style={s.dtlUnit}> KG</Text>
                  </Text>
                </View>
                <View style={s.dtlCell}>
                  <Text style={s.dtlLbl}>Klarade dagar</Text>
                  <Text style={[s.dtlVal, { color: GREEN }]}>{weekReport.daysCleared}</Text>
                </View>
              </View>
            </View>

            {/* Milestone — normal position dag 8+ */}
            {!isEarlyDays && milestone && (
              <TouchableOpacity style={s.milestone} activeOpacity={0.8} onPress={() => setMilestoneOpen(true)}>
                <View style={s.msIcon}><Text style={s.msEmoji}>🏔</Text></View>
                <View style={s.msBody}>
                  <Text style={s.msEyebrow}>NÄSTA MILSTOLPE</Text>
                  <Text style={s.msTitle}>{milestone.label}</Text>
                  <Text style={s.msSub}>
                    {milestone.daysLeft === 1 ? '1 dag kvar' : `${milestone.daysLeft} dagar kvar`} · Håll ut
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={ACCENT} />
              </TouchableOpacity>
            )}

            {/* Calendar */}
            <Text style={s.sectionHead}>Kalender</Text>
            <CalendarView
              days={days}
              startDate={startDate}
              currentDay={currentDay}
              challengeId={challengeId}
              onPressDay={setSelectedDay}
              gestureRef={calSwipeRef}
              workouts={workouts}
              strengthWorkouts={strengthWorkouts}
              completedSessions={completedSessions}
              unit={unit}
              avatarUrl={avatarUrl}
              onDeleteWorkout={onRemoveWorkoutLocal}
            />
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
