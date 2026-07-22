import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Modal, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native'
import { Ionicons } from '@/components/Icon'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Body from 'react-native-body-highlighter'
import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT, accentAlpha } from '@/lib/theme'
import { CATEGORY_LABELS, type Exercise } from '@/services/exercises'
import { getExerciseMuscleGroup, type Slug } from '@/lib/muscles'
import type { ExerciseCategory } from '@/types/database'
import { AppTextInput } from '@/components/AppTextInput'

type Page = 'landing' | 'gym' | 'cardio' | 'exercises'

type GymGroup = { key: string; label: string; side: 'front' | 'back'; slugs: Slug[]; color: string }

const GYM_GROUPS: GymGroup[] = [
  { key: 'chest',     label: 'Bröst',   side: 'front', slugs: ['chest'],                                      color: '#FF6B6B' },
  { key: 'back',      label: 'Rygg',    side: 'back',  slugs: ['upper-back', 'lower-back', 'trapezius'],       color: '#4ECDC4' },
  { key: 'legs',      label: 'Ben',     side: 'front', slugs: ['quadriceps', 'hamstring', 'gluteal', 'calves'], color: '#45B7D1' },
  { key: 'shoulders', label: 'Axlar',   side: 'front', slugs: ['deltoids'],                                    color: '#F7DC6F' },
  { key: 'arms',      label: 'Armar',   side: 'front', slugs: ['biceps', 'triceps'],                           color: '#A29BFE' },
  { key: 'core',      label: 'Mage',    side: 'front', slugs: ['abs', 'obliques'],                             color: '#FD79A8' },
]

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

function cardioExIcon(ex: Exercise): IoniconName {
  const n = ex.name.toLowerCase()
  if (n.includes('cykel') || n.includes('cycl') || n.includes('bike')) return 'bicycle-outline'
  if (n.includes('simm') || n.includes('swim'))                         return 'water-outline'
  if (n.includes('yoga') || n.includes('stretching'))                   return 'leaf-outline'
  if (n.includes('rodd') || n.includes('row'))                          return 'git-compare-outline'
  if (ex.category === 'hiit')                                           return 'flash-outline'
  if (ex.category === 'mobility')                                       return 'accessibility-outline'
  return 'walk-outline'
}

