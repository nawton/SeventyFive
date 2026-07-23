import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
  ActionSheetIOS, Platform,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { useFocusEffect } from 'expo-router'
import { AppTextInput } from '@/components/AppTextInput'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { Ionicons } from '@/components/Icon'
import { promptReport } from '@/lib/report'
import {
  getGroupPosts, createGroupPost, deleteGroupPost, type Group, type GroupPost,
} from '@/services/groups'
import {
  CARD, TEXT_PRIMARY, TEXT_SECONDARY, useThemeStrings, useCardChrome,
} from '@/lib/theme'

// =============================================================================
// GRUPPINLÄGG — "Post something": composer + de senaste inläggen. Vem som
// får skriva och radera avgörs av RLS; komponenten speglar bara reglerna.
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
  const [sending, setSending] = useState(false)

  const load = useCallback(() => {
    getGroupPosts(group.id)
      .then(p => { setPosts(p); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [group.id])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const canPost = !group.only_owner_posts || isOwner

  async function send() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    Haptics.selectionAsync()
    try {
      await createGroupPost(group.id, body)
      setDraft('')
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

  return (
    <View>
      <Text style={s.sectionLabel}>INLÄGG</Text>

      {canPost ? (
        <View style={[s.composer, chrome]}>
          <AppTextInput
            style={s.composerInput}
            value={draft}
            onChangeText={t => setDraft(t.slice(0, 1000))}
            placeholder="Skriv något till gruppen…"
            multiline
            testID="postDraft"
          />
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: T.ACCENT }, (!draft.trim() || sending) && { opacity: 0.4 }]}
            onPress={send}
            disabled={!draft.trim() || sending}
            activeOpacity={0.8}
            testID="postSend"
          >
            {sending
              ? <ActivityIndicator size="small" color={light ? '#fff' : '#000'} />
              : <Ionicons name="arrow-up" size={17} color={light ? '#fff' : '#000'} />}
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={s.lockedHint}>Bara skaparen kan skriva inlägg i den här gruppen.</Text>
      )}

      {loaded && posts.length === 0 && canPost && (
        <Text style={s.empty}>Inga inlägg ännu — skriv gruppens första!</Text>
      )}

      <View style={{ gap: 10, marginTop: posts.length > 0 ? 10 : 0 }}>
        {posts.map(post => (
          <View key={post.id} style={[s.post, chrome]}>
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
            <Text style={s.postBody}>{post.body}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  sectionLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 8, marginTop: 14, paddingHorizontal: 4,
  },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    backgroundColor: CARD, borderRadius: 16, padding: 10,
  },
  composerInput: {
    flex: 1, fontSize: 15, maxHeight: 120,
    paddingHorizontal: 6, paddingVertical: 8,
  },
  sendBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  lockedHint: { color: TEXT_SECONDARY, fontSize: 13, paddingHorizontal: 4 },
  empty: { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', paddingVertical: 14 },

  post: { backgroundColor: CARD, borderRadius: 16, padding: 14 },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  postName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
  postTime: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 1 },
  postBody: { color: TEXT_PRIMARY, fontSize: 15, lineHeight: 21 },
})
