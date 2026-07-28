import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Modal, Image, TouchableOpacity,
  Alert, ActivityIndicator, useColorScheme,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@/components/Icon'
import { useT } from '@/lib/i18n'
import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, useThemeStrings } from '@/lib/theme'
import { compressImage } from '@/lib/image'
import { fmtTime } from '@/lib/format'
import { savePassMeta } from '@/services/gymPassMeta'
import { exerciseImageUrlFor } from '@/lib/exerciseInfo/images'
import { effortColor, effortLabel } from '@/components/EffortRating'
import { AppTextInput } from '@/components/AppTextInput'

// =============================================================================
// GRANSKNING EFTER PASSET — visas efter ansträngningsbetyget: gå igenom
// att allt stämmer, sätt titel, skriv en kommentar och lägg till ett foto
// som syns i flödet. Övningarna med loggade set ligger längst ner.
// Hoppa över sparar ingenting, passet är redan säkrat innan skärmen visas.
// =============================================================================

export type ReviewEntry = {
  name: string
  sets: Array<{ reps: number; weightKg: number }>
}

export function PassReviewSheet({ workoutDate, durationS, effort, entries, onDone }: {
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

  const totalSets = entries.reduce((s, e) => s + e.sets.length, 0)
  const totalKg = entries.reduce((s, e) => s + e.sets.reduce((x, r) => x + r.reps * r.weightKg, 0), 0)
  const totalReps = entries.reduce((s, e) => s + e.sets.reduce((x, r) => x + r.reps, 0), 0)

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
              <Text style={s.statLbl}>{t('REPS')}</Text>
              <Text style={s.statVal}>{totalReps}</Text>
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
            placeholder={t('T.ex. Tungt benpass')}
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
                <View key={e.name + i} style={[s.exRow, i > 0 && s.exBorder]}>
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
                </View>
              )
            })}
          </View>
        </ScrollView>

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
