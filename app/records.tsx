import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { getActiveChallenge } from '@/services/challenge'
import { countCompletedDays, getStreak } from '@/services/dailyLog'
import { getCardioWorkouts, getStrengthWorkouts } from '@/services/workouts'
import { getCompletedSessionsHistory } from '@/services/workoutSchedule'
import { getPersonalRecords, type ExerciseRecord } from '@/services/personalRecords'
import { computeAchievements, type Achievement } from '@/lib/achievements'
import { MedalBadge } from '@/components/MedalBadge'
import { MEDAL_IMAGES } from '@/lib/medalImages'
import { LEVEL_TIERS, POINT_RULES, computePoints, levelFor } from '@/lib/levels'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

const GOLD = '#FFD54F'

export default function RecordsScreen() {
  const [loading, setLoading]           = useState(true)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [records, setRecords]           = useState<ExerciseRecord[]>([])
  const [points, setPoints]             = useState(0)

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        const uid = session.user.id

        const [challenge, cardio, strength, sessionHistory, prs] = await Promise.all([
          getActiveChallenge(uid).catch(() => null),
          getCardioWorkouts(uid, 500).catch(() => []),
          getStrengthWorkouts(uid).catch(() => []),
          getCompletedSessionsHistory(uid).catch(() => []),
          getPersonalRecords(uid).catch(() => [] as ExerciseRecord[]),
        ])
        const [completedDays, streak] = challenge
          ? await Promise.all([
              countCompletedDays(challenge.id).catch(() => 0),
              getStreak(challenge.id).catch(() => 0),
            ])
          : [0, 0]

        setRecords(prs)
        const medals = computeAchievements({
          completedDays,
          streak,
          totalWorkouts: strength.length + cardio.length + sessionHistory.length,
          totalCardio: cardio.length,
          totalKm: cardio.reduce((sum, w) => sum + w.data.distance_km, 0),
          prCount: prs.length,
        })
        setAchievements(medals)
        setPoints(computePoints({
          completedDays,
          sessionCount: sessionHistory.length,
          cardioCount: cardio.length,
          strengthCount: strength.length,
          prCount: prs.length,
          medalsUnlocked: medals.filter(m => m.unlocked).length,
        }))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const unlockedCount = achievements.filter(a => a.unlocked).length
  const level = levelFor(points)

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.title}>Rekord & medaljer</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Min nivå ── */}
        <View style={s.levelHero}>
          <MedalBadge tier={level.current.tier} label="75" unlocked size={120} />
          <Text style={s.levelName}>{level.current.name}</Text>
        </View>

        <View style={s.levelProgressTrack}>
          <View style={[s.levelProgressFill, { width: `${Math.round(level.progress * 100)}%` as any }]} />
        </View>
        <View style={s.levelPtsRow}>
          <Text style={s.levelPtsBig}>
            {level.next
              ? `${(level.next.threshold - points).toLocaleString('sv-SE')} p till ${level.next.name}`
              : 'Högsta nivån nådd!'}
          </Text>
          <Text style={s.levelPtsTotal}>Totalt: {points.toLocaleString('sv-SE')} p</Text>
        </View>

        {/* Tier-rad */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tierRow}>
          {LEVEL_TIERS.map(t => {
            const reached = points >= t.threshold
            return (
              <View key={t.id} style={[s.tierItem, !reached && { opacity: 0.45 }]}>
                <MedalBadge tier={t.tier} label="75" unlocked={reached} size={56} />
                <Text style={[s.tierName, reached && { color: TEXT_PRIMARY }]}>{t.name}</Text>
                <Text style={s.tierPts}>{t.threshold.toLocaleString('sv-SE')} p</Text>
              </View>
            )
          })}
        </ScrollView>

        {/* Så tjänar du poäng */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>SÅ TJÄNAR DU POÄNG</Text>
        </View>
        <View style={s.recordCard}>
          {POINT_RULES.map((rule, i) => (
            <View key={rule.label} style={[s.recordRow, i < POINT_RULES.length - 1 && s.recordBorder]}>
              <View style={s.ruleIcon}>
                <Ionicons name={rule.icon} size={16} color={ORANGE} />
              </View>
              <Text style={s.ruleLabel}>{rule.label}</Text>
              <Text style={s.rulePts}>{rule.pts} p</Text>
            </View>
          ))}
        </View>

        {/* ── Medaljer ── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>MEDALJER</Text>
          <Text style={s.sectionCount}>{unlockedCount}/{achievements.length}</Text>
        </View>
        <View style={s.medalGrid}>
          {achievements.map(a => (
            <View key={a.id} style={[s.medal, !a.unlocked && s.medalLocked]}>
              <MedalBadge tier={a.tier} icon={a.icon} unlocked={a.unlocked} size={56} imageSource={MEDAL_IMAGES[a.id]} />
              <Text style={[s.medalTitle, !a.unlocked && { color: TEXT_SECONDARY }]} numberOfLines={1}>
                {a.title}
              </Text>
              <Text style={s.medalDesc} numberOfLines={2}>
                {a.unlocked ? a.description : (a.progress ?? a.description)}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Personliga rekord ── */}
        <View style={[s.sectionRow, { marginTop: 8 }]}>
          <Text style={s.sectionTitle}>PERSONLIGA REKORD</Text>
          {records.length > 0 && <Text style={s.sectionCount}>{records.length}</Text>}
        </View>

        {records.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="trophy-outline" size={36} color="rgba(255,255,255,0.12)" />
            <Text style={s.emptyText}>
              Logga vikt på dina styrkeövningar så dyker rekorden upp här.
            </Text>
          </View>
        ) : (
          <View style={s.recordCard}>
            {records.map((r, i) => (
              <View key={r.exerciseName} style={[s.recordRow, i < records.length - 1 && s.recordBorder]}>
                <View style={s.recordIcon}>
                  <Ionicons name="trophy" size={16} color={GOLD} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.recordName} numberOfLines={1}>{r.exerciseName}</Text>
                  <Text style={s.recordMeta}>
                    {r.bestWeightKg} kg × {r.bestWeightReps} · est. 1RM {Math.round(r.bestE1rm)} kg
                  </Text>
                </View>
                <Text style={s.recordDate}>
                  {new Date(r.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  scroll: { padding: 20, paddingBottom: 48, gap: 12 },

  // Min nivå
  levelHero: { alignItems: 'center', gap: 12, paddingTop: 12, paddingBottom: 4 },
  levelName: { color: TEXT_PRIMARY, fontSize: 26, fontWeight: '800' },
  levelProgressTrack: {
    height: 8, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4, overflow: 'hidden',
  },
  levelProgressFill: { height: '100%', backgroundColor: GOLD, borderRadius: 4 },
  levelPtsRow:   { alignItems: 'flex-end', gap: 2 },
  levelPtsBig:   { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  levelPtsTotal: { color: TEXT_SECONDARY, fontSize: 13 },
  tierRow:  { gap: 14, paddingVertical: 8 },
  tierItem: { alignItems: 'center', gap: 4, width: 72 },
  tierName: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '700' },
  tierPts:  { color: TEXT_SECONDARY, fontSize: 11 },

  // Poängregler
  ruleIcon: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: ORANGE + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  ruleLabel: { flex: 1, color: TEXT_PRIMARY, fontSize: 14, fontWeight: '500' },
  rulePts:   { color: ORANGE, fontSize: 14, fontWeight: '700' },

  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  sectionCount: { color: ORANGE, fontSize: 12, fontWeight: '700' },

  medalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  medal: {
    width: '31%', flexGrow: 1,
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    padding: 12, alignItems: 'center', gap: 6,
  },
  // Låst-känslan bärs av den mörka metallen i badgen — lätt dimning räcker
  medalLocked: { opacity: 0.75 },
  medalTitle: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  medalDesc:  { color: TEXT_SECONDARY, fontSize: 10, textAlign: 'center', lineHeight: 13 },

  empty:     { alignItems: 'center', paddingVertical: 28, gap: 10, paddingHorizontal: 24 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', lineHeight: 19 },

  recordCard: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    overflow: 'hidden',
  },
  recordRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  recordBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  recordIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: GOLD + '1E',
    alignItems: 'center', justifyContent: 'center',
  },
  recordName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  recordMeta: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  recordDate: { color: TEXT_SECONDARY, fontSize: 11 },
})
