import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
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

// ─── Constants ────────────────────────────────────────────────────────────────

type MuscleGroup = 'all' | 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core'

const CATEGORIES: Array<{ key: ExerciseCategory | 'all'; label: string }> = [
  { key: 'all',      label: 'Alla' },
  { key: 'strength', label: 'Styrka' },
  { key: 'cardio',   label: 'Cardio' },
  { key: 'mobility', label: 'Rörlighet' },
  { key: 'hiit',     label: 'HIIT' },
]

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
  chest: 'chest', 'upper-back': 'back', 'lower-back': 'back',
  trapezius: 'back', quadriceps: 'legs', hamstring: 'legs',
  gluteal: 'legs', calves: 'legs', adductors: 'legs',
  deltoids: 'shoulders', biceps: 'arms', triceps: 'arms',
  forearm: 'arms', abs: 'core', obliques: 'core',
}

const CATEGORY_ICONS: Record<ExerciseCategory, React.ComponentProps<typeof Ionicons>['name']> = {
  strength: 'barbell-outline',
  cardio:   'walk-outline',
  mobility: 'body-outline',
  hiit:     'flash-outline',
}

const GPS_KEYWORDS = ['löpning', 'running', 'jogging', 'cykling', 'cycling', 'promenad', 'walking', 'spring', 'intervallspring', 'gång']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function usesMap(name: string) {
  return GPS_KEYWORDS.some(kw => name.toLowerCase().includes(kw))
}

