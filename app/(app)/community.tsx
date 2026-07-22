import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, FlatList, Modal, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/services/profile'
import { getCardioWorkouts, type CardioWorkout } from '@/services/cardioWorkouts'
import { getStrengthWorkouts, type StrengthWorkout } from '@/services/strengthWorkouts'
import { getFollowLists } from '@/services/follows'
import { getUnitSystem, type UnitSystem } from '@/lib/units'
import { GlassSegment } from '@/components/GlassSegment'
import { GlassCircleButton } from '@/components/GlassButton'
import { CardioSummaryView } from '@/components/CardioSummaryView'
import { GymSummaryView } from '@/components/stats/GymSummaryView'
import {
  FeedWorkoutCard, workoutToPost, strengthToPosts, mergePosts, type FeedPost,
} from '@/components/FeedWorkoutCard'
import { useTabBarShrinkOnScroll } from '@/lib/tabBar'
import { BG, CARD, BORDER, ORANGE, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { TAB_CONTENT_PAD } from '@/lib/glass'

// =============================================================================
// COMMUNITY — flödet visar dina OCH dina godkända vänners pass (löprundor
// och gympass), blandade kronologiskt. Vänners pass blir läsbara via
// RLS-policyn först när de godkänt din vänförfrågan. Tryck på ett kort
// öppnar samma passdetaljvy som statistiken (skrivskyddat betyg på andras
// pass), avataren öppnar personens atletprofil. Grupper är en
// platshållare. Gilla är bara lokal state ännu.
// =============================================================================

const FEED_LIMIT = 50

// Testerna (och ev. andra skärmar) når hjälparna via den delade modulen
export { relativeDayLabel, dayPartTitle } from '@/components/FeedWorkoutCard'

type Segment = 'feed' | 'groups'
type Filter = 'all' | 'cardio' | 'strength'

const FILTERS: Array<{ key: Filter; label: string; icon?: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'all', label: 'Alla' },
  { key: 'cardio', label: 'Cardio', icon: 'fitness-outline' },
  { key: 'strength', label: 'Gym', icon: 'barbell-outline' },
]

function EmptyState({ icon, title, body }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string
}) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={44} color={TEXT_SECONDARY} />
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
    </View>
  )
}

