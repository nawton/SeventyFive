import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, FlatList, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/services/profile'
import { getCardioWorkouts, type CardioWorkout } from '@/services/cardioWorkouts'
import { GlassCircleButton } from '@/components/GlassButton'
import { CardioSummaryView } from '@/components/CardioSummaryView'
import { FeedWorkoutCard, workoutToPost, type FeedPost } from '@/components/FeedWorkoutCard'
import { getUnitSystem, type UnitSystem } from '@/lib/units'
import { BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { TAB_CONTENT_PAD } from '@/lib/glass'

// =============================================================================
// AKTIVITETER — atletprofilens fullständiga passhistorik i samma
// kortlayout som community-flödet (karta och allt). Tryck på ett kort
// öppnar samma passdetaljvy som statistiken. Visar egna pass tills
// delnings-backenden finns; sedan visas vald atlets historik.
// =============================================================================

export default function ActivitiesScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loaded, setLoaded] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [unit, setUnit] = useState<UnitSystem>('metric')
  const [selected, setSelected] = useState<CardioWorkout | null>(null)

  useFocusEffect(useCallback(() => {
    let alive = true
    getUnitSystem().then(u => { if (alive) setUnit(u) })
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user || !alive) return
      const [profile, all] = await Promise.all([
        getProfile(session.user.id).catch(() => null),
        getCardioWorkouts(session.user.id, 200).catch(() => [] as CardioWorkout[]),
      ])
      if (!alive) return
      const authorName = profile?.name || session.user.email?.split('@')[0] || 'Jag'
      setAvatarUrl(profile?.avatar_url ?? null)
      setPosts(all.map(w => workoutToPost(w, authorName, profile?.avatar_url ?? null)))
      setLoaded(true)
    })
    return () => { alive = false }
  }, []))

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
        <Text style={s.title}>Aktiviteter</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => (
          // Ingen avatarnavigering — vi är redan på atletens sidor
          <FeedWorkoutCard post={item} onOpen={setSelected} />
        )}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={loaded ? (
          <View style={s.empty}>
            <Ionicons name="fitness-outline" size={44} color={TEXT_SECONDARY} />
            <Text style={s.emptyTitle}>Inga aktiviteter ännu</Text>
            <Text style={s.emptyBody}>Avklarade cardio-pass hamnar här.</Text>
          </View>
        ) : null}
      />

      {/* Samma passdetaljvy som statistiken — utan radering härifrån */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected && (
          <CardioSummaryView
            workout={selected}
            title={selected.name}
            dateLabel={new Date(selected.created_at).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
            avatarUrl={avatarUrl}
            unit={unit}
            onClose={() => setSelected(null)}
          />
        )}
      </Modal>
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

  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 + TAB_CONTENT_PAD, gap: 16 },

  empty: { alignItems: 'center', gap: 8, paddingTop: 90, paddingHorizontal: 40 },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginTop: 6 },
  emptyBody: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