export function ExercisePickerSheet({
  visible,
  exercises,
  onSelect,
  onClose,
  gymOnly = false,
  multiSelect = false,
  onConfirmMulti,
}: {
  visible:   boolean
  exercises: Exercise[]
  onSelect:  (ex: Exercise, sets: number | null, reps: string | null) => void
  onClose:   () => void
  /** Gym-pass innehåller bara gym-övningar — hoppa förbi landing och cardio */
  gymOnly?:  boolean
  /** Bocka i hur många övningar som helst (utan set/reps-frågan) och spara med Klar */
  multiSelect?: boolean
  onConfirmMulti?: (exs: Exercise[]) => void
}) {
  const insets = useSafeAreaInsets()
  // Gym-pass startar direkt på muskelgrupperna; annars på typvalet
  const startPage: Page = gymOnly ? 'gym' : 'landing'
  const [page, setPage]                   = useState<Page>(startPage)
  const [selectedGroup, setSelectedGroup] = useState('')
  const [search, setSearch]               = useState('')
  const [pendingEx, setPendingEx]         = useState<Exercise | null>(null)
  const [multiSel, setMultiSel]           = useState<Exercise[]>([])
  const [sets, setSets]                   = useState('3')
  const [reps, setReps]                   = useState('10')

  useEffect(() => {
    if (!visible) {
      setPage(startPage)
      setSelectedGroup('')
      setSearch('')
      setPendingEx(null)
      setMultiSel([])
    }
  }, [visible, startPage])

  const unique       = [...new Map(exercises.map(e => [e.name.toLowerCase(), e])).values()]
  const strengthExes = unique.filter(e => e.category === 'strength')
  const otherExes    = unique.filter(e => e.category !== 'strength')

  function handleClose() {
    setPage(startPage)
    setSelectedGroup('')
    setSearch('')
    setPendingEx(null)
    onClose()
  }

  function handleBack() {
    if (page === 'exercises') { setPage('gym'); setSearch('') }
    // I gym-only-läget finns ingen landing att backa till → stäng istället
    else if (page === 'gym' && gymOnly) handleClose()
    else if (page === 'gym' || page === 'cardio') setPage('landing')
  }

  function handleTap(ex: Exercise) {
    if (multiSelect) {
      Haptics.selectionAsync()
      setMultiSel(prev => prev.some(e => e.id === ex.id)
        ? prev.filter(e => e.id !== ex.id)
        : [...prev, ex])
      return
    }
    if (ex.category === 'cardio') {
      onSelect(ex, null, null)
    } else {
      setSets('3')
      setReps('10')
      setPendingEx(ex)
    }
  }

  function confirmMulti() {
    if (multiSel.length === 0) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onConfirmMulti?.(multiSel)
    setMultiSel([])
  }

  function handleConfirm() {
    if (!pendingEx) return
    const s = sets.trim() ? parseInt(sets) : null
    const r = reps.trim() || null
    const ex = pendingEx
    setPendingEx(null)
    onSelect(ex, s, r)
  }

  function gymGroupCount(groupKey: string) {
    return strengthExes.filter(e => getExerciseMuscleGroup(e.name) === groupKey).length
  }

  const groupExercises = selectedGroup === 'all'
    ? strengthExes
    : strengthExes.filter(e => getExerciseMuscleGroup(e.name) === selectedGroup)
  const filteredExercises = search.trim()
    ? groupExercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : groupExercises

  const gymGroupLabel = GYM_GROUPS.find(g => g.key === selectedGroup)?.label ?? ''
  // I gym-only-läget är gym-sidan roten → visa stäng-ikon, inte bakåtpil
  const showBack      = page !== 'landing' && !(gymOnly && page === 'gym')
  const headerTitle   = page === 'gym' ? (gymOnly ? 'Lägg till övning' : 'Gym')
    : page === 'cardio'    ? 'Cardio'
    : page === 'exercises' ? gymGroupLabel
    : 'Lägg till övning'

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[s.screen, { paddingTop: insets.top }]}>

        {/* Header */}
        <View style={s.header}>
          {showBack ? (
            <TouchableOpacity onPress={handleBack} style={s.iconBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleClose} style={s.iconBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-down" size={22} color={TEXT_PRIMARY} />
            </TouchableOpacity>
          )}
          <Text style={s.title}>{headerTitle}</Text>
          <TouchableOpacity onPress={handleClose} style={s.closeBtn} activeOpacity={0.8}>
            <Text style={s.closeBtnText}>Stäng</Text>
          </TouchableOpacity>
        </View>

        {/* ── LANDING ─────────────────────────────────────────────── */}
        {page === 'landing' && (
          <View style={s.landingContainer}>
            <Text style={s.landingSub}>Välj typ av övning</Text>
            <View style={s.landingCards}>
              <TouchableOpacity style={s.landingCard} onPress={() => setPage('gym')} activeOpacity={0.8}>
                <View style={[s.landingIcon, { backgroundColor: 'rgba(255,149,0,0.18)' }]}>
                  <Ionicons name="barbell" size={44} color={ACCENT} />
                </View>
                <Text style={s.landingCardTitle}>Gym</Text>
                <Text style={s.landingCardSub}>Styrketräning</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.landingCard} onPress={() => setPage('cardio')} activeOpacity={0.8}>
                <View style={[s.landingIcon, { backgroundColor: 'rgba(52,199,89,0.18)' }]}>
                  <Ionicons name="heart" size={44} color="#34C759" />
                </View>
                <Text style={s.landingCardTitle}>Cardio</Text>
                <Text style={s.landingCardSub}>Kondition & rörlighet</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── GYM — muscle groups ──────────────────────────────────── */}
        {page === 'gym' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
            {GYM_GROUPS.map(group => (
              <TouchableOpacity
                key={group.key}
                style={s.groupRow}
                onPress={() => { setSelectedGroup(group.key); setPage('exercises') }}
                activeOpacity={0.7}
              >
                <View style={[s.thumbWrap, { backgroundColor: group.color + '14' }]}>
                  <Body
                    data={group.slugs.map(sl => ({ slug: sl, intensity: 1 as const }))}
                    side={group.side}
                    gender="male"
                    scale={0.33}
                    colors={[group.color]}
                    defaultFill="#3A3A3C"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.groupLabel}>{group.label}</Text>
                  <Text style={s.groupCount}>{gymGroupCount(group.key)} övningar</Text>
                </View>
                {multiSelect && multiSel.filter(e => getExerciseMuscleGroup(e.name) === group.key).length > 0 && (
                  <View style={s.groupSelBadge}>
                    <Text style={s.groupSelBadgeText}>{multiSel.filter(e => getExerciseMuscleGroup(e.name) === group.key).length}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── CARDIO — flat list grouped by category ───────────────── */}
        {page === 'cardio' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
            {(['cardio', 'hiit', 'mobility'] as ExerciseCategory[]).map(cat => {
              const catExes = otherExes.filter(e => e.category === cat)
              if (catExes.length === 0) return null
              return (
                <View key={cat}>
                  <Text style={s.sectionHeader}>{CATEGORY_LABELS[cat].toUpperCase()}</Text>
                  {catExes.map(ex => (
                    <TouchableOpacity key={ex.id} style={s.row} onPress={() => handleTap(ex)} activeOpacity={0.7}>
                      <View style={s.cardioIconBox}>
                        <Ionicons name={cardioExIcon(ex)} size={22} color="#34C759" />
                      </View>
                      <Text style={[s.rowName, { flex: 1 }]}>{ex.name}</Text>
                      <View style={s.addBtn}>
                        <Ionicons name="add" size={20} color={ACCENT} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            })}
          </ScrollView>
        )}

        {/* ── EXERCISES — strength in selected muscle group ─────────── */}
        {page === 'exercises' && (
          <>
            <View style={s.searchBar}>
              <Ionicons name="search-outline" size={17} color={TEXT_SECONDARY} />
              <AppTextInput
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
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
              keyboardShouldPersistTaps="handled"
            >
              {filteredExercises.map(ex => {
                const on = multiSelect && multiSel.some(e => e.id === ex.id)
                return (
                  <TouchableOpacity key={ex.id} style={[s.row, on && s.rowOn]} onPress={() => handleTap(ex)} activeOpacity={0.7}>
                    <View style={[s.exIconBox, on && { backgroundColor: accentAlpha('22') }]}>
                      <Ionicons name="barbell-outline" size={18} color={on ? ACCENT : TEXT_SECONDARY} />
                    </View>
                    <Text style={[s.rowName, { flex: 1 }, on && { color: ACCENT }]}>{ex.name}</Text>
                    {multiSelect ? (
                      <View style={[s.checkBox, on && s.checkBoxOn]}>
                        {on && <Ionicons name="checkmark" size={16} color="#000" />}
                      </View>
                    ) : (
                      <View style={s.addBtn}>
                        <Ionicons name="add" size={20} color={ACCENT} />
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
              {filteredExercises.length === 0 && (
                <Text style={s.emptyText}>Inga övningar hittades</Text>
              )}
            </ScrollView>
          </>
        )}

        {/* ── Klar-knapp i multiväljarläget ────────────────────────── */}
        {multiSelect && multiSel.length > 0 && (page === 'gym' || page === 'exercises') && (
          <View style={[s.multiFooter, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity style={s.multiBtn} onPress={confirmMulti} activeOpacity={0.85}>
              <Ionicons name="checkmark" size={20} color="#000" />
              <Text style={s.multiBtnText}>
                Klar · {multiSel.length} {multiSel.length === 1 ? 'övning' : 'övningar'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── SETS / REPS PROMPT ───────────────────────────────────── */}
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
                  <AppTextInput
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
                  <AppTextInput
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
  rowOn: { backgroundColor: 'rgba(255,159,10,0.05)' },
  checkBox: {
    width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  groupSelBadge: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  groupSelBadgeText: { color: '#000', fontSize: 12, fontWeight: '800' },
  multiFooter: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: BG, borderTopWidth: 1, borderTopColor: BORDER,
  },
  multiBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 16,
  },
  multiBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },

  screen: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  iconBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:        { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700' },
  closeBtn:     { backgroundColor: ACCENT, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9 },
  closeBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },

  // Landing
  landingContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  landingSub:       { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', marginBottom: 28 },
  landingCards:     { flexDirection: 'row', gap: 16 },
  landingCard: {
    flex: 1, backgroundColor: CARD, borderRadius: 20,
    paddingVertical: 32, paddingHorizontal: 16, alignItems: 'center', gap: 12,
  },
  landingIcon:      { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  landingCardTitle: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800' },
  landingCardSub:   { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center' },

  // Gym group list
  groupRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)', minHeight: 112,
  },
  thumbWrap: {
    width: 64, height: 110, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'flex-start',
    backgroundColor: CARD, borderRadius: 12,
  },
  groupLabel: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700' },
  groupCount: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },

  // Section header
  sectionHeader: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },

  // Exercise rows
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  cardioIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(52,199,89,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  exIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  rowName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,149,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { color: TEXT_SECONDARY, textAlign: 'center', marginTop: 48, fontSize: 15 },

  // Search bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginVertical: 10,
    paddingHorizontal: 14, height: 46,
    backgroundColor: CARD, borderRadius: 14,
  },
  searchInput: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, padding: 0 },

  // Sets/reps prompt
  promptOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
  },
  promptSheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
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
    flexDirection: 'row',
    backgroundColor: CARD, borderRadius: 16,
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
    backgroundColor: ACCENT, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10,
  },
  confirmBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
})
