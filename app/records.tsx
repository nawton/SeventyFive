import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native'
import * as Haptics from 'expo-haptics'
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
import { LEVEL_TIERS, POINT_RULES, ONE_TIME_RULES, computePoints, levelFor, type PointSource, type OneTimeInput } from '@/lib/levels'
import { getProfile } from '@/services/profile'
import { getProgressPhotos } from '@/services/progressPhotos'
import { getWorkoutSessions } from '@/services/workoutSchedule'
import { getCustomRules } from '@/services/rules'
import type { MedalTier } from '@/components/MedalBadge'

const TIER_NAMES: Record<MedalTier, string> = {
  bronze: 'Brons', silver: 'Silver', gold: 'Guld', platinum: 'Platina', diamond: 'Diamant',
}

/** Innehåll för medalj-detaljmodalen — funkar för både medaljer och nivåer */
interface MedalInfo {
  tier: MedalTier
  icon?: React.ComponentProps<typeof import('@expo/vector-icons').Ionicons>['name']
  label?: string
  imageId?: string
  title: string
  subtitle: string
  description: string
  unlocked: boolean
  progress?: string
}
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

const GOLD = '#FFD54F'

export default function RecordsScreen() {
  const [loading, setLoading]           = useState(true)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [records, setRecords]           = useState<ExerciseRecord[]>([])
  const [points, setPoints]             = useState(0)
  const [pointSources, setPointSources] = useState<PointSource[]>([])
  const [oneTime, setOneTime]           = useState<OneTimeInput>({
    hasAvatar: false, hasProgressPhoto: false, hasSchedule: false, hasCustomRule: false,
  })
  const [selectedMedal, setSelectedMedal] = useState<MedalInfo | null>(null)

  function openMedal(info: MedalInfo) {
    Haptics.selectionAsync()
    setSelectedMedal(info)
  }

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        const uid = session.user.id

        const [challenge, cardio, strength, sessionHistory, prs, profile, photos, allSessions] = await Promise.all([
          getActiveChallenge(uid).catch(() => null),
          getCardioWorkouts(uid, 500).catch(() => []),
          getStrengthWorkouts(uid).catch(() => []),
          getCompletedSessionsHistory(uid).catch(() => []),
          getPersonalRecords(uid).catch(() => [] as ExerciseRecord[]),
          getProfile(uid).catch(() => null),
          getProgressPhotos(uid).catch(() => []),
          getWorkoutSessions(uid).catch(() => []),
        ])
        const customRules = challenge
          ? await getCustomRules(uid, challenge.id).catch(() => [])
          : []
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
        const oneTimeInput: OneTimeInput = {
          hasAvatar: !!profile?.avatar_url,
          hasProgressPhoto: photos.length > 0,
          hasSchedule: allSessions.some(sess => sess.weekdays.length > 0),
          hasCustomRule: customRules.length > 0,
        }
        setOneTime(oneTimeInput)
        const result = computePoints({
          completedDays,
          sessionDates: sessionHistory.map(c => c.completedDate),
          cardioDates: cardio.map(w => w.created_at.slice(0, 10)),
          strengthDates: strength.map(w => w.data.workout_date ?? w.created_at.slice(0, 10)),
          prDates: prs.map(r => r.date),
          medalsUnlocked: medals.filter(m => m.unlocked).length,
        }, oneTimeInput)
        setPoints(result.total)
        setPointSources(result.sources)
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
              <TouchableOpacity
                key={t.id}
                style={[s.tierItem, !reached && { opacity: 0.45 }]}
                activeOpacity={0.75}
                onPress={() => openMedal({
                  tier: t.tier,
                  label: '75',
                  title: t.name,
                  subtitle: `Nivå · ${t.threshold.toLocaleString('sv-SE')} p`,
                  description: reached
                    ? 'Du har nått den här nivån. Fortsätt samla poäng genom dina dagliga aktiviteter.'
                    : `Samla ${(t.threshold - points).toLocaleString('sv-SE')} p till för att nå ${t.name}.`,
                  unlocked: reached,
                  progress: reached ? undefined : `${points.toLocaleString('sv-SE')}/${t.threshold.toLocaleString('sv-SE')} p`,
                })}
              >
                <MedalBadge tier={t.tier} label="75" unlocked={reached} size={56} />
                <Text style={[s.tierName, reached && { color: TEXT_PRIMARY }]}>{t.name}</Text>
                <Text style={s.tierPts}>{t.threshold.toLocaleString('sv-SE')} p</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {/* Dina poäng — varifrån de kommer */}
        {pointSources.length > 0 && (
          <>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>DINA POÄNG</Text>
              <Text style={s.sectionCount}>{points.toLocaleString('sv-SE')} p</Text>
            </View>
            <View style={s.recordCard}>
              {pointSources.map((src, i) => (
                <View key={src.label} style={[s.recordRow, i < pointSources.length - 1 && s.recordBorder]}>
                  <View style={s.ruleIcon}>
                    <Ionicons name={src.icon} size={16} color={ORANGE} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.ruleLabel}>{src.label}</Text>
                    <Text style={s.ruleCap}>{src.detail}</Text>
                  </View>
                  <Text style={s.rulePts}>+{src.pts.toLocaleString('sv-SE')} p</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Engångsmål */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>ENGÅNGSMÅL</Text>
          <Text style={s.sectionCount}>
            {ONE_TIME_RULES.filter(r => oneTime[r.id]).length}/{ONE_TIME_RULES.length}
          </Text>
        </View>
        <View style={s.recordCard}>
          {ONE_TIME_RULES.map((rule, i) => {
            const earned = oneTime[rule.id]
            return (
              <View key={rule.id} style={[s.recordRow, i < ONE_TIME_RULES.length - 1 && s.recordBorder, !earned && { opacity: 0.55 }]}>
                <View style={s.ruleIcon}>
                  <Ionicons name={rule.icon} size={16} color={earned ? '#4CAF50' : ORANGE} />
                </View>
                <Text style={[s.ruleLabel, { flex: 1 }]}>{rule.label}</Text>
                <Text style={s.rulePts}>{rule.pts} p</Text>
                <Ionicons
                  name={earned ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={earned ? '#4CAF50' : 'rgba(255,255,255,0.2)'}
                />
              </View>
            )
          })}
        </View>

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
              <View style={{ flex: 1 }}>
                <Text style={s.ruleLabel}>{rule.label}</Text>
                <Text style={s.ruleCap}>{rule.cap}</Text>
              </View>
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
            <TouchableOpacity
              key={a.id}
              style={[s.medal, !a.unlocked && s.medalLocked]}
              activeOpacity={0.75}
              onPress={() => openMedal({
                tier: a.tier,
                icon: a.icon,
                imageId: a.id,
                title: a.title,
                subtitle: `${TIER_NAMES[a.tier]}-medalj`,
                description: a.description,
                unlocked: a.unlocked,
                progress: a.progress,
              })}
            >
              <MedalBadge tier={a.tier} icon={a.icon} unlocked={a.unlocked} size={56} imageSource={MEDAL_IMAGES[a.id]} />
              <Text style={[s.medalTitle, !a.unlocked && { color: TEXT_SECONDARY }]} numberOfLines={1}>
                {a.title}
              </Text>
              <Text style={s.medalDesc} numberOfLines={2}>
                {a.unlocked ? a.description : (a.progress ?? a.description)}
              </Text>
            </TouchableOpacity>
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

      {/* ── Medaljinfo-modal ── */}
      <Modal
        visible={!!selectedMedal}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMedal(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setSelectedMedal(null)}>
          {selectedMedal && (
            <Pressable style={s.modalCard} onPress={() => {}}>
              <MedalBadge
                tier={selectedMedal.tier}
                icon={selectedMedal.icon}
                label={selectedMedal.label}
                unlocked={selectedMedal.unlocked}
                size={130}
                imageSource={selectedMedal.imageId ? MEDAL_IMAGES[selectedMedal.imageId] : undefined}
              />
              <Text style={s.modalTitle}>{selectedMedal.title}</Text>
              <Text style={s.modalSubtitle}>{selectedMedal.subtitle}</Text>

              <View style={[s.statusPill, selectedMedal.unlocked ? s.statusPillUnlocked : s.statusPillLocked]}>
                <Ionicons
                  name={selectedMedal.unlocked ? 'checkmark-circle' : 'lock-closed'}
                  size={13}
                  color={selectedMedal.unlocked ? '#4CAF50' : TEXT_SECONDARY}
                />
                <Text style={[s.statusPillText, selectedMedal.unlocked && { color: '#4CAF50' }]}>
                  {selectedMedal.unlocked ? 'Upplåst' : selectedMedal.progress ?? 'Låst'}
                </Text>
              </View>

              <Text style={s.modalDesc}>{selectedMedal.description}</Text>

              <TouchableOpacity style={s.modalClose} onPress={() => setSelectedMedal(null)} activeOpacity={0.85}>
                <Text style={s.modalCloseText}>Stäng</Text>
              </TouchableOpacity>
            </Pressable>
          )}
        </Pressable>
      </Modal>
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
  ruleLabel: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '500' },
  ruleCap:   { color: TEXT_SECONDARY, fontSize: 11, marginTop: 1 },
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

  // Medaljinfo-modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  modalCard: {
    width: '100%', maxWidth: 340,
    backgroundColor: CARD, borderRadius: 24,
    borderWidth: 1, borderColor: BORDER,
    padding: 28, alignItems: 'center', gap: 8,
  },
  modalTitle:    { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', marginTop: 8, textAlign: 'center' },
  modalSubtitle: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    marginTop: 6,
  },
  statusPillUnlocked: { backgroundColor: '#4CAF5018' },
  statusPillLocked:   { backgroundColor: 'rgba(255,255,255,0.06)' },
  statusPillText:     { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '700' },
  modalDesc: {
    color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center',
    lineHeight: 20, marginTop: 6,
  },
  modalClose: {
    backgroundColor: ORANGE, borderRadius: 14,
    paddingVertical: 13, paddingHorizontal: 40, marginTop: 14,
  },
  modalCloseText: { color: '#000', fontSize: 15, fontWeight: '700' },
})
