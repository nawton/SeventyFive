import { useEffect, useState } from 'react'
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@/components/Icon'
import { GlassCircleButton } from '@/components/GlassButton'
import { AppTextInput } from '@/components/AppTextInput'
import { ExercisePickerSheet } from '@/components/ExercisePickerSheet'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { useT } from '@/lib/i18n'
import { BG, TEXT_PRIMARY, TEXT_SECONDARY, useThemeStrings } from '@/lib/theme'
import type { Exercise } from '@/services/exercises'
import {
  createCoachWorkout, type CoachWorkout, type CoachExercise, type OrgMember,
} from '@/services/organizations'

// =============================================================================
// TRÄNARPASSET — coachen sätter ihop ett pass och väljer vilka som ska
// kunna joina det: hela föreningen eller handplockade medlemmar.
// Gympass byggs med samma övningsväljare som schemat; cardiopass är
// typ + beskrivning (tempo, distans osv. skrivs i noteringen).
// =============================================================================

const CARDIO_TYPES: Array<{ key: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'running',  label: 'Löpning',   icon: 'fitness-outline' },
  { key: 'cycling',  label: 'Cykling',   icon: 'bicycle-outline' },
  { key: 'interval', label: 'Intervall', icon: 'flash-outline' },
  { key: 'walking',  label: 'Promenad',  icon: 'walk-outline' },
]

interface Draft { key: string; exercise_name: string; sets: string; reps: string }

