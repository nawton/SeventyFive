import { useState } from 'react'
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import MapView, { Polyline, Marker } from 'react-native-maps'
import * as Haptics from 'expo-haptics'
import type { CardioWorkout } from '@/services/cardioWorkouts'
import { formatPace } from '@/lib/cardioUtils'
import { fmtTime } from '@/lib/format'
import { CARD, BORDER, CARDIO_BLUE, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT } from '@/lib/theme'

// =============================================================================
// FLÖDESKORT — delat mellan community-flödet och atletprofilens
// aktivitetslista: avatar + namn, "Torsdag morgon", km/tid/tempo-rad,
// inramad ruttkarta och gilla/kommentera. Gilla är bara lokal state tills
// delnings-backenden finns.
// =============================================================================

export const TYPE_LABELS: Record<string, string> = {
  running: 'Löpning', cycling: 'Cykling', walking: 'Promenad', interval: 'Intervaller',
}

export interface FeedPost {
  id: string
  authorName: string
  authorAvatar: string | null   // http-URL, emoji eller null (initialer)
  typeLabel: string
  createdAt: string
  distanceKm: number
  durationS: number
  route?: Array<[number, number]>
  workout: CardioWorkout        // hela passet — detaljvyn öppnas härifrån
}

/** Gör om ett sparat pass till ett flödesinlägg */
export function workoutToPost(
  w: CardioWorkout, authorName: string, authorAvatar: string | null,
): FeedPost {
  return {
    id: w.id,
    authorName,
    authorAvatar,
    typeLabel: TYPE_LABELS[w.data.type] ?? 'Cardio',
    createdAt: w.created_at,
    distanceKm: w.data.distance_km,
    durationS: w.data.duration_seconds,
    route: w.data.route,
    workout: w,
  }
}

/** "idag" / "igår" / "5 dagar sedan" */
export function relativeDayLabel(iso: string, now = new Date()): string {
  const then = new Date(iso)
  const days = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
     new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) / 86_400_000)
  if (days <= 0) return 'idag'
  if (days === 1) return 'igår'
  return `${days} dagar sedan`
}

/** "Torsdag morgon" — veckodag + tid på dygnet, som förlagan rubricerar pass */
export function dayPartTitle(iso: string): string {
  const d = new Date(iso)
  const weekday = d.toLocaleDateString('sv-SE', { weekday: 'long' })
  const h = d.getHours()
  const part =
    h < 4 ? 'natt' :
    h < 11 ? 'morgon' :
    h < 13 ? 'lunch' :
    h < 17 ? 'eftermiddag' :
    h < 22 ? 'kväll' : 'natt'
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${part}`
}

/** Region som ramar in rutten med luft runt om */
function regionForRoute(route: Array<[number, number]>) {
  let minLa = 90, maxLa = -90, minLo = 180, maxLo = -180
  for (const [la, lo] of route) {
    if (la < minLa) minLa = la
    if (la > maxLa) maxLa = la
    if (lo < minLo) minLo = lo
    if (lo > maxLo) maxLo = lo
  }
  return {
    latitude: (minLa + maxLa) / 2,
    longitude: (minLo + maxLo) / 2,
    latitudeDelta: Math.max(0.008, (maxLa - minLa) * 1.5),
    longitudeDelta: Math.max(0.008, (maxLo - minLo) * 1.5),
  }
}

export function FeedAvatar({ url, fallback, size }: { url: string | null; fallback: string; size: number }) {
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

export function FeedWorkoutCard({ post, onOpen, onAvatarPress }: {
  post: FeedPost
  onOpen: (w: CardioWorkout) => void
  /** Utelämnas när avataren inte ska leda någonstans (t.ex. på atletens egen sida) */
  onAvatarPress?: () => void
}) {
  // Gilla är än så länge bara lokal — sparas när delnings-backenden byggs
  const [liked, setLiked] = useState(false)
  const route = post.route ?? []
  const hasRoute = route.length > 1

  function toggleLike() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setLiked(v => !v)
  }

  const avatar = (
    <FeedAvatar url={post.authorAvatar} fallback={post.authorName.charAt(0).toUpperCase()} size={44} />
  )

  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.92}
      onPress={() => onOpen(post.workout)}
      testID={`post-${post.id}`}
    >
      <View style={s.cardHeader}>
        {onAvatarPress ? (
          <TouchableOpacity
            onPress={onAvatarPress}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            testID={`avatar-${post.id}`}
          >
            {avatar}
          </TouchableOpacity>
        ) : avatar}
        <View style={{ flex: 1 }}>
          <Text style={s.cardName}>{post.authorName}</Text>
          <Text style={s.cardMeta}>{post.typeLabel} — {relativeDayLabel(post.createdAt)}</Text>
        </View>
      </View>

      <View style={s.cardDivider} />

      <Text style={s.cardTitle}>{dayPartTitle(post.createdAt)}</Text>
      <View style={s.statsRow}>
        <Stat value={post.distanceKm.toFixed(2).replace('.', ',')} label="km" />
        <Stat value={fmtTime(post.durationS)} label="tid" />
        <Stat value={formatPace(post.distanceKm, post.durationS)} label="min/km" />
      </View>

      {hasRoute && (
        <View style={s.mapWrap} pointerEvents="none">
          <MapView
            style={s.map}
            initialRegion={regionForRoute(route)}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            <Polyline
              coordinates={route.map(([la, ln]) => ({ latitude: la, longitude: ln }))}
              strokeColor={CARDIO_BLUE}
              strokeWidth={4}
            />
            <Marker coordinate={{ latitude: route[0][0], longitude: route[0][1] }} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[s.routeDot, { backgroundColor: '#22C55E' }]} />
            </Marker>
            <Marker
              coordinate={{ latitude: route[route.length - 1][0], longitude: route[route.length - 1][1] }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[s.routeDot, { backgroundColor: '#EF4444' }]} />
            </Marker>
          </MapView>
        </View>
      )}

      <View style={s.cardFooter}>
        <TouchableOpacity onPress={toggleLike} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID={`like-${post.id}`}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? '#FF3B4A' : TEXT_PRIMARY} />
        </TouchableOpacity>
        <Ionicons name="chatbubble-ellipses-outline" size={24} color={TEXT_SECONDARY} />
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  avatar: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarInitial: { color: TEXT_PRIMARY, fontWeight: '800' },
  cardName: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
  cardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)' },

  cardTitle: {
    color: TEXT_PRIMARY, fontSize: 18, fontWeight: '800',
    paddingHorizontal: 16, paddingTop: 14,
  },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 10, paddingBottom: 14,
  },
  stat: { alignItems: 'center', minWidth: 72 },
  statValue: { color: TEXT_PRIMARY, fontSize: 22, fontFamily: NUM_FONT },
  statLabel: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 1 },

  mapWrap: { height: 240 },
  map: { flex: 1 },
  routeDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: '#fff' },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 22,
    paddingHorizontal: 16, paddingVertical: 12,
  },
})
