import { useCallback, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, Dimensions,
} from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { GlassCircleButton } from '@/components/GlassButton'
import { AppTextInput } from '@/components/AppTextInput'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { Ionicons } from '@/components/Icon'
import { compressImage } from '@/lib/image'
import {
  getThread, sendMessage, markThreadRead, subscribeToMessages, type DirectMessage,
} from '@/services/messages'
import { BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, useThemeStrings } from '@/lib/theme'

// =============================================================================
// CHATT, tråden med EN person: bubblor (egna i accent till höger, deras
// på kort till vänster), bilder, realtidsuppdatering och läskvitton.
// Vem som får skriva till vem avgörs av databasen (can_message).
// =============================================================================

export default function ChatScreen() {
  const params = useLocalSearchParams<{ userId?: string; name?: string; avatar?: string }>()
  const otherId = typeof params.userId === 'string' ? params.userId : null
  const otherName = typeof params.name === 'string' && params.name ? params.name : 'Chatt'
  const otherAvatar = typeof params.avatar === 'string' && params.avatar ? params.avatar : null
  const T = useThemeStrings()
  const light = T.TEXT_PRIMARY !== '#FFFFFF'

  const [me, setMe] = useState<string | null>(null)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [draft, setDraft] = useState('')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const listRef = useRef<FlatList<DirectMessage>>(null)

  const load = useCallback(async (uid: string) => {
    if (!otherId) return
    setMessages(await getThread(uid, otherId))
    markThreadRead(otherId).catch(() => {})
  }, [otherId])

  useFocusEffect(useCallback(() => {
    let alive = true
    let unsub: (() => void) | null = null
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user || !alive) return
      const uid = session.user.id
      setMe(uid)
      load(uid).catch(() => {})
      unsub = subscribeToMessages(uid, () => load(uid).catch(() => {}))
    })
    return () => { alive = false; unsub?.() }
  }, [load]))

  async function pickImage() {
    Haptics.selectionAsync()
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 })
    if (!res.canceled && res.assets[0]) {
      setImageUri(await compressImage(res.assets[0].uri))
    }
  }

  async function send() {
    const body = draft.trim()
    if ((!body && !imageUri) || sending || !otherId || !me) return
    setSending(true)
    Haptics.selectionAsync()
    try {
      await sendMessage(otherId, body, imageUri)
      setDraft(''); setImageUri(null)
      await load(me)
    } catch {
      Alert.alert('Kunde inte skicka',
        'Ni behöver följa varandra eller vara med i samma grupp för att skicka meddelanden.')
    } finally {
      setSending(false)
    }
  }

  // Inverterad lista vill ha nyast först
  const inverted = [...messages].reverse()

  return (
    <SafeScreen style={s.screen}>
      <View style={s.header}>
        <GlassCircleButton icon="chevron-back" size={40} iconColor={TEXT_PRIMARY}
          onPress={() => router.back()} fallbackStyle={s.iconFallback} />
        <TouchableOpacity style={s.headerPerson} activeOpacity={0.7}
          onPress={() => otherId && router.push({
            pathname: '/(app)/athlete',
            params: { userId: otherId, name: otherName, avatar: otherAvatar ?? '' },
          } as never)}>
          <FeedAvatar url={otherAvatar} fallback={otherName.charAt(0).toUpperCase()} size={32} />
          <Text style={s.headerTitle} numberOfLines={1}>{otherName}</Text>
        </TouchableOpacity>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={inverted}
          inverted
          keyExtractor={m => m.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const own = item.sender_id === me
            return (
              <View style={[s.bubbleRow, own && { justifyContent: 'flex-end' }]}>
                <View style={[
                  s.bubble,
                  own ? { backgroundColor: T.ACCENT } : { backgroundColor: CARD },
                ]}>
                  {!!item.image_url && (
                    <TouchableOpacity activeOpacity={0.85} onPress={() => setViewerUrl(item.image_url)}>
                      <Image source={{ uri: item.image_url }} style={s.bubbleImage} />
                    </TouchableOpacity>
                  )}
                  {!!item.body && (
                    <Text style={[s.bubbleText, own && { color: light ? '#FFFFFF' : '#000000' }]}>
                      {item.body}
                    </Text>
                  )}
                  <Text style={[s.bubbleTime, own && { color: light ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)' }]}>
                    {new Date(item.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            )
          }}
          ListEmptyComponent={
            <View style={s.emptyFlip}>
              <Text style={s.emptyText}>
                Inga meddelanden ännu, säg hej till {otherName.split(' ')[0]}!
              </Text>
            </View>
          }
        />

        {imageUri && (
          <View style={s.attachRow}>
            <Image source={{ uri: imageUri }} style={s.attachThumb} />
            <TouchableOpacity onPress={() => setImageUri(null)} hitSlop={8} style={s.attachRemove}>
              <Ionicons name="close-circle" size={20} color={TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>
        )}
        <View style={s.inputRow}>
          <TouchableOpacity onPress={pickImage} hitSlop={8} style={s.imageBtn} testID="chatImage">
            <Ionicons name="image-outline" size={22} color={TEXT_SECONDARY} />
          </TouchableOpacity>
          <AppTextInput
            style={s.input}
            value={draft}
            onChangeText={t => setDraft(t.slice(0, 2000))}
            placeholder="Skriv ett meddelande…"
            multiline
            testID="chatDraft"
          />
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: T.ACCENT }, ((!draft.trim() && !imageUri) || sending) && { opacity: 0.4 }]}
            onPress={send}
            disabled={(!draft.trim() && !imageUri) || sending}
            activeOpacity={0.8}
            testID="chatSend"
          >
            {sending
              ? <ActivityIndicator size="small" color={light ? '#fff' : '#000'} />
              : <Ionicons name="arrow-up" size={18} color={light ? '#fff' : '#000'} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!viewerUrl} transparent animationType="fade" onRequestClose={() => setViewerUrl(null)}>
        <TouchableOpacity style={s.viewerBackdrop} activeOpacity={1} onPress={() => setViewerUrl(null)}>
          {viewerUrl && (
            <Image source={{ uri: viewerUrl }}
              style={{ width: Dimensions.get('window').width - 24, height: '70%' }}
              resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>
    </SafeScreen>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, paddingHorizontal: 16, paddingVertical: 8,
  },
  iconFallback: { backgroundColor: CARD },
  headerPerson: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, justifyContent: 'center' },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },

  listContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleText: { color: TEXT_PRIMARY, fontSize: 15, lineHeight: 21 },
  bubbleImage: { width: 210, height: 160, borderRadius: 10, marginBottom: 5 },
  bubbleTime: { color: TEXT_SECONDARY, fontSize: 10.5, marginTop: 4, alignSelf: 'flex-end' },
  // inverterad lista vänder på allt, vänd tillbaka tomläget
  emptyFlip: { transform: [{ scaleY: -1 }], paddingVertical: 40 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center' },

  attachRow: { paddingHorizontal: 16, paddingBottom: 4 },
  attachThumb: { width: 64, height: 64, borderRadius: 10 },
  attachRemove: { position: 'absolute', top: -6, left: 70 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingBottom: 8, paddingTop: 4,
  },
  imageBtn: { paddingBottom: 9, paddingLeft: 2 },
  input: {
    flex: 1, backgroundColor: CARD, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, maxHeight: 110,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginBottom: 1,
  },
  viewerBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
})
