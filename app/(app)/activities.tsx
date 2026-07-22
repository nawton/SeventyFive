import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/services/profile'
import { getCardioWorkouts, type CardioWorkout } from '@/services/cardioWorkouts'
import { GlassCircleButton } from '@/components/GlassButton'
import { CardioSummaryView } from '@/components/CardioSummaryView'
import { formatPace } from '@/lib/cardioUtils'
import { fmtTime } from '@/lib/format'
import { getUnitSystem, type UnitSystem } from '@/lib/units'
import { BG, CARD, BORDER, CARDIO_BLUE, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT } from '@/lib/theme'
import { TAB_CONTENT_PAD } from '@/lib/glass'

// =============================================================================
// AKTIVITETER — atletprofilens fullständiga passhistorik (Strava-stil):
// en rad per pass med typikon, rubrik, datum och distans/tid/tempo.
// Tryck öppnar samma passdetaljvy som statistiken. Visar egna pass tills
// delnings-backenden finns; sedan visas vald atlets historik.
// =============================================================================

const TYPE_META: Record<string, { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  running:  { label: 'Löpning',     icon: 'fitness-outline' },
  cycling:  { label: 'Cykling',     icon: 'bicycle-outline' },
  walking:  { label: 'Promenad',    icon: 'walk-outline' },
  interval: { label: 'Intervaller', icon: 'timer-outline' },
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

function ActivityRow({ workout, onPress }: { workout: CardioWorkout; onPress: () => void }) {
  const d = workout.data
  const meta = TYPE_META[d.type] ?? TYPE_META.running
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.8} testID={`activity-${workout.id}`}>
      <View style={s.rowIcon}>
        <Ionicons name={meta.icon} size={20} color={CARDIO_BLUE} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{workout.name || meta.label}</Text>
        <Text style={s.rowMeta}>{dateLabel(workout.created_at)}</Text>
      </View>
      <View style={s.rowStats}>
        <Text style={s.rowDistance}>{d.distance_km.toFixed(2).replace('.', ',')} km</Text>
        <Text style={s.rowMeta}>{fmtTime(d.duration_seconds)} · {formatPace(d.distance_km, d.duration_seconds)}/km</Text>
      </View>
    </TouchableOpacity>
  )
}

export default function ActivitiesScreen() {
  const [workouts, setWorkouts] = useState<CardioWorkout[]>([])
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
      setAvatarUrl(profile?.avatar_url ?? null)
      setWorkouts(all)
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
        data={workouts}
        keyExtractor={w => w.id}
        renderItem={({ item }) => <ActivityRow workout={item} onPress={() => setSelected(item)} />}
        ItemSeparatorComponent={() => <View style={s.rowDivider} />}
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

  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 + TAB_CONTENT_PAD },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(63,167,255,0.12)',
    borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  rowStats: { alignItems: 'flex-end' },
  rowDistance: { color: TEXT_PRIMARY, fontSize: 15, fontFamily: NUM_FONT },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)', marginLeft: 56 },

  empty: { alignItems: 'center', gap: 8, paddingTop: 90, paddingHorizontal: 40 },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginTop: 6 },
  emptyBody: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
