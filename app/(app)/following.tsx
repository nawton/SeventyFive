import { useCallback, useRef, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { AppRefreshControl, useAppRefresh } from '@/components/AppRefresh'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/services/profile'
import {
  getFollowLists, follow, unfollow, subscribeToFollows, type FollowProfile,
} from '@/services/follows'
import { GlassCircleButton } from '@/components/GlassButton'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { BG, CARD, ORANGE, TEXT_PRIMARY, TEXT_SECONDARY, DIVIDER } from '@/lib/theme'

// =============================================================================
// FÖLJARE/FÖLJER — riktiga listor ur follows-tabellen: eget namn i headern,
// sökknapp, två flikar med räknare och rader med avatar, namn och
// följ-pill. Följ/avfölj uppdaterar optimistiskt och realtidskanalen
// fångar andras ändringar — inget ska behöva laddas om.
// =============================================================================

type Tab = 'followers' | 'following'

type PillState = 'following' | 'requested' | 'none'

function PersonRow({ person, pillState, ownId, onToggle }: {
  person: FollowProfile
  pillState: PillState
  ownId: string | null
  onToggle: (id: string, state: PillState) => void
}) {
  const isSelf = person.id === ownId
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
        <Text style={s.rowName} numberOfLines={1}>{person.name ?? 'Namnlös'}</Text>
      </TouchableOpacity>
      {/* Man kan inte följa sig själv — egna raden får ingen pill */}
      {!isSelf && (
        <TouchableOpacity
          style={[s.followPill, pillState === 'none' && s.followPillInvite]}
          onPress={() => onToggle(person.id, pillState)}
          activeOpacity={0.8}
          testID={`follow-${person.id}`}
        >
          <Text style={[s.followPillText, pillState === 'none' && s.followPillTextInvite]}>
            {pillState === 'following' ? 'Följer' : pillState === 'requested' ? 'Förfrågad' : 'Följ'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function FollowingScreen() {
  // Räknarna på profilen skickar med vilken flik som ska öppnas — synkas
  // vid varje ändring eftersom skärmen ligger kvar monterad i navigatorn
  const params = useLocalSearchParams<{ tab?: string }>()
  const paramTab: Tab = params.tab === 'followers' ? 'followers' : 'following'
  const [tab, setTab] = useState<Tab>(paramTab)
  // Vid fokus (inte bara paramändring) — annars fastnar fliken från förra
  // besöket när man kommer in med samma param igen
  useFocusEffect(useCallback(() => { setTab(paramTab) }, [paramTab]))
  const [name, setName] = useState('')
  const [ownId, setOwnId] = useState<string | null>(null)
  const [followers, setFollowers] = useState<FollowProfile[]>([])
  const [followingList, setFollowingList] = useState<FollowProfile[]>([])
  // Vilka jag följer (godkända) respektive väntande förfrågningar jag
  // skickat härifrån — styr pillarna i BÅDA flikarna
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set())

  const aliveRef = useRef(true)
  const loadLists = useCallback(async (uid: string) => {
    const lists = await getFollowLists(uid)
    if (!aliveRef.current) return
    setFollowers(lists.followers)
    setFollowingList(lists.following)
    setFollowedIds(new Set(lists.following.map(p => p.id)))
  }, [])

  useFocusEffect(useCallback(() => {
    aliveRef.current = true
    let unsubscribe: (() => void) | null = null
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user || !aliveRef.current) return
      const uid = session.user.id
      setOwnId(uid)
      getProfile(uid).then(p => {
        if (!aliveRef.current) return
        setName(p?.name || session.user.email?.split('@')[0] || '')
      }).catch(() => {})

      loadLists(uid).catch(() => {})
      // Följer någon dig medan sidan är öppen dyker den upp direkt
      unsubscribe = subscribeToFollows(uid, () => { loadLists(uid).catch(() => {}) })
    })
    return () => { aliveRef.current = false; unsubscribe?.() }
  }, [loadLists]))

  const { refreshing, onRefresh } = useAppRefresh(
    useCallback(() => (ownId ? loadLists(ownId) : Promise.resolve()), [ownId, loadLists]),
  )

  const setOf = (prev: Set<string>, id: string, add: boolean) => {
    const copy = new Set(prev)
    if (add) copy.add(id); else copy.delete(id)
    return copy
  }

  function toggleFollow(id: string, state: PillState) {
    Haptics.selectionAsync()
    // Optimistiskt: pillen vänder direkt, backa vid fel. Raderna ligger
    // kvar tills nästa laddning så ett avfölj går att ångra på plats.
    if (state === 'none') {
      // Skicka vänförfrågan → "Förfrågad" tills den godkänns
      setRequestedIds(prev => setOf(prev, id, true))
      follow(id).catch(() => setRequestedIds(prev => setOf(prev, id, false)))
    } else if (state === 'requested') {
      setRequestedIds(prev => setOf(prev, id, false))
      unfollow(id).catch(() => setRequestedIds(prev => setOf(prev, id, true)))
    } else {
      setFollowedIds(prev => setOf(prev, id, false))
      unfollow(id).catch(() => setFollowedIds(prev => setOf(prev, id, true)))
    }
  }

  const people = tab === 'followers' ? followers : followingList

  function switchTab(next: Tab) {
    if (next === tab) return
    Haptics.selectionAsync()
    setTab(next)
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
        <Text style={s.title} numberOfLines={1}>{name || 'Community'}</Text>
        <GlassCircleButton
          icon="search"
          size={40}
          iconColor={TEXT_PRIMARY}
          onPress={() => router.push('/(app)/search-users' as never)}
          fallbackStyle={s.iconBtnFallback}
        />
      </View>

      <View style={s.tabsRow}>
        <TouchableOpacity style={s.tabBtn} onPress={() => switchTab('followers')} activeOpacity={0.8}>
          <Text style={[s.tabText, tab === 'followers' && s.tabTextActive]}>
            {followers.length} Följare
          </Text>
          <View style={[s.tabLine, tab === 'followers' && s.tabLineActive]} />
        </TouchableOpacity>
        <TouchableOpacity style={s.tabBtn} onPress={() => switchTab('following')} activeOpacity={0.8}>
          <Text style={[s.tabText, tab === 'following' && s.tabTextActive]}>
            {followingList.length} Följer
          </Text>
          <View style={[s.tabLine, tab === 'following' && s.tabLineActive]} />
        </TouchableOpacity>
      </View>

      <FlatList
        testID="followsList"
        data={people}
        keyExtractor={p => p.id}
        renderItem={({ item }) => (
          <PersonRow
            person={item}
            pillState={followedIds.has(item.id) ? 'following'
              : requestedIds.has(item.id) ? 'requested' : 'none'}
            ownId={ownId}
            onToggle={toggleFollow}
          />
        )}
        ItemSeparatorComponent={() => <View style={s.rowDivider} />}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} testID="followsRefresh" />
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="people-outline" size={44} color={TEXT_SECONDARY} />
            <Text style={s.emptyTitle}>
              {tab === 'followers' ? 'Inga följare ännu' : 'Du följer ingen ännu'}
            </Text>
            <Text style={s.emptyBody}>
              Sök upp vänner med förstoringsglaset och börja följa varandra.
            </Text>
          </View>
        }
      />
    </SafeScreen>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, paddingHorizontal: 16, paddingVertical: 10,
  },
  iconBtnFallback: { backgroundColor: CARD },
  title: { flex: 1, color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800', textAlign: 'center' },

  tabsRow: { flexDirection: 'row', marginTop: 8 },
  tabBtn: { flex: 1, alignItems: 'center', gap: 10, paddingTop: 6 },
  tabText: { color: TEXT_SECONDARY, fontSize: 15, fontWeight: '600' },
  tabTextActive: { color: TEXT_PRIMARY, fontWeight: '700' },
  tabLine: { alignSelf: 'stretch', height: 3, backgroundColor: 'transparent' },
  tabLineActive: { backgroundColor: ORANGE, borderRadius: 2 },

  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  rowPerson: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowName: { flex: 1, color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: DIVIDER, marginLeft: 66 },

  followPill: {
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 20, paddingHorizontal: 22, paddingVertical: 8,
    minWidth: 96, alignItems: 'center',
  },
  followPillInvite: { borderColor: ORANGE },
  followPillText: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
  followPillTextInvite: { color: ORANGE },

  empty: { alignItems: 'center', gap: 8, paddingTop: 70, paddingHorizontal: 40 },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginTop: 6 },
  emptyBody: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
