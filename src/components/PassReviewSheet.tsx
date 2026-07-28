import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Modal, Image, TouchableOpacity,
  Alert, ActivityIndicator, useColorScheme,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Pressable, Platform, KeyboardAvoidingView } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@/components/Icon'
import { useT } from '@/lib/i18n'
import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, useThemeStrings } from '@/lib/theme'
import { compressImage } from '@/lib/image'
import { fmtTime } from '@/lib/format'
import { savePassMeta } from '@/services/gymPassMeta'
import { updateStrengthWorkoutSets } from '@/services/workouts'
import { exerciseImageUrlFor } from '@/lib/exerciseInfo/images'
import { effortColor, effortLabel } from '@/components/EffortRating'
import { AppTextInput } from '@/components/AppTextInput'

// =============================================================================
// GRANSKNING EFTER PASSET — visas efter ansträngningsbetyget: gå igenom
// att allt stämmer, sätt titel, skriv en kommentar och lägg till ett foto
// som syns i flödet. Övningarna med loggade set ligger längst ner.
// Hoppa över sparar ingenting, passet är redan säkrat innan skärmen visas.
// =============================================================================

const SLIDE = 640
const SPRING = { damping: 20, stiffness: 220, mass: 0.8 } as const

export type ReviewEntry = {
  name: string
  /** user_workouts-radens id — gör övningen redigerbar från granskningen */
  workoutId?: string | null
  sets: Array<{ reps: number; weightKg: number }>
}

