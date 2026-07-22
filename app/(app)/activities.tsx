import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, FlatList, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/services/profile'
import type { StrengthWorkout } from '@/services/strengthWorkouts'
import { fetchUserWorkouts } from '@/services/feed'
import { GlassCircleButton } from '@/components/GlassButton'
import { GlassSegment } from '@/components/GlassSegment'
import { CardioSummaryView } from '@/components/CardioSummaryView'
import { GymSummaryView } from '@/components/stats/GymSummaryView'
import {
  FeedWorkoutCard, workoutToPost, strengthToPosts, mergePosts, type FeedPost,
} from '@/components/FeedWorkoutCard'
import { getUnitSystem, type UnitSystem } from '@/lib/units'
import { BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { TAB_CONTENT_PAD } from '@/lib/glass'

// =============================================================================
// AKTIVITETER — atletprofilens fullständiga passhistorik i samma
// kortlayout som community-flödet (karta och allt). Tryck på ett kort
// öppnar samma passdetaljvy som statistiken. Med userId-param visas en
// annan persons historik — kräver godkänd vänförfrågan (annars släpper
// RLS inte igenom några pass och listan blir tom).
// =============================================================================

type Filter = 'all' | 'cardio' | 'strength'

export default function ActivitiesScreen() {
  // Samma navigator-fälla som atletsidan: synka från params vid varje fokus
  const params = useLocalSearchParams<{ userId?: string; name?: string; avatar?: string }>()
  const otherId = typeof params.userId === 'string' && params.userId.length > 0 ? params.userId : null
  const paramName = typeof params.name === 'string' ? params.name : ''
  const paramAvatar = typeof params.avatar === 'string' && params.avatar.length > 0 ? params.avatar : null
  const [filter, setFilter] = useState<Filter>('all')
  const [isOther, setIsOther] = useState(false)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loaded, setLoaded] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [unit, setUnit] = useState<UnitSystem>('metric')
  const [allStrength, setAllStrength] = useState<StrengthWorkout[]>([])
  const [selected, setSelected] = useState<FeedPost | null>(null)

  useFocusEffect(useCallback(() => {
    let alive = true
    getUnitSystem().then(u => { if (alive) setUnit(u) })
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user || !alive) return
      const own = otherId === null || otherId === session.user.id
      setIsOther(!own)
      const targetId = own ? session.user.id : otherId!
      // Serverstrippad läsväg: rutter följer bara med om ägaren delar kartor
      const [profile, shared] = await Promise.all([
        own ? getProfile(session.user.id).catch(() => null) : Promise.resolve(null),
        fetchUserWorkouts(targetId).catch(() => ({ cardio: [], strength: [] })),
      ])
      if (!alive) return
      const authorName = own
        ? profile?.name || session.user.email?.split('@')[0] || 'Jag'
        : paramName || 'Atlet'
      const avatar = own ? profile?.avatar_url ?? null : paramAvatar
      const strength = shared.strength.map(r => r.workout)
      setAvatarUrl(avatar)
      setAllStrength(strength)
      setPosts(mergePosts([
        ...shared.cardio.map(r => workoutToPost(r.workout, targetId, authorName, avatar)),
        ...strengthToPosts(strength, targetId, authorName, avatar),
      ]))
      setLoaded(true)
    })
    return () => { alive = false }
  }, [otherId, paramName, paramAvatar]))

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

      {/* Filtrera historiken — samma klara glassegment som flödet */}
      <View style={s.filterRow}>
        <GlassSegment
          value={filter}
          options={[
            { key: 'all', label: 'Alla' },
            { key: 'cardio', label: 'Cardio' },
            { key: 'strength', label: 'Gym' },
          ]}
          onChange={setFilter}
          tint={null}
        />
      </View>

      <FlatList
        data={filter === 'all' ? posts : posts.filter(p => p.kind === filter)}
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
            <Text style={s.emptyTitle}>
              {filter === 'strength' ? 'Inga gympass ännu'
                : filter === 'cardio' ? 'Inga cardio-pass ännu'
                : 'Inga aktiviteter ännu'}
            </Text>
            <Text style={s.emptyBody}>Avklarade pass hamnar här.</Text>
          </View>
        ) : null}
      />

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
            effortReadOnly={isOther}
            social={{
              postKey: selected.id,
              ownerId: selected.authorId,
              onOpenComments: () => {
                const post = selected
                setSelected(null)
                router.push({
                  pathname: '/(app)/post',
                  params: {
                    postKey: post.id,
                    ownerId: post.authorId,
                    ownerName: post.authorName,
                    ownerAvatar: post.authorAvatar ?? '',
                    kind: 'cardio',
                    title: post.kind === 'cardio' ? post.workout.name : 'Gympass',
                    createdAt: post.createdAt,
                    meta: post.kind === 'cardio'
                      ? `${post.distanceKm.toFixed(2).replace('.', ',')} km`
                      : '',
                  },
                } as never)
              },
            }}
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
            social={{
              postKey: selected.id,
              ownerId: selected.authorId,
              onOpenComments: () => {
                const post = selected
                setSelected(null)
                router.push({
                  pathname: '/(app)/post',
                  params: {
                    postKey: post.id,
                    ownerId: post.authorId,
                    ownerName: post.authorName,
                    ownerAvatar: post.authorAvatar ?? '',
                    kind: 'strength',
                    title: 'Gympass',
                    createdAt: post.createdAt,
                    meta: post.kind === 'strength' ? `${post.exercises} övningar` : '',
                  },
                } as never)
              },
            }}
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
  filterRow: { paddingHorizontal: 20, paddingBottom: 12 },

  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 + TAB_CONTENT_PAD, gap: 16 },

  empty: { alignItems: 'center', gap: 8, paddingTop: 90, paddingHorizontal: 40 },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginTop: 6 },
  emptyBody: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