export default function CommunityScreen() {
  const [segment, setSegment] = useState<Segment>('feed')
  const [filter, setFilter] = useState<Filter>('all')
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loaded, setLoaded] = useState(false)
  const [ownId, setOwnId] = useState<string | null>(null)
  const [unit, setUnit] = useState<UnitSystem>('metric')
  const [selected, setSelected] = useState<FeedPost | null>(null)
  const onScroll = useTabBarShrinkOnScroll()

  useFocusEffect(useCallback(() => {
    let alive = true
    getUnitSystem().then(u => { if (alive) setUnit(u) })
    async function loadFeed() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || !alive) return
      const uid = session.user.id
      setOwnId(uid)
      const [profile, lists] = await Promise.all([
        getProfile(uid).catch(() => null),
        getFollowLists(uid).catch(() => ({ followers: [], following: [] })),
      ])
      if (!alive) return

      // Jag själv + alla jag följer (godkända) — varje författares pass
      // hämtas parallellt och blandas till ett flöde
      const authors = [
        {
          id: uid,
          name: profile?.name || session.user.email?.split('@')[0] || 'Jag',
          avatar: profile?.avatar_url ?? null,
        },
        ...lists.following.map(p => ({
          id: p.id, name: p.name ?? 'Namnlös', avatar: p.avatar_url,
        })),
      ]
      const perAuthor = await Promise.all(authors.map(async a => {
        const [cardio, strength] = await Promise.all([
          getCardioWorkouts(a.id, 20).catch(() => [] as CardioWorkout[]),
          getStrengthWorkouts(a.id, 200).catch(() => [] as StrengthWorkout[]),
        ])
        return [
          ...cardio.map(w => workoutToPost(w, a.id, a.name, a.avatar)),
          ...strengthToPosts(strength, a.id, a.name, a.avatar),
        ]
      }))
      if (!alive) return
      setPosts(mergePosts(perAuthor.flat()).slice(0, FEED_LIMIT))
      setLoaded(true)
    }
    loadFeed()
    return () => { alive = false }
  }, []))

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {/* Rent otonat glas i tummen (som förlagan) + följer-knapp till höger */}
      <View style={s.segmentRow}>
        <View style={{ flex: 1 }}>
          <GlassSegment
            value={segment}
            options={[{ key: 'feed', label: 'Flöde' }, { key: 'groups', label: 'Grupper' }]}
            onChange={setSegment}
            tint={null}
          />
        </View>
        <GlassCircleButton
          icon="people-outline"
          size={44}
          iconColor={TEXT_PRIMARY}
          onPress={() => router.push({
            pathname: '/(app)/following',
            params: { tab: 'following' },   // skriver över ev. kvarliggande flikparam
          } as never)}
          fallbackStyle={s.followBtnFallback}
        />
      </View>

      {segment === 'groups' ? (
        <EmptyState
          icon="people-outline"
          title="Grupper kommer snart"
          body="Skapa grupper med vänner och peppa varandra genom utmaningen."
        />
      ) : (
        <FlatList
          data={filter === 'all' ? posts : posts.filter(p => p.kind === filter)}
          keyExtractor={p => p.id}
          renderItem={({ item }) => (
            <FeedWorkoutCard
              post={item}
              onOpen={setSelected}
              // Egen avatar → egna profilen (tomma params skriver över
              // kvarliggande), väns avatar → deras atletprofil
              onAvatarPress={() => router.push({
                pathname: '/(app)/athlete',
                params: item.authorId === ownId
                  ? { userId: '', name: '', avatar: '' }
                  : { userId: item.authorId, name: item.authorName, avatar: item.authorAvatar ?? '' },
              } as never)}
            />
          )}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          // Chipsen scrollar med flödet — headern förblir ren
          ListHeaderComponent={
            <View style={s.chipsRow}>
              {FILTERS.map(f => {
                const on = f.key === filter
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[s.chip, on && s.chipActive]}
                    onPress={() => {
                      if (f.key === filter) return
                      Haptics.selectionAsync()
                      setFilter(f.key)
                    }}
                    activeOpacity={0.8}
                  >
                    {f.icon && <Ionicons name={f.icon} size={14} color={on ? ORANGE : TEXT_PRIMARY} />}
                    <Text style={[s.chipText, on && s.chipTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          }
          ListEmptyComponent={loaded ? (
            <EmptyState
              icon="megaphone-outline"
              title={filter === 'strength' ? 'Inga gympass i flödet'
                : filter === 'cardio' ? 'Inga cardio-pass i flödet'
                : 'Inget i flödet ännu'}
              body="Dina pass dyker upp här. Snart kan du dela dem så att andra kan se, gilla och kommentera."
            />
          ) : null}
        />
      )}

      {/* Samma detaljvyer som statistiken — utan radering härifrån, och
          skrivskyddat betyg på vänners pass */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected?.kind === 'cardio' && (
          <CardioSummaryView
            workout={selected.workout}
            title={selected.workout.name}
            dateLabel={new Date(selected.createdAt).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
            avatarUrl={selected.authorAvatar}
            unit={unit}
            onClose={() => setSelected(null)}
            effortReadOnly={selected.authorId !== ownId}
          />
        )}
        {selected?.kind === 'strength' && (
          <GymSummaryView
            name="Gympass"
            dateLabel={new Date(selected.createdAt).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
            logged={selected.workouts}
            plannedNames={[]}
            allWorkouts={selected.workouts}
            onClose={() => setSelected(null)}
          />
        )}
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  segmentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  followBtnFallback: { backgroundColor: CARD },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 + TAB_CONTENT_PAD, gap: 16 },

  // Samma chipstil som atletprofilens typväljare
  chipsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: BORDER, borderRadius: 17,
    paddingHorizontal: 11, paddingVertical: 7,
    backgroundColor: CARD,
  },
  chipActive: { borderColor: ORANGE },
  chipText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: ORANGE, fontWeight: '700' },

  empty: { alignItems: 'center', gap: 8, paddingTop: 90, paddingHorizontal: 40 },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginTop: 6 },
  emptyBody: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
