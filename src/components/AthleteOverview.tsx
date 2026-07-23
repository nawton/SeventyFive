import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Image, TouchableOpacity, useWindowDimensions } from 'react-native'
import { Ionicons } from '@/components/Icon'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import type { CardioWorkout } from '@/services/cardioWorkouts'
import type { FollowCounts, FollowStatus } from '@/services/follows'
import { DistanceAreaChart, type AreaBucket } from '@/components/stats/DistanceAreaChart'
import { fmtDuration } from '@/lib/format'
import type { UnitSystem } from '@/lib/units'
import { toLocalDateString, startOfWeek } from '@/lib/date'
import { CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, ACCENT, CARD_BORDER, accentAlpha, ORANGE, useThemeStrings, THEME_DARK } from '@/lib/theme'

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
  followStatus, statsUnlocked, onToggleFollow, onOpenActivities, onPressHero, onPressFollows,
  streak, onPressStreak, blocked,
}: {
  isOwn: boolean
  name: string
  avatarUrl: string | null
  /** Cardio-passen som statistiken bygger på (tom för låsta profiler) */
  workouts: CardioWorkout[]
  gymCount: number
  counts: FollowCounts
  unit: UnitSystem
  /** Min relation till profilen: ingen, väntande förfrågan eller godkänd */
  followStatus: FollowStatus
  /** Statistiken visas — egen profil eller godkänd vänförfrågan */
  statsUnlocked: boolean
  onToggleFollow: () => void
  onOpenActivities: () => void
  /** Gör toppen tryckbar (profilfliken: gå till Redigera profil) */
  onPressHero?: () => void
  /** Gör Följare/Följer-räknarna tryckbara (egna profilen: öppna listorna) */
  onPressFollows?: (tab: 'followers' | 'following') => void
  /** Egna profilen: dagars streak ersätter Totalt km (statistiken har egen flik) */
  streak?: number
  onPressStreak?: () => void
  /** Jag har blockerat personen — knappen blir Avblockera, allt är låst */
  blocked?: boolean
}) {
  // Chipramar som strängar per schema — dynamiska ramfärger fryser fel
  const T = useThemeStrings()
  const chipEdge = T.TEXT_PRIMARY === '#FFFFFF' ? THEME_DARK.BORDER : 'rgba(0,0,0,0.10)'
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
          {statsUnlocked ? activeLabel(latestIso) : 'Privat profil'}
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
        {isOwn && streak !== undefined ? (
          <TouchableOpacity
            style={s.counter}
            onPress={onPressStreak}
            disabled={!onPressStreak}
            activeOpacity={0.6}
            testID="streakCounter"
          >
            <View style={s.streakValueRow}>
              {/* Flamman är alltid eld — orange oavsett tema */}
              <Ionicons name="flame" size={18} color={ORANGE} />
              <Text style={s.counterValue}>{streak}</Text>
            </View>
            <Text style={s.counterLabel}>Streak</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.counter}>
            <Text style={s.counterValue}>{statsUnlocked ? totalKm : '–'}</Text>
            <Text style={s.counterLabel}>Totalt km</Text>
          </View>
        )}
        <View style={s.counterDivider} />
        <TouchableOpacity
          style={s.counter}
          onPress={onPressFollows ? () => onPressFollows('followers') : undefined}
          disabled={!onPressFollows}
          activeOpacity={0.6}
          testID="followersCounter"
        >
          <Text style={s.counterValue}>{counts.followers}</Text>
          <Text style={s.counterLabel}>Följare</Text>
        </TouchableOpacity>
        <View style={s.counterDivider} />
        <TouchableOpacity
          style={s.counter}
          onPress={onPressFollows ? () => onPressFollows('following') : undefined}
          disabled={!onPressFollows}
          activeOpacity={0.6}
          testID="followingCounter"
        >
          <Text style={s.counterValue}>{counts.following}</Text>
          <Text style={s.counterLabel}>Följer</Text>
        </TouchableOpacity>
      </View>

      {/* Följ-knappen finns bara på ANDRAS profiler — man kan inte följa
          sig själv. Bara kantlinje; orange ram + text när ingen förfrågan
          skickats ännu. */}
      {!isOwn && (
        <TouchableOpacity
          style={[
            s.followBtn,
            blocked ? s.followBtnBlocked : followStatus === 'none' && s.followBtnInvite,
          ]}
          onPress={onToggleFollow}
          activeOpacity={0.8}
          testID="athleteFollow"
        >
          <Text style={[
            s.followBtnText,
            blocked ? s.followBtnTextBlocked : followStatus === 'none' && s.followBtnTextInvite,
          ]}>
            {blocked ? 'Avblockera'
              : followStatus === 'accepted' ? 'Följer'
              : followStatus === 'pending' ? 'Förfrågan skickad' : 'Följ'}
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Strava-delen: typ-chips, veckan och distansgraf — visas BARA på
          andras upplåsta profiler. Den egna statistiken har en hel flik i
          navbaren, så här vore den bara dubblerad. Framstegsfoton visas
          ALDRIG för andra, oavsett godkännande. ── */}
      {!isOwn && !statsUnlocked && (
        <View style={s.otherEmpty}>
          <Ionicons
            name={blocked ? 'ban-outline' : 'lock-closed-outline'}
            size={38}
            color={TEXT_SECONDARY}
          />
          <Text style={s.otherEmptyTitle}>
            {blocked ? 'Blockerad' : 'Statistiken är privat'}
          </Text>
          <Text style={s.otherEmptyBody}>
            {blocked
              ? `Du har blockerat ${name.split(' ')[0] || 'personen'}. Ni kan inte följa eller se varandra förrän du avblockerar.`
              : followStatus === 'pending'
              ? `Väntar på godkännande — när ${name.split(' ')[0] || 'personen'} godkänner din förfrågan ser du statistiken här.`
              : `Skicka en vänförfrågan för att se ${name.split(' ')[0] || 'personens'} statistik och aktiviteter.`}
          </Text>
        </View>
      )}

      {!isOwn && statsUnlocked && (<>
      <View style={s.chipsRow}>
        {TYPES.map(t => {
          const on = t.key === type
          return (
            <TouchableOpacity
              key={t.key}
              style={[s.chip, { borderColor: on ? T.ACCENT : chipEdge }]}
              onPress={() => switchType(t.key)}
              activeOpacity={0.8}
            >
              <Ionicons name={t.icon} size={14} color={on ? ACCENT : TEXT_PRIMARY} />
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

      </>)}

      {/* Alla aktiviteter — bara på upplåsta vänners profiler; den egna
          historiken finns redan i statistikfliken */}
      {!isOwn && statsUnlocked && (
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
      )}
    </View>
  )
}

const s = StyleSheet.create({
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 },
  avatar: {
    backgroundColor: accentAlpha('1E'),
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarInitial: { color: ACCENT, fontWeight: '800' },
  name: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800' },
  activeMeta: { color: TEXT_SECONDARY, fontSize: 14, marginTop: 3 },

  countersRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 20, paddingVertical: 4,
  },
  counter: { flex: 1, alignItems: 'center', gap: 2 },
  streakValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  counterValue: { color: TEXT_PRIMARY, fontSize: 24, fontFamily: NUM_FONT },
  counterLabel: { color: TEXT_SECONDARY, fontSize: 13 },
  counterDivider: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: 'rgba(255,255,255,0.15)' },

  followBtn: {
    marginTop: 18, borderRadius: 26, paddingVertical: 13,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center',
  },
  followBtnInvite: { borderColor: ACCENT },
  followBtnBlocked: { borderColor: '#FF3B4A88' },
  followBtnText: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  followBtnTextInvite: { color: ACCENT },
  followBtnTextBlocked: { color: '#FF3B4A' },

  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 26 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 17,
    paddingHorizontal: 11, paddingVertical: 7,
  },
  chipActive: {},
  chipText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: ACCENT, fontWeight: '700' },

  sectionTitle: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800', marginTop: 24 },
  weekRow: { flexDirection: 'row', marginTop: 14 },
  weekStat: { flex: 1, gap: 4 },
  weekLabel: { color: TEXT_SECONDARY, fontSize: 13 },
  weekValue: { color: TEXT_PRIMARY, fontSize: 18, fontFamily: NUM_FONT },

  chartCard: {
    marginTop: 20, backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: CARD_BORDER, padding: 16,
  },

  activitiesBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginTop: 20, backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: CARD_BORDER, padding: 16,
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
