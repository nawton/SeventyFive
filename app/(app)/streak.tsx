import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator,
} from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import Svg, {
  Path, Circle, Defs, G, LinearGradient as SvgLinearGradient, RadialGradient, Stop,
} from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { getActiveChallenge } from '@/services/challenge'
import { getStreak, getWeekStatuses, getDayDetail, type TaskItem } from '@/services/dailyLog'
import { GlassCircleButton } from '@/components/GlassButton'
import { toLocalDateString, startOfWeek } from '@/lib/date'
import { BG, CARD, BORDER, GREEN, RED, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, ACCENT, accentAlpha, useThemeStrings, useCardChrome, THEME_DARK } from '@/lib/theme'

// =============================================================================
// STREAK — hur många dagar i rad utmaningen klarats. Glödande låga,
// veckoöversikt med bockar och nästa milstolpe. Nås från streakräknaren
// på profilen.
// =============================================================================

const MILESTONES = [7, 14, 21, 28, 50, 75]

/** De fyra mest relevanta milstolparna kring nuvarande streak */
export function visibleMilestones(streak: number): number[] {
  const nextIdx = MILESTONES.findIndex(m => m > streak)
  if (nextIdx === -1) return MILESTONES.slice(-4)
  const start = Math.max(0, Math.min(nextIdx - 1, MILESTONES.length - 4))
  return MILESTONES.slice(start, start + 4)
}

