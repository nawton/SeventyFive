import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, Modal, Pressable, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { getComments, addComment, type PostComment } from '@/services/social'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { BG, CARD, BORDER, ORANGE, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

// =============================================================================
// KOMMENTARER — bottom sheet för ett flödesinlägg. Synligheten styrs av
// RLS (ägaren + godkända följare), så listan innehåller bara det man får
// se och skrivfältet fungerar bara på pass man har tillgång till.
// =============================================================================

function timeAgo(iso: string, now = new Date()): string {
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'nu'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}

export function CommentsSheet({ postKey, ownerId, onClose, onCommentAdded }: {
  /** null = stängt */
  postKey: string | null
  ownerId: string | null
  onClose: () => void
  /** Föräldern kan ticka upp sin kommentarsräknare direkt */
  onCommentAdded?: (postKey: string) => void
}) {
  const insets = useSafeAreaInsets()
  const [comments, setComments] = useState<PostComment[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!postKey) return
    let alive = true
    setLoading(true)
    setComments([])
    getComments(postKey)
      .then(rows => { if (alive) setComments(rows) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [postKey])

  async function handleSend() {
    const body = draft.trim()
    if (!postKey || !ownerId || body.length === 0 || sending) return
    setSending(true)
    try {
      await addComment(postKey, ownerId, body)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setDraft('')
      onCommentAdded?.(postKey)
      const rows = await getComments(postKey)
      setComments(rows)
    } catch {
      // RLS stoppar kommentarer på pass man inte får se — behåll utkastet
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal visible={postKey !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.sheet, { paddingBottom: insets.bottom + 10 }]}>
          <View style={s.handle} />
          <Text style={s.title}>Kommentarer</Text>

          <FlatList
            data={comments}
            keyExtractor={c => c.id}
            style={{ maxHeight: 320 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <View style={s.row}>
                <FeedAvatar
                  url={item.authorAvatar}
                  fallback={(item.authorName ?? '?').charAt(0).toUpperCase()}
                  size={34}
                />
                <View style={{ flex: 1 }}>
                  <View style={s.rowHead}>
                    <Text style={s.rowName}>{item.authorName ?? 'Namnlös'}</Text>
                    <Text style={s.rowTime}>{timeAgo(item.createdAt)}</Text>
                  </View>
                  <Text style={s.rowBody}>{item.body}</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator color={ORANGE} style={{ paddingVertical: 24 }} />
              ) : (
                <Text style={s.empty}>Inga kommentarer ännu — bli först!</Text>
              )
            }
          />

          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Skriv en kommentar…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              maxLength={500}
              multiline
              testID="commentInput"
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={draft.trim().length === 0 || sending}
              style={[s.sendBtn, (draft.trim().length === 0 || sending) && { opacity: 0.4 }]}
              testID="commentSend"
            >
              {sending
                ? <ActivityIndicator color="#000" size="small" />
                : <Ionicons name="arrow-up" size={18} color="#000" />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 18, paddingTop: 10,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 12,
  },
  title: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 10 },

  row: { flexDirection: 'row', gap: 10, paddingVertical: 9 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700' },
  rowTime: { color: TEXT_SECONDARY, fontSize: 11 },
  rowBody: { color: TEXT_PRIMARY, fontSize: 14, lineHeight: 20, marginTop: 2 },
  empty: { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', paddingVertical: 24 },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  input: {
    flex: 1, color: TEXT_PRIMARY, fontSize: 15,
    backgroundColor: CARD, borderRadius: 18,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
  },
})
