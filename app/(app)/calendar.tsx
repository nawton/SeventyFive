import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useFocusEffect } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@/components/Icon'
import { supabase } from '@/lib/supabase'
import { GlassCircleButton } from '@/components/GlassButton'
import { getActiveChallenge, calculateCurrentDay } from '@/services/challenge'
import { getAllDays, getTasksForDay, type DaySummary, type TaskItem } from '@/services/dailyLog'
import { toLocalDateString, parseLocalDate } from '@/lib/date'
import { useT, dateLocale } from '@/lib/i18n'
import {
  BG, CARD, GREEN, RED, ACCENT, TEXT_PRIMARY, TEXT_SECONDARY,
  useThemeStrings, useCardChrome,
} from '@/lib/theme'

// =============================================================================
// KALENDERSIDAN — öppnas från "Hela kalendern" på översikten. Tre
// summeringskort (klara/missade/kvar), månadsgrid med utmaningens dagar
// färgkodade och vald dags uppgifter längst ner. Uppgifterna är
// skrivskyddade här — redigering bor kvar i dagvyn på översikten.
// =============================================================================

const DAY_MS = 86400000

export default function CalendarScreen() {
  const t = useT()
  const T = useThemeStrings()
  const chrome = useCardChrome()

  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<string | null>(null)
  const [currentDay, setCurrentDay] = useState(0)
  const [days, setDays] = useState<DaySummary[]>([])
  const [monthOffset, setMonthOffset] = useState(0)
  const [selDay, setSelDay] = useState<number | null>(null)
  const [tasks, setTasks] = useState<TaskItem[] | null>(null)

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const challenge = await getActiveChallenge(session.user.id)
    if (!challenge) return
    const day = calculateCurrentDay(challenge.start_date)
    setChallengeId(challenge.id)
    setStartDate(challenge.start_date)
    setCurrentDay(day)
    setDays(await getAllDays(challenge.id, day))
    // Dagens uppgifter förvalda i detaljkortet
    setSelDay(day >= 1 && day <= 75 ? day : null)
    if (day >= 1 && day <= 75) {
      setTasks(await getTasksForDay(challenge.id, day).catch(() => null))
    }
  }, [])

  useFocusEffect(useCallback(() => { load().catch(() => {}) }, [load]))

  const completed = days.filter(d => d.status === 'completed').length
  const missed    = days.filter(d => d.status === 'failed').length
  const left      = days.filter(d => d.status === 'future').length

  // ── Månadsgriden ───────────────────────────────────────────────────────────
  const base = new Date()
  const month = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1)
  const monthLabel = month.toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const leadBlanks = (month.getDay() + 6) % 7   // måndagsstart
  const todayIso = toLocalDateString(new Date())

  function challengeDayFor(iso: string): { n: number; status: DaySummary['status'] } | null {
    if (!startDate) return null
    const n = Math.round((parseLocalDate(iso).getTime() - parseLocalDate(startDate).getTime()) / DAY_MS) + 1
    if (n < 1 || n > 75) return null
    const d = days.find(x => x.dayNumber === n)
    return d ? { n, status: d.status } : null
  }

  async function selectDay(n: number) {
    if (!challengeId || n > currentDay) return
    Haptics.selectionAsync()
    setSelDay(n)
    setTasks(null)
    setTasks(await getTasksForDay(challengeId, n).catch(() => null))
  }

  const weekdayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2026, 5, 1 + i)   // en känd måndag: 1 juni 2026
    return d.toLocaleDateString(dateLocale(), { weekday: 'short' }).replace('.', '').toUpperCase()
  })

  const selDate = startDate && selDay
    ? new Date(parseLocalDate(startDate).getTime() + (selDay - 1) * DAY_MS)
    : null
  const selLabel = selDate
    ? selDate.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })
    : ''
  const selFailed = selDay != null && days.find(d => d.dayNumber === selDay)?.status === 'failed'

  return (
    <SafeScreen style={s.screen}>
      <View style={s.topBar}>
        <GlassCircleButton icon="chevron-back" size={40} iconColor={TEXT_PRIMARY}
          onPress={() => router.back()} fallbackStyle={{ backgroundColor: CARD }} />
        <Text style={s.topTitle}>{t('Kalender')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Summeringen: klara, missade, kvar */}
        <View style={s.statRow}>
          <View style={[s.statCard, chrome]}>
            <Text style={[s.statValue, { color: GREEN }]}>{completed}</Text>
            <Text style={s.statLabel}>{t('klara')}</Text>
          </View>
          <View style={[s.statCard, chrome]}>
            <Text style={[s.statValue, { color: RED }]}>{missed}</Text>
            <Text style={s.statLabel}>{t('missade')}</Text>
          </View>
          <View style={[s.statCard, chrome]}>
            <Text style={s.statValue}>{left}</Text>
            <Text style={s.statLabel}>{t('kvar')}</Text>
          </View>
        </View>

        {/* Månaden */}
        <View style={[s.monthCard, chrome]}>
          <View style={s.monthHead}>
            <TouchableOpacity style={s.monthNav} onPress={() => setMonthOffset(o => o - 1)} hitSlop={8} testID="prevMonth">
              <Ionicons name="chevron-back" size={18} color={TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={s.monthTitle}>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</Text>
            <TouchableOpacity style={s.monthNav} onPress={() => setMonthOffset(o => o + 1)} hitSlop={8} testID="nextMonth">
              <Ionicons name="chevron-forward" size={18} color={TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>

          <View style={s.gridRow}>
            {weekdayLabels.map(w => (
              <Text key={w} style={s.gridHead}>{w}</Text>
            ))}
          </View>
          <View style={s.grid}>
            {Array.from({ length: leadBlanks }).map((_, i) => (
              <View key={`b${i}`} style={s.gridCell} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const dayNum = i + 1
              const iso = toLocalDateString(new Date(month.getFullYear(), month.getMonth(), dayNum))
              const cd = challengeDayFor(iso)
              const isToday = iso === todayIso
              const isFuture = iso > todayIso
              const dotColor = cd && !isFuture && !isToday
                ? cd.status === 'completed' ? GREEN : cd.status === 'failed' ? RED : T.ACCENT
                : null
              return (
                <TouchableOpacity
                  key={iso}
                  style={s.gridCell}
                  onPress={() => cd && selectDay(cd.n)}
                  activeOpacity={cd && !isFuture ? 0.7 : 1}
                  testID={`calDay-${iso}`}
                >
                  <View style={[
                    s.dayCircle,
                    isToday && { borderWidth: 2, borderColor: T.ACCENT },
                    !isToday && isFuture && cd != null && s.dayCircleFuture,
                    selDay != null && cd?.n === selDay && !isToday && { backgroundColor: `${T.ACCENT}18` },
                  ]}>
                    <Text style={[
                      s.dayNum,
                      cd == null && { color: TEXT_SECONDARY, opacity: 0.55 },
                      isToday && { color: T.ACCENT, fontWeight: '800' },
                    ]}>
                      {dayNum}
                    </Text>
                  </View>
                  <View style={s.dotSlot}>
                    {dotColor && <View style={[s.dot, { backgroundColor: dotColor }]} />}
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Legenden */}
          <View style={s.legendRow}>
            <View style={[s.dot, { backgroundColor: GREEN }]} />
            <Text style={s.legendText}>{t('Klar')}</Text>
            <View style={[s.dot, { backgroundColor: RED }]} />
            <Text style={s.legendText}>{t('Missad')}</Text>
            <View style={[s.dot, { backgroundColor: T.ACCENT }]} />
            <Text style={s.legendText}>{t('Pågående')}</Text>
            <View style={s.legendFuture} />
            <Text style={s.legendText}>{t('Framtid')}</Text>
          </View>
        </View>

        {/* Vald dags uppgifter */}
        {selDay != null && (
          <View style={[s.dayCard, chrome]}>
            <Text style={s.dayTitle}>
              {selLabel.charAt(0).toUpperCase() + selLabel.slice(1)} · {t('Dag {n}', { n: selDay })}
            </Text>
            {tasks === null && <Text style={s.dayEmpty}>{t('Inga uppgifter loggade den här dagen.')}</Text>}
            {tasks?.map(task => {
              const missedTask = !task.completed && selFailed
              return (
                <View key={task.completionId} style={s.taskRow}>
                  <Ionicons
                    name={task.completed ? 'checkmark-circle' : missedTask ? 'close-circle' : 'ellipse-outline'}
                    size={26}
                    color={task.completed ? GREEN : missedTask ? RED : 'rgba(128,128,128,0.45)'}
                  />
                  <Text style={[s.taskName, missedTask && { color: RED }]} numberOfLines={1}>
                    {t(task.name)}
                  </Text>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeScreen>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  topTitle: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800' },
  scroll: { paddingHorizontal: 16, paddingBottom: 60, paddingTop: 6 },

  statRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1, alignItems: 'center', gap: 2,
    backgroundColor: CARD, borderRadius: 18, paddingVertical: 16,
  },
  statValue: { color: TEXT_PRIMARY, fontSize: 24, fontWeight: '800' },
  statLabel: { color: TEXT_SECONDARY, fontSize: 13 },

  monthCard: { backgroundColor: CARD, borderRadius: 20, padding: 14, marginBottom: 14 },
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthNav: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  monthTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '800' },
  gridRow: { flexDirection: 'row', marginBottom: 4 },
  gridHead: {
    flex: 1, textAlign: 'center', color: TEXT_SECONDARY,
    fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: { width: `${100 / 7}%` as never, alignItems: 'center', paddingVertical: 4 },
  dayCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  dayCircleFuture: { borderWidth: 1.5, borderColor: 'rgba(128,128,128,0.4)', borderStyle: 'dashed' },
  dayNum: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  dotSlot: { height: 8, justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },

  legendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.2)',
  },
  legendText: { color: TEXT_SECONDARY, fontSize: 13, marginRight: 8 },
  legendFuture: {
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 1.5, borderColor: 'rgba(128,128,128,0.45)', borderStyle: 'dashed',
  },

  dayCard: { backgroundColor: CARD, borderRadius: 20, padding: 16 },
  dayTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '800', marginBottom: 12 },
  dayEmpty: { color: TEXT_SECONDARY, fontSize: 14 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  taskName: { flex: 1, color: TEXT_PRIMARY, fontSize: 15.5, fontWeight: '500' },
})
