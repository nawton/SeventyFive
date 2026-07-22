import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/services/profile'
import { GlassCircleButton } from '@/components/GlassButton'
import { BG, CARD, ORANGE, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

// =============================================================================
// FÖLJARE/FÖLJER — Runkeeper-förlagan: eget namn i headern, sökknapp,
// två flikar med räknare och en lista med avatar, namn, total distans och
// Följer-pill. Följ-backenden är inte byggd än (medvetet avgränsat) —
// listorna visar exempeldata så designen kan utvärderas, och gilla/följ
// är bara lokal state. Sökknappen är en platshållare tills sök byggs.
// =============================================================================

type Tab = 'followers' | 'following'

interface Person {
  id: string
  name: string
  avatar: string | null   // emoji eller null (initialer)
  totalKm: number
}

// Exempeldata tills följ-systemet finns i backend
const DEMO_PEOPLE: Person[] = [
  { id: 'p1', name: 'Lukas', avatar: '😉', totalKm: 11 },
  { id: 'p2', name: 'Tanja', avatar: '🏎️', totalKm: 706 },
]

function PersonRow({ person }: { person: Person }) {
  // Följ-status är bara lokal tills backenden finns
  const [following, setFollowing] = useState(true)

  function toggle() {
    Haptics.selectionAsync()
    setFollowing(v => !v)
  }

  return (
    <View style={s.row}>
      <View style={s.rowAvatar}>
        {person.avatar
          ? <Text style={{ fontSize: 26 }}>{person.avatar}</Text>
          : <Text style={s.rowAvatarInitial}>{person.name.charAt(0).toUpperCase()}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowName}>{person.name}</Text>
        <Text style={s.rowMeta}>{person.totalKm} km totalt</Text>
      </View>
      <TouchableOpacity
        style={[s.followPill, !following && s.followPillActive]}
        onPress={toggle}
        activeOpacity={0.8}
        testID={`follow-${person.id}`}
      >
        <Text style={[s.followPillText, !following && s.followPillTextActive]}>
          {following ? 'Följer' : 'Följ'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

export default function FollowingScreen() {
  const [tab, setTab] = useState<Tab>('following')
  const [name, setName] = useState('')

  useFocusEffect(useCallback(() => {
    let alive = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user || !alive) return
      getProfile(session.user.id).then(p => {
        if (!alive) return
        setName(p?.name || session.user.email?.split('@')[0] || '')
      }).catch(() => {})
    })
    return () => { alive = false }
  }, []))

  // Samma exempeldata i båda flikarna tills backenden finns
  const followers = DEMO_PEOPLE
  const following = DEMO_PEOPLE

  const people = tab === 'followers' ? followers : following

  function switchTab(next: Tab) {
    if (next === tab) return
    Haptics.selectionAsync()
    setTab(next)
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
        <Text style={s.title} numberOfLines={1}>{name || 'Community'}</Text>
        {/* Platshållare — sökfunktionen byggs tillsammans med följ-systemet */}
        <GlassCircleButton
          icon="search"
          size={40}
          iconColor={TEXT_PRIMARY}
          onPress={() => {}}
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
            {following.length} Följer
          </Text>
          <View style={[s.tabLine, tab === 'following' && s.tabLineActive]} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={people}
        keyExtractor={p => p.id}
        renderItem={({ item }) => <PersonRow person={item} />}
        ItemSeparatorComponent={() => <View style={s.rowDivider} />}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
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
  rowAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  rowAvatarInitial: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800' },
  rowName: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  rowMeta: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)', marginLeft: 66 },

  followPill: {
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 20, paddingHorizontal: 22, paddingVertical: 8,
    minWidth: 96, alignItems: 'center',
  },
  followPillActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  followPillText: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
  followPillTextActive: { color: '#000' },
})
