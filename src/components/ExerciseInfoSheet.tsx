import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Modal, Image, useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GlassCircleButton } from '@/components/GlassButton'
import { useT, getLanguage } from '@/lib/i18n'
import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, useThemeStrings } from '@/lib/theme'
import type { Exercise } from '@/services/exercises'
import { publicExerciseImageUrl } from '@/lib/exerciseInfo/images'
import { EXERCISE_INFO } from '@/lib/exerciseInfo'

// =============================================================================
// INFOBLAD FÖR EN ÖVNING — stor animation, muskler, utrustning och
// steg-för-steg-instruktioner från det licensierade ExerciseDB-paketet.
// Öppnas från övningsväljaren via tryck på GIF:en eller långtryck på raden.
// =============================================================================

export function ExerciseInfoSheet({ exercise, onClose }: {
  exercise: Exercise | null
  onClose: () => void
}) {
  const t = useT()
  const T = useThemeStrings()
  // Rå accentsträng: iOS fryser dynamiska färger inne i modaler
  const tint = (alpha: string) => `${T.ACCENT}${alpha}`
  const onAccent = useColorScheme() === 'light' ? '#FFFFFF' : '#000000'
  const insets = useSafeAreaInsets()
  // 360-versionen är skarp i stora vyn, 180-plattan är reserv om den saknas
  const [bigFailed, setBigFailed] = useState(false)

  const info = exercise ? EXERCISE_INFO[exercise.name] : undefined
  if (!exercise) return null
  const english = getLanguage() === 'en'

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.screen}>
        <View style={s.header}>
          <Text style={s.title} numberOfLines={1}>{t(exercise.name)}</Text>
          <GlassCircleButton icon="close" size={36} iconColor={TEXT_PRIMARY} onPress={onClose} fallbackStyle={{ backgroundColor: CARD }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          testID="exerciseInfoSheet"
        >
          {exercise.image_path && (
            <View style={s.heroWrap}>
              <Image
                source={{ uri: publicExerciseImageUrl(bigFailed ? exercise.image_path : `360/${exercise.image_path}`) ?? undefined }}
                onError={() => setBigFailed(true)}
                style={s.hero}
              />
            </View>
          )}

          {info && (
            <>
              <View style={s.chipRow}>
                <View style={[s.chip, { backgroundColor: T.ACCENT }]}>
                  <Text style={[s.chipText, { color: onAccent }]}>{t(info.target)}</Text>
                </View>
                {info.secondary.map(m => (
                  <View key={m} style={[s.chip, { backgroundColor: tint('16') }]}>
                    <Text style={[s.chipText, { color: T.ACCENT }]}>{t(m)}</Text>
                  </View>
                ))}
              </View>

              <View style={s.metaRow}>
                <Text style={s.metaLabel}>{t('UTRUSTNING')}</Text>
                <Text style={s.metaValue}>{t(info.equipment)}</Text>
              </View>

              <Text style={s.sectionHeader}>{t('GENOMFÖRANDE')}</Text>
              {info.steps.map((step, i) => (
                <View key={i} style={s.stepRow}>
                  <View style={[s.stepBadge, { backgroundColor: tint('16') }]}>
                    <Text style={[s.stepBadgeText, { color: T.ACCENT }]}>{i + 1}</Text>
                  </View>
                  <Text style={s.stepText}>{english ? step.en : step.sv}</Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, gap: 12,
  },
  title: { flex: 1, color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800' },

  // Animationen är svart på vitt, plattan är vit i båda lägena
  heroWrap: {
    marginHorizontal: 20, marginTop: 4, borderRadius: 24,
    backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
    overflow: 'hidden', alignItems: 'center',
  },
  hero: { width: '100%', aspectRatio: 1, resizeMode: 'contain', backgroundColor: '#FFFFFF' },

  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 20, marginTop: 16,
  },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: '700' },

  metaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 20, marginTop: 16,
    backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
  },
  metaLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  metaValue: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },

  sectionHeader: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10,
  },
  stepRow: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    paddingHorizontal: 20, paddingBottom: 14,
  },
  stepBadge: {
    width: 26, height: 26, borderRadius: 13, marginTop: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBadgeText: { fontSize: 13, fontWeight: '800' },
  stepText: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, lineHeight: 22 },
})
