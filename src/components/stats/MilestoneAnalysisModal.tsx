import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { GlassCircleButton } from '@/components/GlassButton'
import { BG, CARD, ORANGE, GREEN, RED, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, NUM_FONT_SEMI, CARDIO_BLUE } from '@/lib/theme'
import { parseLocalDate, toLocalDateString } from '@/lib/date'
import { toDisplayDistance, distanceUnitLabel, type UnitSystem } from '@/lib/units'
import type { DaySummary } from '@/services/dailyLog'
import type { CardioWorkout } from '@/services/workouts'
import type { CompletedSessionItem } from '@/services/workoutSchedule'

// =============================================================================
// MILSTOLPEANALYS — öppnas från milstolpe-bannern på Framsteg.
// Sammanfattar hur det gått hittills och ger konkreta, databaserade tips.
// =============================================================================

const BLUE = CARDIO_BLUE
const TEAL = '#40F5E9'

const WEEKDAYS = ['måndagar', 'tisdagar', 'onsdagar', 'torsdagar', 'fredagar', 'lördagar', 'söndagar']

interface Tip {
  icon: React.ComponentProps<typeof Ionicons>['name']
  color: string
  text: string
}

export function MilestoneAnalysisModal({
  visible, onClose, days, currentDay, streak, milestone, startDate, workouts, completedSessions, unit,
}: {
  visible: boolean
  onClose: () => void
  days: DaySummary[]
  currentDay: number
  streak: number
  milestone: { day: number; label: string; daysLeft: number } | null
  startDate: string | null
  workouts: CardioWorkout[]
  completedSessions: CompletedSessionItem[]
  unit: UnitSystem
}) {
  const insets = useSafeAreaInsets()
  const unitLabel = distanceUnitLabel(unit)

  // ── Facit hittills ──
  const completed = days.filter(d => d.status === 'completed').length
  const missed    = days.filter(d => d.status === 'failed').length
  const logged    = completed + missed
  const successRate = logged > 0 ? Math.round((completed / logged) * 100) : 100

  // Längsta sviten av avklarade dagar i loggen
  const longestStreak = (() => {
    const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber)
    let best = 0, cur = 0
    for (const d of sorted) {
      if (d.status === 'completed') { cur += 1; best = Math.max(best, cur) }
      else if (d.status === 'failed') cur = 0
    }
    return Math.max(best, streak)
  })()

  // Vilken veckodag missarna oftast landar på
  const topMissDay = (() => {
    if (!startDate || missed === 0) return null
    const start = parseLocalDate(startDate)
    const counts = new Array(7).fill(0)
    for (const d of days) {
      if (d.status !== 'failed') continue
      const date = new Date(start)
      date.setDate(date.getDate() + d.dayNumber - 1)
      counts[(date.getDay() + 6) % 7] += 1
    }
    const max = Math.max(...counts)
    return max >= 2 ? { weekday: WEEKDAYS[counts.indexOf(max)], count: max } : null
  })()

  // ── Aktivitet: senaste 7 dagarna vs 7 dagarna innan ──
  const dayKeysBack = (from: number, to: number): Set<string> => {
    const keys = new Set<string>()
    for (let i = from; i < to; i++) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i)
      keys.add(toLocalDateString(d))
    }
    return keys
  }
  const thisWeekKeys = dayKeysBack(0, 7)
  const prevWeekKeys = dayKeysBack(7, 14)

  const passCount = (keys: Set<string>) =>
    workouts.filter(w => keys.has(toLocalDateString(new Date(w.created_at)))).length +
    completedSessions.filter(cs => cs.sessionType === 'gym' && keys.has(cs.completedDate)).length
  const kmSum = (keys: Set<string>) =>
    workouts.filter(w => keys.has(toLocalDateString(new Date(w.created_at))))
      .reduce((s, w) => s + w.data.distance_km, 0)

  const thisWeekPasses = passCount(thisWeekKeys)
  const prevWeekPasses = passCount(prevWeekKeys)
  const thisWeekKm = kmSum(thisWeekKeys)
  const prevWeekKm = kmSum(prevWeekKeys)

  const daysSinceCardio = (() => {
    if (workouts.length === 0) return null
    const latest = Math.max(...workouts.map(w => new Date(w.created_at).getTime()))
    return Math.floor((Date.now() - latest) / 86400000)
  })()

  // ── Tips, viktigast först ──
  const tips: Tip[] = []
  if (topMissDay) {
    tips.push({
      icon: 'calendar-outline', color: RED,
      text: `${topMissDay.count} av dina missar har landat på ${topMissDay.weekday}. Planera de dagarna extra noga: bestäm i förväg när passet, läsningen och fotot ska ske.`,
    })
  } else if (missed > 0) {
    tips.push({
      icon: 'alert-circle-outline', color: RED,
      text: `${missed} ${missed === 1 ? 'missad dag' : 'missade dagar'} hittills. Vanligaste orsaken är att kvällen blir för kort — gör den svåraste uppgiften före lunch.`,
    })
  } else if (logged >= 3) {
    tips.push({
      icon: 'shield-checkmark-outline', color: GREEN,
      text: 'Noll missade dagar hittills. Ändra ingenting, rutinen du har fungerar.',
    })
  }
  if (thisWeekPasses < prevWeekPasses) {
    tips.push({
      icon: 'trending-down-outline', color: ORANGE,
      text: `${thisWeekPasses} pass senaste 7 dagarna mot ${prevWeekPasses} veckan innan. Boka in nästa pass direkt efter att du läst klart det här.`,
    })
  } else if (thisWeekKm > prevWeekKm && prevWeekKm > 0) {
    tips.push({
      icon: 'trending-up-outline', color: GREEN,
      text: `Distansen ökar: ${toDisplayDistance(thisWeekKm, unit).toFixed(1)} ${unitLabel} senaste veckan mot ${toDisplayDistance(prevWeekKm, unit).toFixed(1)} veckan innan. Öka högst ~10 % per vecka så håller kroppen.`,
    })
  }
  if (daysSinceCardio !== null && daysSinceCardio >= 3) {
    tips.push({
      icon: 'walk-outline', color: BLUE,
      text: `${daysSinceCardio} dagar sedan senaste cardiopasset. Ett kort pass idag räcker för att hålla vanan vid liv.`,
    })
  }
  if (streak >= 7) {
    tips.push({
      icon: 'flame-outline', color: ORANGE,
      text: `Din streak på ${streak} dagar är din största tillgång. Skydda den: gör aldrig morgondagen beroende av motivation, bara av planen.`,
    })
  } else {
    tips.push({
      icon: 'flame-outline', color: ORANGE,
      text: `Streak: ${streak} ${streak === 1 ? 'dag' : 'dagar'}. Ta den till 7 så börjar rutinen sköta sig själv — en dag i taget.`,
    })
  }
  if (milestone) {
    tips.push({
      icon: 'flag-outline', color: TEAL,
      text: `${milestone.daysLeft === 1 ? 'Bara 1 dag' : `${milestone.daysLeft} dagar`} kvar till "${milestone.label.replace(/!$/, '')}". Sikta bara på den, inte på dag 75.`,
    })
  }

  const progressDays = Math.max(0, currentDay - 1)
  const progressPct = milestone ? Math.min(100, Math.round((progressDays / milestone.day) * 100)) : 100

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
          <GlassCircleButton icon="chevron-back" onPress={onClose} />
          <Text style={s.topTitle}>Analys</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
          {/* Mot nästa milstolpe */}
          {milestone && (
            <View style={s.readout}>
              <Text style={s.readoutLabel}>Nästa milstolpe</Text>
              <Text style={s.readoutTitle}>{milestone.label}</Text>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${progressPct}%` as never }]} />
              </View>
              <Text style={s.readoutSub}>
                Dag {progressDays} av {milestone.day} · {milestone.daysLeft === 1 ? '1 dag kvar' : `${milestone.daysLeft} dagar kvar`}
              </Text>
            </View>
          )}

          {/* Facit hittills */}
          <Text style={s.sectionHead}>Så har det gått</Text>
          <View style={s.card}>
            <View style={[s.dtlRow, { paddingTop: 14 }]}>
              <View style={s.dtlCell}>
                <Text style={s.dtlLbl}>Klarade dagar</Text>
                <Text style={[s.dtlVal, { color: GREEN }]}>{completed}</Text>
              </View>
              <View style={s.dtlCell}>
                <Text style={s.dtlLbl}>Missade dagar</Text>
                <Text style={[s.dtlVal, { color: RED }]}>{missed}</Text>
              </View>
            </View>
            <View style={s.dtlSep} />
            <View style={[s.dtlRow, { paddingBottom: 14 }]}>
              <View style={s.dtlCell}>
                <Text style={s.dtlLbl}>Framgång</Text>
                <Text style={[s.dtlVal, { color: TEAL }]}>
                  {successRate}
                  <Text style={s.dtlUnit}> %</Text>
                </Text>
              </View>
              <View style={s.dtlCell}>
                <Text style={s.dtlLbl}>Längsta streak</Text>
                <Text style={[s.dtlVal, { color: ORANGE }]}>
                  {longestStreak}
                  <Text style={s.dtlUnit}> DAGAR</Text>
                </Text>
              </View>
            </View>
          </View>

          {/* Senaste veckan */}
          <Text style={s.sectionHead}>Senaste 7 dagarna</Text>
          <View style={s.card}>
            <View style={[s.kpiRow, { borderTopWidth: 0 }]}>
              <Text style={s.kpiLbl}>Träningspass</Text>
              <Text style={s.kpiVal}>
                {thisWeekPasses}
                <Text style={s.kpiPrev}>  ({prevWeekPasses} veckan innan)</Text>
              </Text>
            </View>
            <View style={s.kpiRow}>
              <Text style={s.kpiLbl}>Distans</Text>
              <Text style={s.kpiVal}>
                {toDisplayDistance(thisWeekKm, unit).toFixed(1)} {unitLabel}
                <Text style={s.kpiPrev}>  ({toDisplayDistance(prevWeekKm, unit).toFixed(1)} veckan innan)</Text>
              </Text>
            </View>
          </View>

          {/* Tips */}
          <Text style={s.sectionHead}>Att tänka på</Text>
          <View style={s.card}>
            {tips.map((t, i) => (
              <View key={i} style={[s.tipRow, i > 0 && s.rowBorder]}>
                <View style={[s.tipIcon, { backgroundColor: t.color + '1A' }]}>
                  <Ionicons name={t.icon} size={16} color={t.color} />
                </View>
                <Text style={s.tipText}>{t.text}</Text>
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
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },

  readout: { gap: 6, marginTop: 6 },
  readoutLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  readoutTitle: { color: TEXT_PRIMARY, fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: ORANGE },
  readoutSub: { color: TEXT_SECONDARY, fontSize: 13, fontFamily: NUM_FONT_SEMI },

  sectionHead: {
    color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', letterSpacing: -0.4,
    marginTop: 6, marginBottom: -6,
  },
  card: { backgroundColor: CARD, borderRadius: 20, paddingHorizontal: 18 },

  dtlRow: { flexDirection: 'row', paddingVertical: 13 },
  dtlCell: { flex: 1, gap: 3 },
  dtlLbl: { color: TEXT_SECONDARY, fontSize: 14 },
  dtlVal: { fontSize: 26, fontFamily: NUM_FONT },
  dtlUnit: { fontSize: 14, fontFamily: NUM_FONT_SEMI },
  dtlSep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)' },

  kpiRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)',
  },
  kpiLbl: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500' },
  kpiVal: { color: TEXT_PRIMARY, fontSize: 16, fontFamily: NUM_FONT, fontVariant: ['tabular-nums'] },
  kpiPrev: { color: TEXT_SECONDARY, fontSize: 12, fontFamily: NUM_FONT_SEMI },

  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  tipRow: { flexDirection: 'row', gap: 12, paddingVertical: 14, alignItems: 'flex-start' },
  tipIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  tipText: { color: TEXT_PRIMARY, fontSize: 14, lineHeight: 20, flex: 1 },
})
