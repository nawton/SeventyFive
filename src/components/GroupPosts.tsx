import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
  ActionSheetIOS, Platform, Image, Modal, Dimensions,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { router, useFocusEffect } from 'expo-router'
import { AppTextInput } from '@/components/AppTextInput'
import { FeedAvatar, FeedWorkoutCard, type FeedPost } from '@/components/FeedWorkoutCard'
import { Ionicons } from '@/components/Icon'
import { compressImage } from '@/lib/image'
import { promptReport } from '@/lib/report'
import {
  getGroupPosts, createGroupPost, deleteGroupPost, setGroupPostPinned,
  type Group, type GroupPost,
} from '@/services/groups'
import {
  getFeedSocial, likePost, unlikePost, type PostSocial,
} from '@/services/social'
import {
  CARD, TEXT_PRIMARY, TEXT_SECONDARY, useThemeStrings, useCardChrome,
} from '@/lib/theme'

// =============================================================================
// GRUPPENS FLÖDE: textinlägg och pass blandade kronologiskt. Inläggen har
// samma gilla/kommentar-system som passen (grp-nycklar i post_likes/
// post_comments, diskussionen öppnas på samma sida). Ägaren kan fästa ett
// inlägg som alltid ligger överst. RLS avgör vem som får skriva och radera.
// =============================================================================

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'nu'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}

