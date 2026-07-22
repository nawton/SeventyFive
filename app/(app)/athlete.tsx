import { useCallback, useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/services/profile'
import { getCardioWorkouts, type CardioWorkout } from '@/services/cardioWorkouts'
import { GlassCircleButton } from '@/components/GlassButton'
import { DistanceAreaChart, type AreaBucket } from '@/components/stats/DistanceAreaChart'
import { fmtDuration } from '@/lib/format'
import { getUnitSystem, type UnitSystem } from '@/lib/units'
import { toLocalDateString, startOfWeek } from '@/lib/date'
import { BG, CARD, BORDER, ORANGE, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT } from '@/lib/theme'
import { TAB_CONTENT_PAD } from '@/lib/glass'

// =============================================================================
// ATLETPROFIL — öppnas från flödeskortens avatar. Toppen följer Runkeeper
// (avatar, namn, senast aktiv, Totalt km/Följare/Följer och en bred
// Följer-pill), statistiken under följer Strava (aktivitetstyp-chips,
// "Den här veckan" och veckodistansgraf — samma DistanceAreaChart som
// statistikfliken). Följ-backenden finns inte än: sidan visar den egna
// profilen (flödet är egna pass) och följ/räknare är platshållare.
// =============================================================================

const TYPES = [
  { key: 'running', label: 'Löpning',  icon: 'fitness-outline' },
  { key: 'cycling', label: 'Cykling',  icon: 'bicycle-outline' },
  { key: 'walking', label: 'Promenad', icon: 'walk-outline' },
] as const

type CardioType = typeof TYPES[number]['key']

const CHART_WEEKS = 12

/** "Aktiv: idag" / "Aktiv: igår" / "Aktiv: 5 dagar sedan" */
export function activeLabel(latestIso: string | null, now = new Date()): string {
  if (!latestIso) return 'Inga pass ännu'
  const then = new Date(latestIso)
  const days = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
     new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) / 86_400_000)
  if (days <= 0) return 'Aktiv: idag'
  if (days === 1) return 'Aktiv: igår'
  return `Aktiv: ${days} dagar sedan`
}

/** 12 veckovisa hinkar, etikett = månadsnamn där månaden byter (Strava-stil) */
export function buildWeekBuckets(
  workouts: CardioWorkout[], type: CardioType, now = new Date(),
): AreaBucket[] {
  const thisMon = startOfWeek(now)
  const buckets: AreaBucket[] = Array.from({ length: CHART_WEEKS }, (_, i) => {
    const mon = new Date(thisMon); mon.setDate(mon.getDate() - (CHART_WEEKS - 1 - i) * 7)
    return {
      key: toLocalDateString(mon),
      label: mon.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', '').toUpperCase(),
      total: 0,
      isCurrent: i === CHART_WEEKS - 1,
    }
  })
  // Bara första veckan i varje månad behåller sin etikett — resten blir tysta
  let prev = ''
  for (const b of buckets) {
    if (b.label === prev) b.label = ''
    else prev = b.label
  }
  for (const w of workouts) {
    if (w.data.type !== type) continue
    const key = toLocalDateString(startOfWeek(new Date(w.created_at)))
    const bucket = buckets.find(b => b.key === key)
    if (bucket) bucket.total += w.data.distance_km
  }
  return buckets
}

function Avatar({ url, fallback, size }: { url: string | null; fallback: string; size: number }) {
  const radius = size / 2
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: radius }]}>
      {url?.startsWith('http') ? (
        <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: radius }} />
      ) : url ? (
        <Text style={{ fontSize: size * 0.5 }}>{url}</Text>
      ) : (
        <Text style={[s.avatarInitial, { fontSize: size * 0.4 }]}>{fallback}</Text>
      )}
    </View>
  )
}

