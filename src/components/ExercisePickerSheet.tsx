import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Modal, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { CATEGORY_LABELS, type Exercise } from '@/services/exercises'
import { getExerciseMuscleGroup } from '@/lib/muscles'
import type { ExerciseCategory } from '@/types/database'

const CATEGORY_ICONS: Record<ExerciseCategory, React.ComponentProps<typeof Ionicons>['name']> = {
  strength: 'barbell-outline',
  cardio:   'walk-outline',
  mobility: 'body-outline',
  hiit:     'flash-outline',
}

const PICKER_FILTERS = [
  { key: 'all',       label: 'Alla' },
  { key: 'cardio',    label: 'Cardio' },
  { key: 'legs',      label: 'Ben' },
  { key: 'chest',     label: 'Bröst' },
  { key: 'back',      label: 'Rygg' },
  { key: 'shoulders', label: 'Axlar' },
  { key: 'arms',      label: 'Armar' },
  { key: 'core',      label: 'Mage' },
  { key: 'mobility',  label: 'Rörlighet' },
  { key: 'hiit',      label: 'HIIT' },
]

export function ExercisePickerSheet({
  visible,
  exercises,
  onSelect,
  onClose,
}: {
  visible:   boolean
  exercises: Exercise[]
  onSelect:  (ex: Exercise, sets: number | null, reps: string | null) => void
  onClose:   () => void
}) {
  const insets = useSafeAreaInsets()
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('all')
  const [pendingEx, setPendingEx] = useState<Exercise | null>(null)
  const [sets, setSets]           = useState('3')
  const [reps, setReps]           = useState('10')

  const unique = [...new Map(exercises.map(e => [e.name.toLowerCase(), e])).values()]

  const filtered = unique.filter(ex => {
    const matchesCat = filter === 'all'
      || ex.category === filter
      || getExerciseMuscleGroup(ex.name) === filter
    const matchesSearch = !search.trim() || ex.name.toLowerCase().includes(search.toLowerCase())
    return matchesCat && matchesSearch
  })

  function handleClose() {
    setSearch('')
    setFilter('all')
    setPendingEx(null)
    onClose()
  }

  function handleTap(ex: Exercise) {
    if (ex.category === 'cardio') {
      setSearch('')
      setFilter('all')
      onSelect(ex, null, null)
    } else {
      setSets('3')
      setReps('10')
      setPendingEx(ex)
    }
  }

  function handleConfirm() {
    if (!pendingEx) return
    const s = sets.trim() ? parseInt(sets) : null
    const r = reps.trim() || null
    setPendingEx(null)
    setSearch('')
    setFilter('all')
    onSelect(pendingEx, s, r)
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[s.screen, { paddingTop: insets.top }]}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleClose} style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={22} color={TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={s.title}>Lägg till övning</Text>
          <TouchableOpacity onPress={handleClose} style={s.klarBtn} activeOpacity={0.8}>
            <Text style={s.klarBtnText}>Stäng</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={17} color={TEXT_SECONDARY} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Sök övning…"
            placeholderTextColor={TEXT_SECONDARY}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={17} color={TEXT_SECONDARY} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.filterStrip}
          contentContainerStyle={s.filterContent}
        >
          {PICKER_FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.pill, filter === f.key && s.pillActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.pillText, filter === f.key && s.pillTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={s.count}>{filtered.length} övningar</Text>

        {/* Exercise list */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {filtered.map(ex => (
            <TouchableOpacity
              key={ex.id}
              style={s.row}
              onPress={() => handleTap(ex)}
              activeOpacity={0.7}
            >
              <View style={s.icon}>
                <Ionicons name={CATEGORY_ICONS[ex.category]} size={18} color={TEXT_SECONDARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{ex.name}</Text>
                <Text style={s.rowSub}>{CATEGORY_LABELS[ex.category]}</Text>
              </View>
              <View style={s.addBtn}>
                <Ionicons name="add" size={18} color={TEXT_SECONDARY} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sets/reps prompt — overlay inside same Modal to avoid nested-Modal black screen */}
        {pendingEx !== null && (
          <KeyboardAvoidingView
            style={s.promptOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => { Keyboard.dismiss(); setPendingEx(null) }}
              activeOpacity={1}
            />
            <View style={[s.promptSheet, { paddingBottom: insets.bottom + 20 }]}>
              <View style={s.promptHandle} />
              <Text style={s.promptTitle} numberOfLines={1}>{pendingEx.name}</Text>
              <Text style={s.promptSub}>Ange set och reps för passet</Text>

              <View style={s.promptFields}>
                <View style={s.promptField}>
                  <Text style={s.promptLabel}>SET</Text>
                  <TextInput
                    style={s.promptInput}
                    value={sets}
                    onChangeText={setSets}
                    keyboardType="number-pad"
                    placeholder="3"
                    placeholderTextColor={TEXT_SECONDARY}
                    selectTextOnFocus
                  />
                </View>
                <View style={s.promptDivider} />
                <View style={s.promptField}>
                  <Text style={s.promptLabel}>REPS</Text>
                  <TextInput
                    style={s.promptInput}
                    value={reps}
                    onChangeText={setReps}
                    keyboardType="number-pad"
                    placeholder="10"
                    placeholderTextColor={TEXT_SECONDARY}
                    selectTextOnFocus
                  />
                </View>
              </View>

              <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
                <Text style={s.confirmBtnText}>Lägg till i pass</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}

      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  iconBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:       { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700' },
  klarBtn:     { backgroundColor: ORANGE, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9 },
  klarBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginVertical: 10,
    paddingHorizontal: 14, height: 46,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
  },
  searchInput: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, padding: 0 },

  filterStrip:   { height: 60, flexGrow: 0, marginBottom: 10 },
  filterContent: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },

  pill: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  pillActive:     { backgroundColor: ORANGE, borderColor: ORANGE },
  pillText:       { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500' },
  pillTextActive: { color: '#000', fontWeight: '700' },

  count: {
    color: TEXT_SECONDARY, fontSize: 12, paddingHorizontal: 20,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  icon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  rowName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  rowSub:  { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },

  // Sets/reps prompt
  promptOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
  },
  promptSheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderWidth: 1, borderBottomWidth: 0, borderColor: BORDER,
    padding: 24, paddingBottom: 36, gap: 4,
  },
  promptHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginBottom: 16,
  },
  promptTitle:  { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800' },
  promptSub:    { color: TEXT_SECONDARY, fontSize: 14, marginBottom: 20 },
  promptFields: {
    flexDirection: 'row', gap: 0,
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    overflow: 'hidden', marginBottom: 16,
  },
  promptField:   { flex: 1, alignItems: 'center', paddingVertical: 20, gap: 8 },
  promptDivider: { width: 1, backgroundColor: BORDER },
  promptLabel:   { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  promptInput: {
    color: TEXT_PRIMARY, fontSize: 32, fontWeight: '700',
    textAlign: 'center', minWidth: 80, padding: 0,
  },
  confirmBtn: {
    backgroundColor: ORANGE, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10,
  },
  confirmBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
})
