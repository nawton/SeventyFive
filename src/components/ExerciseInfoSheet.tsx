import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Modal, Image, useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GlassCircleButton } from '@/components/GlassButton'
import { useT, getLanguage } from '@/lib/i18n'
import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, useThemeStrings } from '@/lib/theme'
import type { Exercise } from '@/services/exercises'
import { publicExerciseImageUrl } from '@/lib/exerciseInfo/images'
import { EXERCISE_INFO } from '@/lib/exerciseInfo'
import { SLUG_LABELS } from '@/lib/muscles'
import { EQUIPMENT_LABELS } from '@/services/exercises'

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
  // Nya bibliotekets steg bor i databasen. Vyer som bara har namnet
  // (flödet, passdetaljer) hämtar dem här, med ren fetch så bladet
  // förblir fritt från supabase-klienten
  const [fetchedSteps, setFetchedSteps] = useState<Array<{ sv: string; en: string }> | null>(null)

  // Egna övningar (user_id) får aldrig bibliotekets bundlade steg vid namnkrock
  const info = exercise && !exercise.user_id ? EXERCISE_INFO[exercise.name] : undefined

  useEffect(() => {
    let alive = true
    setFetchedSteps(null)
    const base = process.env.EXPO_PUBLIC_SUPABASE_URL
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    if (!exercise || info || exercise.user_id || exercise.instructions?.length || !base || !key) return
    fetch(`${base}/rest/v1/exercises?select=instructions&name=eq.${encodeURIComponent(exercise.name)}&user_id=is.null&limit=1`,
      { headers: { apikey: key } })
      .then(r => r.json())
      .then(rows => { if (alive && Array.isArray(rows) && rows[0]?.instructions) setFetchedSteps(rows[0].instructions) })
      .catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.name])
  if (!exercise) return null
  const english = getLanguage() === 'en'
  // Nya biblioteket saknar bundlade steg — muskler och utrustning
  // kommer från radens egna kolumner istället
  const target = info?.target ?? (exercise.primary_muscle ? SLUG_LABELS[exercise.primary_muscle] : null)
  const secondary = info?.secondary ?? (exercise.other_muscles ?? []).map(m => SLUG_LABELS[m]).filter(Boolean)
  const equipment = info?.equipment ?? (exercise.equipment ? EQUIPMENT_LABELS[exercise.equipment] : null)
  const steps = info?.steps ?? (exercise.instructions?.length ? exercise.instructions : null) ?? fetchedSteps

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

          {target && (
            <View style={s.chipRow}>
              <View style={[s.chip, { backgroundColor: T.ACCENT }]}>
                <Text style={[s.chipText, { color: onAccent }]}>{t(target)}</Text>
              </View>
              {secondary.map(m => (
                <View key={m} style={[s.chip, { backgroundColor: tint('16') }]}>
                  <Text style={[s.chipText, { color: T.ACCENT }]}>{t(m)}</Text>
                </View>
              ))}
            </View>
          )}

          {equipment && (
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>{t('UTRUSTNING')}</Text>
              <Text style={s.metaValue}>{t(equipment)}</Text>
            </View>
          )}

          {steps && steps.length > 0 && (
            <>
              <Text style={s.sectionHeader}>{t('GENOMFÖRANDE')}</Text>
              {steps.map((step, i) => (
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
