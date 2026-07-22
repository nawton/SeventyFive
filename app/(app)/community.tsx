import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import MapView, { Polyline, Marker } from 'react-native-maps'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/services/profile'
import { getCardioWorkouts, type CardioWorkout } from '@/services/cardioWorkouts'
import { formatPace } from '@/lib/cardioUtils'
import { fmtTime } from '@/lib/format'
import { getUnitSystem, type UnitSystem } from '@/lib/units'
import { GlassSegment } from '@/components/GlassSegment'
import { GlassCircleButton } from '@/components/GlassButton'
import { CardioSummaryView } from '@/components/CardioSummaryView'
import { useTabBarShrinkOnScroll } from '@/lib/tabBar'
import { BG, CARD, BORDER, CARDIO_BLUE, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT } from '@/lib/theme'
import { TAB_CONTENT_PAD } from '@/lib/glass'

// =============================================================================
// COMMUNITY — flöde med delade pass (Runkeeper-förlagan: kort med avatar,
// namn, statistikrad, karta och gilla/kommentera). Delnings-backenden är
// inte byggd än, så flödet visar de egna cardio-passen som förhandsvisning;
// när delning finns byts datakällan ut i loadFeed. Sök/följ medvetet
// utelämnat. Grupper är en platshållare. Tryck på ett kort öppnar samma
// passdetaljvy som statistiken använder (CardioSummaryView).
// =============================================================================

const TYPE_LABELS: Record<string, string> = {
  running: 'Löpning', cycling: 'Cykling', walking: 'Promenad', interval: 'Intervaller',
}

type Segment = 'feed' | 'groups'

interface FeedPost {
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

function FeedCard({ post, onOpen }: { post: FeedPost; onOpen: (w: CardioWorkout) => void }) {
  // Gilla är än så länge bara lokal — sparas när delnings-backenden byggs
  const [liked, setLiked] = useState(false)
  const route = post.route ?? []
  const hasRoute = route.length > 1

  function toggleLike() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setLiked(v => !v)
  }

  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.92}
      onPress={() => onOpen(post.workout)}
      testID={`post-${post.id}`}
    >
      <View style={s.cardHeader}>
        <Avatar url={post.authorAvatar} fallback={post.authorName.charAt(0).toUpperCase()} size={44} />
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

function EmptyState({ icon, title, body }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string
}) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={44} color={TEXT_SECONDARY} />
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
    </View>
  )
}

export default function CommunityScreen() {
  const [segment, setSegment] = useState<Segment>('feed')
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loaded, setLoaded] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [unit, setUnit] = useState<UnitSystem>('metric')
  const [selectedWorkout, setSelectedWorkout] = useState<CardioWorkout | null>(null)
  const onScroll = useTabBarShrinkOnScroll()

  useFocusEffect(useCallback(() => {
    let alive = true
    getUnitSystem().then(u => { if (alive) setUnit(u) })
    async function loadFeed() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || !alive) return
      const [profile, workouts] = await Promise.all([
        getProfile(session.user.id).catch(() => null),
        getCardioWorkouts(session.user.id, 20).catch(() => [] as CardioWorkout[]),
      ])
      if (!alive) return
      const authorName = profile?.name || session.user.email?.split('@')[0] || 'Jag'
      setAvatarUrl(profile?.avatar_url ?? null)
      setPosts(workouts.map(w => ({
        id: w.id,
        authorName,
        authorAvatar: profile?.avatar_url ?? null,
        typeLabel: TYPE_LABELS[w.data.type] ?? 'Cardio',
        createdAt: w.created_at,
        distanceKm: w.data.distance_km,
        durationS: w.data.duration_seconds,
        route: w.data.route,
        workout: w,
      })))
      setLoaded(true)
    }
    loadFeed()
    return () => { alive = false }
  }, []))

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {/* Rent otonat glas i tummen (som förlagan) + följer-knapp till höger */}
      <View style={s.segmentRow}>
        <View style={{ flex: 1 }}>
          <GlassSegment
            value={segment}
            options={[{ key: 'feed', label: 'Flöde' }, { key: 'groups', label: 'Grupper' }]}
            onChange={setSegment}
            tint={null}
          />
        </View>
        <GlassCircleButton
          icon="people-outline"
          size={44}
          iconColor={TEXT_PRIMARY}
          onPress={() => router.push('/(app)/following' as never)}
          fallbackStyle={s.followBtnFallback}
        />
      </View>

      {segment === 'groups' ? (
        <EmptyState
          icon="people-outline"
          title="Grupper kommer snart"
          body="Skapa grupper med vänner och peppa varandra genom utmaningen."
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          renderItem={({ item }) => <FeedCard post={item} onOpen={setSelectedWorkout} />}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={loaded ? (
            <EmptyState
              icon="megaphone-outline"
              title="Inget i flödet ännu"
              body="Dina cardio-pass dyker upp här. Snart kan du dela dem så att andra kan se, gilla och kommentera."
            />
          ) : null}
        />
      )}

      {/* Samma passdetaljvy som statistiken — utan radering härifrån */}
      <Modal visible={!!selectedWorkout} animationType="slide" onRequestClose={() => setSelectedWorkout(null)}>
        {selectedWorkout && (
          <CardioSummaryView
            workout={selectedWorkout}
            title={selectedWorkout.name}
            dateLabel={new Date(selectedWorkout.created_at).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
            avatarUrl={avatarUrl}
            unit={unit}
            onClose={() => setSelectedWorkout(null)}
          />
        )}
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  segmentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  followBtnFallback: { backgroundColor: CARD },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 + TAB_CONTENT_PAD, gap: 16 },

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

  empty: { alignItems: 'center', gap: 8, paddingTop: 90, paddingHorizontal: 40 },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginTop: 6 },
  emptyBody: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
