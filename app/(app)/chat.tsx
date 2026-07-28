import { useCallback, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, Dimensions,
  ActionSheetIOS,
} from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated'
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
  getThread, sendMessage, markThreadRead, subscribeToMessages, deleteMessage,
  getMessageReactions, setReaction, removeReaction,
  type DirectMessage, type MessageReaction,
} from '@/services/messages'
import { blockUser } from '@/services/blocks'
import { promptReport } from '@/lib/report'
import { BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, useThemeStrings } from '@/lib/theme'
import { useT, dateLocale } from '@/lib/i18n'

// =============================================================================
// CHATT, tråden med EN person: bubblor (egna i accent till höger, deras
// på kort till vänster), bilder, realtidsuppdatering och läskvitton.
// Vem som får skriva till vem avgörs av databasen (can_message).
// =============================================================================

export default function ChatScreen() {
  const t = useT()
  const params = useLocalSearchParams<{ userId?: string; name?: string; avatar?: string }>()
  const otherId = typeof params.userId === 'string' ? params.userId : null
  const otherName = typeof params.name === 'string' && params.name ? params.name : t('Chatt')
  const otherAvatar = typeof params.avatar === 'string' && params.avatar ? params.avatar : null
  const T = useThemeStrings()
  const light = T.TEXT_PRIMARY !== '#FFFFFF'
  const insets = useSafeAreaInsets()

  const [me, setMe] = useState<string | null>(null)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [draft, setDraft] = useState('')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [reactions, setReactions] = useState<Record<string, MessageReaction[]>>({})
  const [reactFor, setReactFor] = useState<DirectMessage | null>(null)
  const listRef = useRef<FlatList<DirectMessage>>(null)

  const load = useCallback(async (uid: string) => {
    if (!otherId) return
    const thread = await getThread(uid, otherId)
    setMessages(thread)
    getMessageReactions(thread.map(m => m.id)).then(setReactions).catch(() => {})
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
    const image = imageUri
    Haptics.selectionAsync()
    // Optimistiskt: bubblan visas direkt, servern bekräftar i bakgrunden.
    // Vid fel plockas den bort och utkastet läggs tillbaka.
    const temp: DirectMessage = {
      id: `temp-${Date.now()}`,
      sender_id: me,
      recipient_id: otherId,
      body,
      image_url: image,
      created_at: new Date().toISOString(),
      read_at: null,
    }
    setDraft(''); setImageUri(null); setSending(true)
    setMessages(prev => [...prev, temp])
    try {
      await sendMessage(otherId, body, image)
      await load(me)
    } catch {
      setMessages(prev => prev.filter(m => m.id !== temp.id))
      setDraft(body); setImageUri(image)
      Alert.alert(t('Kunde inte skicka'),
        t('Ni behöver följa varandra eller vara med i samma grupp för att skicka meddelanden.'))
    } finally {
      setSending(false)
    }
  }

  /** ⋯ i headern: anmäl eller blockera — rapportvägen ska finnas där
      innehållet visas */
  function chatMenu() {
    if (!otherId) return
    const report = () => promptReport('user', otherId, t('Anmäl {name}', { name: otherName }))
    const block = () => Alert.alert(
      t('Blockera {name}?', { name: otherName }),
      t('Ni kan inte längre se varandra, följa varandra eller skicka meddelanden.'),
      [
        { text: t('Avbryt'), style: 'cancel' },
        { text: t('Blockera'), style: 'destructive', onPress: () => {
          blockUser(otherId).then(() => router.back()).catch(() =>
            Alert.alert(t('Kunde inte blockera'), t('Kontrollera anslutningen och försök igen.')))
        } },
      ],
    )
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('Avbryt'), t('Anmäl användaren'), t('Blockera')],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        i => { if (i === 1) report(); else if (i === 2) block() },
      )
    } else {
      Alert.alert(otherName, undefined, [
        { text: t('Avbryt'), style: 'cancel' },
        { text: t('Anmäl användaren'), onPress: report },
        { text: t('Blockera'), onPress: block },
      ])
    }
  }

  /** Långtryck öppnar reaktionsväljaren (+ radera för egna meddelanden) */
  const REACTION_EMOJIS = ['❤️', '👍', '👎', '😂', '😮', '🔥']

  function openReactions(m: DirectMessage) {
    if (m.id.startsWith('temp-')) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setReactFor(m)
  }

  function pickReaction(emoji: string) {
    const m = reactFor
    if (!m || !me) return
    setReactFor(null)
    Haptics.selectionAsync()
    const mineNow = reactions[m.id]?.find(r => r.user_id === me)
    // Optimistiskt: samma emoji igen tar bort, annars sätt/byt
    if (mineNow?.emoji === emoji) {
      setReactions(prev => ({
        ...prev,
        [m.id]: (prev[m.id] ?? []).filter(r => r.user_id !== me),
      }))
      removeReaction(m.id).catch(() => { if (me) load(me).catch(() => {}) })
    } else {
      setReactions(prev => ({
        ...prev,
        [m.id]: [
          ...(prev[m.id] ?? []).filter(r => r.user_id !== me),
          { message_id: m.id, user_id: me, emoji },
        ],
      }))
      setReaction(m.id, emoji).catch(() => { if (me) load(me).catch(() => {}) })
    }
  }

  function deleteFromSheet() {
    const m = reactFor
    if (!m) return
    setReactFor(null)
    deleteMessage(m.id)
      .then(() => { if (me) load(me).catch(() => {}) })
      .catch(() => {})
  }

  // Tiderna ligger gömda utanför högerkanten (som i Meddelanden): dra
  // listan åt vänster så glider de fram, släpp så fjädrar allt tillbaka.
  // Färgerna bor på barnen — dynamiska färger på animerade noder kraschar.
  const dragX = useSharedValue(0)
  const timePan = Gesture.Pan()
    .activeOffsetX(-15)
    .failOffsetY([-12, 12])
    .onUpdate(e => { dragX.value = Math.max(-72, Math.min(0, e.translationX)) })
    // Ease-out utan studs — glider mjukt tillbaka till helskärm
    .onEnd(() => { dragX.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }) })
  const rowAnim = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.value }] }))

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
        <GlassCircleButton icon="ellipsis-horizontal" size={40} iconColor={TEXT_PRIMARY}
          onPress={chatMenu} fallbackStyle={s.iconFallback} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <GestureDetector gesture={timePan}>
        <FlatList
          ref={listRef}
          data={inverted}
          inverted
          keyExtractor={m => m.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const own = item.sender_id === me
            const reacts = reactions[item.id] ?? []
            return (
              <Animated.View style={[s.bubbleRow, own && { justifyContent: 'flex-end' }, rowAnim]}>
                <View style={{ maxWidth: '78%', alignItems: own ? 'flex-end' : 'flex-start' }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onLongPress={() => openReactions(item)}
                    delayLongPress={350}
                    style={[
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
                  </TouchableOpacity>
                  {reacts.length > 0 && (
                    <View style={[s.reactBadge, { borderColor: light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.18)' }]}>
                      <Text style={s.reactBadgeText}>{reacts.map(r => r.emoji).join(' ')}</Text>
                    </View>
                  )}
                </View>
                {/* Tiden gömd utanför kanten — glider fram vid vänsterdrag */}
                <View style={s.timeReveal} pointerEvents="none">
                  <Text style={s.timeRevealText}>
                    {new Date(item.created_at).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </Animated.View>
            )
          }}
          ListEmptyComponent={
            <View style={s.emptyFlip}>
              <Text style={s.emptyText}>
                {t('Inga meddelanden ännu, säg hej till {name}!', { name: otherName.split(' ')[0] })}
              </Text>
            </View>
          }
        />
        </GestureDetector>

        {imageUri && (
          <View style={s.attachRow}>
            <Image source={{ uri: imageUri }} style={s.attachThumb} />
            <TouchableOpacity onPress={() => setImageUri(null)} hitSlop={8} style={s.attachRemove}>
              <Ionicons name="close-circle" size={20} color={TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>
        )}
        <View style={[s.inputRow, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TouchableOpacity onPress={pickImage} hitSlop={8} style={s.imageBtn} testID="chatImage">
            <Ionicons name="image-outline" size={22} color={TEXT_SECONDARY} />
          </TouchableOpacity>
          <AppTextInput
            style={s.input}
            value={draft}
            onChangeText={v => setDraft(v.slice(0, 2000))}
            placeholder={t('Skriv ett meddelande…')}
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

      {/* Reaktionsväljaren — emojirad + radera för egna meddelanden */}
      <Modal visible={!!reactFor} transparent animationType="fade" onRequestClose={() => setReactFor(null)}>
        <TouchableOpacity style={s.reactBackdrop} activeOpacity={1} onPress={() => setReactFor(null)}>
          <View style={s.reactSheet} onStartShouldSetResponder={() => true}>
            <View style={s.reactBar}>
              {REACTION_EMOJIS.map(e => {
                const isMine = !!reactFor && reactions[reactFor.id]?.some(r => r.user_id === me && r.emoji === e)
                return (
                  <TouchableOpacity key={e} onPress={() => pickReaction(e)} hitSlop={6}
                    style={[s.reactChoice, isMine && { backgroundColor: T.ACCENT + '33' }]}
                    testID={`react-${e}`}>
                    <Text style={s.reactChoiceText}>{e}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            {reactFor?.sender_id === me && (
              <TouchableOpacity onPress={deleteFromSheet} hitSlop={8} style={s.reactDelete} testID="reactDelete">
                <Text style={s.reactDeleteText}>{t('Radera meddelandet')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

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
  // Bredden begränsas av wrappern i renderItem — procent HÄR också får
  // Yoga att kollapsa bubblan till en bokstav per rad
  bubble: { borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9, overflow: 'hidden' },
  bubbleText: { color: TEXT_PRIMARY, fontSize: 15, lineHeight: 21 },
  bubbleImage: { width: 210, height: 160, borderRadius: 10, marginBottom: 5 },
  // right -80 lägger hela rutan bortom skärmkanten (listans padding är 16),
  // så ingen tidssiffra skymtar förrän man faktiskt drar
  timeReveal: {
    position: 'absolute', right: -80, top: 0, bottom: 0,
    width: 64, justifyContent: 'center', alignItems: 'center',
  },
  timeRevealText: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600' },

  reactBadge: {
    backgroundColor: CARD, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 7, paddingVertical: 2, marginTop: -7, zIndex: 1,
  },
  reactBadgeText: { fontSize: 12 },
  reactBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: 30,
  },
  reactSheet: { alignItems: 'center', gap: 14 },
  reactBar: {
    flexDirection: 'row', gap: 4, backgroundColor: CARD,
    borderRadius: 26, paddingHorizontal: 10, paddingVertical: 8,
  },
  reactChoice: { borderRadius: 18, paddingHorizontal: 7, paddingVertical: 4 },
  reactChoiceText: { fontSize: 26 },
  reactDelete: {
    backgroundColor: CARD, borderRadius: 999,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  reactDeleteText: { color: '#FF3B4A', fontSize: 14, fontWeight: '700' },
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
