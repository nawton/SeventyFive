import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native'
import * as Haptics from 'expo-haptics'

const SCREEN_W  = Dimensions.get('window').width
const PAGE_W    = SCREEN_W - 68  // smalare än skärmen så nästa kort sticker fram
const PAGE_GAP  = 14             // mellanrum mellan korten i pagern
const SNAP_W    = PAGE_W + PAGE_GAP
const MAX_THRESHOLD = 7500       // Diamant — sliderns högra ände
import { SafeScreen } from '@/components/SafeScreen'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { getActiveChallenge } from '@/services/challenge'
import { countCompletedDays, getStreak } from '@/services/dailyLog'
import Svg, { Polyline, Circle as SvgCircle, Line as SvgLine } from 'react-native-svg'
import { getCardioWorkouts, getStrengthWorkouts, type StrengthWorkout, type CardioWorkout } from '@/services/workouts'
import { CardioSummaryView } from '@/components/CardioSummaryView'
import { getCompletedSessionsHistory } from '@/services/workoutSchedule'
import { getPersonalRecords, epley1RM, type ExerciseRecord } from '@/services/personalRecords'
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

// ── Övningshistorik ──────────────────────────────────────────────────────────

type HistPoint = { date: string; topKg: number; topReps: number; e1rm: number; sets: number }

