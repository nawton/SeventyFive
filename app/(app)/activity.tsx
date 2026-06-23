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
import { getMusclesForName } from '@/lib/muscles'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import type { ExerciseCategory } from '@/types/database'

const CATEGORIES: Array<{ key: ExerciseCategory | 'all'; label: string }> = [
  { key: 'all',      label: 'Alla' },
  { key: 'strength', label: 'Styrka' },
  { key: 'cardio',   label: 'Cardio' },
  { key: 'mobility', label: 'Rörlighet' },
  { key: 'hiit',     label: 'HIIT' },
]

type MuscleGroup = 'all' | 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core'

const MUSCLE_GROUPS: Array<{ key: MuscleGroup; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'all',       label: 'Alla',   icon: 'apps-outline' },
  { key: 'chest',     label: 'Bröst',  icon: 'body-outline' },
  { key: 'back',      label: 'Rygg',   icon: 'git-merge-outline' },
  { key: 'legs',      label: 'Ben',    icon: 'walk-outline' },
  { key: 'shoulders', label: 'Axlar',  icon: 'barbell-outline' },
  { key: 'arms',      label: 'Armar',  icon: 'fitness-outline' },
  { key: 'core',      label: 'Mage',   icon: 'ellipse-outline' },
]

const SLUG_TO_GROUP: Record<string, MuscleGroup> = {
  chest:          'chest',
  'upper-back':   'back',
  'lower-back':   'back',
  trapezius:      'back',
  quadriceps:     'legs',
  hamstring:      'legs',
  gluteal:        'legs',
  calves:         'legs',
  adductors:      'legs',
  deltoids:       'shoulders',
  biceps:         'arms',
  triceps:        'arms',
  forearm:        'arms',
  abs:            'core',
  obliques:       'core',
}

function getExerciseMuscleGroup(name: string): MuscleGroup {
  const slugs = getMusclesForName(name)
  for (const slug of slugs) {
    const group = SLUG_TO_GROUP[slug]
    if (group) return group
  }
  return 'all'
}

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

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const diffColor = DIFFICULTY_COLORS[exercise.difficulty]
  const icon = CATEGORY_ICONS[exercise.category]
  const hasMap = exercise.category === 'cardio' && usesMap(exercise.name)

  function handlePress() {
    if (hasMap) {
      router.push({ pathname: '/cardio', params: { name: exercise.name } })
    } else {
      router.push({
        pathname: '/exercise/[id]',
        params: {
          id: exercise.id,
          name: exercise.name,
          description: exercise.description ?? '',
          category: exercise.category,
          difficulty: exercise.difficulty,
        },
      })
    }
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.75}
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
      <Ionicons
        name={hasMap ? 'chevron-forward' : 'add-circle-outline'}
        size={18}
        color={hasMap ? '#444' : ORANGE}
        style={{ alignSelf: 'center' }}
      />
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ActivityScreen() {
  const [exercises, setExercises]       = useState<Exercise[]>([])
  const [activeFilter, setActiveFilter] = useState<ExerciseCategory | 'all'>('all')
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup>('all')
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    getExercises()
      .then(setExercises)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleCategoryFilter(key: ExerciseCategory | 'all') {
    setActiveFilter(key)
    setMuscleFilter('all') // reset muscle filter when switching category
  }

  const byCategory = activeFilter === 'all'
    ? exercises
    : exercises.filter(e => e.category === activeFilter)

  const filtered = activeFilter === 'strength' && muscleFilter !== 'all'
    ? byCategory.filter(e => getExerciseMuscleGroup(e.name) === muscleFilter)
    : byCategory

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
            <Text style={styles.subtitle}>{filtered.length} övningar</Text>
          </View>

          {/* Category filter */}
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
                onPress={() => handleCategoryFilter(cat.key)}
              />
            ))}
          </ScrollView>

          {/* Muscle group filter — only shown under Styrka */}
          {activeFilter === 'strength' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.muscleFilterRow}
            >
              {MUSCLE_GROUPS.map((mg) => (
                <TouchableOpacity
                  key={mg.key}
                  style={[styles.muscleTab, muscleFilter === mg.key && styles.muscleTabActive]}
                  onPress={() => setMuscleFilter(mg.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={mg.icon}
                    size={14}
                    color={muscleFilter === mg.key ? '#000' : TEXT_SECONDARY}
                  />
                  <Text style={[styles.muscleTabText, muscleFilter === mg.key && styles.muscleTabTextActive]}>
                    {mg.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
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

  muscleFilterRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  muscleTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  muscleTabActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  muscleTabText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '500',
  },
  muscleTabTextActive: {
    color: '#000',
    fontWeight: '700',
  },
})
