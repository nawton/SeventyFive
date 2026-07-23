import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import Svg, {
  Path, Circle, Defs, LinearGradient as SvgLinearGradient, RadialGradient, Stop,
} from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { getActiveChallenge } from '@/services/challenge'
import { getStreak, getWeekStatuses } from '@/services/dailyLog'
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

/** Glödande låga — radiell glöd, ring, ytter- och innerlåga plus gnistor */
function Flame({ size = 230 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="52%" r="50%">
          <Stop offset="0%" stopColor={ACCENT} stopOpacity={0.32} />
          <Stop offset="55%" stopColor={ACCENT} stopOpacity={0.12} />
          <Stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
        </RadialGradient>
        <SvgLinearGradient id="outer" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFC24D" />
          <Stop offset="60%" stopColor="#FF9E1B" />
          <Stop offset="100%" stopColor="#F57200" />
        </SvgLinearGradient>
        <SvgLinearGradient id="inner" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFF3C4" />
          <Stop offset="100%" stopColor="#FFC93C" />
        </SvgLinearGradient>
      </Defs>

      {/* Glöd + tunn ring som i förlagan */}
      <Circle cx={50} cy={52} r={48} fill="url(#glow)" />
      <Circle cx={50} cy={52} r={38} fill="none" stroke={ACCENT} strokeOpacity={0.28} strokeWidth={1.4} />

      {/* Ytterlågan — droppform med vek topp */}
      <Path
        d="M50 22
           C 52 32, 63 36, 66 46
           C 68 53, 67 59, 63 64
           C 64 56, 60 52, 57 50
           C 59 58, 55 62, 52 66
           C 49 62, 44 58, 46 50
           C 41 54, 38 60, 40 66
           C 34 61, 32 53, 34 46
           C 37 36, 47 32, 50 22 Z"
        fill="url(#outer)"
      />
      {/* Innerlågan */}
      <Path
        d="M50 48
           C 52 54, 58 56, 57 63
           C 56 69, 52 72, 50 73
           C 48 72, 44 69, 43 63
           C 42 56, 48 54, 50 48 Z"
        fill="url(#inner)"
      />

      {/* Gnistor */}
      <Circle cx={31} cy={30} r={1.4} fill="#FFD37A" />
      <Circle cx={70} cy={26} r={1.1} fill="#FFD37A" />
      <Circle cx={76} cy={40} r={0.9} fill="#FFB84D" />
      <Circle cx={26} cy={46} r={0.9} fill="#FFB84D" />
      <Path d="M64 18 l1.1 2.4 2.4 1.1 -2.4 1.1 -1.1 2.4 -1.1 -2.4 -2.4 -1.1 2.4 -1.1 Z" fill="#FFE49A" />
    </Svg>
  )
}

export default function StreakScreen() {
  const T = useThemeStrings()
  const chrome = useCardChrome()
  const dotEdge = T.TEXT_PRIMARY === '#FFFFFF' ? THEME_DARK.BORDER : 'rgba(0,0,0,0.30)'
  const [streak, setStreak] = useState(0)
  const [weekStatuses, setWeekStatuses] = useState<Record<string, string>>({})

  useFocusEffect(useCallback(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user || !alive) return
      const challenge = await getActiveChallenge(session.user.id).catch(() => null)
      if (!challenge || !alive) return
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
              <View key={d.key} style={s.weekSlot}>
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
              </View>
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
    </SafeScreen>
  )
}

const s = StyleSheet.create({
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