export function PassReviewSheet({ workoutDate, durationS, effort, entries: initialEntries, onDone }: {
  workoutDate: string
  durationS: number | null
  effort: number | null
  entries: ReviewEntry[]
  onDone: () => void
}) {
  const t = useT()
  const T = useThemeStrings()
  const tint = (alpha: string) => `${T.ACCENT}${alpha}`
  const onAccent = useColorScheme() === 'light' ? '#FFFFFF' : '#000000'
  const insets = useSafeAreaInsets()
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Redigerbara lokalt — sparas per övning direkt mot databasen
  const [entries, setEntries] = useState<ReviewEntry[]>(initialEntries)
  const [editIx, setEditIx] = useState<number | null>(null)
  const [editSets, setEditSets] = useState<Array<{ reps: string; weight: string }>>([])
  const [editSaving, setEditSaving] = useState(false)

  const editTy = useSharedValue(SLIDE)

  function openEdit(ix: number) {
    setEditSets(entries[ix].sets.map(r => ({ reps: String(r.reps), weight: r.weightKg > 0 ? String(r.weightKg) : '' })))
    setEditIx(ix)
    editTy.value = SLIDE
    editTy.value = withSpring(0, SPRING)
  }

  function closeEdit() {
    editTy.value = withTiming(SLIDE, { duration: 200 }, finished => {
      if (finished) runOnJS(setEditIx)(null)
    })
  }

  const editDrag = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .onUpdate(e => {
      editTy.value = e.translationY > 0 ? e.translationY : e.translationY * 0.15
    })
    .onEnd(e => {
      if (e.translationY > 100 || e.velocityY > 600) {
        editTy.value = withTiming(SLIDE, { duration: 200 }, finished => {
          if (finished) runOnJS(setEditIx)(null)
        })
      } else {
        editTy.value = withSpring(0, SPRING)
      }
    })

  const editSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: editTy.value }],
  }))

  async function saveEdit() {
    if (editIx === null) return
    const entry = entries[editIx]
    const parsed = editSets
      .map(r => ({ reps: parseInt(r.reps, 10) || 0, weight_kg: parseFloat(r.weight.replace(',', '.')) || 0 }))
      .filter(r => r.reps > 0)
    if (parsed.length === 0 || !entry.workoutId) { closeEdit(); return }
    setEditSaving(true)
    try {
      await updateStrengthWorkoutSets(entry.workoutId, parsed)
      setEntries(prev => prev.map((e, i) => i === editIx
        ? { ...e, sets: parsed.map(r => ({ reps: r.reps, weightKg: r.weight_kg })) }
        : e))
      closeEdit()
    } catch {
      Alert.alert(t('Något gick fel'), t('Ändringen kunde inte sparas. Försök igen.'))
    } finally {
      setEditSaving(false)
    }
  }

  const totalSets = entries.reduce((s, e) => s + e.sets.length, 0)
  const totalKg = entries.reduce((s, e) => s + e.sets.reduce((x, r) => x + r.reps * r.weightKg, 0), 0)

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('Åtkomst nekad'), t('Tillåt åtkomst till fotobiblioteket i Inställningar.'))
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    })
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0]
      // Flödeskort och detaljvy visar max ~700 pt bredd, 1280 px räcker
      setPhotoUri(await compressImage(a.uri, a.width, 1280))
    }
  }

  async function save() {
    if (!title.trim() && !note.trim() && !photoUri) { onDone(); return }
    setSaving(true)
    try {
      await savePassMeta({ workoutDate, title, note, photoUri })
      onDone()
    } catch {
      setSaving(false)
      Alert.alert(t('Kunde inte spara'), t('Passet är sparat, men titeln och fotot kunde inte laddas upp. Försök igen.'))
    }
  }

  return (
    // Helskärm, inte pageSheet: en svepning ner slängde annars titel,
    // kommentar och foto man hunnit skriva. Klar och Hoppa över är enda
    // vägarna ut, Android-backen får inte tyst kasta inmatningen heller.
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => {}}>
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          testID="passReviewSheet"
        >
          <View style={s.header}>
            <Text style={s.headTitle}>{t('Bra jobbat!')}</Text>
            <Text style={s.headSub}>{t('Gå igenom passet innan det delas, allt är redan sparat.')}</Text>
          </View>

          {/* Snabbsiffrorna att kontrollera */}
          <View style={s.statCard}>
            <View style={s.statCell}>
              <Text style={s.statLbl}>{t('TID')}</Text>
              <Text style={s.statVal}>{durationS !== null && durationS > 0 ? fmtTime(durationS) : '-'}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statCell}>
              <Text style={s.statLbl}>{t('SET')}</Text>
              <Text style={s.statVal}>{totalSets}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statCell}>
              <Text style={s.statLbl}>{t('VOLYM')}</Text>
              <Text style={s.statVal}>{Math.round(totalKg)} kg</Text>
            </View>
            {effort !== null && (
              <>
                <View style={s.statDivider} />
                <View style={s.statCell}>
                  <Text style={s.statLbl}>{t('KÄNSLA')}</Text>
                  <Text style={[s.statVal, { color: effortColor(effort) }]}>{t(effortLabel(effort))}</Text>
                </View>
              </>
            )}
          </View>

          <Text style={s.label}>{t('TITEL')}</Text>
          <AppTextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t('Gympass')}
            placeholderTextColor={TEXT_SECONDARY}
            returnKeyType="done"
            testID="reviewTitle"
          />

          <Text style={s.label}>{t('KOMMENTAR')}</Text>
          <AppTextInput
            style={[s.input, s.noteInput]}
            value={note}
            onChangeText={setNote}
            placeholder={t('Hur kändes passet?')}
            placeholderTextColor={TEXT_SECONDARY}
            multiline
            testID="reviewNote"
          />

          <Text style={s.label}>{t('FOTO')}</Text>
          {photoUri ? (
            <View style={s.photoWrap}>
              <Image source={{ uri: photoUri }} style={s.photo} />
              <TouchableOpacity style={s.photoRemove} onPress={() => setPhotoUri(null)} hitSlop={8} testID="removePhoto">
                <Ionicons name="close" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.photoBtn, { borderColor: tint('55') }]}
              onPress={pickPhoto}
              activeOpacity={0.75}
              testID="addPhoto"
            >
              <Ionicons name="camera-outline" size={20} color={T.ACCENT} />
              <Text style={[s.photoBtnText, { color: T.ACCENT }]}>{t('Lägg till foto')}</Text>
            </TouchableOpacity>
          )}

          {/* Övningarna längst ner, som facit */}
          <Text style={s.label}>{t('ÖVNINGAR')}</Text>
          <View style={s.exCard}>
            {entries.length === 0 && (
              <Text style={s.emptyText}>{t('Inga set loggades det här passet.')}</Text>
            )}
            {entries.map((e, i) => {
              const img = exerciseImageUrlFor(e.name)
              return (
                <TouchableOpacity
                  key={e.name + i}
                  style={[s.exRow, i > 0 && s.exBorder]}
                  onPress={e.workoutId ? () => openEdit(i) : undefined}
                  activeOpacity={e.workoutId ? 0.7 : 1}
                  testID={`reviewEx-${i}`}
                >
                  {img ? (
                    <Image source={{ uri: img }} style={s.exImg} />
                  ) : (
                    <View style={[s.exImg, s.exIconBox]}>
                      <Ionicons name="barbell-outline" size={16} color={TEXT_SECONDARY} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.exName} numberOfLines={1}>{t(e.name)}</Text>
                    <Text style={s.exSets} numberOfLines={1}>
                      {e.sets.map(r => r.weightKg > 0 ? `${r.weightKg}×${r.reps}` : `${r.reps}`).join('  ·  ')}
                    </Text>
                  </View>
                  <Text style={s.exCount}>{t('{n} set', { n: e.sets.length })}</Text>
                  {e.workoutId ? <Ionicons name="pencil-outline" size={15} color={TEXT_SECONDARY} /> : null}
                </TouchableOpacity>
              )
            })}
          </View>
        </ScrollView>

        {editIx !== null && (
          <Modal visible transparent animationType="fade" onRequestClose={closeEdit}>
            <GestureHandlerRootView style={s.editRoot}>
              <Pressable style={s.editBackdrop} onPress={closeEdit} testID="editBackdrop" />
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <Animated.View style={[s.editSheet, { paddingBottom: insets.bottom + 16 }, editSheetStyle]}>
                  {/* Handtaget och rubriken äger nedsvepet, inte inmatningsfälten */}
                  <GestureDetector gesture={editDrag}>
                    <View style={s.editDragArea}>
                      <View style={s.editHandle} />
                      <Text style={s.editTitle}>{t(entries[editIx].name)}</Text>
                    </View>
                  </GestureDetector>

                  <View style={s.editHead}>
                    <Text style={[s.editTh, { width: 30 }]}>{t('SET')}</Text>
                    <Text style={[s.editTh, { flex: 1, textAlign: 'center' }]}>{t('REPS')}</Text>
                    <Text style={[s.editTh, { flex: 1, textAlign: 'center' }]}>{t('KG')}</Text>
                    <View style={{ width: 24 }} />
                  </View>
                  <ScrollView
                    style={{ flexGrow: 0 }}
                    contentContainerStyle={{ paddingBottom: 4 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {editSets.map((row, j) => (
                      <View key={j} style={s.editRow}>
                        <Text style={s.editNum}>{j + 1}</Text>
                        <AppTextInput
                          style={s.editInput}
                          value={row.reps}
                          onChangeText={v => setEditSets(prev => prev.map((r, k) => k === j ? { ...r, reps: v.replace(/[^0-9]/g, '') } : r))}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={TEXT_SECONDARY}
                          testID={`editReps-${j}`}
                        />
                        <AppTextInput
                          style={s.editInput}
                          value={row.weight}
                          onChangeText={v => setEditSets(prev => prev.map((r, k) => k === j ? { ...r, weight: v } : r))}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={TEXT_SECONDARY}
                          testID={`editKg-${j}`}
                        />
                        <TouchableOpacity
                          onPress={() => setEditSets(prev => prev.filter((_, k) => k !== j))}
                          hitSlop={8}
                          testID={`editRemove-${j}`}
                        >
                          <Ionicons name="close-circle" size={20} color={TEXT_SECONDARY} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                  <TouchableOpacity
                    style={[s.editAdd, { borderColor: tint('55') }]}
                    onPress={() => setEditSets(prev => [...prev, { reps: '', weight: '' }])}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="add" size={17} color={T.ACCENT} />
                    <Text style={[s.editAddText, { color: T.ACCENT }]}>{t('Lägg till set')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.saveBtn, { backgroundColor: T.ACCENT, marginTop: 14 }, editSaving && { opacity: 0.6 }]}
                    onPress={saveEdit}
                    disabled={editSaving}
                    activeOpacity={0.85}
                    testID="editSave"
                  >
                    {editSaving ? <ActivityIndicator color={onAccent} /> : <Text style={[s.saveBtnText, { color: onAccent }]}>{t('Spara')}</Text>}
                  </TouchableOpacity>
                </Animated.View>
              </KeyboardAvoidingView>
            </GestureHandlerRootView>
          </Modal>
        )}

        <View style={[s.footer, { paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: T.ACCENT }, saving && { opacity: 0.6 }]}
            onPress={save}
            disabled={saving}
            activeOpacity={0.85}
            testID="reviewSave"
          >
            {saving
              ? <ActivityIndicator color={onAccent} />
              : <Text style={[s.saveBtnText, { color: onAccent }]}>{t('Klar')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={onDone} disabled={saving} hitSlop={8} testID="reviewSkip">
            <Text style={s.skipText}>{t('Hoppa över')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 4, gap: 6 },
  headTitle: { color: TEXT_PRIMARY, fontSize: 26, fontWeight: '800' },
  headSub: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 20 },

  statCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 16,
    marginHorizontal: 20, marginTop: 16, paddingVertical: 14,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: BORDER },
  statLbl: { color: TEXT_SECONDARY, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  statVal: { color: TEXT_PRIMARY, fontSize: 15, fontFamily: NUM_FONT },

  label: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8,
  },
  input: {
    backgroundColor: CARD, borderRadius: 14, marginHorizontal: 20,
    color: TEXT_PRIMARY, fontSize: 16, paddingHorizontal: 14, paddingVertical: 13,
  },
  noteInput: { minHeight: 88, textAlignVertical: 'top' },

  photoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 20, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed',
  },
  photoBtnText: { fontSize: 15, fontWeight: '700' },
  photoWrap: { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 4 / 3, backgroundColor: CARD },
  photoRemove: {
    position: 'absolute', top: 10, right: 10,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },

  exCard: { backgroundColor: CARD, borderRadius: 16, marginHorizontal: 20, overflow: 'hidden' },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  exBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER },
  exImg: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFFFFF',
    resizeMode: 'contain', borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
  },
  exIconBox: { backgroundColor: 'rgba(128,128,128,0.12)', alignItems: 'center', justifyContent: 'center' },
  exName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  exSets: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  exCount: { color: TEXT_SECONDARY, fontSize: 13, fontFamily: NUM_FONT },
  emptyText: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', paddingVertical: 18 },

  editRoot: { flex: 1, justifyContent: 'flex-end' },
  editBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  editSheet: {
    backgroundColor: BG, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderWidth: 1, borderColor: BORDER, paddingHorizontal: 20, paddingTop: 10,
    maxHeight: 560,
  },
  editDragArea: { alignItems: 'center', paddingBottom: 4 },
  editHandle: {
    width: 44, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.45)', marginBottom: 14,
  },
  editTitle: { color: TEXT_PRIMARY, fontSize: 19, fontWeight: '800', alignSelf: 'flex-start', paddingBottom: 10 },
  editHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 6 },
  editTh: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  editNum: { width: 30, color: TEXT_SECONDARY, fontSize: 15, fontFamily: NUM_FONT },
  editInput: {
    flex: 1, backgroundColor: CARD, borderRadius: 12,
    color: TEXT_PRIMARY, fontSize: 16, paddingHorizontal: 12, paddingVertical: 11,
    textAlign: 'center',
  },
  editAdd: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 10, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
  },
  editAddText: { fontSize: 14, fontWeight: '700' },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: BG, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER,
  },
  saveBtn: {
    alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, paddingVertical: 16,
  },
  saveBtnText: { fontSize: 16, fontWeight: '800' },
  skipText: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600' },
})