export default function AthleteScreen() {
  const { width: screenW } = useWindowDimensions()
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [workouts, setWorkouts] = useState<CardioWorkout[]>([])
  const [unit, setUnit] = useState<UnitSystem>('metric')
  const [type, setType] = useState<CardioType>('running')
  // Följ-status är bara lokal tills backenden finns
  const [following, setFollowing] = useState(true)

  useFocusEffect(useCallback(() => {
    let alive = true
    getUnitSystem().then(u => { if (alive) setUnit(u) })
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user || !alive) return
      const [profile, all] = await Promise.all([
        getProfile(session.user.id).catch(() => null),
        getCardioWorkouts(session.user.id, 200).catch(() => [] as CardioWorkout[]),
      ])
      if (!alive) return
      setName(profile?.name || session.user.email?.split('@')[0] || '')
      setAvatarUrl(profile?.avatar_url ?? null)
      setWorkouts(all)
    })
    return () => { alive = false }
  }, []))

  const totalKm = useMemo(
    () => Math.round(workouts.reduce((sum, w) => sum + w.data.distance_km, 0)),
    [workouts])

  const latestIso = workouts.length > 0 ? workouts[0].created_at : null

  // Den här veckan, för vald aktivitetstyp
  const week = useMemo(() => {
    const monKey = toLocalDateString(startOfWeek())
    let km = 0, secs = 0, passes = 0
    for (const w of workouts) {
      if (w.data.type !== type) continue
      if (toLocalDateString(startOfWeek(new Date(w.created_at))) !== monKey) continue
      km += w.data.distance_km
      secs += w.data.duration_seconds
      passes += 1
    }
    return { km, secs, passes }
  }, [workouts, type])

  const buckets = useMemo(() => buildWeekBuckets(workouts, type), [workouts, type])

  // Scrub: håll fingret på grafen → vald veckas detaljer visas ovanför
  const [scrubKey, setScrubKey] = useState<string | null>(null)
  const scrubInfo = useMemo(() => {
    if (!scrubKey) return null
    const mon = new Date(scrubKey + 'T12:00:00')
    const sun = new Date(mon); sun.setDate(sun.getDate() + 6)
    let km = 0, secs = 0, passes = 0
    for (const w of workouts) {
      if (w.data.type !== type) continue
      if (toLocalDateString(startOfWeek(new Date(w.created_at))) !== scrubKey) continue
      km += w.data.distance_km
      secs += w.data.duration_seconds
      passes += 1
    }
    const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '')
    return `${fmt(mon)} – ${fmt(sun)} · ${km.toFixed(1).replace('.', ',')} km · ${passes} pass · ${fmtDuration(secs)}`
  }, [scrubKey, workouts, type])

  function toggleFollow() {
    Haptics.selectionAsync()
    setFollowing(v => !v)
  }

  function switchType(next: CardioType) {
    if (next === type) return
    Haptics.selectionAsync()
    setType(next)
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <GlassCircleButton
          icon="chevron-back"
          size={40}
          iconColor={TEXT_PRIMARY}
          onPress={() => router.back()}
          fallbackStyle={s.iconBtnFallback}
        />
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Runkeeper-delen: profil, räknare och Följer-pill ── */}
        <View style={s.profileRow}>
          <Avatar url={avatarUrl} fallback={name.charAt(0).toUpperCase() || '?'} size={72} />
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{name}</Text>
            <Text style={s.activeMeta}>{activeLabel(latestIso)}</Text>
          </View>
        </View>

        <View style={s.countersRow}>
          <View style={s.counter}>
            <Text style={s.counterValue}>{totalKm}</Text>
            <Text style={s.counterLabel}>Totalt km</Text>
          </View>
          <View style={s.counterDivider} />
          <View style={s.counter}>
            <Text style={s.counterValue}>0</Text>
            <Text style={s.counterLabel}>Följare</Text>
          </View>
          <View style={s.counterDivider} />
          <View style={s.counter}>
            <Text style={s.counterValue}>0</Text>
            <Text style={s.counterLabel}>Följer</Text>
          </View>
        </View>

        {/* Alltid bara kantlinje — ingen fylld orange variant */}
        <TouchableOpacity
          style={s.followBtn}
          onPress={toggleFollow}
          activeOpacity={0.8}
          testID="athleteFollow"
        >
          <Text style={s.followBtnText}>{following ? 'Följer' : 'Följ'}</Text>
        </TouchableOpacity>

        {/* ── Strava-delen: typ-chips, veckan och distansgraf ── */}
        <View style={s.chipsRow}>
          {TYPES.map(t => {
            const on = t.key === type
            return (
              <TouchableOpacity
                key={t.key}
                style={[s.chip, on && s.chipActive]}
                onPress={() => switchType(t.key)}
                activeOpacity={0.8}
              >
                <Ionicons name={t.icon} size={14} color={on ? ORANGE : TEXT_PRIMARY} />
                <Text style={[s.chipText, on && s.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={s.sectionTitle}>Den här veckan</Text>
        {/* key={type} monterar om blocket vid typbyte — in/ut-tona ger en
            mjuk växling av både veckosiffrorna och grafen */}
        <Animated.View key={type} entering={FadeIn.duration(250)} exiting={FadeOut.duration(120)}>
          <View style={s.weekRow}>
            <View style={s.weekStat}>
              <Text style={s.weekLabel}>Distans</Text>
              <Text style={s.weekValue}>{week.km.toFixed(2).replace('.', ',')} km</Text>
            </View>
            <View style={s.weekStat}>
              <Text style={s.weekLabel}>Tid</Text>
              <Text style={s.weekValue}>{fmtDuration(week.secs)}</Text>
            </View>
            <View style={s.weekStat}>
              <Text style={s.weekLabel}>Pass</Text>
              <Text style={s.weekValue}>{week.passes}</Text>
            </View>
          </View>

          <View style={s.chartCard}>
            {/* Under scrub visas den valda veckans detaljer i stället för hinten */}
            <Text style={[s.chartHint, scrubInfo != null && s.chartHintActive]}>
              {scrubInfo ?? `km per vecka, senaste ${CHART_WEEKS} veckorna — håll för detaljer`}
            </Text>
            <DistanceAreaChart
              buckets={buckets}
              width={screenW - 40 - 32}
              height={170}
              unit={unit}
              selectedKey={scrubKey}
              onScrub={setScrubKey}
              onScrubEnd={() => setScrubKey(null)}
            />
          </View>
        </Animated.View>

        {/* Alla aktiviteter — hela historiken på egen sida */}
        <TouchableOpacity
          style={s.activitiesBtn}
          onPress={() => router.push('/(app)/activities' as never)}
          activeOpacity={0.8}
          testID="athleteActivities"
        >
          <View style={s.activitiesIcon}>
            <Ionicons name="list-outline" size={20} color={TEXT_PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.activitiesTitle}>Aktiviteter</Text>
            <Text style={s.activitiesMeta}>
              {workouts.length > 0 ? `${workouts.length} pass` : 'Inga pass ännu'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={TEXT_SECONDARY} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  iconBtnFallback: { backgroundColor: CARD },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 + TAB_CONTENT_PAD },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 },
  avatar: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarInitial: { color: TEXT_PRIMARY, fontWeight: '800' },
  name: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800' },
  activeMeta: { color: TEXT_SECONDARY, fontSize: 14, marginTop: 3 },

  countersRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 20, paddingVertical: 4,
  },
  counter: { flex: 1, alignItems: 'center', gap: 2 },
  counterValue: { color: TEXT_PRIMARY, fontSize: 24, fontFamily: NUM_FONT },
  counterLabel: { color: TEXT_SECONDARY, fontSize: 13 },
  counterDivider: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: 'rgba(255,255,255,0.15)' },

  followBtn: {
    marginTop: 18, borderRadius: 26, paddingVertical: 13,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center',
  },
  followBtnText: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },

  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 26 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: BORDER, borderRadius: 17,
    paddingHorizontal: 11, paddingVertical: 7,
  },
  chipActive: { borderColor: ORANGE },
  chipText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: ORANGE, fontWeight: '700' },

  sectionTitle: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800', marginTop: 24 },
  weekRow: { flexDirection: 'row', marginTop: 14 },
  weekStat: { flex: 1, gap: 4 },
  weekLabel: { color: TEXT_SECONDARY, fontSize: 13 },
  weekValue: { color: TEXT_PRIMARY, fontSize: 18, fontFamily: NUM_FONT },

  chartCard: {
    marginTop: 20, backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER, padding: 16, gap: 10,
  },
  chartHint: { color: TEXT_SECONDARY, fontSize: 12 },
  chartHintActive: { color: TEXT_PRIMARY, fontWeight: '700' },

  activitiesBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginTop: 20, backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER, padding: 16,
  },
  activitiesIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  activitiesTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  activitiesMeta: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
})
