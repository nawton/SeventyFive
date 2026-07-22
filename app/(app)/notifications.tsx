import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import {
  getIncomingRequests, acceptFollower, declineFollower, subscribeToFollows,
  type FollowProfile,
} from '@/services/follows'
import {
  getSocialNotifications, subscribeToSocial, type SocialNotification,
} from '@/services/social'
import { setNotifSeenAt } from '@/lib/prefs'
import { GlassCircleButton } from '@/components/GlassButton'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { BG, CARD, BORDER, ORANGE, TEXT_PRIMARY, TEXT_SECONDARY, DIVIDER } from '@/lib/theme'

// =============================================================================
// NOTISER — notiscentret, nås från klockan på profilfliken. Idag:
// inkommande vänförfrågningar med Godkänn/Avböj (godkänd = personen ser
// din statistik, ALDRIG dina framstegsfoton). Framöver: gillanden,
// kommentarer och påminnelser.
// =============================================================================

function RequestRow({ person, onAccept, onDecline }: {
  person: FollowProfile
  onAccept: (id: string) => void
  onDecline: (id: string) => void
}) {
  return (
    <View style={s.row}>
      <TouchableOpacity
        style={s.rowPerson}
        activeOpacity={0.7}
        onPress={() => router.push({
          pathname: '/(app)/athlete',
          params: { userId: person.id, name: person.name ?? 'Namnlös', avatar: person.avatar_url ?? '' },
        } as never)}
      >
        <FeedAvatar
          url={person.avatar_url}
          fallback={(person.name ?? '?').charAt(0).toUpperCase()}
          size={52}
        />
        <View style={{ flex: 1 }}>
          <Text style={s.requestName} numberOfLines={1}>{person.name ?? 'Namnlös'}</Text>
          <Text style={s.rowMeta}>vill följa dig och se din statistik</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.pill, s.pillAccept]}
        onPress={() => onAccept(person.id)}
        activeOpacity={0.8}
        testID={`accept-${person.id}`}
      >
        <Text style={s.pillAcceptText}>Godkänn</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={s.pill}
        onPress={() => onDecline(person.id)}
        activeOpacity={0.8}
        testID={`decline-${person.id}`}
      >
        <Text style={s.pillText}>Avböj</Text>
      </TouchableOpacity>
    </View>
  )
}

/** "gillade ditt gympass" / "gillade din löprunda" utifrån inläggsnyckeln */
function likeLabel(postKey: string): string {
  return postKey.startsWith('gym-') ? 'gillade ditt gympass' : 'gillade ditt pass'
}

function timeAgo(iso: string, now = new Date()): string {
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'nu'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}

export default function NotificationsScreen() {
  const [requests, setRequests] = useState<FollowProfile[]>([])
  const [socialItems, setSocialItems] = useState<SocialNotification[]>([])
  const [loaded, setLoaded] = useState(false)

  useFocusEffect(useCallback(() => {
    let alive = true
    let unsubFollows: (() => void) | null = null
    let unsubSocial: (() => void) | null = null
    const loadAll = () => {
      getIncomingRequests().then(r => {
        if (!alive) return
        setRequests(r)
        setLoaded(true)
      }).catch(() => {})
      getSocialNotifications().then(items => {
        if (alive) setSocialItems(items)
      }).catch(() => {})
    }
    loadAll()
    // Badgen på klockan nollställs — allt som fanns nu räknas som sett
    setNotifSeenAt(new Date().toISOString()).catch(() => {})
    // Nya förfrågningar/gillanden/kommentarer dyker upp live
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user || !alive) return
      unsubFollows = subscribeToFollows(session.user.id, loadAll)
      unsubSocial = subscribeToSocial(session.user.id, loadAll)
    })
    return () => { alive = false; unsubFollows?.(); unsubSocial?.() }
  }, []))

  function handleAccept(id: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    setRequests(prev => prev.filter(p => p.id !== id))
    acceptFollower(id).catch(() => {})
  }

  function handleDecline(id: string) {
    Haptics.selectionAsync()
    setRequests(prev => prev.filter(p => p.id !== id))
    declineFollower(id).catch(() => {})
  }

  return (
    <SafeScreen style={s.screen}>
      <View style={s.header}>
        <GlassCircleButton
          icon="chevron-back"
          size={40}
          iconColor={TEXT_PRIMARY}
          onPress={() => router.back()}
          fallbackStyle={s.iconBtnFallback}
        />
        <Text style={s.title}>Notiser</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={socialItems}
        keyExtractor={item => `${item.kind}-${item.postKey}-${item.from.id}-${item.createdAt}`}
        renderItem={({ item }) => (
          <View style={s.row}>
            <TouchableOpacity
              style={s.rowPerson}
              activeOpacity={0.7}
              onPress={() => router.push({
                pathname: '/(app)/athlete',
                params: { userId: item.from.id, name: item.from.name ?? 'Namnlös', avatar: item.from.avatar_url ?? '' },
              } as never)}
            >
              <FeedAvatar
                url={item.from.avatar_url}
                fallback={(item.from.name ?? '?').charAt(0).toUpperCase()}
                size={44}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.rowName} numberOfLines={2}>
                  <Text style={{ fontWeight: '800' }}>{item.from.name ?? 'Namnlös'}</Text>
                  {item.kind === 'like'
                    ? ` ${likeLabel(item.postKey)}`
                    : ' kommenterade ditt pass'}
                </Text>
                {item.kind === 'comment' && !!item.body && (
                  <Text style={s.rowComment} numberOfLines={2}>”{item.body}”</Text>
                )}
              </View>
              <View style={s.rowRight}>
                <Ionicons
                  name={item.kind === 'like' ? 'heart' : 'chatbubble-ellipses'}
                  size={16}
                  color={item.kind === 'like' ? '#FF3B4A' : TEXT_SECONDARY}
                />
                <Text style={s.rowTime}>{timeAgo(item.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
        ListHeaderComponent={
          <>
            {requests.length > 0 && (
              <>
                <Text style={s.sectionHead}>Vänförfrågningar</Text>
                {requests.map((person, i) => (
                  <View key={person.id}>
                    {i > 0 && <View style={s.rowDivider} />}
                    <RequestRow person={person} onAccept={handleAccept} onDecline={handleDecline} />
                  </View>
                ))}
              </>
            )}
            {socialItems.length > 0 && (
              <Text style={[s.sectionHead, requests.length > 0 && { marginTop: 18 }]}>Aktivitet</Text>
            )}
          </>
        }
        ItemSeparatorComponent={() => <View style={s.rowDivider} />}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={loaded && requests.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="notifications-outline" size={44} color={TEXT_SECONDARY} />
            <Text style={s.emptyTitle}>Inga notiser ännu</Text>
            <Text style={s.emptyBody}>
              Här samlas vänförfrågningar, gillanden och kommentarer.
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
  iconBtnFallback: { backgroundColor: CARD },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  sectionHead: {
    color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  rowPerson: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '500', lineHeight: 19 },
  requestName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  rowComment: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 3, fontStyle: 'italic' },
  rowRight: { alignItems: 'flex-end', gap: 3 },
  rowTime: { color: TEXT_SECONDARY, fontSize: 11 },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: DIVIDER, marginLeft: 64 },

  pill: {
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7,
  },
  pillText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700' },
  pillAccept: { borderColor: ORANGE },
  pillAcceptText: { color: ORANGE, fontSize: 13, fontWeight: '700' },

  empty: { alignItems: 'center', gap: 8, paddingTop: 90, paddingHorizontal: 40 },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginTop: 6 },
  emptyBody: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
