import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, FlatList, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/services/profile'
import { getCardioWorkouts, type CardioWorkout } from '@/services/cardioWorkouts'
import { getUnitSystem, type UnitSystem } from '@/lib/units'
import { GlassSegment } from '@/components/GlassSegment'
import { GlassCircleButton } from '@/components/GlassButton'
import { CardioSummaryView } from '@/components/CardioSummaryView'
import { FeedWorkoutCard, workoutToPost, type FeedPost } from '@/components/FeedWorkoutCard'
import { useTabBarShrinkOnScroll } from '@/lib/tabBar'
import { BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
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
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loaded, setLoaded] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [unit, setUnit] = useState<UnitSystem>('metric')
  const [selectedWorkout, setSelectedWorkout] = useState<CardioWorkout | null>(null)
  const onScroll = useTabBarShrinkOnScroll()

  useFocusEffect(useCallback(() => {
    let alive = true
    getUnitSystem().then(u => { if (alive) setUnit(u) })
    async function loadFeed() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || !alive) return
      const [profile, workouts] = await Promise.all([
        getProfile(session.user.id).catch(() => null),
        getCardioWorkouts(session.user.id, 20).catch(() => [] as CardioWorkout[]),
      ])
      if (!alive) return
      const authorName = profile?.name || session.user.email?.split('@')[0] || 'Jag'
      setAvatarUrl(profile?.avatar_url ?? null)
      setPosts(workouts.map(w => workoutToPost(w, authorName, profile?.avatar_url ?? null)))
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
          data={posts}
          keyExtractor={p => p.id}
          renderItem={({ item }) => (
            <FeedWorkoutCard
              post={item}
              onOpen={setSelectedWorkout}
              onAvatarPress={() => router.push('/(app)/athlete' as never)}
            />
          )}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={loaded ? (
            <EmptyState
              icon="megaphone-outline"
              title="Inget i flödet ännu"
              body="Dina cardio-pass dyker upp här. Snart kan du dela dem så att andra kan se, gilla och kommentera."
            />
          ) : null}
        />
      )}

      {/* Samma passdetaljvy som statistiken — utan radering härifrån */}
      <Modal visible={!!selectedWorkout} animationType="slide" onRequestClose={() => setSelectedWorkout(null)}>
        {selectedWorkout && (
          <CardioSummaryView
            workout={selectedWorkout}
            title={selectedWorkout.name}
            dateLabel={new Date(selectedWorkout.created_at).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
            avatarUrl={avatarUrl}
            unit={unit}
            onClose={() => setSelectedWorkout(null)}
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

  empty: { alignItems: 'center', gap: 8, paddingTop: 90, paddingHorizontal: 40 },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginTop: 6 },
  emptyBody: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
