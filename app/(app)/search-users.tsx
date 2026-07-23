import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator, Keyboard,
  TouchableOpacity,
} from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import * as Haptics from 'expo-haptics'
import { searchProfiles, type ProfileSearchHit } from '@/services/profile'
import {
  getFollowStatuses, getFollowStatus, follow, unfollow, type FollowStatus,
} from '@/services/follows'
import { GlassCircleButton } from '@/components/GlassButton'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, DIVIDER, ACCENT, useThemeStrings } from '@/lib/theme'
import { AppTextInput } from '@/components/AppTextInput'

// =============================================================================
// SÖK ANVÄNDARE — riktig sökning mot databasen via search_profiles-RPC:n
// (bara id/namn/avatar lämnas ut, blockerade par filtreras bort).
// Debounce så vi inte spammar Supabase medan man skriver. Varje träff
// visar följstatusen som en pill: Följ → Förfrågad → Följer, med samma
// optimistiska toggle som resten av appen.
// =============================================================================

const DEBOUNCE_MS = 300

export default function SearchUsersScreen() {
  // Ramar som schemasträngar — dynamiska fryser, vit-alfa syns inte på ljust
  const T = useThemeStrings()
  const pillEdge = T.TEXT_PRIMARY === '#FFFFFF' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)'
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ProfileSearchHit[]>([])
  const [statuses, setStatuses] = useState<Record<string, FollowStatus>>({})
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)   // minst en sökning har körts
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setHits([])
      setSearched(false)
      setSearching(false)
      return
    }
    setSearching(true)
    timer.current = setTimeout(() => {
      let alive = true
      searchProfiles(trimmed)
        .then(async result => {
          if (!alive) return
          setHits(result)
          setSearched(true)
          // Följstatus per träff — så man ser vilka man redan följer
          const map = await getFollowStatuses(result.map(h => h.id)).catch(() => ({}))
          if (alive) setStatuses(prev => ({ ...prev, ...map }))
        })
        .finally(() => { if (alive) setSearching(false) })
      // Städas inte per timeout — senaste svaret vinner via ny debounce-runda
      return () => { alive = false }
    }, DEBOUNCE_MS)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [query])

  // Samma optimistiska följ-toggle som resten av appen. Offentliga
  // profiler godkänns direkt av servertriggern, därav omfrågan efteråt.
  function toggleFollow(id: string) {
    Haptics.selectionAsync()
    const current = statuses[id] ?? 'none'
    const setStatus = (st: FollowStatus) =>
      setStatuses(prev => ({ ...prev, [id]: st }))
    if (current === 'none') {
      setStatus('pending')
      follow(id)
        .then(() => getFollowStatus(id))
        .then(setStatus)
        .catch(() => setStatus('none'))
    } else {
      setStatus('none')
      unfollow(id).catch(() => setStatus(current))
    }
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
        <Text style={s.title}>Hitta vänner</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.searchRow}>
        <Ionicons name="search" size={18} color={TEXT_SECONDARY} />
        <AppTextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Sök på namn"
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={() => Keyboard.dismiss()}
          testID="searchInput"
        />
        {searching && <ActivityIndicator size="small" color={ACCENT} />}
      </View>

      <FlatList
        data={hits}
        keyExtractor={h => h.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const status = statuses[item.id] ?? 'none'
          return (
            <View style={s.row}>
              <TouchableOpacity
                style={s.rowPerson}
                activeOpacity={0.7}
                testID={`hit-${item.id}`}
                onPress={() => router.push({
                  pathname: '/(app)/athlete',
                  params: {
                    userId: item.id,
                    name: item.name ?? 'Namnlös',
                    avatar: item.avatar_url ?? '',
                  },
                } as never)}
              >
                <FeedAvatar
                  url={item.avatar_url}
                  fallback={(item.name ?? '?').charAt(0).toUpperCase()}
                  size={52}
                />
                <Text style={s.rowName} numberOfLines={1}>{item.name ?? 'Namnlös'}</Text>
              </TouchableOpacity>
              {/* Följstatusen direkt i träffen: Följ → Förfrågad → Följer */}
              <TouchableOpacity
                style={[s.followPill, { borderColor: status === 'none' ? T.ACCENT : pillEdge }]}
                onPress={() => toggleFollow(item.id)}
                activeOpacity={0.8}
                testID={`follow-${item.id}`}
              >
                <Text style={[s.followPillText, status === 'none' && s.followPillTextInvite]}>
                  {status === 'accepted' ? 'Följer' : status === 'pending' ? 'Förfrågad' : 'Följ'}
                </Text>
              </TouchableOpacity>
            </View>
          )
        }}
        ItemSeparatorComponent={() => <View style={s.rowDivider} />}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="search-outline" size={44} color={TEXT_SECONDARY} />
            <Text style={s.emptyTitle}>
              {query.trim().length < 2 ? 'Sök efter andra'
                : searched && !searching ? 'Inga träffar'
                : ' '}
            </Text>
            <Text style={s.emptyBody}>
              {query.trim().length < 2
                ? 'Skriv minst två tecken för att hitta andra som kör utmaningen.'
                : searched && !searching ? 'Ingen användare matchade din sökning.' : ' '}
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
    paddingHorizontal: 16, paddingVertical: 10,
  },
  iconBtnFallback: { backgroundColor: CARD },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginTop: 4, marginBottom: 8,
    backgroundColor: CARD, borderRadius: 12, paddingHorizontal: 14,
  },
  searchInput: { flex: 1, color: TEXT_PRIMARY, fontSize: 16, paddingVertical: 12 },

  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowPerson: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowName: { flex: 1, color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: DIVIDER, marginLeft: 66 },

  followPill: {
    borderWidth: 1.5,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    minWidth: 92, alignItems: 'center',
  },
  followPillText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700' },
  followPillTextInvite: { color: ACCENT },

  empty: { alignItems: 'center', gap: 8, paddingTop: 70, paddingHorizontal: 40 },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginTop: 6 },
  emptyBody: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
