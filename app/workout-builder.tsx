import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getExercises, DIFFICULTY_COLORS, type Exercise } from '@/services/exercises'
import { workoutPlanStore, type PlanExercise } from '@/stores/workoutPlan'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

const REST_OPTIONS = [
  { label: '60s',  value: 60 },
  { label: '90s',  value: 90 },
  { label: '2min', value: 120 },
  { label: '3min', value: 180 },
]

export default function WorkoutBuilderScreen() {
  const [plan, setPlan]           = useState<PlanExercise[]>([])
  const [restSecs, setRestSecs]   = useState(90)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    setLoading(true)
    getExercises()
      .then(setAllExercises)
      .finally(() => setLoading(false))
  }, [])

  const filteredExercises = search.trim()
    ? allExercises.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) &&
        e.category !== 'cardio'
      )
    : allExercises.filter(e => e.category !== 'cardio')

  function addExercise(ex: Exercise) {
    if (plan.find(p => p.id === ex.id)) return
    setPlan(prev => [...prev, {
      id: ex.id,
      name: ex.name,
      category: ex.category,
      difficulty: ex.difficulty,
      sets: 3,
      reps: 10,
      weight: '',
    }])
    setPickerOpen(false)
    setSearch('')
  }

  function removeExercise(id: string) {
    setPlan(prev => prev.filter(p => p.id !== id))
  }

  function updateField(id: string, field: 'sets' | 'reps' | 'weight', value: string | number) {
    setPlan(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  function startSession() {
    if (plan.length === 0) {
      Alert.alert('Lägg till övningar', 'Välj minst en övning för att starta passet.')
      return
    }
    workoutPlanStore.set({ exercises: plan, restSeconds: restSecs })
    router.push('/workout-session')
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.title}>Skapa pass</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Rest time */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Vila mellan set</Text>
          <View style={styles.restRow}>
            {REST_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.restBtn, restSecs === opt.value && styles.restBtnActive]}
                onPress={() => setRestSecs(opt.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.restBtnText, restSecs === opt.value && styles.restBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Exercise list */}
        {plan.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Övningar  ·  {plan.length} valda</Text>
            {plan.map((ex, idx) => (
              <View key={ex.id} style={styles.exerciseCard}>
                <View style={styles.exTop}>
                  <View style={styles.exNum}>
                    <Text style={styles.exNumText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.exName} numberOfLines={1}>{ex.name}</Text>
                  <TouchableOpacity onPress={() => removeExercise(ex.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                </View>

                <View style={styles.exControls}>
                  {/* Sets */}
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => updateField(ex.id, 'sets', Math.max(1, ex.sets - 1))}
                    >
                      <Ionicons name="remove" size={16} color={TEXT_PRIMARY} />
                    </TouchableOpacity>
                    <View style={styles.stepperVal}>
                      <Text style={styles.stepperNum}>{ex.sets}</Text>
                      <Text style={styles.stepperLabel}>set</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => updateField(ex.id, 'sets', Math.min(20, ex.sets + 1))}
                    >
                      <Ionicons name="add" size={16} color={TEXT_PRIMARY} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.stepperDivider} />

                  {/* Reps */}
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => updateField(ex.id, 'reps', Math.max(1, ex.reps - 1))}
                    >
                      <Ionicons name="remove" size={16} color={TEXT_PRIMARY} />
                    </TouchableOpacity>
                    <View style={styles.stepperVal}>
                      <Text style={styles.stepperNum}>{ex.reps}</Text>
                      <Text style={styles.stepperLabel}>reps</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => updateField(ex.id, 'reps', Math.min(100, ex.reps + 1))}
                    >
                      <Ionicons name="add" size={16} color={TEXT_PRIMARY} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.stepperDivider} />

                  {/* Weight */}
                  <View style={styles.weightWrap}>
                    <TextInput
                      style={styles.weightInput}
                      value={ex.weight}
                      onChangeText={v => updateField(ex.id, 'weight', v.replace(/[^0-9.]/g, ''))}
                      placeholder="—"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      keyboardType="decimal-pad"
                    />
                    <Text style={styles.stepperLabel}>kg</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Add exercise button */}
        <TouchableOpacity style={styles.addBtn} onPress={() => setPickerOpen(true)} activeOpacity={0.8}>
          <Ionicons name="add-circle-outline" size={20} color={ORANGE} />
          <Text style={styles.addBtnText}>Lägg till övning</Text>
        </TouchableOpacity>

        {plan.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="barbell-outline" size={48} color="rgba(255,255,255,0.1)" />
            <Text style={styles.emptyText}>Ditt pass är tomt</Text>
            <Text style={styles.emptySubText}>Lägg till övningar ovan för att bygga ditt pass</Text>
          </View>
        )}

      </ScrollView>

      {/* Start button */}
      {plan.length > 0 && (
        <View style={styles.startWrap}>
          <TouchableOpacity style={styles.startBtn} onPress={startSession} activeOpacity={0.85}>
            <Ionicons name="play" size={20} color="#000" />
            <Text style={styles.startBtnText}>
              Starta pass  ·  {plan.reduce((s, e) => s + e.sets, 0)} set totalt
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Exercise picker modal */}
      <Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerOpen(false)}>
        <SafeAreaView style={styles.picker} edges={['top', 'bottom']}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Välj övning</Text>
            <TouchableOpacity onPress={() => { setPickerOpen(false); setSearch('') }} activeOpacity={0.8}>
              <Ionicons name="close" size={24} color={TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={17} color={TEXT_SECONDARY} />
            <TextInput
              style={styles.searchInput}
              placeholder="Sök övning..."
              placeholderTextColor={TEXT_SECONDARY}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          {loading ? (
            <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {filteredExercises.map(ex => {
                const already = plan.some(p => p.id === ex.id)
                const diffColor = DIFFICULTY_COLORS[ex.difficulty]
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[styles.pickerItem, already && styles.pickerItemDone]}
                    onPress={() => !already && addExercise(ex)}
                    activeOpacity={already ? 1 : 0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pickerItemName, already && { color: TEXT_SECONDARY }]}>
                        {ex.name}
                      </Text>
                      <View style={styles.pickerItemMeta}>
                        <View style={[styles.diffDot, { backgroundColor: diffColor }]} />
                        <Text style={styles.pickerItemSub}>{ex.description?.slice(0, 50)}</Text>
                      </View>
                    </View>
                    {already
                      ? <Ionicons name="checkmark-circle" size={22} color={ORANGE} />
                      : <Ionicons name="add-circle-outline" size={22} color={ORANGE} />
                    }
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  scroll: { padding: 20, gap: 24, paddingBottom: 16 },

  section: { gap: 12 },
  sectionLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  restRow: { flexDirection: 'row', gap: 8 },
  restBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 14,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center',
  },
  restBtnActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  restBtnText: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600' },
  restBtnTextActive: { color: '#000', fontWeight: '800' },

  exerciseCard: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    padding: 16, gap: 14,
  },
  exTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exNum: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center',
  },
  exNumText: { color: ORANGE, fontSize: 13, fontWeight: '700' },
  exName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600', flex: 1 },

  exControls: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  stepper: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  stepperBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepperVal: { alignItems: 'center', minWidth: 32 },
  stepperNum: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700' },
  stepperLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '500', textAlign: 'center' },
  stepperDivider: { width: 1, height: 36, backgroundColor: BORDER, marginHorizontal: 4 },

  weightWrap: { flex: 1, alignItems: 'center', gap: 2 },
  weightInput: {
    width: 56, height: 36, backgroundColor: '#2C2C2E',
    borderRadius: 10, color: TEXT_PRIMARY,
    fontSize: 18, fontWeight: '700', textAlign: 'center',
  },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 18,
    borderRadius: 16, borderWidth: 1.5,
    borderColor: ORANGE + '55', borderStyle: 'dashed',
  },
  addBtnText: { color: ORANGE, fontSize: 16, fontWeight: '600' },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 17, fontWeight: '600' },
  emptySubText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center' },

  startWrap: { padding: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  startBtn: {
    backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12,
  },
  startBtnText: { color: '#000', fontSize: 17, fontWeight: '800' },

  // Picker
  picker: { flex: 1, backgroundColor: BG },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  pickerTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, paddingHorizontal: 14, height: 44,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER, gap: 8,
  },
  searchInput: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, padding: 0 },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  pickerItemDone: { opacity: 0.5 },
  pickerItemName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  pickerItemMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  diffDot: { width: 6, height: 6, borderRadius: 3 },
  pickerItemSub: { color: TEXT_SECONDARY, fontSize: 12, flex: 1 },
})
