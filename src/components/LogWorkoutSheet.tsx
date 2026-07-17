import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal, Keyboard,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { getExerciseMuscleGroup } from '@/lib/muscles'
import type { Exercise } from '@/services/exercises'

const CARDIO_GREEN = '#34C759'

type Step = 'choose' | 'cardio' | 'gymPick' | 'gymOverview'

const CARDIO_TYPES: { key: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'running',  label: 'Löpning',    icon: 'fitness-outline' },
  { key: 'cycling',  label: 'Cykling',    icon: 'bicycle-outline' },
  { key: 'walking',  label: 'Promenad',   icon: 'walk-outline' },
  { key: 'interval', label: 'Intervaller', icon: 'flash-outline' },
]

const GROUPS = [
  { key: 'all',       label: 'Alla' },
  { key: 'legs',      label: 'Ben' },
  { key: 'chest',     label: 'Bröst' },
  { key: 'back',      label: 'Rygg' },
  { key: 'shoulders', label: 'Axlar' },
  { key: 'arms',      label: 'Armar' },
  { key: 'core',      label: 'Mage' },
]

type GymEntry = { exercise: Exercise; sets: string; reps: string }

export type GymLogItem = { exerciseName: string; sets: number; reps: string }

export function LogWorkoutSheet({ visible, exercises, onClose, onPickCardio, onSaveGym }: {
  visible: boolean
  exercises: Exercise[]
  onClose: () => void
  onPickCardio: (type: string, label: string) => void
  onSaveGym: (name: string, items: GymLogItem[]) => void
}) {
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState<Step>('choose')
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('all')
  const [selected, setSelected] = useState<Exercise[]>([])
  const [entries, setEntries] = useState<GymEntry[]>([])
  const [passName, setPassName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!visible) {
      setStep('choose'); setSearch(''); setGroup('all')
      setSelected([]); setEntries([]); setPassName(''); setSaving(false)
    }
  }, [visible])

  const strength = [...new Map(exercises.filter(e => e.category === 'strength').map(e => [e.name.toLowerCase(), e])).values()]
  const filtered = strength.filter(e => {
    const g = group === 'all' || getExerciseMuscleGroup(e.name) === group
    const q = search.trim() === '' || e.name.toLowerCase().includes(search.toLowerCase())
    return g && q
  })

  function toggle(ex: Exercise) {
    setSelected(prev => prev.some(e => e.id === ex.id) ? prev.filter(e => e.id !== ex.id) : [...prev, ex])
  }

  function goToOverview() {
    Keyboard.dismiss()
    setEntries(selected.map(ex => ({ exercise: ex, sets: '3', reps: '10' })))
    setStep('gymOverview')
  }

  function updateEntry(exId: string, field: 'sets' | 'reps', value: string) {
    setEntries(prev => prev.map(en => en.exercise.id === exId ? { ...en, [field]: value } : en))
  }
  function removeEntry(exId: string) {
    setEntries(prev => prev.filter(en => en.exercise.id !== exId))
    setSelected(prev => prev.filter(e => e.id !== exId))
  }

  function save() {
    if (entries.length === 0) return
    setSaving(true)
    onSaveGym(
      passName.trim() || 'Gympass',
      entries.map(en => ({
        exerciseName: en.exercise.name,
        sets: en.sets.trim() ? parseInt(en.sets) : 3,
        reps: en.reps.trim() || '10',
      })),
    )
  }

  const headerTitle = step === 'choose' ? 'Logga pass'
    : step === 'cardio' ? 'Välj cardio'
    : step === 'gymPick' ? 'Välj övningar'
    : 'Passöversikt'

  function back() {
    if (step === 'cardio' || step === 'gymPick') setStep('choose')
    else if (step === 'gymOverview') setStep('gymPick')
    else onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={back}>
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={back} style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name={step === 'choose' ? 'chevron-down' : 'chevron-back'} size={24} color={TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={s.title}>{headerTitle}</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.8}>
            <Text style={s.closeText}>Stäng</Text>
          </TouchableOpacity>
        </View>

        {/* ── Val: Gym eller Cardio ── */}
        {step === 'choose' && (
          <View style={s.chooseWrap}>
            <Text style={s.chooseSub}>Vad vill du logga?</Text>
            <View style={s.chooseCards}>
              <TouchableOpacity style={s.chooseCard} onPress={() => setStep('gymPick')} activeOpacity={0.85}>
                <View style={[s.chooseIcon, { backgroundColor: ORANGE + '22' }]}>
                  <Ionicons name="barbell" size={42} color={ORANGE} />
                </View>
                <Text style={s.chooseTitle}>Gym</Text>
                <Text style={s.chooseHint}>Flera övningar i ett pass</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.chooseCard} onPress={() => setStep('cardio')} activeOpacity={0.85}>
                <View style={[s.chooseIcon, { backgroundColor: CARDIO_GREEN + '22' }]}>
                  <Ionicons name="heart" size={42} color={CARDIO_GREEN} />
                </View>
                <Text style={s.chooseTitle}>Cardio</Text>
                <Text style={s.chooseHint}>Ett eget pass med GPS</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Cardio-typ ── */}
        {step === 'cardio' && (
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
            {CARDIO_TYPES.map(t => (
              <TouchableOpacity key={t.key} style={s.cardioRow} onPress={() => onPickCardio(t.key, t.label)} activeOpacity={0.8}>
                <View style={[s.cardioIcon, { backgroundColor: CARDIO_GREEN + '18' }]}>
                  <Ionicons name={t.icon} size={22} color={CARDIO_GREEN} />
                </View>
                <Text style={s.cardioLabel}>{t.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Gym: välj övningar (multi) ── */}
        {step === 'gymPick' && (
          <View style={{ flex: 1 }}>
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
                clearButtonMode="while-editing"
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipStrip} contentContainerStyle={s.chips}>
              {GROUPS.map(g => (
                <TouchableOpacity key={g.key} style={[s.chip, group === g.key && s.chipActive]} onPress={() => setGroup(g.key)} activeOpacity={0.7}>
                  <Text style={[s.chipText, group === g.key && s.chipTextActive]}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {filtered.map(ex => {
                const on = selected.some(e => e.id === ex.id)
                return (
                  <TouchableOpacity key={ex.id} style={[s.exRow, on && s.exRowOn]} onPress={() => toggle(ex)} activeOpacity={0.7}>
                    <View style={[s.exIcon, on && { backgroundColor: ORANGE + '22' }]}>
                      <Ionicons name="barbell-outline" size={18} color={on ? ORANGE : TEXT_SECONDARY} />
                    </View>
                    <Text style={[s.exName, on && { color: ORANGE }]}>{ex.name}</Text>
                    <View style={[s.checkBox, on && s.checkBoxOn]}>
                      {on && <Ionicons name="checkmark" size={16} color="#000" />}
                    </View>
                  </TouchableOpacity>
                )
              })}
              {filtered.length === 0 && <Text style={s.empty}>Inga övningar hittades</Text>}
            </ScrollView>

            {selected.length > 0 && (
              <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
                <TouchableOpacity style={s.primaryBtn} onPress={goToOverview} activeOpacity={0.85}>
                  <Text style={s.primaryBtnText}>Fortsätt · {selected.length} {selected.length === 1 ? 'övning' : 'övningar'}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#000" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── Gym: översikt — namnge passet + set/reps ── */}
        {step === 'gymOverview' && (
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View>
                <Text style={s.fieldLabel}>PASSNAMN</Text>
                <TextInput
                  style={s.nameInput}
                  value={passName}
                  onChangeText={setPassName}
                  placeholder="t.ex. Push, Ben, Överkropp…"
                  placeholderTextColor={TEXT_SECONDARY}
                  autoCorrect={false}
                  returnKeyType="done"
                />
              </View>

              {entries.map(en => (
                <View key={en.exercise.id} style={s.exCard}>
                  <View style={s.exCardHeader}>
                    <Text style={s.exCardName} numberOfLines={1}>{en.exercise.name}</Text>
                    <TouchableOpacity onPress={() => removeEntry(en.exercise.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={20} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                  </View>
                  <View style={s.fieldRow}>
                    <View style={s.field}>
                      <Text style={s.fieldSmall}>SET</Text>
                      <TextInput
                        style={s.fieldInput}
                        defaultValue={en.sets}
                        onChangeText={v => updateEntry(en.exercise.id, 'sets', v)}
                        keyboardType="number-pad" placeholder="3" placeholderTextColor={TEXT_SECONDARY} selectTextOnFocus
                      />
                    </View>
                    <View style={s.field}>
                      <Text style={s.fieldSmall}>REPS</Text>
                      <TextInput
                        style={s.fieldInput}
                        defaultValue={en.reps}
                        onChangeText={v => updateEntry(en.exercise.id, 'reps', v)}
                        keyboardType="default" placeholder="10" placeholderTextColor={TEXT_SECONDARY} selectTextOnFocus
                      />
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
              <TouchableOpacity style={[s.primaryBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
                <Ionicons name="checkmark" size={20} color="#000" />
                <Text style={s.primaryBtnText}>{saving ? 'Sparar…' : 'Spara pass'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700' },
  closeBtn: { backgroundColor: ORANGE, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  closeText: { color: '#000', fontWeight: '700', fontSize: 14 },

  chooseWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  chooseSub: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', marginBottom: 26 },
  chooseCards: { flexDirection: 'row', gap: 16 },
  chooseCard: {
    flex: 1, backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    paddingVertical: 30, paddingHorizontal: 14, alignItems: 'center', gap: 10,
  },
  chooseIcon: { width: 78, height: 78, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chooseTitle: { color: TEXT_PRIMARY, fontSize: 21, fontWeight: '800' },
  chooseHint: { color: TEXT_SECONDARY, fontSize: 12, textAlign: 'center' },

  cardioRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 14,
  },
  cardioIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardioLabel: { flex: 1, color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    paddingHorizontal: 14, height: 46, backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
  },
  searchInput: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, padding: 0 },
  chipStrip: { flexGrow: 0, marginBottom: 6 },
  chips: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER },
  chipActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  chipText: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500' },
  chipTextActive: { color: '#000', fontWeight: '700' },

  exRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  exRowOn: { backgroundColor: ORANGE + '0C' },
  exIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  exName: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  checkBox: {
    width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: ORANGE, borderColor: ORANGE },
  empty: { color: TEXT_SECONDARY, textAlign: 'center', marginTop: 44, fontSize: 15 },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: BG, borderTopWidth: 1, borderTopColor: BORDER,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 16,
  },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },

  fieldLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8, paddingHorizontal: 4 },
  nameInput: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600', paddingHorizontal: 14, paddingVertical: 14,
  },
  exCard: { backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 16, gap: 12 },
  exCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exCardName: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700', flex: 1, marginRight: 10 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, gap: 6 },
  fieldSmall: { color: TEXT_SECONDARY, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  fieldInput: {
    height: 46, backgroundColor: BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', textAlign: 'center',
  },
})
