import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, CARDIO_BLUE } from '@/lib/theme'
import { ExercisePickerSheet } from '@/components/ExercisePickerSheet'
import type { Exercise } from '@/services/exercises'


type Step = 'choose' | 'cardio' | 'gymOverview'

const CARDIO_TYPES: { key: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'running',  label: 'Löpning',    icon: 'fitness-outline' },
  { key: 'cycling',  label: 'Cykling',    icon: 'bicycle-outline' },
  { key: 'walking',  label: 'Promenad',   icon: 'walk-outline' },
  { key: 'interval', label: 'Intervaller', icon: 'flash-outline' },
]

type GymEntry = { exercise: Exercise; sets: string; reps: string }

export type GymLogItem = { exerciseName: string; sets: number; reps: string }

export function LogWorkoutSheet({ visible, exercises, onClose, onPickCardio, onSaveGym, allowCardio = true }: {
  visible: boolean
  exercises: Exercise[]
  onClose: () => void
  onPickCardio: (type: string, label: string) => void
  onSaveGym: (name: string, items: GymLogItem[]) => void
  /** Tidigare dagar: GPS-cardio går inte i efterhand — hoppa direkt till gym */
  allowCardio?: boolean
}) {
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState<Step>('choose')
  const [entries, setEntries] = useState<GymEntry[]>([])
  const entriesRef = useRef<GymEntry[]>([])
  useEffect(() => { entriesRef.current = entries }, [entries])
  const [passName, setPassName] = useState('')
  const [saving, setSaving] = useState(false)
  // Muskelgruppssidan (samma som Lägg till övning i passvyn) — nested modal
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (!visible) return
    // Återställs vid öppning — att nollställa vid stängning gav en synlig
    // "choose"-blink medan modalen animerade ut
    setStep(allowCardio ? 'choose' : 'gymOverview')
    setEntries([])
    setPassName('')
    setSaving(false)
    // Utan cardio-val: hoppa direkt in i övningsväljaren med översikten bakom
    setPickerOpen(!allowCardio)
  }, [visible, allowCardio])

  function handlePickerSelect(ex: Exercise, sets: number | null, reps: string | null) {
    setEntries(prev => {
      if (prev.some(en => en.exercise.id === ex.id)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        return prev
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      return [...prev, { exercise: ex, sets: String(sets ?? 3), reps: reps ?? '10' }]
    })
    // Väljaren lämnas öppen så man kan lägga till flera övningar i rad
  }

  function handlePickerConfirm(exs: Exercise[]) {
    setEntries(prev => {
      const have = new Set(prev.map(en => en.exercise.id))
      const added = exs.filter(e => !have.has(e.id)).map(e => ({ exercise: e, sets: '3', reps: '10' }))
      return [...prev, ...added]
    })
    setPickerOpen(false)
    setStep('gymOverview')
  }

  function handlePickerClose() {
    setPickerOpen(false)
    if (entriesRef.current.length > 0) setStep('gymOverview')
    else if (!allowCardio) {
      // Vänta tills väljarens modal hunnit stängas — stängs båda i samma
      // tick lämnar iOS en svart, död presentation kvar
      setTimeout(() => onClose(), 400)
    }
    else setStep('choose')
  }

  function removeEntry(exId: string) {
    setEntries(prev => prev.filter(en => en.exercise.id !== exId))
  }

  function save() {
    if (entries.length === 0) return
    setSaving(true)
    onSaveGym(
      passName.trim() || 'Gympass',
      entries.map(en => {
        // Ogiltig inmatning får inte bli NaN — då failar databas-inserten tyst
        const parsed = parseInt(en.sets, 10)
        return {
          exerciseName: en.exercise.name,
          sets: Number.isFinite(parsed) && parsed > 0 ? parsed : 3,
          reps: en.reps.trim() || '10',
        }
      }),
    )
  }

  const headerTitle = step === 'choose' ? 'Logga pass'
    : step === 'cardio' ? 'Välj cardio'
    : 'Passöversikt'

  function back() {
    if (step === 'cardio') setStep('choose')
    else if (step === 'gymOverview') {
      if (allowCardio) setStep('choose')
      else onClose()
    }
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
              <TouchableOpacity
                style={[s.chooseCard, { backgroundColor: ORANGE + '14' }]}
                onPress={() => setPickerOpen(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="barbell" size={110} color={ORANGE} style={s.chooseWatermark} />
                <View style={[s.chooseIcon, { backgroundColor: ORANGE }]}>
                  <Ionicons name="barbell" size={26} color="#000" />
                </View>
                <View style={s.chooseTextWrap}>
                  <Text style={s.chooseTitle}>Gym</Text>
                  <Text style={s.chooseHint}>Välj övningar och logga set</Text>
                </View>
                <View style={[s.chooseArrow, { backgroundColor: ORANGE + '26' }]}>
                  <Ionicons name="arrow-forward" size={15} color={ORANGE} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.chooseCard, { backgroundColor: CARDIO_BLUE + '14' }]}
                onPress={() => setStep('cardio')}
                activeOpacity={0.85}
              >
                <Ionicons name="fitness" size={110} color={CARDIO_BLUE} style={s.chooseWatermark} />
                <View style={[s.chooseIcon, { backgroundColor: CARDIO_BLUE }]}>
                  <Ionicons name="fitness" size={26} color="#fff" />
                </View>
                <View style={s.chooseTextWrap}>
                  <Text style={s.chooseTitle}>Cardio</Text>
                  <Text style={s.chooseHint}>GPS-pass med karta och tempo</Text>
                </View>
                <View style={[s.chooseArrow, { backgroundColor: CARDIO_BLUE + '26' }]}>
                  <Ionicons name="arrow-forward" size={15} color={CARDIO_BLUE} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Cardio-typ ── */}
        {step === 'cardio' && (
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
            {CARDIO_TYPES.map(t => (
              <TouchableOpacity key={t.key} style={s.cardioRow} onPress={() => onPickCardio(t.key, t.label)} activeOpacity={0.8}>
                <View style={[s.cardioIcon, { backgroundColor: CARDIO_BLUE + '18' }]}>
                  <Ionicons name={t.icon} size={22} color={CARDIO_BLUE} />
                </View>
                <Text style={s.cardioLabel}>{t.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            ))}
          </ScrollView>
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

              {/* Set, reps och vikt fylls i inne i passet — här väljs bara övningarna */}
              <View style={s.exListCard}>
                {entries.map((en, i) => (
                  <View key={en.exercise.id} style={[s.exListRow, i < entries.length - 1 && s.exListBorder]}>
                    <View style={s.exListIcon}>
                      <Ionicons name="barbell-outline" size={17} color={ORANGE} />
                    </View>
                    <Text style={s.exListName} numberOfLines={1}>{en.exercise.name}</Text>
                    <TouchableOpacity onPress={() => removeEntry(en.exercise.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={20} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Fler övningar via muskelgruppssidan */}
              <TouchableOpacity style={s.addExBtn} onPress={() => setPickerOpen(true)} activeOpacity={0.8}>
                <Ionicons name="add" size={19} color={ORANGE} />
                <Text style={s.addExText}>Lägg till övning</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
              <TouchableOpacity
                style={[s.primaryBtn, (saving || entries.length === 0) && { opacity: 0.6 }]}
                onPress={save}
                disabled={saving || entries.length === 0}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark" size={20} color="#000" />
                <Text style={s.primaryBtnText}>{saving ? 'Sparar…' : 'Spara pass'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Muskelgruppssidan — samma väljare som i passvyn, gymOnly.
            Ligger inne i modalens träd så den presenterar korrekt på iOS. */}
        <ExercisePickerSheet
          visible={pickerOpen}
          exercises={exercises}
          gymOnly
          multiSelect
          onSelect={handlePickerSelect}
          onConfirmMulti={handlePickerConfirm}
          onClose={handlePickerClose}
        />
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
  chooseCards: { gap: 14 },
  chooseCard: {
    borderRadius: 24, padding: 20, minHeight: 150,
    justifyContent: 'space-between', overflow: 'hidden',
  },
  chooseWatermark: {
    position: 'absolute', right: -18, top: -14, opacity: 0.10,
    transform: [{ rotate: '-12deg' }],
  },
  chooseIcon: {
    width: 46, height: 46, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  chooseTextWrap: { gap: 3, marginTop: 14 },
  chooseTitle: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  chooseHint: { color: TEXT_SECONDARY, fontSize: 13 },
  chooseArrow: {
    position: 'absolute', right: 16, bottom: 16,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },

  cardioRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: CARD, borderRadius: 16, padding: 14,
  },
  cardioIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardioLabel: { flex: 1, color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },

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

  addExBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: ORANGE + '50', borderStyle: 'dashed',
  },
  addExText: { color: ORANGE, fontSize: 15, fontWeight: '700' },

  fieldLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8, paddingHorizontal: 4 },
  nameInput: {
    backgroundColor: CARD, borderRadius: 14,
    color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600', paddingHorizontal: 14, paddingVertical: 14,
  },
  exListCard: { backgroundColor: CARD, borderRadius: 18, overflow: 'hidden' },
  exListRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  exListBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  exListIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: ORANGE + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  exListName: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
})
