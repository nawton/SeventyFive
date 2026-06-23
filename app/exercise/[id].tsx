import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import Body from 'react-native-body-highlighter'
import { getMusclesForName, bestSideForMuscles, SLUG_LABELS } from '@/lib/muscles'
import { saveStrengthWorkout } from '@/services/workouts'
import { supabase } from '@/lib/supabase'
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
} from '@/services/exercises'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import type { ExerciseCategory } from '@/types/database'

type SetRow = { reps: string; weight: string }

export default function ExerciseDetailScreen() {
  const params = useLocalSearchParams<{
    id: string
    name: string
    description: string
    category: string
    difficulty: string
  }>()

  const { id, name, description, category, difficulty } = params

  const muscles  = getMusclesForName(name ?? '')
  const initSide = bestSideForMuscles(muscles)
  const [bodyView, setBodyView] = useState<'front' | 'back'>(initSide)
  const [sets, setSets]         = useState<SetRow[]>([{ reps: '', weight: '' }])
  const [saving, setSaving]     = useState(false)

  const muscleData = muscles.map(slug => ({ slug, intensity: 1 as const }))
  const muscleLabels = muscles.map(s => SLUG_LABELS[s]).filter(Boolean).join('  ·  ')
  const diffColor = DIFFICULTY_COLORS[difficulty as keyof typeof DIFFICULTY_COLORS] ?? ORANGE

  function updateSet(index: number, field: keyof SetRow, value: string) {
    setSets(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  function addSet() {
    const last = sets[sets.length - 1]
    setSets(prev => [...prev, { reps: last.reps, weight: last.weight }])
  }

  function removeSet(index: number) {
    if (sets.length === 1) return
    setSets(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    const validSets = sets
      .map(s => ({ reps: parseInt(s.reps) || 0, weight_kg: parseFloat(s.weight) || 0 }))
      .filter(s => s.reps > 0)

    if (validSets.length === 0) {
      Alert.alert('Lägg till set', 'Fyll i minst ett set med reps.')
      return
    }

    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const ok = await saveStrengthWorkout({
          userId: session.user.id,
          exerciseId: id,
          exerciseName: name,
          category: category as 'strength' | 'mobility' | 'hiit',
          sets: validSets,
        })
        if (ok) {
          Alert.alert('Sparat!', `${name} loggat.`, [
            { text: 'OK', onPress: () => router.back() },
          ])
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const totalReps = sets.reduce((s, r) => s + (parseInt(r.reps) || 0), 0)

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color={TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Badges */}
          <View style={styles.badgeRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {CATEGORY_LABELS[category as ExerciseCategory] ?? category}
              </Text>
            </View>
            <View style={[styles.diffBadge, { backgroundColor: diffColor + '22', borderColor: diffColor + '55' }]}>
              <Text style={[styles.diffBadgeText, { color: diffColor }]}>
                {DIFFICULTY_LABELS[difficulty as keyof typeof DIFFICULTY_LABELS] ?? difficulty}
              </Text>
            </View>
          </View>

          {/* Body map */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Muskelgrupper</Text>
              <View style={styles.toggle}>
                {(['front', 'back'] as const).map(side => (
                  <TouchableOpacity
                    key={side}
                    style={[styles.toggleBtn, bodyView === side && styles.toggleBtnActive]}
                    onPress={() => setBodyView(side)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.toggleText, bodyView === side && styles.toggleTextActive]}>
                      {side === 'front' ? 'Fram' : 'Bak'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.bodyWrap}>
              <Body
                data={muscleData}
                side={bodyView}
                gender="male"
                scale={1.6}
                colors={[ORANGE]}
                defaultFill="#2A2A2C"
                border="rgba(255,255,255,0.10)"
              />
            </View>

            {muscleLabels ? (
              <View style={styles.muscleChips}>
                {muscles.map(slug => (
                  <View key={slug} style={styles.muscleChip}>
                    <Text style={styles.muscleChipText}>{SLUG_LABELS[slug]}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noMuscles}>Inga muskler mappade för denna övning</Text>
            )}
          </View>

          {/* Description */}
          {description ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Om övningen</Text>
              <Text style={styles.descText}>{description}</Text>
            </View>
          ) : null}

          {/* Log section */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Logga träning</Text>

            <View style={styles.setHeader}>
              <Text style={[styles.setHeaderText, { width: 36 }]}>Set</Text>
              <Text style={[styles.setHeaderText, { flex: 1 }]}>Reps</Text>
              <Text style={[styles.setHeaderText, { flex: 1 }]}>Kg</Text>
              <View style={{ width: 32 }} />
            </View>

            {sets.map((s, i) => (
              <View key={i} style={styles.setRow}>
                <View style={styles.setIndex}>
                  <Text style={styles.setIndexText}>{i + 1}</Text>
                </View>
                <TextInput
                  style={styles.setInput}
                  value={s.reps}
                  onChangeText={v => updateSet(i, 'reps', v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  returnKeyType="next"
                />
                <TextInput
                  style={styles.setInput}
                  value={s.weight}
                  onChangeText={v => updateSet(i, 'weight', v.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeSet(i)}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={sets.length > 1 ? 'rgba(255,255,255,0.3)' : 'transparent'}
                  />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addSetBtn} onPress={addSet} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={18} color={ORANGE} />
              <Text style={styles.addSetText}>Lägg till set</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>

        {/* Save button */}
        <View style={styles.saveWrap}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Sparar…' : `Spara  ·  ${sets.length} set${totalReps > 0 ? `  ·  ${totalReps} reps` : ''}`}
            </Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center',
  },

  scroll: { padding: 20, gap: 16, paddingBottom: 8 },

  badgeRow: { flexDirection: 'row', gap: 8 },
  categoryBadge: {
    backgroundColor: ORANGE + '22', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: ORANGE + '44',
  },
  categoryBadgeText: { color: ORANGE, fontSize: 13, fontWeight: '600' },
  diffBadge: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1,
  },
  diffBadgeText: { fontSize: 13, fontWeight: '600' },

  card: {
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER,
    padding: 20, gap: 14,
  },
  cardTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  toggle: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10, padding: 3, gap: 2,
  },
  toggleBtn:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  toggleBtnActive:  { backgroundColor: ORANGE },
  toggleText:       { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  toggleTextActive: { color: '#000' },

  bodyWrap: { alignItems: 'center' },

  muscleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muscleChip:  {
    backgroundColor: 'rgba(255,143,0,0.15)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: ORANGE + '33',
  },
  muscleChipText: { color: ORANGE, fontSize: 13, fontWeight: '600' },
  noMuscles:      { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center' },

  descText: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 22 },

  setHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  setHeaderText: {
    color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center',
  },
  setRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  setIndex: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center',
  },
  setIndexText: { color: ORANGE, fontSize: 14, fontWeight: '700' },
  setInput: {
    flex: 1, height: 44, backgroundColor: '#2C2C2E',
    borderRadius: 12, color: TEXT_PRIMARY,
    fontSize: 18, fontWeight: '700', textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  removeBtn: { width: 32, alignItems: 'center', justifyContent: 'center' },
  addSetBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  addSetText: { color: ORANGE, fontSize: 15, fontWeight: '600' },

  saveWrap: { padding: 20, paddingTop: 12 },
  saveBtn: {
    backgroundColor: ORANGE, borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12,
  },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
})
