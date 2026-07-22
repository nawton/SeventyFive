import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import MapView, { Polyline, Marker } from 'react-native-maps'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getCardioWorkoutById, type CardioWorkout } from '@/services/cardioWorkouts'
import {
  getFeedSocial, getPostLikers, getComments, addComment, likePost, unlikePost,
  type PostComment,
} from '@/services/social'
import type { FollowProfile } from '@/services/follows'
import { FeedAvatar, relativeDayLabel, regionForRoute } from '@/components/FeedWorkoutCard'
import { GlassCircleButton } from '@/components/GlassButton'
import { CardioSummaryView } from '@/components/CardioSummaryView'
import { getUnitSystem, type UnitSystem } from '@/lib/units'
import { timeAgo } from '@/lib/format'
import { BG, CARD, BORDER, CARDIO_BLUE, ORANGE, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT } from '@/lib/theme'

// =============================================================================
// DISKUSSION — ett inläggs egen sida (Strava-stil): kartan högst upp,
// passets namn, vem och när, gilla-rad med avatarer på de som gillat och
// kommentarstråden med skrivfält längst ner. Öppnas från flödeskortens
// pratbubbla. Synligheten styrs av RLS precis som i flödet.
// =============================================================================

export default function PostScreen() {
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    postKey?: string; ownerId?: string; ownerName?: string; ownerAvatar?: string
    kind?: string; title?: string; createdAt?: string; meta?: string
  }>()
  const postKey   = typeof params.postKey === 'string' ? params.postKey : ''
  const ownerId   = typeof params.ownerId === 'string' ? params.ownerId : ''
  const ownerName = typeof params.ownerName === 'string' ? params.ownerName : ''
  const kind      = params.kind === 'strength' ? 'strength' : 'cardio'
  const title     = typeof params.title === 'string' && params.title ? params.title : 'Pass'
  const createdAt = typeof params.createdAt === 'string' ? params.createdAt : ''
  const meta      = typeof params.meta === 'string' ? params.meta : ''

  const [ownId, setOwnId] = useState<string | null>(null)
  const [workout, setWorkout] = useState<CardioWorkout | null>(null)
  const [likes, setLikes] = useState(0)
  const [likedByMe, setLikedByMe] = useState(false)
  const [likers, setLikers] = useState<FollowProfile[]>([])
  const [comments, setComments] = useState<PostComment[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [unit, setUnit] = useState<UnitSystem>('metric')
  const [detailOpen, setDetailOpen] = useState(false)

  useFocusEffect(useCallback(() => {
    if (!postKey) return
    let alive = true
    // Skärmen ligger kvar monterad — nollställ så förra inlägget inte skymtar
    setWorkout(null)
    setComments([])
    setLikers([])
    setLikes(0)
    setLikedByMe(false)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (alive) setOwnId(session?.user?.id ?? null)
    })
    getUnitSystem().then(u => { if (alive) setUnit(u) })
    setDetailOpen(false)
    if (kind === 'cardio' && ownerId) {
      getCardioWorkoutById(ownerId, postKey)
        .then(w => { if (alive) setWorkout(w) })
        .catch(() => {})
    }
    getFeedSocial([postKey]).then(map => {
      if (!alive) return
      const entry = map[postKey]
      if (entry) { setLikes(entry.likes); setLikedByMe(entry.likedByMe) }
    }).catch(() => {})
    getPostLikers(postKey).then(l => { if (alive) setLikers(l) }).catch(() => {})
    getComments(postKey).then(c => { if (alive) setComments(c) }).catch(() => {})
    return () => { alive = false }
  }, [postKey, ownerId, kind]))

  function toggleLike() {
    if (!postKey || !ownerId || !ownId) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const next = !likedByMe
    setLikedByMe(next)
    setLikes(n => Math.max(0, n + (next ? 1 : -1)))
    ;(next ? likePost(postKey, ownerId) : unlikePost(postKey))
      .then(() => getPostLikers(postKey))
      .then(setLikers)
      .catch(() => {
        setLikedByMe(!next)
        setLikes(n => Math.max(0, n + (next ? -1 : 1)))
      })
  }

  async function handleSend() {
    const body = draft.trim()
    if (!postKey || !ownerId || body.length === 0 || sending) return
    setSending(true)
    try {
      await addComment(postKey, ownerId, body)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setDraft('')
      setComments(await getComments(postKey))
    } catch {
      // RLS stoppar kommentarer på pass man inte får se — behåll utkastet
    } finally {
      setSending(false)
    }
  }

  const route = workout?.data.route ?? []
  const hasRoute = route.length > 1

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.header}>
        <GlassCircleButton
          icon="chevron-back"
          size={40}
          iconColor={TEXT_PRIMARY}
          onPress={() => router.back()}
          fallbackStyle={s.iconBtnFallback}
        />
        <Text style={s.headerTitle}>Diskussion</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Kartan högst upp — som Stravas diskussionsvy. Tryck öppnar
              hela passdetaljvyn med splits, karta och allt. */}
          {hasRoute && (
            <TouchableOpacity
              style={s.mapWrap}
              activeOpacity={0.9}
              onPress={() => setDetailOpen(true)}
              testID="postMap"
            >
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
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
            </TouchableOpacity>
          )}

          <View style={s.body}>
            <Text style={s.title}>{workout?.name || title}</Text>
            <Text style={s.metaRow}>
              {ownerName}
              {createdAt ? `  ·  ${relativeDayLabel(createdAt)}` : ''}
              {meta ? `  ·  ${meta}` : ''}
            </Text>

            {/* Gilla-raden: hjärta + antal + de som gillat */}
            <View style={s.likeRow}>
              <TouchableOpacity
                onPress={toggleLike}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID="postLike"
                style={s.likeBtn}
              >
                <Ionicons
                  name={likedByMe ? 'heart' : 'heart-outline'}
                  size={26}
                  color={likedByMe ? '#FF3B4A' : TEXT_PRIMARY}
                />
                {likes > 0 && <Text style={s.likeCount}>{likes}</Text>}
              </TouchableOpacity>
              <View style={s.likerAvatars}>
                {likers.slice(0, 5).map((p, i) => (
                  <View key={p.id} style={[s.likerAvatar, i > 0 && { marginLeft: -10 }]}>
                    <FeedAvatar
                      url={p.avatar_url}
                      fallback={(p.name ?? '?').charAt(0).toUpperCase()}
                      size={28}
                    />
                  </View>
                ))}
              </View>
            </View>

            <View style={s.divider} />

            {/* Kommentarstråden — tryck på en kommentar öppnar personens
                profil (egen kommentar → profilfliken) */}
            {comments.map(c => (
              <TouchableOpacity
                key={c.id}
                style={s.commentRow}
                activeOpacity={0.7}
                testID={`comment-${c.id}`}
                onPress={() => {
                  if (c.authorId === ownId) {
                    router.push('/(app)/profile' as never)
                  } else {
                    router.push({
                      pathname: '/(app)/athlete',
                      params: {
                        userId: c.authorId,
                        name: c.authorName ?? 'Namnlös',
                        avatar: c.authorAvatar ?? '',
                      },
                    } as never)
                  }
                }}
              >
                <FeedAvatar
                  url={c.authorAvatar}
                  fallback={(c.authorName ?? '?').charAt(0).toUpperCase()}
                  size={38}
                />
                <View style={{ flex: 1 }}>
                  <View style={s.commentHead}>
                    <Text style={s.commentName}>{c.authorName ?? 'Namnlös'}</Text>
                    <Text style={s.commentTime}>· {timeAgo(c.createdAt)}</Text>
                  </View>
                  <Text style={s.commentBody}>{c.body}</Text>
                </View>
              </TouchableOpacity>
            ))}
            {comments.length === 0 && (
              <Text style={s.emptyComments}>Inga kommentarer ännu — bli först!</Text>
            )}
          </View>
        </ScrollView>

        {/* Skrivfältet ligger fast i botten och lyfter med tangentbordet */}
        <View style={[s.inputRow, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            style={s.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Lägg till en kommentar"
            placeholderTextColor="rgba(255,255,255,0.35)"
            maxLength={500}
            multiline
            testID="commentInput"
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={draft.trim().length === 0 || sending}
            testID="commentSend"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {sending
              ? <ActivityIndicator color={ORANGE} size="small" />
              : (
                <Text style={[s.sendText, draft.trim().length === 0 && { opacity: 0.4 }]}>
                  Skicka
                </Text>
              )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Hela passdetaljvyn — samma som statistiken, skrivskyddat betyg
          på andras pass */}
      <Modal visible={detailOpen && !!workout} animationType="slide" onRequestClose={() => setDetailOpen(false)}>
        {workout && (
          <CardioSummaryView
            workout={workout}
            title={workout.name}
            dateLabel={new Date(workout.created_at).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
            avatarUrl={typeof params.ownerAvatar === 'string' && params.ownerAvatar ? params.ownerAvatar : null}
            unit={unit}
            onClose={() => setDetailOpen(false)}
            effortReadOnly={ownerId !== ownId}
            // Kommentarerna finns redan här under — stäng bara modalen
            social={{ postKey, ownerId, onOpenComments: () => setDetailOpen(false) }}
          />
        )}
      </Modal>
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
  headerTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  mapWrap: { height: 220 },
  map: { flex: 1 },
  routeDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: '#fff' },

  body: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 },
  title: { color: TEXT_PRIMARY, fontSize: 21, fontWeight: '800' },
  metaRow: { color: TEXT_SECONDARY, fontSize: 14, marginTop: 6 },

  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeCount: { color: TEXT_PRIMARY, fontSize: 16, fontFamily: NUM_FONT },
  likerAvatars: { flexDirection: 'row', alignItems: 'center' },
  likerAvatar: {
    borderWidth: 2, borderColor: BG, borderRadius: 16, overflow: 'hidden',
  },

  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 18,
  },

  commentRow: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
  commentTime: { color: TEXT_SECONDARY, fontSize: 12 },
  commentBody: { color: TEXT_PRIMARY, fontSize: 15, lineHeight: 21, marginTop: 3 },
  emptyComments: { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', paddingVertical: 20 },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 12,
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)',
    backgroundColor: BG,
  },
  input: {
    flex: 1, color: TEXT_PRIMARY, fontSize: 16,
    paddingVertical: 8, maxHeight: 110,
  },
  sendText: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700', paddingBottom: 8 },
})
