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
// COMMUNITY — flöde med delade pass (Runkeeper-förlagan). Delnings-
// backenden är inte byggd än, så flödet visar de egna cardio-passen som
// förhandsvisning; när delning finns byts datakällan ut i loadFeed.
// Sök/följ medvetet utelämnat. Grupper är en platshållare. Tryck på ett
// kort öppnar samma passdetaljvy som statistiken (CardioSummaryView),
// avataren öppnar atletprofilen.
// =============================================================================

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [unit, setUnit] = useState<UnitSystem>('metric')
  const [allStrength, setAllStrength] = useState<StrengthWorkout[]>([])
  const [selected, setSelected] = useState<FeedPost | null>(null)
  const onScroll = useTabBarShrinkOnScroll()

  useFocusEffect(useCallback(() => {
    let alive = true
    getUnitSystem().then(u => { if (alive) setUnit(u) })
    async function loadFeed() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || !alive) return
      const [profile, cardio, strength] = await Promise.all([
        getProfile(session.user.id).catch(() => null),
        getCardioWorkouts(session.user.id, 20).catch(() => [] as CardioWorkout[]),
        getStrengthWorkouts(session.user.id, 200).catch(() => [] as StrengthWorkout[]),
      ])
      if (!alive) return
      const authorName = profile?.name || session.user.email?.split('@')[0] || 'Jag'
      const avatar = profile?.avatar_url ?? null
      setAvatarUrl(avatar)
      setAllStrength(strength)
      setPosts(mergePosts([
        ...cardio.map(w => workoutToPost(w, authorName, avatar)),
        ...strengthToPosts(strength, authorName, avatar),
      ]).slice(0, 30))
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
          onPress={() => router.push('/(app)/following' as never)}
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
              // Tomma params skriver över ev. kvarliggande sökparametrar —
              // annars kan den egna avataren visa senast besökta profil
              onAvatarPress={() => router.push({
                pathname: '/(app)/athlete',
                params: { userId: '', name: '', avatar: '' },
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

      {/* Samma detaljvyer som statistiken — utan radering härifrån */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected?.kind === 'cardio' && (
          <CardioSummaryView
            workout={selected.workout}
            title={selected.workout.name}
            dateLabel={new Date(selected.createdAt).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
            avatarUrl={avatarUrl}
            unit={unit}
            onClose={() => setSelected(null)}
          />
        )}
        {selected?.kind === 'strength' && (
          <GymSummaryView
            name="Gympass"
            dateLabel={new Date(selected.createdAt).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
            logged={selected.workouts}
            plannedNames={[]}
            allWorkouts={allStrength}
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
