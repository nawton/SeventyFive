import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { GlassCircleButton } from '@/components/GlassButton'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { Ionicons } from '@/components/Icon'
import {
  getConversations, subscribeToMessages, type Conversation,
} from '@/services/messages'
import { BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT, useThemeStrings } from '@/lib/theme'

// =============================================================================
// MEDDELANDEN, samtalslistan: senaste meddelandet per person, olästa
// markerade. Nya samtal startas från en profil eller en medlemslista.
// =============================================================================

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'nu'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}

export default function ChatsScreen() {
  const T = useThemeStrings()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loaded, setLoaded] = useState(false)

  useFocusEffect(useCallback(() => {
    let alive = true
    let unsub: (() => void) | null = null
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user || !alive) return
      const uid = session.user.id
      const load = () => getConversations(uid)
        .then(c => { if (alive) { setConversations(c); setLoaded(true) } })
        .catch(() => { if (alive) setLoaded(true) })
      load()
      unsub = subscribeToMessages(uid, load)
    })
    return () => { alive = false; unsub?.() }
  }, []))

  return (
    <SafeScreen style={s.screen}>
      <View style={s.header}>
        <GlassCircleButton icon="chevron-back" size={40} iconColor={TEXT_PRIMARY}
          onPress={() => router.back()} fallbackStyle={s.iconFallback} />
        <Text style={s.headerTitle}>Meddelanden</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={conversations}
        keyExtractor={c => c.userId}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={s.divider} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.row} activeOpacity={0.7} testID={`chat-${item.userId}`}
            onPress={() => router.push({
              pathname: '/(app)/chat',
              params: { userId: item.userId, name: item.name ?? 'Namnlös', avatar: item.avatar_url ?? '' },
            } as never)}>
            <FeedAvatar url={item.avatar_url}
              fallback={(item.name ?? '?').charAt(0).toUpperCase()} size={50} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowName} numberOfLines={1}>{item.name ?? 'Namnlös'}</Text>
              <Text style={[s.rowPreview, item.unread > 0 && { color: TEXT_PRIMARY, fontWeight: '600' }]}
                numberOfLines={1}>
                {item.lastFromMe ? 'Du: ' : ''}
                {item.lastBody || (item.lastHasImage ? '📷 Bild' : '')}
              </Text>
            </View>
            <View style={s.rowRight}>
              <Text style={s.rowTime}>{timeAgo(item.lastAt)}</Text>
              {item.unread > 0 && (
                <View style={[s.unreadBadge, { backgroundColor: T.ACCENT }]}>
                  <Text style={[s.unreadText, { color: T.TEXT_PRIMARY === '#FFFFFF' ? '#000000' : '#FFFFFF' }]}>
                    {item.unread > 9 ? '9+' : item.unread}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={loaded ? (
          <View style={s.empty}>
            <Ionicons name="chatbubbles-outline" size={44} color={TEXT_SECONDARY} />
            <Text style={s.emptyTitle}>Inga meddelanden ännu</Text>
            <Text style={s.emptyBody}>
              Starta ett samtal från någons profil eller från en grupps medlemslista.
            </Text>
          </View>
        ) : null}
      />
    </SafeScreen>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  iconFallback: { backgroundColor: CARD },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  listContent: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 40 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(128,128,128,0.25)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowName: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  rowPreview: { color: TEXT_SECONDARY, fontSize: 13.5, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 5 },
  rowTime: { color: TEXT_SECONDARY, fontSize: 12 },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadText: { fontSize: 11, fontWeight: '800' },

  empty: { alignItems: 'center', gap: 8, paddingTop: 80, paddingHorizontal: 30 },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginTop: 4 },
  emptyBody: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