export function CoachWorkoutSheet({ visible, orgId, userId, members, exercises, onClose, onCreated }: {
  visible: boolean
  orgId: string
  userId: string | null
  /** Föreningens medlemmar — för handplockade mottagare */
  members: OrgMember[]
  exercises: Exercise[]
  onClose: () => void
  onCreated: (w: CoachWorkout) => void
}) {
  const t = useT()
  const T = useThemeStrings()
  const insets = useSafeAreaInsets()
  const onAccent = T.TEXT_PRIMARY === '#FFFFFF' ? '#000000' : '#FFFFFF'
  const hairline = 'rgba(128,128,128,0.25)'

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [type, setType] = useState<'gym' | 'cardio'>('gym')
  const [cardioType, setCardioType] = useState('running')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [everyone, setEveryone] = useState(true)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [seq, setSeq] = useState(0)

  useEffect(() => {
    if (!visible) return
    setName(''); setNotes(''); setType('gym'); setCardioType('running')
    setDrafts([]); setPickerOpen(false); setEveryone(true); setPicked(new Set()); setBusy(false)
  }, [visible])

  function addExercises(exs: Exercise[]) {
    setDrafts(prev => {
      const have = new Set(prev.map(d => d.exercise_name))
      let n = seq
      const added = exs.filter(e => !have.has(e.name)).map(e => ({
        key: `d${++n}`, exercise_name: e.name, sets: '3', reps: '10',
      }))
      setSeq(n)
      return [...prev, ...added]
    })
  }

  function togglePick(id: string) {
    Haptics.selectionAsync()
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    if (busy || !userId) return
    if (name.trim().length < 2) {
      Alert.alert(t('Ange ett namn'), t('Passet behöver ett namn.'))
      return
    }
    if (type === 'gym' && drafts.length === 0) {
      Alert.alert(t('Inga övningar'), t('Lägg till minst en övning i passet.'))
      return
    }
    if (!everyone && picked.size === 0) {
      Alert.alert(t('Inga mottagare'), t('Välj minst en medlem, eller skicka till hela föreningen.'))
      return
    }
    const exList: CoachExercise[] = type === 'gym'
      ? drafts.map(d => ({
          exercise_name: d.exercise_name,
          sets: Number.isFinite(parseInt(d.sets, 10)) && parseInt(d.sets, 10) > 0 ? parseInt(d.sets, 10) : 3,
          reps: d.reps.trim() || '10',
        }))
      : []
    try {
      setBusy(true)
      const w = await createCoachWorkout({
        orgId,
        createdBy: userId,
        name,
        notes,
        sessionType: type,
        cardioType: type === 'cardio' ? cardioType : null,
        exercises: exList,
        audience: everyone ? 'org' : 'selected',
        recipientIds: everyone ? undefined : [...picked],
      })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onCreated(w)
    } catch {
      Alert.alert(t('Kunde inte spara'), t('Något gick fel. Försök igen.'))
    } finally {
      setBusy(false)
    }
  }

  const others = members.filter(m => m.id !== userId)

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.screen, { backgroundColor: T.BG, paddingTop: insets.top }]}>
        <View style={s.header}>
          <GlassCircleButton icon="close" size={40} iconColor={TEXT_PRIMARY}
            onPress={onClose} fallbackStyle={{ backgroundColor: 'rgba(128,128,128,0.14)' }} testID="coachSheetClose" />
          <Text style={s.title}>{t('Nytt tränarpass')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.fieldLabel}>{t('PASSNAMN')}</Text>
            <AppTextInput
              style={[s.input, { borderColor: hairline, color: T.TEXT_PRIMARY }]}
              value={name}
              onChangeText={setName}
              placeholder={t('t.ex. Torsdagsintervaller')}
              placeholderTextColor={TEXT_SECONDARY}
              autoCorrect={false}
              maxLength={80}
              testID="coachName"
            />

            <Text style={s.fieldLabel}>{t('BESKRIVNING (VALFRITT)')}</Text>
            <AppTextInput
              style={[s.input, s.inputMulti, { borderColor: hairline, color: T.TEXT_PRIMARY }]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('Syfte, tempo, vad medlemmarna ska tänka på…')}
              placeholderTextColor={TEXT_SECONDARY}
              multiline
              maxLength={2000}
              testID="coachNotes"
            />

            {/* Typval: gym med övningar eller cardio med typ */}
            <Text style={s.fieldLabel}>{t('TYP AV PASS')}</Text>
            <View style={s.typeRow}>
              {(['gym', 'cardio'] as const).map(k => {
                const on = type === k
                return (
                  <TouchableOpacity
                    key={k}
                    style={[s.typeBtn, { borderColor: on ? T.ACCENT : hairline }, on && { backgroundColor: `${T.ACCENT}14` }]}
                    onPress={() => { Haptics.selectionAsync(); setType(k) }}
                    activeOpacity={0.8}
                    testID={`coachType-${k}`}
                  >
                    <Ionicons name={k === 'gym' ? 'barbell-outline' : 'fitness-outline'} size={16}
                      color={on ? T.ACCENT : TEXT_PRIMARY} />
                    <Text style={[s.typeText, on && { color: T.ACCENT, fontWeight: '700' }]}>
                      {k === 'gym' ? t('Gym') : t('Cardio')}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {type === 'cardio' ? (
              <View style={s.typeRow}>
                {CARDIO_TYPES.map(ct => {
                  const on = cardioType === ct.key
                  return (
                    <TouchableOpacity
                      key={ct.key}
                      style={[s.cardioBtn, { borderColor: on ? T.ACCENT : hairline }, on && { backgroundColor: `${T.ACCENT}14` }]}
                      onPress={() => { Haptics.selectionAsync(); setCardioType(ct.key) }}
                      activeOpacity={0.8}
                      testID={`coachCardio-${ct.key}`}
                    >
                      <Ionicons name={ct.icon} size={15} color={on ? T.ACCENT : TEXT_PRIMARY} />
                      <Text style={[s.cardioText, on && { color: T.ACCENT, fontWeight: '700' }]}>{t(ct.label)}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ) : (
              <>
                {drafts.map(d => (
                  <View key={d.key} style={[s.exRow, { borderColor: hairline }]}>
                    <Text style={s.exName} numberOfLines={1}>{t(d.exercise_name)}</Text>
                    <AppTextInput
                      style={[s.exInput, { borderColor: hairline, color: T.TEXT_PRIMARY }]}
                      value={d.sets}
                      onChangeText={v => setDrafts(prev => prev.map(x => x.key === d.key ? { ...x, sets: v.replace(/[^0-9]/g, '') } : x))}
                      keyboardType="number-pad"
                      placeholder={t('Set')}
                      placeholderTextColor={TEXT_SECONDARY}
                    />
                    <AppTextInput
                      style={[s.exInput, { borderColor: hairline, color: T.TEXT_PRIMARY }]}
                      value={d.reps}
                      onChangeText={v => setDrafts(prev => prev.map(x => x.key === d.key ? { ...x, reps: v } : x))}
                      placeholder={t('Reps')}
                      placeholderTextColor={TEXT_SECONDARY}
                    />
                    <TouchableOpacity
                      onPress={() => setDrafts(prev => prev.filter(x => x.key !== d.key))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      testID={`coachRemoveEx-${d.key}`}
                    >
                      <Ionicons name="close-circle" size={20} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={[s.addExBtn, { borderColor: `${T.ACCENT}30` }]}
                  onPress={() => setPickerOpen(true)}
                  activeOpacity={0.8}
                  testID="coachAddExercise"
                >
                  <Ionicons name="add" size={19} color={T.ACCENT} />
                  <Text style={[s.addExText, { color: T.ACCENT }]}>{t('Lägg till övning')}</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Målgruppen: alla i föreningen eller handplockade */}
            <Text style={s.fieldLabel}>{t('VILKA KAN JOINA PASSET?')}</Text>
            <TouchableOpacity
              style={[s.audienceRow, { borderColor: everyone ? T.ACCENT : hairline }, everyone && { backgroundColor: `${T.ACCENT}10` }]}
              onPress={() => { Haptics.selectionAsync(); setEveryone(true) }}
              activeOpacity={0.8}
              testID="audienceOrg"
            >
              <Ionicons name="people-outline" size={18} color={everyone ? T.ACCENT : TEXT_PRIMARY} />
              <Text style={[s.audienceText, everyone && { color: T.ACCENT, fontWeight: '700' }]}>{t('Hela föreningen')}</Text>
              {everyone && <Ionicons name="checkmark-circle" size={18} color={T.ACCENT} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.audienceRow, { borderColor: !everyone ? T.ACCENT : hairline }, !everyone && { backgroundColor: `${T.ACCENT}10` }]}
              onPress={() => { Haptics.selectionAsync(); setEveryone(false) }}
              activeOpacity={0.8}
              testID="audienceSelected"
            >
              <Ionicons name="person-outline" size={18} color={!everyone ? T.ACCENT : TEXT_PRIMARY} />
              <Text style={[s.audienceText, !everyone && { color: T.ACCENT, fontWeight: '700' }]}>
                {picked.size > 0 ? t('Utvalda medlemmar ({n})', { n: picked.size }) : t('Utvalda medlemmar')}
              </Text>
              {!everyone && <Ionicons name="checkmark-circle" size={18} color={T.ACCENT} />}
            </TouchableOpacity>

            {!everyone && others.map(m => {
              const on = picked.has(m.id)
              return (
                <TouchableOpacity
                  key={m.id}
                  style={s.memberRow}
                  onPress={() => togglePick(m.id)}
                  activeOpacity={0.7}
                  testID={`pickMember-${m.id}`}
                >
                  <FeedAvatar url={m.avatar_url} fallback={(m.name ?? '?').charAt(0).toUpperCase()} size={38} />
                  <Text style={s.memberName} numberOfLines={1}>{m.name ?? t('Namnlös')}</Text>
                  <Ionicons
                    name={on ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={on ? T.ACCENT : TEXT_SECONDARY}
                  />
                </TouchableOpacity>
              )
            })}
            {!everyone && others.length === 0 && (
              <Text style={s.hint}>{t('Föreningen har inga andra medlemmar ännu.')}</Text>
            )}
          </ScrollView>

          <View style={[s.footer, { paddingBottom: insets.bottom + 14 }]}>
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: T.ACCENT }, busy && { opacity: 0.6 }]}
              onPress={save}
              disabled={busy}
              activeOpacity={0.85}
              testID="coachSave"
            >
              {busy
                ? <ActivityIndicator color={onAccent} />
                : <Text style={[s.primaryBtnText, { color: onAccent }]}>{t('Publicera pass')}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        <ExercisePickerSheet
          visible={pickerOpen}
          exercises={exercises}
          gymOnly
          multiSelect
          onSelect={ex => { addExercises([ex]) }}
          onConfirmMulti={exs => { addExercises(exs); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '800' },
  scroll: { paddingHorizontal: 20, paddingBottom: 30 },
  fieldLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 8, marginTop: 18,
  },
  input: {
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1, borderRadius: 14, paddingVertical: 12,
  },
  typeText: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  cardioBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8,
    marginTop: 8,
  },
  cardioText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' },
  exRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 8,
  },
  exName: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  exInput: {
    width: 52, borderWidth: 1, borderRadius: 10, paddingVertical: 7,
    fontSize: 14, textAlign: 'center',
  },
  addExBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 12,
    marginTop: 2,
  },
  addExText: { fontSize: 14, fontWeight: '700' },
  audienceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
    marginBottom: 8,
  },
  audienceText: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 4,
  },
  memberName: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  hint: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 4, paddingHorizontal: 4 },
  footer: { paddingHorizontal: 20, paddingTop: 8 },
  primaryBtn: {
    borderRadius: 16, paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '800' },
})