/** Bästa set per dag för en övning, kronologiskt — underlag för utvecklingsgrafen */
function buildHistory(workouts: StrengthWorkout[], name: string): HistPoint[] {
  const byDate = new Map<string, HistPoint>()
  for (const w of workouts) {
    if (w.data.exercise_name !== name) continue
    const date = w.data.workout_date ?? w.created_at.slice(0, 10)
    let topKg = 0, topReps = 0, best = 0, sets = 0
    for (const st of w.data.sets) {
      sets++
      const e = epley1RM(st.weight_kg, st.reps)
      if (e > best) best = e
      if (st.weight_kg > topKg) { topKg = st.weight_kg; topReps = st.reps }
    }
    if (best <= 0) continue
    const prev = byDate.get(date)
    if (!prev || best > prev.e1rm) {
      byDate.set(date, { date, topKg, topReps, e1rm: best, sets: (prev?.sets ?? 0) + sets })
    } else {
      prev.sets += sets
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** Vart varje engångsmål tar dig — action-parametern får sidan att scrolla
    till rätt sektion och öppna själva flödet, så användaren lär sig var det bor */
const ONE_TIME_ROUTES: Record<string, string> = {
  hasAvatar:        '/(app)/edit-profile?action=avatar',
  hasProgressPhoto: '/(app)/profile?action=addPhoto',
  hasSchedule:      '/(app)/add?action=wizard',
  hasCustomRule:    '/(app)/dashboard?action=addRule',
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
import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, NUM_FONT_SEMI, CARDIO_BLUE, DIVIDER, ACCENT, accentAlpha, useThemeStrings } from '@/lib/theme'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { runOnJS, useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { getUnitSystem, toDisplayDistance, distanceUnitLabel, paceForUnit, type UnitSystem } from '@/lib/units'
import { toLocalDateString, startOfWeek } from '@/lib/date'
import { GlassCircleButton } from '@/components/GlassButton'
import { useStatsColors } from '@/components/stats/statsShared'

const GOLD = '#FFD54F'

type CardioRecs = {
  longestKm: number
  longestId: string | null
  bestPaceSec: number
  bestPaceId: string | null
  fastestSplitSec: number
  fastestSplitId: string | null
  biggestWeekKm: number
  biggestWeekBestId: string | null
}

function fmtPaceStr(secs: number): string {
  if (!Number.isFinite(secs) || secs <= 0) return '--:--'
  return `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`
}

export default function RecordsScreen() {
  const P = useStatsColors()
  const T = useThemeStrings()
  const [loading, setLoading]           = useState(true)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [records, setRecords]           = useState<ExerciseRecord[]>([])
  const [points, setPoints]             = useState(0)
  const [pointSources, setPointSources] = useState<PointSource[]>([])
  const [oneTime, setOneTime]           = useState<OneTimeInput>({
    hasAvatar: false, hasProgressPhoto: false, hasSchedule: false, hasCustomRule: false,
  })
  const [selectedMedal, setSelectedMedal] = useState<MedalInfo | null>(null)
  const [cardioRecs, setCardioRecs]     = useState<CardioRecs | null>(null)
  const [unit, setUnit]                 = useState<UnitSystem>('metric')
  const [avatarUrl, setAvatarUrl]       = useState<string | null>(null)
  const [selectedCardio, setSelectedCardio] = useState<CardioWorkout | null>(null)
  const cardioListRef = useRef<CardioWorkout[]>([])

  function openCardioRecord(id: string | null) {
    if (!id) return
    const w = cardioListRef.current.find(x => x.id === id)
    if (w) { Haptics.selectionAsync(); setSelectedCardio(w) }
  }
  const [breakdownVisible, setBreakdownVisible] = useState(false)
  // Övningshistorik — öppnas från rekordraderna
  const [historyEx, setHistoryEx]   = useState<string | null>(null)
  const [historyPts, setHistoryPts] = useState<HistPoint[]>([])
  const allWorkoutsRef = useRef<StrengthWorkout[] | null>(null)

  async function openHistory(name: string) {
    Haptics.selectionAsync()
    setHistoryPts([])
    setHistoryEx(name)
    if (!allWorkoutsRef.current) {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      allWorkoutsRef.current = await getStrengthWorkouts(session.user.id, 200).catch(() => [])
    }
    setHistoryPts(buildHistory(allWorkoutsRef.current ?? [], name))
  }
  const [mainTab, setMainTab] = useState<0 | 1>(0)
  const mainTabRef = useRef<0 | 1>(0)
  useEffect(() => { mainTabRef.current = mainTab }, [mainTab])
  const mainPos = useSharedValue(0)
  const mainDragging = useRef(false)
  const [tabW, setTabW] = useState(0)
  useEffect(() => {
    if (!mainDragging.current) mainPos.value = withTiming(mainTab, { duration: 160, easing: Easing.out(Easing.quad) })
  }, [mainTab])
  const mainIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: mainPos.value * (PAGE_W / 2) }],
  }))

  function beginMainDrag() { mainDragging.current = true }
  function commitMain(i: 0 | 1) {
    mainDragging.current = false
    mainPos.value = withTiming(i, { duration: 160, easing: Easing.out(Easing.quad) })
    if (i !== mainTabRef.current) {
      Haptics.selectionAsync()
      setMainTab(i)
    }
  }
  function abortMainDrag() {
    if (!mainDragging.current) return
    mainDragging.current = false
    mainPos.value = withTiming(mainTabRef.current, { duration: 160, easing: Easing.out(Easing.quad) })
  }

  // Dra på flikraden: indikatorn följer fingret, släpp väljer närmaste flik
  const tabPan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-14, 14])
    .onStart(e => {
      if (tabW <= 0) return
      runOnJS(beginMainDrag)()
      mainPos.value = Math.min(1, Math.max(0, e.x / (tabW / 2) - 0.5))
    })
    .onUpdate(e => {
      if (tabW <= 0) return
      mainPos.value = Math.min(1, Math.max(0, e.x / (tabW / 2) - 0.5))
    })
    .onEnd(e => {
      if (tabW <= 0) return
      runOnJS(commitMain)(Math.round(Math.min(1, Math.max(0, e.x / (tabW / 2) - 0.5))) as 0 | 1)
    })
    .onFinalize(() => { runOnJS(abortMainDrag)() })

  const earnPagerRef = useRef<ScrollView>(null)

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
        getUnitSystem().then(setUnit)

        // Cardiorekord (all-time) från de hämtade passen — id:n sparas så
        // raderna kan öppna just det passet
        cardioListRef.current = cardio
        let longestKm = 0, longestId: string | null = null
        let bestPaceSec = Infinity, bestPaceId: string | null = null
        let fastestSplitSec = Infinity, fastestSplitId: string | null = null
        let bestPace3kSec = Infinity
        let biggestWeekKm = 0, biggestWeekKey = ''
        if (cardio.length > 0) {
          const byWeek = new Map<string, number>()
          for (const w of cardio) {
            if (w.data.distance_km > longestKm) { longestKm = w.data.distance_km; longestId = w.id }
            if (w.data.distance_km > 0.1) {
              const pace = w.data.duration_seconds / w.data.distance_km
              if (pace > 0 && pace < bestPaceSec) { bestPaceSec = pace; bestPaceId = w.id }
              if (w.data.distance_km >= 3 && pace > 0 && pace < bestPace3kSec) bestPace3kSec = pace
            }
            for (const sp of w.data.splits ?? []) {
              if (/^\d+\s*(km|mi)$/.test(sp.label) && sp.paceSec > 0 && sp.paceSec < fastestSplitSec) {
                fastestSplitSec = sp.paceSec
                fastestSplitId = w.id
              }
            }
            const key = toLocalDateString(startOfWeek(new Date(w.created_at)))
            byWeek.set(key, (byWeek.get(key) ?? 0) + w.data.distance_km)
          }
          byWeek.forEach((v, k) => { if (v > biggestWeekKm) { biggestWeekKm = v; biggestWeekKey = k } })
          // Längsta vecka pekar på veckans längsta pass
          let biggestWeekBestId: string | null = null
          let bestInWeek = 0
          for (const w of cardio) {
            if (toLocalDateString(startOfWeek(new Date(w.created_at))) !== biggestWeekKey) continue
            if (w.data.distance_km > bestInWeek) { bestInWeek = w.data.distance_km; biggestWeekBestId = w.id }
          }
          setCardioRecs({ longestKm, longestId, bestPaceSec, bestPaceId, fastestSplitSec, fastestSplitId, biggestWeekKm, biggestWeekBestId })
        }
        const medals = computeAchievements({
          completedDays,
          streak,
          totalWorkouts: strength.length + cardio.length + sessionHistory.length,
          totalCardio: cardio.length,
          totalKm: cardio.reduce((sum, w) => sum + w.data.distance_km, 0),
          prCount: prs.length,
          longestRunKm: longestKm,
          bestPace3kSec,
          biggestWeekKm,
        })
        setAchievements(medals)
        setAvatarUrl(profile?.avatar_url ?? null)
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
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    )
  }

  return (
    <SafeScreen style={s.screen}>
      <View style={s.header}>
        <GlassCircleButton
          icon="chevron-back" size={40} iconColor={TEXT_PRIMARY}
          onPress={() => router.back()} fallbackStyle={s.iconBtn}
        />
        <Text style={s.title}>Rekord & medaljer</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Min nivå ── */}
        <View style={s.levelHero}>
          <MedalBadge tier={level.current.tier} label="75" unlocked size={120} />
          <Text style={s.levelName}>{level.current.name}</Text>
        </View>

        {/* Kompakt nivå-slider: progress mot Diamant med tier-markörer längs banan */}
        <View style={s.tierSlider}>
          <View style={s.tierTrack}>
            <LinearGradient
              colors={[ACCENT, '#FFE60A']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[s.tierFill, { width: `${Math.min(100, (points / MAX_THRESHOLD) * 100)}%` as any }]}
            />
          </View>
          {LEVEL_TIERS.map(t => {
            const pct     = (t.threshold / MAX_THRESHOLD) * 100
            const reached = points >= t.threshold
            return (
              <TouchableOpacity
                key={t.id}
                style={[s.tierMarker, { left: `${pct}%` as any }]}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
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
                <MedalBadge tier={t.tier} label="" unlocked={reached} size={24} />
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={s.levelPtsRow}>
          <Text style={s.levelPtsBig}>
            {level.next
              ? `${(level.next.threshold - points).toLocaleString('sv-SE')} p till ${level.next.name}`
              : 'Högsta nivån nådd!'}
          </Text>
          <TouchableOpacity
            style={s.historyBtn}
            onPress={() => setBreakdownVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={14} color={ACCENT} />
            <Text style={s.historyBtnText}>Poänghistorik</Text>
          </TouchableOpacity>
        </View>

        {/* Huvudflikar: tap, dra på raden eller svep var som helst på sidan */}
        <GestureDetector gesture={tabPan}>
          <View onLayout={e => setTabW(e.nativeEvent.layout.width)}>
            <View style={[s.earnTabsRow, { marginTop: 10 }]}>
              {(['Medaljer', 'Rekord'] as const).map((label, i) => (
                <TouchableOpacity
                  key={label}
                  style={s.earnTabBtn}
                  onPress={() => commitMain(i as 0 | 1)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.mainTabText, mainTab === i && s.earnTabTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.earnTrack}>
              <Animated.View style={[s.earnIndicator, { backgroundColor: T.ACCENT }, mainIndicatorStyle]} />
            </View>
          </View>
        </GestureDetector>

        {mainTab === 0 && (<>
        {/* Tjäna poäng — titlarna sitter i korten, nästa kort sticker fram */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>TJÄNA POÄNG</Text>
        </View>
        <ScrollView
          ref={earnPagerRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -20 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: PAGE_GAP }}
          snapToInterval={SNAP_W}
          snapToAlignment="start"
          decelerationRate="fast"
        >
          {/* Sida 1: återkommande */}
          <View style={[s.recordCard, { width: PAGE_W }]}>
            <View style={s.earnCardHead}>
              <View style={[s.ruleIcon, { backgroundColor: accentAlpha('1A') }]}>
                <Ionicons name="repeat" size={16} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.earnCardTitle}>Återkommande</Text>
                <Text style={s.earnCardSub}>Poäng du kan tjäna varje dag</Text>
              </View>
            </View>
            {POINT_RULES.map((rule, i) => (
              <View key={rule.label} style={[s.recordRow, i < POINT_RULES.length - 1 && s.recordBorder]}>
                <View style={s.ruleIcon}>
                  <Ionicons name={rule.icon} size={16} color={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.ruleLabel}>{rule.label}</Text>
                  <Text style={s.ruleCap}>{rule.cap}</Text>
                </View>
                <Text style={s.rulePts}>{rule.pts} p</Text>
              </View>
            ))}
          </View>

          {/* Sida 2: engångsmål */}
          <View style={[s.recordCard, { width: PAGE_W }]}>
            <View style={s.earnCardHead}>
              <View style={[s.ruleIcon, { backgroundColor: '#3BE8621A' }]}>
                <Ionicons name="checkmark-done" size={16} color="#3BE862" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.earnCardTitle}>Engångsmål</Text>
                <Text style={s.earnCardSub}>{ONE_TIME_RULES.filter(r => oneTime[r.id]).length} av {ONE_TIME_RULES.length} avklarade</Text>
              </View>
            </View>
            {ONE_TIME_RULES.map((rule, i) => {
              const earned = oneTime[rule.id]
              return (
                <TouchableOpacity
                  key={rule.id}
                  style={[s.recordRow, i < ONE_TIME_RULES.length - 1 && s.recordBorder, earned && { opacity: 0.55 }]}
                  activeOpacity={earned ? 1 : 0.7}
                  disabled={earned}
                  onPress={() => {
                    const route = ONE_TIME_ROUTES[rule.id]
                    if (route) router.push(route as never)
                  }}
                >
                  <View style={s.ruleIcon}>
                    <Ionicons name={rule.icon} size={16} color={earned ? '#3BE862' : ACCENT} />
                  </View>
                  <Text style={[s.ruleLabel, { flex: 1 }]}>{rule.label}</Text>
                  <Text style={s.rulePts}>{rule.pts} p</Text>
                  {earned ? (
                    <Ionicons name="checkmark-circle" size={18} color="#3BE862" />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        </ScrollView>

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

        </>)}

        {mainTab === 1 && (<>
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
              <TouchableOpacity
                key={r.exerciseName}
                style={[s.recordRow, i < records.length - 1 && s.recordBorder]}
                onPress={() => openHistory(r.exerciseName)}
                activeOpacity={0.7}
              >
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
                <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Cardiorekord ── */}
        {cardioRecs && (
          <>
            <View style={[s.sectionRow, { marginTop: 8 }]}>
              <Text style={s.sectionTitle}>CARDIOREKORD</Text>
            </View>
            <View style={s.recordCard}>
              {([
                {
                  icon: 'map-outline' as const, color: CARDIO_BLUE, label: 'Längsta pass',
                  id: cardioRecs.longestId,
                  value: cardioRecs.longestKm > 0
                    ? `${toDisplayDistance(cardioRecs.longestKm, unit).toFixed(2).replace('.', ',')} ${distanceUnitLabel(unit)}`
                    : '0',
                },
                {
                  icon: 'flash-outline' as const, color: P.LIME, label: 'Snabbaste km',
                  id: cardioRecs.fastestSplitId ?? cardioRecs.bestPaceId,
                  value: cardioRecs.fastestSplitSec !== Infinity
                    ? fmtPaceStr(cardioRecs.fastestSplitSec)
                    : cardioRecs.bestPaceSec !== Infinity
                      ? fmtPaceStr(cardioRecs.bestPaceSec)
                      : '--:--',
                },
                {
                  icon: 'stopwatch-outline' as const, color: T.ACCENT, label: 'Bästa tempo',
                  id: cardioRecs.bestPaceId,
                  value: cardioRecs.bestPaceSec === Infinity
                    ? '--:--'
                    : `${fmtPaceStr(paceForUnit(cardioRecs.bestPaceSec, unit))} /${distanceUnitLabel(unit)}`,
                },
                {
                  icon: 'trending-up-outline' as const, color: GOLD, label: 'Längsta vecka',
                  id: cardioRecs.biggestWeekBestId,
                  value: cardioRecs.biggestWeekKm > 0
                    ? `${toDisplayDistance(cardioRecs.biggestWeekKm, unit).toFixed(1).replace('.', ',')} ${distanceUnitLabel(unit)}`
                    : '0',
                },
              ]).map((r, i, arr) => (
                <TouchableOpacity
                  key={r.label}
                  style={[s.recordRow, i < arr.length - 1 && s.recordBorder]}
                  onPress={() => openCardioRecord(r.id)}
                  disabled={!r.id}
                  activeOpacity={0.7}
                >
                  <View style={[s.ruleIcon, { backgroundColor: r.color + '1A' }]}>
                    <Ionicons name={r.icon} size={16} color={r.color} />
                  </View>
                  <Text style={[s.ruleLabel, { flex: 1 }]}>{r.label}</Text>
                  <Text style={s.cardioRecVal}>{r.value}</Text>
                  {r.id && <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.25)" />}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        </>)}

      </ScrollView>

      {/* ── Rekordpassets detaljvy ── */}
      <Modal visible={!!selectedCardio} animationType="slide" onRequestClose={() => setSelectedCardio(null)}>
        {selectedCardio && (
          <CardioSummaryView
            workout={selectedCardio}
            title={selectedCardio.name}
            dateLabel={new Date(selectedCardio.created_at).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
            avatarUrl={avatarUrl}
            unit={unit}
            onClose={() => setSelectedCardio(null)}
          />
        )}
      </Modal>

      {/* ── Övningshistorik — utveckling över tid ── */}
      <Modal
        visible={!!historyEx}
        transparent
        animationType="fade"
        onRequestClose={() => setHistoryEx(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setHistoryEx(null)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.histTitle} numberOfLines={1}>{historyEx}</Text>
            <Text style={s.histSub}>Utveckling · est. 1RM (kg)</Text>

            {historyPts.length >= 2 ? (() => {
              const CH_W = PAGE_W - 84
              const CH_H = 130
              const PADX = 8
              const PADY = 14
              const vals = historyPts.map(p => p.e1rm)
              const min  = Math.min(...vals)
              const max  = Math.max(...vals)
              const span = max - min || 1
              const px = (i: number) => PADX + (i / (historyPts.length - 1)) * (CH_W - PADX * 2)
              const py = (v: number) => PADY + (1 - (v - min) / span) * (CH_H - PADY * 2)
              const line = historyPts.map((p, i) => `${px(i)},${py(p.e1rm)}`).join(' ')
              return (
                <View style={s.histChartWrap}>
                  <View style={s.histAxis}>
                    <Text style={s.histAxisText}>{Math.round(max)}</Text>
                    <Text style={s.histAxisText}>{Math.round(min)}</Text>
                  </View>
                  <Svg width={CH_W} height={CH_H}>
                    <SvgLine x1={0} y1={py(max)} x2={CH_W} y2={py(max)} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
                    <SvgLine x1={0} y1={py(min)} x2={CH_W} y2={py(min)} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
                    <Polyline points={line} stroke={ACCENT} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                    {historyPts.map((p, i) => (
                      <SvgCircle key={i} cx={px(i)} cy={py(p.e1rm)} r={3.5} fill={ACCENT} />
                    ))}
                  </Svg>
                </View>
              )
            })() : (
              <Text style={s.histEmpty}>
                {historyPts.length === 0
                  ? 'Laddar…'
                  : 'Logga övningen fler gånger så ritas utvecklingen här.'}
              </Text>
            )}

            {/* Senaste passen */}
            {historyPts.slice(-6).reverse().map((p, i, arr) => (
              <View key={p.date} style={[s.histRow, i < arr.length - 1 && s.histRowBorder]}>
                <Text style={s.histDate}>
                  {new Date(p.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                </Text>
                <Text style={s.histSets}>{p.sets} set</Text>
                <Text style={s.histTop}>{p.topKg} kg × {p.topReps}</Text>
                <Text style={s.histE1rm}>1RM {Math.round(p.e1rm)}</Text>
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Poäng-breakdown ── */}
      <Modal
        visible={breakdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBreakdownVisible(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setBreakdownVisible(false)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalTitle}>Dina poäng</Text>
            <Text style={s.modalSubtitle}>Totalt {points.toLocaleString('sv-SE')} p</Text>

            <View style={{ alignSelf: 'stretch', marginTop: 10 }}>
              {pointSources.map((src, i) => (
                <View key={src.label} style={[s.recordRow, i < pointSources.length - 1 && s.recordBorder]}>
                  <View style={s.ruleIcon}>
                    <Ionicons name={src.icon} size={16} color={ACCENT} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.ruleLabel}>{src.label}</Text>
                    <Text style={s.ruleCap}>{src.detail}</Text>
                  </View>
                  <Text style={s.rulePts}>+{src.pts.toLocaleString('sv-SE')} p</Text>
                </View>
              ))}
              {pointSources.length === 0 && (
                <Text style={s.modalDesc}>Inga poäng ännu. Kom igång med dagens uppgifter!</Text>
              )}
            </View>

            <TouchableOpacity style={s.modalClose} onPress={() => setBreakdownVisible(false)} activeOpacity={0.85}>
              <Text style={s.modalCloseText}>Stäng</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

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
                  color={selectedMedal.unlocked ? '#3BE862' : TEXT_SECONDARY}
                />
                <Text style={[s.statusPillText, selectedMedal.unlocked && { color: '#3BE862' }]}>
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
    </SafeScreen>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
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
  // Kompakt tier-slider
  tierSlider: {
    height: 32, justifyContent: 'center',
    marginHorizontal: 12, marginTop: 4,
  },
  tierTrack: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3, overflow: 'hidden',
  },
  tierFill: { height: '100%', backgroundColor: GOLD, borderRadius: 3 },
  tierMarker: {
    position: 'absolute', top: 4, marginLeft: -12,
  },

  levelPtsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 2,
  },
  levelPtsBig: { color: TEXT_PRIMARY, fontSize: 15, fontFamily: NUM_FONT_SEMI, flexShrink: 1 },
  historyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: accentAlpha('16'), borderRadius: 18,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  historyBtnText: { color: ACCENT, fontSize: 12, fontWeight: '700' },

  // Tjäna poäng-flikar (Runna-stil: text + tunn glidande indikatorlinje)

  // Poängregler
  ruleIcon: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: accentAlpha('18'),
    alignItems: 'center', justifyContent: 'center',
  },
  ruleLabel: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '500' },
  ruleCap:   { color: TEXT_SECONDARY, fontSize: 11, marginTop: 1 },
  rulePts:   { color: ACCENT, fontSize: 14, fontFamily: NUM_FONT },

  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  sectionCount: { color: ACCENT, fontSize: 12, fontFamily: NUM_FONT },
  cardioRecVal: { color: TEXT_PRIMARY, fontSize: 15, fontFamily: NUM_FONT, fontVariant: ['tabular-nums'] },
  earnTabsRow: { flexDirection: 'row' },
  earnTabBtn:  { flex: 1, alignItems: 'center', paddingVertical: 8 },
  mainTabText:       { color: TEXT_SECONDARY, fontSize: 16, fontWeight: '700' },
  earnTabTextActive: { color: ACCENT, fontWeight: '700' },
  // Samma padding som raderna (kortet självt är opaddat)
  earnCardHead: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  earnCardTitle: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },
  earnCardSub: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  earnTrack: {
    height: 3, borderRadius: 2, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 12,
  },
  earnIndicator: { width: '50%', height: '100%', borderRadius: 2 },

  medalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  medal: {
    width: '31%', flexGrow: 1,
    backgroundColor: CARD, borderRadius: 16,
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
    overflow: 'hidden',
  },
  recordRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  recordBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DIVIDER },
  recordIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: GOLD + '1E',
    alignItems: 'center', justifyContent: 'center',
  },
  recordName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  recordMeta: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2, fontFamily: NUM_FONT_SEMI },
  recordDate: { color: TEXT_SECONDARY, fontSize: 11 },

  // Övningshistorik
  histTitle: { color: TEXT_PRIMARY, fontSize: 19, fontWeight: '800', alignSelf: 'stretch' },
  histSub:   { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600', alignSelf: 'stretch', marginTop: -4 },
  histChartWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 8, alignSelf: 'stretch' },
  histAxis: { height: 130, justifyContent: 'space-between', paddingVertical: 8 },
  histAxisText: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontFamily: NUM_FONT_SEMI, fontVariant: ['tabular-nums'] },
  histEmpty: { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', marginVertical: 16 },
  histRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    alignSelf: 'stretch', paddingVertical: 8,
  },
  histRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  histDate: { color: TEXT_SECONDARY, fontSize: 12, width: 52 },
  histSets: { color: TEXT_SECONDARY, fontSize: 12, width: 40 },
  histTop:  { flex: 1, color: TEXT_PRIMARY, fontSize: 13, fontFamily: NUM_FONT_SEMI, fontVariant: ['tabular-nums'] },
  histE1rm: { color: ACCENT, fontSize: 12, fontFamily: NUM_FONT, fontVariant: ['tabular-nums'] },

  // Medaljinfo-modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  modalCard: {
    width: '100%', maxWidth: 340,
    backgroundColor: CARD, borderRadius: 24,
    padding: 28, alignItems: 'center', gap: 8,
  },
  modalTitle:    { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', marginTop: 8, textAlign: 'center' },
  modalSubtitle: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    marginTop: 6,
  },
  statusPillUnlocked: { backgroundColor: '#3BE86218' },
  statusPillLocked:   { backgroundColor: 'rgba(255,255,255,0.06)' },
  statusPillText:     { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '700' },
  modalDesc: {
    color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center',
    lineHeight: 20, marginTop: 6,
  },
  modalClose: {
    backgroundColor: ACCENT, borderRadius: 14,
    paddingVertical: 13, paddingHorizontal: 40, marginTop: 14,
  },
  modalCloseText: { color: '#000', fontSize: 15, fontWeight: '700' },
})
