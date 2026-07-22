import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import MapView, { Polyline, Marker } from 'react-native-maps'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import type { CardioWorkout } from '@/services/cardioWorkouts'
import { getSharedWorkout } from '@/services/feed'
import {
  getFeedSocial, getPostLikers, getComments, addComment, deleteComment,
  likePost, unlikePost, likeComment, unlikeComment, getCommentLikers,
  type PostComment,
} from '@/services/social'
import { LikersSheet } from '@/components/LikersSheet'
import { reportContent } from '@/services/reports'
import type { FollowProfile } from '@/services/follows'
import { FeedAvatar, relativeDayLabel, regionForRoute } from '@/components/FeedWorkoutCard'
import { GlassCircleButton } from '@/components/GlassButton'
import { CardioSummaryView } from '@/components/CardioSummaryView'
import { getUnitSystem, type UnitSystem } from '@/lib/units'
import { timeAgo } from '@/lib/format'
import { BG, CARD, BORDER, CARDIO_BLUE, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, DIVIDER, ACCENT } from '@/lib/theme'

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
  // Gillarlistan för en kommentar — null = stängd
  const [likersFor, setLikersFor] = useState<{ count: number; list: FollowProfile[] } | null>(null)

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
      // Serverstrippad läsväg — rutten följer med bara om ägaren delar kartor
      getSharedWorkout(postKey)
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

  // Gillamarkeringstexten öppnar den dragbara gillarlistan
  function openCommentLikers(c: PostComment) {
    getCommentLikers(c.id)
      .then(list => setLikersFor({ count: list.length, list }))
      .catch(() => {})
  }

  // Hjärtat under en kommentar — optimistiskt, backas vid fel
  function toggleCommentLike(c: PostComment) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const next = !c.likedByMe
    const apply = (likedByMe: boolean, delta: number) =>
      setComments(prev => prev.map(x => x.id === c.id
        ? { ...x, likedByMe, likes: Math.max(0, x.likes + delta) }
        : x))
    apply(next, next ? 1 : -1)
    ;(next ? likeComment(c.id) : unlikeComment(c.id))
      .catch(() => apply(!next, next ? -1 : 1))
  }

  // Long-press: rapportera andras kommentarer; radera egna och alla på
  // ens eget pass (samma regler som databasens RLS)
  function handleLongPressComment(c: PostComment) {
    const canDelete = c.authorId === ownId || ownerId === ownId
    const canReport = c.authorId !== ownId
    if (!canDelete && !canReport) return
    const buttons: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = []
    if (canReport) {
      buttons.push({
        text: 'Rapportera',
        onPress: () => {
          reportContent('comment', c.id)
            .then(() => Alert.alert('Tack', 'Rapporten är mottagen och granskas av teamet.'))
            .catch(() => {})
        },
      })
    }
    if (canDelete) {
      buttons.push({
        text: 'Radera',
        style: 'destructive',
        onPress: () => {
          setComments(prev => prev.filter(x => x.id !== c.id))
          deleteComment(c.id).catch(() => {
            getComments(postKey).then(setComments).catch(() => {})
          })
        },
      })
    }
    buttons.push({ text: 'Avbryt', style: 'cancel' })
    Alert.alert('Kommentar', `”${c.body}”`, buttons)
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
    <SafeScreen style={s.screen} edges={['top']}>
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

            {/* Gilla-raden: hjärtat togglar, räknaren och avatarerna öppnar
                gillarlistan */}
            <View style={s.likeRow}>
              <TouchableOpacity
                onPress={toggleLike}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID="postLike"
              >
                <Ionicons
                  name={likedByMe ? 'heart' : 'heart-outline'}
                  size={26}
                  color={likedByMe ? '#FF3B4A' : TEXT_PRIMARY}
                />
              </TouchableOpacity>
              {likes > 0 && (
                <TouchableOpacity
                  style={s.likeBtn}
                  onPress={() => setLikersFor({ count: likes, list: likers })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  testID="postLikers"
                >
                  <Text style={s.likeCount}>{likes}</Text>
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
                </TouchableOpacity>
              )}
            </View>

            <View style={s.divider} />

            {/* Kommentarstråden — tryck öppnar personens profil (egen
                kommentar → profilfliken), long-press raderar när man får */}
            {comments.map(c => (
              <TouchableOpacity
                key={c.id}
                style={s.commentRow}
                activeOpacity={0.7}
                testID={`comment-${c.id}`}
                onLongPress={() => handleLongPressComment(c)}
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
                  {/* Hjärtat togglar; gillamarkeringstexten öppnar listan */}
                  <View style={s.commentLike}>
                    <TouchableOpacity
                      onPress={() => toggleCommentLike(c)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      testID={`commentLike-${c.id}`}
                    >
                      <Ionicons
                        name={c.likedByMe ? 'heart' : 'heart-outline'}
                        size={16}
                        color={c.likedByMe ? '#FF3B4A' : TEXT_SECONDARY}
                      />
                    </TouchableOpacity>
                    {c.likes > 0 && (
                      <TouchableOpacity
                        onPress={() => openCommentLikers(c)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        testID={`commentLikers-${c.id}`}
                      >
                        <Text style={s.commentLikeCount}>
                          {c.likes === 1 ? '1 gillamarkering' : `${c.likes} gillamarkeringar`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
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
              ? <ActivityIndicator color={ACCENT} size="small" />
              : (
                <Text style={[s.sendText, draft.trim().length === 0 && { opacity: 0.4 }]}>
                  Skicka
                </Text>
              )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Dragbar gillarlista: halvvägs upp, dra upp för helskärm eller
          ner för att stänga */}
      <LikersSheet
        likers={likersFor?.list ?? null}
        count={likersFor?.count ?? 0}
        onClose={() => setLikersFor(null)}
        onPressPerson={p => {
          setLikersFor(null)
          if (p.id === ownId) {
            router.push('/(app)/profile' as never)
          } else {
            router.push({
              pathname: '/(app)/athlete',
              params: { userId: p.id, name: p.name ?? 'Namnlös', avatar: p.avatar_url ?? '' },
            } as never)
          }
        }}
      />

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
    </SafeScreen>
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

  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  likeCount: { color: TEXT_PRIMARY, fontSize: 16, fontFamily: NUM_FONT },
  likerAvatars: { flexDirection: 'row', alignItems: 'center' },
  likerAvatar: {
    borderWidth: 2, borderColor: BG, borderRadius: 16, overflow: 'hidden',
  },

  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: DIVIDER,
    marginVertical: 18,
  },

  commentRow: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
  commentTime: { color: TEXT_SECONDARY, fontSize: 12 },
  commentBody: { color: TEXT_PRIMARY, fontSize: 15, lineHeight: 21, marginTop: 3 },
  commentLike: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', marginTop: 7,
  },
  commentLikeCount: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '700' },
  emptyComments: { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', paddingVertical: 20 },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 12,
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER,
    backgroundColor: BG,
  },
  input: {
    flex: 1, color: TEXT_PRIMARY, fontSize: 16,
    paddingVertical: 8, maxHeight: 110,
  },
  sendText: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700', paddingBottom: 8 },
})
