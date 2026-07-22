import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import {
  getIncomingRequests, acceptFollower, declineFollower, subscribeToFollows,
  type FollowProfile,
} from '@/services/follows'
import { GlassCircleButton } from '@/components/GlassButton'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { BG, CARD, BORDER, ORANGE, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

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
          <Text style={s.rowName} numberOfLines={1}>{person.name ?? 'Namnlös'}</Text>
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

export default function NotificationsScreen() {
  const [requests, setRequests] = useState<FollowProfile[]>([])
  const [loaded, setLoaded] = useState(false)

  useFocusEffect(useCallback(() => {
    let alive = true
    let unsubscribe: (() => void) | null = null
    const loadRequests = () => {
      getIncomingRequests().then(r => {
        if (!alive) return
        setRequests(r)
        setLoaded(true)
      }).catch(() => {})
    }
    loadRequests()
    // Nya förfrågningar dyker upp live medan sidan är öppen
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user || !alive) return
      unsubscribe = subscribeToFollows(session.user.id, loadRequests)
    })
    return () => { alive = false; unsubscribe?.() }
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
    <SafeAreaView style={s.screen}>
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
        data={requests}
        keyExtractor={p => p.id}
        renderItem={({ item }) => (
          <RequestRow person={item} onAccept={handleAccept} onDecline={handleDecline} />
        )}
        ListHeaderComponent={requests.length > 0 ? (
          <Text style={s.sectionHead}>Vänförfrågningar</Text>
        ) : null}
        ItemSeparatorComponent={() => <View style={s.rowDivider} />}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={loaded ? (
          <View style={s.empty}>
            <Ionicons name="notifications-outline" size={44} color={TEXT_SECONDARY} />
            <Text style={s.emptyTitle}>Inga notiser ännu</Text>
            <Text style={s.emptyBody}>
              Här samlas vänförfrågningar, gillanden och påminnelser framöver.
            </Text>
          </View>
        ) : null}
      />
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
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  sectionHead: {
    color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  rowPerson: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)', marginLeft: 64 },

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