export function GroupPosts({
  group, me, isOwner,
  workoutPosts = [], workoutSocial = {},
  onToggleWorkoutLike = () => {}, onOpenWorkout = () => {}, onOpenWorkoutComments = () => {},
  avatarPressFor = () => undefined, menuFor = () => undefined,
  hasMore = false, loadingMore = false, onLoadMore = () => {}, feedNote,
}: {
  group: Group
  me: string | null
  isOwner: boolean
  /** Medlemmarnas pass, blandas in kronologiskt (tomt när flödet är av) */
  workoutPosts?: FeedPost[]
  workoutSocial?: Record<string, PostSocial>
  onToggleWorkoutLike?: (p: FeedPost) => void
  onOpenWorkout?: (p: FeedPost) => void
  onOpenWorkoutComments?: (p: FeedPost) => void
  avatarPressFor?: (p: FeedPost) => (() => void) | undefined
  menuFor?: (p: FeedPost) => (() => void) | undefined
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  /** Visas under flödet, t.ex. "aktivitetsflödet är avstängt" */
  feedNote?: string
}) {
  const T = useThemeStrings()
  const chrome = useCardChrome()
  const light = T.TEXT_PRIMARY !== '#FFFFFF'
  const pillEdge = light ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.35)'

  const [posts, setPosts] = useState<GroupPost[]>([])
  const [loaded, setLoaded] = useState(false)
  const [draft, setDraft] = useState('')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [social, setSocial] = useState<Record<string, PostSocial>>({})

  const load = useCallback(() => {
    getGroupPosts(group.id)
      .then(p => { setPosts(p); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [group.id])

  useFocusEffect(useCallback(() => { load() }, [load]))

  // Gillanden/kommentarsantal för inläggen, samma system som passen
  const keysOf = (list: GroupPost[]) => list.map(p => `grp-${p.id}`)
  const postKeysKey = keysOf(posts).join(',')
  useEffect(() => {
    if (posts.length === 0) return
    getFeedSocial(keysOf(posts)).then(m => setSocial(prev => ({ ...prev, ...m }))).catch(() => {})
    // postKeysKey fångar ändringar i uppsättningen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postKeysKey])

  const canPost = !group.only_owner_posts || isOwner

  // Blandat flöde: inlägg + pass i tidsordning, fäst inlägg alltid överst
  type FeedItem =
    | { kind: 'text'; post: GroupPost; at: string }
    | { kind: 'workout'; post: FeedPost; at: string }
  const items = useMemo<FeedItem[]>(() => {
    const textItems: FeedItem[] = posts.map(p => ({ kind: 'text', post: p, at: p.created_at }))
    const workoutItems: FeedItem[] = workoutPosts.map(p => ({ kind: 'workout', post: p, at: p.createdAt }))
    const all = [...textItems, ...workoutItems].sort((a, b) => b.at.localeCompare(a.at))
    const pinnedIdx = all.findIndex(i => i.kind === 'text' && i.post.pinned)
    if (pinnedIdx > 0) {
      const [pin] = all.splice(pinnedIdx, 1)
      all.unshift(pin)
    }
    return all
  }, [posts, workoutPosts])

  async function pickImage() {
    Haptics.selectionAsync()
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 })
    if (!res.canceled && res.assets[0]) {
      setImageUri(await compressImage(res.assets[0].uri))
    }
  }

  async function send() {
    const body = draft.trim()
    if ((!body && !imageUri) || sending) return
    setSending(true)
    Haptics.selectionAsync()
    try {
      await createGroupPost(group.id, body, { imageUri })
      setDraft(''); setImageUri(null)
      load()
    } catch {
      Alert.alert('Kunde inte publicera', 'Kontrollera anslutningen och försök igen.')
    } finally {
      setSending(false)
    }
  }

  /** Diskussionssidan, samma som för passen */
  function openDiscussion(post: GroupPost) {
    const excerpt = post.body
      ? (post.body.length > 60 ? `${post.body.slice(0, 60)}…` : post.body)
      : 'Bild'
    router.push({
      pathname: '/(app)/post',
      params: {
        postKey: `grp-${post.id}`,
        ownerId: post.author_id,
        ownerName: post.authorName ?? 'Namnlös',
        ownerAvatar: post.authorAvatar ?? '',
        kind: 'strength',   // hoppar över cardio-hämtningen, sidan är generisk
        title: excerpt,
        createdAt: post.created_at,
        meta: '',
      },
    } as never)
  }

  function toggleLike(post: GroupPost) {
    const key = `grp-${post.id}`
    const current = social[key] ?? { likes: 0, likedByMe: false, comments: 0 }
    const next = !current.likedByMe
    const apply = (likedByMe: boolean, delta: number) =>
      setSocial(prev => ({
        ...prev,
        [key]: {
          ...(prev[key] ?? current),
          likedByMe,
          likes: Math.max(0, (prev[key]?.likes ?? 0) + delta),
        },
      }))
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    apply(next, next ? 1 : -1)
    ;(next ? likePost(key, post.author_id) : unlikePost(key))
      .catch(() => apply(!next, next ? -1 : 1))
  }

  function postMenu(post: GroupPost) {
    const canDelete = post.author_id === me || isOwner
    const remove = () => deleteGroupPost(post.id).then(load).catch(() => {})
    const report = () => promptReport('post', `grp-${post.id}`, 'Anmäl inlägget')
    const togglePin = () => setGroupPostPinned(post.id, !post.pinned).then(load).catch(() => {})
    const options: Array<{ label: string; act: () => void; destructive?: boolean }> = []
    if (isOwner) options.push({ label: post.pinned ? 'Ta bort fästningen' : 'Fäst inlägget', act: togglePin })
    if (post.author_id !== me) options.push({ label: 'Anmäl inlägget', act: report })
    if (canDelete) options.push({ label: 'Radera inlägget', act: remove, destructive: true })
    if (options.length === 0) return
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Avbryt', ...options.map(o => o.label)],
          cancelButtonIndex: 0,
          destructiveButtonIndex: options.findIndex(o => o.destructive) >= 0
            ? options.findIndex(o => o.destructive) + 1 : undefined,
        },
        i => { if (i > 0) options[i - 1].act() },
      )
    } else {
      Alert.alert('Inlägg', undefined, [
        { text: 'Avbryt', style: 'cancel' },
        ...options.map(o => ({ text: o.label, onPress: o.act })),
      ])
    }
  }

  function TextPostCard({ post }: { post: GroupPost }) {
    const key = `grp-${post.id}`
    const st = social[key]
    return (
      <View style={[s.post, chrome]}>
        {post.pinned && (
          <View style={s.pinRow}>
            <Ionicons name="pin" size={12} color={T.ACCENT} />
            <Text style={[s.pinText, { color: T.ACCENT }]}>Fäst inlägg</Text>
          </View>
        )}
        <View style={s.postHead}>
          <FeedAvatar url={post.authorAvatar}
            fallback={(post.authorName ?? '?').charAt(0).toUpperCase()} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={s.postName} numberOfLines={1}>{post.authorName ?? 'Namnlös'}</Text>
            <Text style={s.postTime}>{timeAgo(post.created_at)}</Text>
          </View>
          <TouchableOpacity onPress={() => postMenu(post)} hitSlop={10} testID={`gpMenu-${post.id}`}>
            <Ionicons name="ellipsis-horizontal" size={17} color={TEXT_SECONDARY} />
          </TouchableOpacity>
        </View>
        {!!post.body && <Text style={s.postBody}>{post.body}</Text>}
        {!!post.image_url && (
          <TouchableOpacity activeOpacity={0.85} onPress={() => setViewerUrl(post.image_url)}>
            <Image source={{ uri: post.image_url }} style={s.postImage} />
          </TouchableOpacity>
        )}
        {/* Samma sociala rad som passen: hjärta + pratbubbla */}
        <View style={s.socialRow}>
          <TouchableOpacity style={s.socialBtn} hitSlop={8}
            onPress={() => toggleLike(post)} testID={`gpLike-${post.id}`}>
            <Ionicons
              name={st?.likedByMe ? 'heart' : 'heart-outline'}
              size={20}
              color={st?.likedByMe ? '#FF3B4A' : TEXT_SECONDARY}
            />
            {(st?.likes ?? 0) > 0 && <Text style={s.socialCount}>{st!.likes}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.socialBtn} hitSlop={8}
            onPress={() => openDiscussion(post)} testID={`gpComments-${post.id}`}>
            <Ionicons name="chatbubble-outline" size={18} color={TEXT_SECONDARY} />
            {(st?.comments ?? 0) > 0 && <Text style={s.socialCount}>{st!.comments}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View>
      <Text style={s.sectionLabel}>FLÖDE</Text>

      {canPost ? (
        <View style={[s.composerWrap, chrome]}>
          {imageUri && (
            <View style={s.attachRow}>
              <Image source={{ uri: imageUri }} style={s.attachThumb} />
              <TouchableOpacity onPress={() => setImageUri(null)} hitSlop={8}
                style={s.attachRemove} testID="removeImage">
                <Ionicons name="close-circle" size={20} color={TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>
          )}
          <View style={s.composer}>
            <TouchableOpacity onPress={pickImage} hitSlop={8} style={s.imageBtn} testID="pickImage">
              <Ionicons name="image-outline" size={21} color={TEXT_SECONDARY} />
            </TouchableOpacity>
            <AppTextInput
              style={s.composerInput}
              value={draft}
              onChangeText={t => setDraft(t.slice(0, 1000))}
              placeholder="Skriv något till gruppen…"
              multiline
              testID="postDraft"
            />
            <TouchableOpacity
              style={[s.sendBtn, { backgroundColor: T.ACCENT }, (!draft.trim() && !imageUri) || sending ? { opacity: 0.4 } : null]}
              onPress={send}
              disabled={(!draft.trim() && !imageUri) || sending}
              activeOpacity={0.8}
              testID="postSend"
            >
              {sending
                ? <ActivityIndicator size="small" color={light ? '#fff' : '#000'} />
                : <Ionicons name="arrow-up" size={17} color={light ? '#fff' : '#000'} />}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={s.lockedHint}>Bara skaparen kan skriva inlägg i den här gruppen.</Text>
      )}

      {loaded && items.length === 0 && (
        <Text style={s.empty}>
          {canPost ? 'Inget i flödet ännu, skriv gruppens första inlägg!' : 'Inget i flödet ännu.'}
        </Text>
      )}

      <View style={{ gap: 12, marginTop: items.length > 0 ? 10 : 0 }}>
        {items.map(item => item.kind === 'text' ? (
          <TextPostCard key={`t-${item.post.id}`} post={item.post} />
        ) : (
          <FeedWorkoutCard
            key={`w-${item.post.id}`}
            post={item.post}
            onOpen={onOpenWorkout}
            onAvatarPress={avatarPressFor(item.post)}
            social={workoutSocial[item.post.id]}
            onToggleLike={() => onToggleWorkoutLike(item.post)}
            onOpenComments={() => onOpenWorkoutComments(item.post)}
            onMenuPress={menuFor(item.post)}
          />
        ))}
        {hasMore && (
          <TouchableOpacity style={[s.moreBtn, { borderColor: pillEdge }]}
            onPress={onLoadMore} disabled={loadingMore} activeOpacity={0.8} testID="loadMore">
            {loadingMore
              ? <ActivityIndicator size="small" color={TEXT_SECONDARY} />
              : <Text style={s.moreText}>Visa fler pass</Text>}
          </TouchableOpacity>
        )}
      </View>

      {!!feedNote && <Text style={s.empty}>{feedNote}</Text>}

      {/* Bildvisare, tryck för att stänga */}
      <Modal visible={!!viewerUrl} transparent animationType="fade" onRequestClose={() => setViewerUrl(null)}>
        <TouchableOpacity style={s.viewerBackdrop} activeOpacity={1} onPress={() => setViewerUrl(null)}>
          {viewerUrl && (
            <Image source={{ uri: viewerUrl }}
              style={{ width: Dimensions.get('window').width - 24, height: '70%' }}
              resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  sectionLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 8, marginTop: 14, paddingHorizontal: 4,
  },
  composerWrap: { backgroundColor: CARD, borderRadius: 16, padding: 10 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composerInput: {
    flex: 1, fontSize: 15, maxHeight: 120,
    paddingHorizontal: 2, paddingVertical: 8,
  },
  imageBtn: { paddingBottom: 8, paddingLeft: 4 },
  sendBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  attachRow: { paddingHorizontal: 6, paddingBottom: 8 },
  attachThumb: { width: 72, height: 72, borderRadius: 10 },
  attachRemove: { position: 'absolute', top: -6, left: 62 },
  lockedHint: { color: TEXT_SECONDARY, fontSize: 13, paddingHorizontal: 4 },
  empty: { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', paddingVertical: 14 },

  post: { backgroundColor: CARD, borderRadius: 16, padding: 14 },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  pinText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.4 },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  postName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
  postTime: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 1 },
  postBody: { color: TEXT_PRIMARY, fontSize: 15, lineHeight: 21 },
  postImage: { width: '100%', height: 200, borderRadius: 12, marginTop: 8 },

  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 10 },
  socialBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  socialCount: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '700' },

  moreBtn: {
    borderWidth: 1.5, borderRadius: 999, paddingVertical: 12,
    alignItems: 'center', marginTop: 2,
  },
  moreText: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },

  viewerBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
})