/** Fyruddig gnistra */
function Sparkle({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const w = r * 0.3
  return (
    <Path
      d={`M ${x} ${y - r} L ${x + w} ${y - w} L ${x + r} ${y} L ${x + w} ${y + w}
          L ${x} ${y + r} L ${x - w} ${y + w} L ${x - r} ${y} L ${x - w} ${y - w} Z`}
      fill={fill}
    />
  )
}

/** Glödande låga som i förlagan: stor mjuk radiell glöd, tunn dubbelring,
    rund fyllig låga med krulltoppar och krämvit innerlåga, plus gnistor */
function Flame({ size = 250 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FF8A1E" stopOpacity={0.45} />
          <Stop offset="45%" stopColor="#FF8A1E" stopOpacity={0.20} />
          <Stop offset="75%" stopColor="#FF8A1E" stopOpacity={0.07} />
          <Stop offset="100%" stopColor="#FF8A1E" stopOpacity={0} />
        </RadialGradient>
        <SvgLinearGradient id="outer" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFC94D" />
          <Stop offset="55%" stopColor="#FF9E1B" />
          <Stop offset="100%" stopColor="#F26B00" />
        </SvgLinearGradient>
        <SvgLinearGradient id="inner" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFF7DE" />
          <Stop offset="100%" stopColor="#FFD35C" />
        </SvgLinearGradient>
      </Defs>

      {/* Glöden fyller hela ytan, ringarna svävar runt lågan */}
      <Circle cx={50} cy={50} r={50} fill="url(#glow)" />
      <Circle cx={50} cy={50} r={39} fill="none" stroke={ACCENT} strokeOpacity={0.30} strokeWidth={1.3} />
      <Circle cx={50} cy={50} r={44} fill="none" stroke={ACCENT} strokeOpacity={0.10} strokeWidth={1} />

      {/* Lågan — rund och fyllig med krull åt båda håll, skalad in i ringen */}
      <G transform="translate(15, 17) scale(0.7)">
        <Path
          d="M50 12
             C 50 12, 57 22, 57 31
             C 57 36, 54 39, 51 41
             C 56 42, 64 38, 63 26
             C 71 34, 76 44, 76 54
             C 76 68, 64 78, 50 78
             C 36 78, 24 68, 24 54
             C 24 44, 30 35, 37 27
             C 37 38, 43 43, 47 40
             C 43 33, 45 21, 50 12 Z"
          fill="url(#outer)"
        />
        <Path
          d="M50 78
             C 43 78, 38 73, 38 66
             C 38 59, 44 55, 47 49
             C 49 54, 56 57, 58 63
             C 60 70, 57 78, 50 78 Z"
          fill="url(#inner)"
        />
      </G>

      {/* Gnistor — stjärnor och prickar som i förlagan */}
      <Sparkle x={30} y={24} r={3.2} fill="#FFE49A" />
      <Sparkle x={71} y={18} r={2.2} fill="#FFD37A" />
      <Circle cx={76} cy={34} r={1.2} fill="#FFB84D" />
      <Circle cx={24} cy={42} r={1.0} fill="#FFB84D" />
      <Circle cx={66} cy={26} r={0.9} fill="#FFD37A" />
    </Svg>
  )
}

export default function StreakScreen() {
  const T = useThemeStrings()
  const chrome = useCardChrome()
  const dotEdge = T.TEXT_PRIMARY === '#FFFFFF' ? THEME_DARK.BORDER : 'rgba(0,0,0,0.30)'
  const [streak, setStreak] = useState(0)
  const [weekStatuses, setWeekStatuses] = useState<Record<string, string>>({})
  const [challengeId, setChallengeId] = useState<string | null>(null)
  // Dagvyn: tryckt dag + dess uppgifter (null = stängd)
  const [dayOpen, setDayOpen] = useState<string | null>(null)
  const [dayTasks, setDayTasks] = useState<TaskItem[] | null>(null)
  const [dayStatus, setDayStatus] = useState<string | null>(null)

  useFocusEffect(useCallback(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user || !alive) return
      const challenge = await getActiveChallenge(session.user.id).catch(() => null)
      if (!challenge || !alive) return
      setChallengeId(challenge.id)
      const [days, statuses] = await Promise.all([
        getStreak(challenge.id).catch(() => 0),
        getWeekStatuses(challenge.id).catch(() => ({})),
      ])
      if (!alive) return
      setStreak(days)
      setWeekStatuses(statuses)
    })
    return () => { alive = false }
  }, []))

  function openDay(date: string) {
    if (!challengeId) return
    setDayOpen(date)
    setDayTasks(null)
    setDayStatus(null)
    getDayDetail(challengeId, date)
      .then(d => { setDayTasks(d.tasks); setDayStatus(d.status) })
      .catch(() => setDayTasks([]))
  }

  // Veckoremsan: M T O T F L S med status per dag
  const monday = startOfWeek()
  const today = toLocalDateString()
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(d.getDate() + i)
    const key = toLocalDateString(d)
    return {
      key,
      label: ['M', 'T', 'O', 'T', 'F', 'L', 'S'][i],
      dayOfMonth: d.getDate(),
      status: weekStatuses[key] ?? null,
      isToday: key === today,
      isFuture: key > today,
    }
  })

  const milestones = visibleMilestones(streak)
  const next = MILESTONES.find(m => m > streak)

  return (
    <SafeScreen style={s.screen}>
      <View style={s.header}>
        <GlassCircleButton
          icon="chevron-back"
          size={40}
          iconColor={TEXT_PRIMARY}
          onPress={() => router.back()}
          fallbackStyle={s.iconBtnFallback}
        />
        <Text style={s.title}>Streak</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.flameWrap}>
          <Flame />
        </View>

        <Text style={s.streakNumber}>{streak}</Text>
        <Text style={s.streakLabel}>{streak === 1 ? 'dags streak' : 'dagars streak'}</Text>
        <Text style={s.streakHint}>
          Klara alla dagens uppgifter varje dag för att hålla lågan vid liv.
        </Text>

        {/* Veckan: bock för klarade dagar, kryss för missade, siffror framåt */}
        <View style={[s.weekCard, chrome]}>
          <View style={s.weekRow}>
            {week.map(d => (
              <Text key={`l-${d.key}`} style={[s.weekLabel, d.isToday && s.weekLabelToday]}>
                {d.label}
              </Text>
            ))}
          </View>
          <View style={s.weekRow}>
            {week.map(d => (
              <TouchableOpacity
                key={d.key}
                style={s.weekSlot}
                disabled={d.isFuture}
                activeOpacity={0.6}
                onPress={() => openDay(d.key)}
                testID={`day-${d.key}`}
              >
                {d.status === 'completed' ? (
                  <View style={[s.dayDot, { backgroundColor: T.ACCENT, borderColor: T.ACCENT }]}>
                    <Ionicons name="checkmark" size={14} color="#000" />
                  </View>
                ) : d.status === 'failed' ? (
                  <View style={[s.dayDot, { borderColor: RED + '88' }]}>
                    <Ionicons name="close" size={13} color={RED} />
                  </View>
                ) : d.isFuture ? (
                  <Text style={s.dayNumber}>{d.dayOfMonth}</Text>
                ) : (
                  <View style={[s.dayDot, { borderColor: d.isToday ? T.ACCENT : dotEdge }]} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Milstolpar — nästa mål har streckad orange ram som i förlagan */}
        <View style={[s.milestoneCard, chrome]}>
          <Text style={s.milestoneHead}>
            {next ? `NÄSTA MILSTOLPE: ${next} DAGAR` : 'ALLA MILSTOLPAR KLARADE'}
          </Text>
          <View style={s.milestoneRow}>
            {milestones.map(m => {
              const passed = streak >= m
              const isNext = m === next
              return (
                <View key={m} style={[s.milestoneChip, isNext && s.milestoneChipNext]}>
                  <Text style={[
                    s.milestoneDays,
                    passed && s.milestonePassed,
                    isNext && s.milestoneNextText,
                  ]}>
                    {m} dagar
                  </Text>
                  {passed ? (
                    <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                  ) : (
                    <Ionicons name="flame-outline" size={16} color={isNext ? ACCENT : TEXT_SECONDARY} />
                  )}
                </View>
              )
            })}
          </View>
        </View>
      </ScrollView>

      {/* Dagvyn: vad som klarades och missades den tryckta dagen */}
      <Modal visible={!!dayOpen} transparent animationType="fade" onRequestClose={() => setDayOpen(null)}>
        <TouchableOpacity style={s.dayBackdrop} activeOpacity={1} onPress={() => setDayOpen(null)}>
          <View style={[s.dayCard, chrome]} onStartShouldSetResponder={() => true}>
            <View style={s.grabber} />
            <Text style={s.dayTitle}>
              {dayOpen ? new Date(`${dayOpen}T12:00:00`).toLocaleDateString('sv-SE', {
                weekday: 'long', day: 'numeric', month: 'long',
              }).replace(/^./, c => c.toUpperCase()) : ''}
            </Text>
            {dayStatus === 'completed' && <Text style={[s.dayStatusText, { color: GREEN }]}>Dagen klarad</Text>}
            {dayStatus === 'failed' && <Text style={[s.dayStatusText, { color: RED }]}>Dagen missad</Text>}

            {dayTasks === null ? (
              <ActivityIndicator style={{ marginVertical: 24 }} color={TEXT_SECONDARY} />
            ) : dayTasks.length === 0 ? (
              <Text style={s.dayEmpty}>
                Ingen data för den här dagen, du hade inte öppnat appen då.
              </Text>
            ) : (
              <View style={{ marginTop: 6 }}>
                {dayTasks.map((t, i) => (
                  <View key={t.completionId} style={[s.dayTaskRow, i > 0 && s.dayTaskDivider]}>
                    <Ionicons
                      name={t.completed ? 'checkmark-circle' : 'close-circle'}
                      size={20}
                      color={t.completed ? GREEN : RED}
                    />
                    <Text style={[s.dayTaskName, !t.completed && s.dayTaskMissed]} numberOfLines={1}>
                      {t.name}
                    </Text>
                    {!t.completed && <Text style={s.dayTaskTag}>Missad</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeScreen>
  )
}

const s = StyleSheet.create({
  dayBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  dayCard: {
    backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 22, paddingTop: 10, paddingBottom: 42,
  },
  grabber: {
    width: 40, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.45)',
    alignSelf: 'center', marginBottom: 12,
  },
  dayTitle: { color: TEXT_PRIMARY, fontSize: 19, fontWeight: '800' },
  dayStatusText: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  dayEmpty: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 20, marginVertical: 18 },
  dayTaskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  dayTaskDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.25)' },
  dayTaskName: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  dayTaskMissed: { color: TEXT_SECONDARY },
  dayTaskTag: { color: RED, fontSize: 12, fontWeight: '700' },

  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  iconBtnFallback: { backgroundColor: CARD },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, alignItems: 'center' },

  flameWrap: { marginTop: 4, marginBottom: -14 },
  streakNumber: { color: TEXT_PRIMARY, fontSize: 64, fontFamily: NUM_FONT, lineHeight: 70 },
  streakLabel: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginTop: 2 },
  streakHint: {
    color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center',
    marginTop: 10, lineHeight: 19, paddingHorizontal: 30,
  },

  weekCard: {
    alignSelf: 'stretch', marginTop: 26,
    backgroundColor: CARD, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 10, gap: 12,
  },
  weekRow: { flexDirection: 'row' },
  weekLabel: {
    flex: 1, textAlign: 'center',
    color: TEXT_SECONDARY, fontSize: 13, fontWeight: '700',
  },
  weekLabelToday: { color: ACCENT },
  weekSlot: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 30 },
  dayDot: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  dayDotFailed: {},
  dayNumber: { color: TEXT_SECONDARY, fontSize: 13, fontFamily: NUM_FONT },

  milestoneCard: {
    alignSelf: 'stretch', marginTop: 14,
    backgroundColor: CARD, borderRadius: 16,
    padding: 16, gap: 14,
  },
  milestoneHead: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.2, textAlign: 'center',
  },
  milestoneRow: { flexDirection: 'row', gap: 8 },
  milestoneChip: {
    flex: 1, alignItems: 'center', gap: 6,
    borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent',
    paddingVertical: 10,
  },
  milestoneChipNext: { borderColor: accentAlpha('77'), borderStyle: 'dashed' },
  milestoneDays: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700' },
  milestonePassed: { color: TEXT_SECONDARY, textDecorationLine: 'line-through' },
  milestoneNextText: { color: ACCENT },
})
