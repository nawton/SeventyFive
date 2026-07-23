import { useCallback, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
  ActionSheetIOS, Platform, Image, Modal, Dimensions,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect } from 'expo-router'
import { AppTextInput } from '@/components/AppTextInput'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { Ionicons } from '@/components/Icon'
import { compressImage } from '@/lib/image'
import { promptReport } from '@/lib/report'
import {
  getGroupPosts, createGroupPost, deleteGroupPost, type Group, type GroupPost,
} from '@/services/groups'
import {
  CARD, TEXT_PRIMARY, TEXT_SECONDARY, useThemeStrings, useCardChrome,
} from '@/lib/theme'

// =============================================================================
// GRUPPINLÄGG, "Post something": composer med bildstöd, svar som visas
// indraget under sitt inlägg. Vem som får skriva och radera avgörs av RLS;
// komponenten speglar bara reglerna.
// =============================================================================

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'nu'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}

export function GroupPosts({ group, me, isOwner }: {
  group: Group
  me: string | null
  isOwner: boolean
}) {
  const T = useThemeStrings()
  const chrome = useCardChrome()
  const light = T.TEXT_PRIMARY !== '#FFFFFF'

  const [posts, setPosts] = useState<GroupPost[]>([])
  const [loaded, setLoaded] = useState(false)
  const [draft, setDraft] = useState('')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<GroupPost | null>(null)
  const [sending, setSending] = useState(false)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)

  const load = useCallback(() => {
    getGroupPosts(group.id)
      .then(p => { setPosts(p); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [group.id])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const canPost = !group.only_owner_posts || isOwner

  // Trådning: föräldrar i tidsordning, svar grupperade under sin förälder
  const threads = useMemo(() => {
    const parents = posts.filter(p => !p.reply_to)
    const replies = new Map<string, GroupPost[]>()
    for (const p of posts) {
      if (!p.reply_to) continue
      const list = replies.get(p.reply_to)
      if (list) list.push(p)
      else replies.set(p.reply_to, [p])
    }
    // Svar äldst först så tråden läses uppifrån och ner
    for (const list of replies.values()) list.reverse()
    return parents.map(p => ({ post: p, replies: replies.get(p.id) ?? [] }))
  }, [posts])

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
      await createGroupPost(group.id, body, { replyTo: replyTo?.id ?? null, imageUri })
      setDraft(''); setImageUri(null); setReplyTo(null)
      load()
    } catch {
      Alert.alert('Kunde inte publicera', 'Kontrollera anslutningen och försök igen.')
    } finally {
      setSending(false)
    }
  }

  function postMenu(post: GroupPost) {
    const canDelete = post.author_id === me || isOwner
    const remove = () => deleteGroupPost(post.id).then(load).catch(() => {})
    const report = () => promptReport('post', `grp-${post.id}`, 'Anmäl inlägget')
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: canDelete
            ? ['Avbryt', ...(post.author_id !== me ? ['Anmäl inlägget'] : []), 'Radera inlägget']
            : ['Avbryt', 'Anmäl inlägget'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: canDelete ? (post.author_id !== me ? 2 : 1) : undefined,
        },
        i => {
          if (!canDelete) { if (i === 1) report(); return }
          if (post.author_id !== me) {
            if (i === 1) report(); else if (i === 2) remove()
          } else if (i === 1) remove()
        },
      )
    } else {
      Alert.alert('Inlägg', undefined, [
        { text: 'Avbryt', style: 'cancel' },
        ...(post.author_id !== me ? [{ text: 'Anmäl inlägget', onPress: report }] : []),
        ...(canDelete ? [{ text: 'Radera inlägget', onPress: remove }] : []),
      ])
    }
  }

  function startReply(post: GroupPost) {
    Haptics.selectionAsync()
    setReplyTo(post)
  }

  function PostCard({ post, isReply }: { post: GroupPost; isReply: boolean }) {
    return (
      <View style={[isReply ? s.reply : s.post, !isReply && chrome]}>
        <View style={s.postHead}>
          <FeedAvatar url={post.authorAvatar}
            fallback={(post.authorName ?? '?').charAt(0).toUpperCase()} size={isReply ? 28 : 36} />
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
        {canPost && (
          <TouchableOpacity onPress={() => startReply(post)} hitSlop={8} style={s.replyBtn}
            testID={`reply-${post.id}`}>
            <Ionicons name="arrow-undo-outline" size={13} color={TEXT_SECONDARY} />
            <Text style={s.replyBtnText}>Svara</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <View>
      <Text style={s.sectionLabel}>INLÄGG</Text>

      {canPost ? (
        <View style={[s.composerWrap, chrome]}>
          {replyTo && (
            <View style={s.replyingRow}>
              <Text style={s.replyingText} numberOfLines={1}>
                Svarar {replyTo.authorName ?? 'Namnlös'}
              </Text>
              <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={8} testID="cancelReply">
                <Ionicons name="close-circle" size={18} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>
          )}
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
              placeholder={replyTo ? 'Skriv ditt svar…' : 'Skriv något till gruppen…'}
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

      {loaded && posts.length === 0 && canPost && (
        <Text style={s.empty}>Inga inlägg ännu, skriv gruppens första!</Text>
      )}

      <View style={{ gap: 10, marginTop: threads.length > 0 ? 10 : 0 }}>
        {threads.map(({ post, replies }) => (
          <View key={post.id}>
            <PostCard post={post} isReply={false} />
            {replies.length > 0 && (
              <View style={s.replyList}>
                {replies.map(r => <PostCard key={r.id} post={r} isReply />)}
              </View>
            )}
          </View>
        ))}
      </View>

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
  replyingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 6, paddingBottom: 6,
  },
  replyingText: { flex: 1, color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  attachRow: { paddingHorizontal: 6, paddingBottom: 8 },
  attachThumb: { width: 72, height: 72, borderRadius: 10 },
  attachRemove: { position: 'absolute', top: -6, left: 62 },
  lockedHint: { color: TEXT_SECONDARY, fontSize: 13, paddingHorizontal: 4 },
  empty: { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', paddingVertical: 14 },

  post: { backgroundColor: CARD, borderRadius: 16, padding: 14 },
  replyList: { marginLeft: 26, marginTop: 6, gap: 6 },
  reply: {
    backgroundColor: CARD, borderRadius: 14, padding: 12,
    borderLeftWidth: 2, borderLeftColor: 'rgba(128,128,128,0.35)',
  },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  postName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
  postTime: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 1 },
  postBody: { color: TEXT_PRIMARY, fontSize: 15, lineHeight: 21 },
  postImage: { width: '100%', height: 200, borderRadius: 12, marginTop: 8 },
  replyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', marginTop: 9,
  },
  replyBtnText: { color: TEXT_SECONDARY, fontSize: 12.5, fontWeight: '600' },

  viewerBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
})