function getExerciseMuscleGroup(name: string): MuscleGroup {
  for (const slug of getMusclesForName(name)) {
    const g = SLUG_TO_GROUP[slug]
    if (g) return g
  }
  return 'all'
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({ exercise, query }: { exercise: Exercise; query: string }) {
  const diffColor = DIFFICULTY_COLORS[exercise.difficulty]
  const icon      = CATEGORY_ICONS[exercise.category]
  const hasMap    = exercise.category === 'cardio' && usesMap(exercise.name)

  function HighlightedName() {
    if (!query) return <Text style={styles.cardName}>{exercise.name}</Text>
    const idx = exercise.name.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return <Text style={styles.cardName}>{exercise.name}</Text>
    return (
      <Text style={styles.cardName}>
        {exercise.name.slice(0, idx)}
        <Text style={styles.highlight}>{exercise.name.slice(idx, idx + query.length)}</Text>
        {exercise.name.slice(idx + query.length)}
      </Text>
    )
  }

  function handlePress() {
    if (hasMap) {
      router.push({ pathname: '/cardio', params: { name: exercise.name } })
    } else {
      router.push({
        pathname: '/exercise/[id]',
        params: { id: exercise.id, name: exercise.name, description: exercise.description ?? '', category: exercise.category, difficulty: exercise.difficulty },
      })
    }
  }

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.75}>
      <View style={styles.cardLeft}>
        <View style={styles.cardIcon}>
          <Ionicons name={icon} size={22} color={ORANGE} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <HighlightedName />
        {exercise.description && (
          <Text style={styles.cardDescription} numberOfLines={2}>{exercise.description}</Text>
        )}
        <View style={styles.cardMeta}>
          <View style={[styles.badge, { backgroundColor: diffColor + '22', borderColor: diffColor + '55' }]}>
            <Text style={[styles.badgeText, { color: diffColor }]}>{DIFFICULTY_LABELS[exercise.difficulty]}</Text>
          </View>
          <Text style={styles.categoryText}>{CATEGORY_LABELS[exercise.category]}</Text>
          {hasMap && <Ionicons name="map-outline" size={13} color={ORANGE} />}
        </View>
      </View>
      <Ionicons name={hasMap ? 'chevron-forward' : 'add-circle-outline'} size={18} color={hasMap ? '#444' : ORANGE} style={{ alignSelf: 'center' }} />
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ActivityScreen() {
  const [exercises, setExercises]       = useState<Exercise[]>([])
  const [catFilter, setCatFilter]       = useState<ExerciseCategory | 'all'>('all')
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup>('all')
  const [searchQuery, setSearchQuery]   = useState('')

  useEffect(() => {
    getExercises().then(setExercises).catch(() => {})
  }, [])

  const unique     = [...new Map(exercises.map(e => [e.name.toLowerCase(), e])).values()]
  const byCategory = catFilter === 'all' ? unique : unique.filter(e => e.category === catFilter)
  const byMuscle   = catFilter === 'strength' && muscleFilter !== 'all'
    ? byCategory.filter(e => getExerciseMuscleGroup(e.name) === muscleFilter)
    : byCategory
  const filtered   = searchQuery.trim()
    ? byMuscle.filter(e =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    : byMuscle

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Sticky filter bar */}
        <View style={styles.stickyTop}>
          <View style={styles.topHeader}>
            <Text style={styles.title}>Övningar</Text>
          </View>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={17} color={TEXT_SECONDARY} />
            <TextInput
              style={styles.searchInput}
              placeholder="Sök övning..."
              placeholderTextColor={TEXT_SECONDARY}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.filterTab, catFilter === cat.key && styles.filterTabActive]}
                onPress={() => { setCatFilter(cat.key); setMuscleFilter('all') }}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterTabText, catFilter === cat.key && styles.filterTabTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {catFilter === 'strength' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.muscleFilterRow}>
              {MUSCLE_GROUPS.map(mg => (
                <TouchableOpacity
                  key={mg.key}
                  style={[styles.muscleTab, muscleFilter === mg.key && styles.muscleTabActive]}
                  onPress={() => setMuscleFilter(mg.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={mg.icon} size={14} color={muscleFilter === mg.key ? '#000' : TEXT_SECONDARY} />
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
          <Text style={styles.listCount}>{filtered.length} övningar</Text>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>
              {searchQuery ? `Inga övningar matchar "${searchQuery}"` : 'Inga övningar hittades.'}
            </Text>
          ) : (
            filtered.map(ex => <ExerciseCard key={ex.id} exercise={ex} query={searchQuery} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  stickyTop: { backgroundColor: BG, paddingTop: 8 },
  topHeader: { paddingHorizontal: 20, paddingBottom: 10 },
  title:     { color: TEXT_PRIMARY, fontSize: 28, fontWeight: '700' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 10,
    paddingHorizontal: 14, height: 44,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER, gap: 8,
  },
  searchInput: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, padding: 0 },
  highlight:   { color: ORANGE, fontWeight: '700' },

  filterRow: { paddingHorizontal: 20, paddingBottom: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
  filterTab: {
    height: 36, paddingHorizontal: 16, borderRadius: 18,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, justifyContent: 'center',
  },
  filterTabActive:     { backgroundColor: ORANGE, borderColor: ORANGE },
  filterTabText:       { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500' },
  filterTabTextActive: { color: '#000000', fontWeight: '700' },

  muscleFilterRow: { paddingHorizontal: 20, paddingBottom: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
  muscleTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 32, paddingHorizontal: 12, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: BORDER,
  },
  muscleTabActive:     { backgroundColor: ORANGE, borderColor: ORANGE },
  muscleTabText:       { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '500' },
  muscleTabTextActive: { color: '#000', fontWeight: '700' },

  list:      { paddingHorizontal: 20, paddingBottom: 32, gap: 10, paddingTop: 4 },
  listCount: { color: TEXT_SECONDARY, fontSize: 13, marginBottom: 4 },
  empty:     { color: TEXT_SECONDARY, textAlign: 'center', marginTop: 40, fontSize: 15 },

  card: {
    backgroundColor: CARD, borderRadius: 14, padding: 16,
    flexDirection: 'row', gap: 14, borderWidth: 1, borderColor: BORDER,
  },
  cardLeft: { paddingTop: 2 },
  cardIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: BG, alignItems: 'center', justifyContent: 'center',
  },
  cardBody:        { flex: 1, gap: 6 },
  cardName:        { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  cardDescription: { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 18 },
  cardMeta:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  badge:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeText:       { fontSize: 12, fontWeight: '600' },
  categoryText:    { color: TEXT_SECONDARY, fontSize: 12 },
})
