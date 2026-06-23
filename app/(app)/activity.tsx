import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import {
  getExercises,
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  type Exercise,
} from '@/services/exercises'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import type { ExerciseCategory } from '@/types/database'

const CATEGORIES: Array<{ key: ExerciseCategory | 'all'; label: string }> = [
  { key: 'all',      label: 'Alla' },
  { key: 'strength', label: 'Styrka' },
  { key: 'cardio',   label: 'Cardio' },
  { key: 'mobility', label: 'Rörlighet' },
  { key: 'hiit',     label: 'HIIT' },
]

const CATEGORY_ICONS: Record<ExerciseCategory, React.ComponentProps<typeof Ionicons>['name']> = {
  strength: 'barbell-outline',
  cardio:   'walk-outline',
  mobility: 'body-outline',
  hiit:     'flash-outline',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterTab({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.filterTab, active && styles.filterTabActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

const GPS_KEYWORDS = ['löpning', 'running', 'jogging', 'cykling', 'cycling', 'promenad', 'walking', 'spring', 'intervallspring', 'gång']

function usesMap(name: string): boolean {
  const s = name.toLowerCase()
  return GPS_KEYWORDS.some(kw => s.includes(kw))
}

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const diffColor = DIFFICULTY_COLORS[exercise.difficulty]
  const icon = CATEGORY_ICONS[exercise.category]
  const hasMap = exercise.category === 'cardio' && usesMap(exercise.name)

  function handlePress() {
    if (hasMap) router.push({ pathname: '/cardio', params: { name: exercise.name } })
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={hasMap ? 0.75 : 1}
    >
      <View style={styles.cardLeft}>
        <View style={styles.cardIcon}>
          <Ionicons name={icon} size={22} color={ORANGE} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{exercise.name}</Text>
        {exercise.description && (
          <Text style={styles.cardDescription} numberOfLines={2}>
            {exercise.description}
          </Text>
        )}
        <View style={styles.cardMeta}>
          <View style={[styles.badge, { backgroundColor: diffColor + '22', borderColor: diffColor + '55' }]}>
            <Text style={[styles.badgeText, { color: diffColor }]}>
              {DIFFICULTY_LABELS[exercise.difficulty]}
            </Text>
          </View>
          <Text style={styles.categoryText}>
            {CATEGORY_LABELS[exercise.category]}
          </Text>
          {hasMap && (
            <Ionicons name="map-outline" size={13} color={ORANGE} />
          )}
        </View>
      </View>
      {hasMap && (
        <Ionicons name="chevron-forward" size={18} color="#444" style={{ alignSelf: 'center' }} />
      )}
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ActivityScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [activeFilter, setActiveFilter] = useState<ExerciseCategory | 'all'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getExercises()
      .then(setExercises)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = activeFilter === 'all'
    ? exercises
    : exercises.filter((e) => e.category === activeFilter)

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        {/* Sticky header + filter */}
        <View style={styles.stickyTop}>
          <View style={styles.header}>
            <Text style={styles.title}>Träning</Text>
            <Text style={styles.subtitle}>{exercises.length} övningar</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {CATEGORIES.map((cat) => (
              <FilterTab
                key={cat.key}
                label={cat.label}
                active={activeFilter === cat.key}
                onPress={() => setActiveFilter(cat.key)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Exercise list */}
        <View style={styles.list}>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>Inga övningar hittades.</Text>
          ) : (
            filtered.map((exercise) => (
              <ExerciseCard key={exercise.id} exercise={exercise} />
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  centered: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyTop: {
    backgroundColor: BG,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 2,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  filterRow: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterTab: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  filterTabActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  filterTabText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 10,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardLeft: {
    paddingTop: 2,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 6,
  },
  cardName: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '600',
  },
  cardDescription: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 18,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  categoryText: {
    color: TEXT_SECONDARY,
    fontSize: 12,
  },
  empty: {
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
})
