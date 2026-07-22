import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Image, TouchableOpacity, useWindowDimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import type { CardioWorkout } from '@/services/cardioWorkouts'
import type { FollowCounts } from '@/services/follows'
import { DistanceAreaChart, type AreaBucket } from '@/components/stats/DistanceAreaChart'
import { fmtDuration } from '@/lib/format'
import type { UnitSystem } from '@/lib/units'
import { toLocalDateString, startOfWeek } from '@/lib/date'
import { CARD, BORDER, ORANGE, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT } from '@/lib/theme'

// =============================================================================
// ATLETVY — delad mellan atletsidan (öppnas från flödet/sökningen) och
// profilfliken, så de ser exakt likadana ut: Runkeeper-topp (avatar, namn,
// senast aktiv, Totalt km/Följare/Följer, följ-pill på ANDRAS profiler)
// och Strava-statistik (typ-chips, veckosektion styrd av grafvalet,
// scrubbar 12-veckorsgraf, Aktiviteter-knapp). För andras profiler visas
// ett ärligt tomläge tills delnings-backenden gör deras pass läsbara.
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

export function AthleteOverview({
  isOwn, name, avatarUrl, workouts, gymCount, counts, unit,
  following, onToggleFollow, onOpenActivities, onPressHero,
}: {
  isOwn: boolean
  name: string
  avatarUrl: string | null
  /** Cardio-passen som statistiken bygger på (tom för andras profiler) */
  workouts: CardioWorkout[]
  gymCount: number
  counts: FollowCounts
  unit: UnitSystem
  following: boolean
  onToggleFollow: () => void
  onOpenActivities: () => void
  /** Gör toppen tryckbar (profilfliken: gå till Redigera profil) */
  onPressHero?: () => void
}) {
  const { width: screenW } = useWindowDimensions()
  const [type, setType] = useState<CardioType>('running')

  const totalKm = useMemo(
    () => Math.round(workouts.reduce((sum, w) => sum + w.data.distance_km, 0)),
    [workouts])

  const latestIso = workouts.length > 0 ? workouts[0].created_at : null

  const buckets = useMemo(() => buildWeekBuckets(workouts, type), [workouts, type])

  // Vald punkt i grafen styr hela veckosektionen — utan val visas
  // innevarande vecka
  const [scrubKey, setScrubKey] = useState<string | null>(null)
  const weekKey = scrubKey ?? toLocalDateString(startOfWeek())

  const week = useMemo(() => {
    let km = 0, secs = 0, passes = 0
    for (const w of workouts) {
      if (w.data.type !== type) continue
      if (toLocalDateString(startOfWeek(new Date(w.created_at))) !== weekKey) continue
      km += w.data.distance_km
      secs += w.data.duration_seconds
      passes += 1
    }
    return { km, secs, passes }
  }, [workouts, type, weekKey])

  // "12 maj – 18 maj" för en vald vecka, annars "Den här veckan"
  const weekTitle = useMemo(() => {
    if (!scrubKey) return 'Den här veckan'
    const mon = new Date(scrubKey + 'T12:00:00')
    const sun = new Date(mon); sun.setDate(sun.getDate() + 6)
    const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '')
    return `${fmt(mon)} – ${fmt(sun)}`
  }, [scrubKey])

  function switchType(next: CardioType) {
    if (next === type) return
    Haptics.selectionAsync()
    setType(next)
  }

  const hero = (
    <View style={s.profileRow}>
      <Avatar url={avatarUrl} fallback={name.charAt(0).toUpperCase() || '?'} size={72} />
      <View style={{ flex: 1 }}>
        <Text style={s.name}>{name}</Text>
        <Text style={s.activeMeta}>
          {isOwn ? activeLabel(latestIso) : 'Delar inga pass ännu'}
        </Text>
      </View>
      {onPressHero && <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />}
    </View>
  )

  return (
    <View>
      {onPressHero ? (
        <TouchableOpacity activeOpacity={0.8} onPress={onPressHero}>{hero}</TouchableOpacity>
      ) : hero}

      <View style={s.countersRow}>
        <View style={s.counter}>
          <Text style={s.counterValue}>{isOwn ? totalKm : '–'}</Text>
          <Text style={s.counterLabel}>Totalt km</Text>
        </View>
        <View style={s.counterDivider} />
        <View style={s.counter}>
          <Text style={s.counterValue}>{counts.followers}</Text>
          <Text style={s.counterLabel}>Följare</Text>
        </View>
        <View style={s.counterDivider} />
        <View style={s.counter}>
          <Text style={s.counterValue}>{counts.following}</Text>
          <Text style={s.counterLabel}>Följer</Text>
        </View>
      </View>

      {/* Följ-knappen finns bara på ANDRAS profiler — man kan inte följa
          sig själv. Bara kantlinje; orange ram + text när man inte
          följer ännu. */}
      {!isOwn && (
        <TouchableOpacity
          style={[s.followBtn, !following && s.followBtnInvite]}
          onPress={onToggleFollow}
          activeOpacity={0.8}
          testID="athleteFollow"
        >
          <Text style={[s.followBtnText, !following && s.followBtnTextInvite]}>
            {following ? 'Följer' : 'Följ'}
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Strava-delen: typ-chips, veckan och distansgraf — bara för den
          egna profilen tills delnings-backenden gör andras pass läsbara ── */}
      {!isOwn ? (
        <View style={s.otherEmpty}>
          <Ionicons name="lock-closed-outline" size={38} color={TEXT_SECONDARY} />
          <Text style={s.otherEmptyTitle}>Inga delade pass ännu</Text>
          <Text style={s.otherEmptyBody}>
            När delning finns på plats ser du {name.split(' ')[0] || 'personens'} statistik
            och aktiviteter här.
          </Text>
        </View>
      ) : (<>
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

      <Text style={s.sectionTitle}>{weekTitle}</Text>
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
          <DistanceAreaChart
            buckets={buckets}
            width={screenW - 40 - 32}
            height={170}
            unit={unit}
            selectedKey={scrubKey}
            onSelect={key => setScrubKey(k => k === key ? null : key)}
            onScrub={setScrubKey}
          />
        </View>
      </Animated.View>

      {/* Alla aktiviteter — hela historiken på egen sida */}
      <TouchableOpacity
        style={s.activitiesBtn}
        onPress={onOpenActivities}
        activeOpacity={0.8}
        testID="athleteActivities"
      >
        <View style={s.activitiesIcon}>
          <Ionicons name="list-outline" size={20} color={TEXT_PRIMARY} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.activitiesTitle}>Aktiviteter</Text>
          <Text style={s.activitiesMeta}>
            {workouts.length + gymCount > 0 ? `${workouts.length + gymCount} pass` : 'Inga pass ännu'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={TEXT_SECONDARY} />
      </TouchableOpacity>
      </>)}
    </View>
  )
}

const s = StyleSheet.create({
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
  followBtnInvite: { borderColor: ORANGE },
  followBtnText: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  followBtnTextInvite: { color: ORANGE },

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
    borderWidth: 1, borderColor: BORDER, padding: 16,
  },

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

  otherEmpty: { alignItems: 'center', gap: 8, paddingTop: 60, paddingHorizontal: 30 },
  otherEmptyTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginTop: 6 },
  otherEmptyBody: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
