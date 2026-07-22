import { useState } from 'react'
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native'
import { Ionicons } from '@/components/Icon'
import MapView, { Polyline, Marker } from 'react-native-maps'
import * as Haptics from 'expo-haptics'
import type { CardioWorkout } from '@/services/cardioWorkouts'
import type { StrengthWorkout } from '@/services/strengthWorkouts'
import { formatPace } from '@/lib/cardioUtils'
import { fmtTime } from '@/lib/format'
import { CARD, BORDER, CARDIO_BLUE, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, DIVIDER, useCardChrome, accentAlpha, ACCENT } from '@/lib/theme'
import { useRouteColor } from '@/lib/routeColor'

// =============================================================================
// FLÖDESKORT — delat mellan community-flödet och atletprofilens
// aktivitetslista: avatar + namn, "Torsdag morgon", statistikrad,
// ruttkarta (cardio) och gilla/kommentera. Gympass är dagens loggade
// övningar grupperade till ETT inlägg (en user_workouts-rad per övning)
// med övningar/set/volym som rad. Gilla är bara lokal state tills
// delnings-backenden finns.
// =============================================================================

export const TYPE_LABELS: Record<string, string> = {
  running: 'Löpning', cycling: 'Cykling', walking: 'Promenad', interval: 'Intervaller',
}

interface BasePost {
  id: string
  authorId: string              // vem passet tillhör — styr avatarnavigering m.m.
  authorName: string
  authorAvatar: string | null   // http-URL, emoji eller null (initialer)
  typeLabel: string
  createdAt: string
}

export interface CardioPost extends BasePost {
  kind: 'cardio'
  distanceKm: number
  durationS: number
  route?: Array<[number, number]>
  workout: CardioWorkout        // hela passet — detaljvyn öppnas härifrån
}

export interface StrengthPost extends BasePost {
  kind: 'strength'
  exercises: number
  sets: number
  volumeKg: number
  workouts: StrengthWorkout[]   // dagens övningsrader — detaljvyn öppnas härifrån
}

export type FeedPost = CardioPost | StrengthPost

/** Gör om ett sparat cardio-pass till ett flödesinlägg */
export function workoutToPost(
  w: CardioWorkout, authorId: string, authorName: string, authorAvatar: string | null,
): CardioPost {
  return {
    kind: 'cardio',
    id: w.id,
    authorId,
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

/** Grupperar styrkeloggar per träningsdag till gympass-inlägg */
export function strengthToPosts(
  workouts: StrengthWorkout[], authorId: string, authorName: string, authorAvatar: string | null,
): StrengthPost[] {
  const byDay = new Map<string, StrengthWorkout[]>()
  for (const w of workouts) {
    const day = w.data.workout_date ?? w.created_at.split('T')[0]
    const list = byDay.get(day)
    if (list) list.push(w)
    else byDay.set(day, [w])
  }
  return Array.from(byDay.entries()).map(([day, dayWorkouts]) => {
    let sets = 0, volumeKg = 0
    for (const w of dayWorkouts) {
      sets += w.data.sets.length
      for (const set of w.data.sets) volumeKg += set.reps * set.weight_kg
    }
    // Senast loggade övningen får representera passets tidpunkt
    const createdAt = dayWorkouts
      .map(w => w.created_at)
      .sort()[dayWorkouts.length - 1]
    return {
      kind: 'strength' as const,
      id: `gym-${authorId}-${day}`,
      authorId,
      authorName,
      authorAvatar,
      typeLabel: 'Gympass',
      createdAt,
      exercises: dayWorkouts.length,
      sets,
      volumeKg: Math.round(volumeKg),
      workouts: dayWorkouts,
    }
  })
}

/** Cardio + gympass blandat, nyast först */
export function mergePosts(posts: FeedPost[]): FeedPost[] {
  return [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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
export function regionForRoute(route: Array<[number, number]>) {
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

export interface PostSocialState {
  likes: number
  likedByMe: boolean
  comments: number
}

export function FeedWorkoutCard({ post, onOpen, onAvatarPress, social, onToggleLike, onOpenComments }: {
  post: FeedPost
  onOpen: (post: FeedPost) => void
  /** Utelämnas när avataren inte ska leda någonstans (t.ex. på atletens egen sida) */
  onAvatarPress?: () => void
  /** Riktiga gillanden/kommentarer — utan dessa är hjärtat bara lokalt */
  social?: PostSocialState
  onToggleLike?: () => void
  onOpenComments?: () => void
}) {
  const chrome = useCardChrome()
  const routeColor = useRouteColor()
  const [localLiked, setLocalLiked] = useState(false)
  const liked = social ? social.likedByMe : localLiked
  const route = post.kind === 'cardio' ? post.route ?? [] : []
  const hasRoute = route.length > 1

  function toggleLike() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (onToggleLike) onToggleLike()
    else setLocalLiked(v => !v)
  }

  const avatar = (
    <FeedAvatar url={post.authorAvatar} fallback={post.authorName.charAt(0).toUpperCase()} size={44} />
  )

  return (
    // Chromet (mörk ram/ljus skugga) på wrappern — kortet klipper kartan
    // med overflow hidden, vilket annars äter upp skuggan
    <View style={[s.cardChrome, chrome]}>
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.92}
      onPress={() => onOpen(post)}
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
      {post.kind === 'cardio' ? (
        <View style={s.statsRow}>
          <Stat value={post.distanceKm.toFixed(2).replace('.', ',')} label="km" />
          <Stat value={fmtTime(post.durationS)} label="tid" />
          <Stat value={formatPace(post.distanceKm, post.durationS)} label="min/km" />
        </View>
      ) : (
        <View style={s.statsRow}>
          <Stat value={String(post.exercises)} label="övningar" />
          <Stat value={String(post.sets)} label="set" />
          <Stat value={post.volumeKg.toLocaleString('sv-SE')} label="kg volym" />
        </View>
      )}

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
              strokeColor={routeColor}
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
        <TouchableOpacity
          onPress={toggleLike}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID={`like-${post.id}`}
          style={s.footerAction}
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? '#FF3B4A' : TEXT_PRIMARY} />
          {social != null && social.likes > 0 && (
            <Text style={s.footerCount}>{social.likes}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onOpenComments}
          disabled={!onOpenComments}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID={`comments-${post.id}`}
          style={s.footerAction}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={onOpenComments ? TEXT_PRIMARY : TEXT_SECONDARY} />
          {social != null && social.comments > 0 && (
            <Text style={s.footerCount}>{social.comments}</Text>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  cardChrome: { borderRadius: 20 },
  card: {
    backgroundColor: CARD, borderRadius: 20,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  avatar: {
    backgroundColor: accentAlpha('1E'),
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarInitial: { color: ACCENT, fontWeight: '800' },
  cardName: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
  cardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: DIVIDER },

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
  footerAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerCount: { color: TEXT_SECONDARY, fontSize: 14, fontFamily: NUM_FONT },
})
