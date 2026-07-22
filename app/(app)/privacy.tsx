import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getProfile, updateProfile } from '@/services/profile'
import { GlassCircleButton } from '@/components/GlassButton'
import { BG, CARD, BORDER, ORANGE, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

// =============================================================================
// INTEGRITETSINSTÄLLNINGAR — Strava-mönstret: lista med nuvarande värde,
// undersida med radioval och förklaringar. Alla val är PÅ RIKTIGT:
// sökbarheten filtreras i search_profiles, profilvalet styr triggern som
// auto-godkänner följare (is_public), och aktivitetssynligheten
// upprätthålls av RLS-policyerna på pass/gillanden/kommentarer.
// Framstegsfoton är alltid privata oavsett val.
// =============================================================================

type SettingKey = 'search' | 'profile' | 'activities'

interface Option {
  value: string
  title: string
  description: string
}

const SETTINGS: Record<SettingKey, {
  label: string
  intro: string
  options: Option[]
}> = {
  search: {
    label: 'Sökning',
    intro: 'Välj om andra kan hitta dig via sökningen. Du kan alltid söka och skicka förfrågningar själv, oavsett val.',
    options: [
      {
        value: 'all',
        title: 'Alla',
        description: 'Alla i SeventyFive kan hitta dig via sökningen och skicka en vänförfrågan.',
      },
      {
        value: 'none',
        title: 'Ingen',
        description: 'Du går inte att hitta via sökningen. Befintliga följare påverkas inte.',
      },
    ],
  },
  profile: {
    label: 'Profil',
    intro: 'Välj om nya följare behöver ditt godkännande. Först när någon följer dig kan de se din statistik.',
    options: [
      {
        value: 'all',
        title: 'Alla',
        description: 'Nya följare godkänns automatiskt och ser din statistik direkt. Väntande förfrågningar godkänns när du väljer detta.',
      },
      {
        value: 'approval',
        title: 'Godkännande krävs',
        description: 'Du godkänner varje vänförfrågan i notiscentret innan personen kan följa dig och se din statistik.',
      },
    ],
  },
  activities: {
    label: 'Aktiviteter',
    intro: 'Välj vem som ser dina pass i flödet och din statistik. Framstegsfoton är alltid privata, oavsett vad du väljer här.',
    options: [
      {
        value: 'followers',
        title: 'Följare',
        description: 'Godkända följare ser dina pass i flödet, din statistik och kan gilla och kommentera.',
      },
      {
        value: 'private',
        title: 'Bara du',
        description: 'Dina pass och din statistik är helt privata — även för godkända följare. Ingen kan gilla eller kommentera dina pass.',
      },
    ],
  },
}

export default function PrivacyScreen() {
  const [userId, setUserId] = useState<string | null>(null)
  const [searchable, setSearchable] = useState(true)
  const [isPublic, setIsPublic] = useState(false)
  const [activityVisibility, setActivityVisibility] = useState<'followers' | 'private'>('followers')
  const [picker, setPicker] = useState<SettingKey | null>(null)

  useFocusEffect(useCallback(() => {
    let alive = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user || !alive) return
      setUserId(session.user.id)
      getProfile(session.user.id).then(p => {
        if (!alive || !p) return
        setSearchable(p.searchable ?? true)
        setIsPublic(p.is_public ?? false)
        setActivityVisibility(p.activity_visibility ?? 'followers')
      }).catch(() => {})
    })
    return () => { alive = false }
  }, []))

  function save(updates: Parameters<typeof updateProfile>[1]) {
    if (!userId) return
    updateProfile(userId, updates).catch(() => {})
  }

  const currentValue: Record<SettingKey, string> = {
    search: searchable ? 'all' : 'none',
    profile: isPublic ? 'all' : 'approval',
    activities: activityVisibility,
  }

  const displayValue: Record<SettingKey, string> = {
    search: searchable ? 'Alla' : 'Ingen',
    profile: isPublic ? 'Alla' : 'Godkännande krävs',
    activities: activityVisibility === 'followers' ? 'Följare' : 'Bara du',
  }

  function select(key: SettingKey, value: string) {
    Haptics.selectionAsync()
    if (key === 'search') {
      const next = value === 'all'
      setSearchable(next)
      save({ searchable: next })
    } else if (key === 'profile') {
      const next = value === 'all'
      setIsPublic(next)
      save({ is_public: next })
    } else {
      const next = value as 'followers' | 'private'
      setActivityVisibility(next)
      save({ activity_visibility: next })
    }
  }

  const active = picker ? SETTINGS[picker] : null

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <GlassCircleButton
          icon="chevron-back"
          size={40}
          iconColor={TEXT_PRIMARY}
          onPress={() => router.back()}
          fallbackStyle={s.iconBtnFallback}
        />
        <Text style={s.title}>Integritet</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.sectionLabel}>VAR DU VISAS</Text>
        <View style={s.rowsCard}>
          {(Object.keys(SETTINGS) as SettingKey[]).map((key, i) => (
            <View key={key}>
              {i > 0 && <View style={s.rowDivider} />}
              <TouchableOpacity
                style={s.row}
                onPress={() => setPicker(key)}
                activeOpacity={0.7}
                testID={`privacy-${key}`}
              >
                <Text style={s.rowLabel}>{SETTINGS[key].label}</Text>
                <Text style={s.rowValue}>{displayValue[key]}</Text>
                <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Text style={s.footnote}>
          Framstegsfoton är alltid privata och delas aldrig med någon.
        </Text>
      </ScrollView>

      {/* Undersidan: förklaring + radioval, som förlagan */}
      <Modal visible={picker !== null} animationType="slide" onRequestClose={() => setPicker(null)}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <GlassCircleButton
              icon="chevron-back"
              size={40}
              iconColor={TEXT_PRIMARY}
              onPress={() => setPicker(null)}
              fallbackStyle={s.iconBtnFallback}
            />
            <Text style={s.title}>{active?.label ?? ''}</Text>
            <View style={{ width: 40 }} />
          </View>

          {picker && active && (
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
              <Text style={s.intro}>{active.intro}</Text>
              {active.options.map(option => {
                const selected = currentValue[picker] === option.value
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={s.option}
                    onPress={() => select(picker, option.value)}
                    activeOpacity={0.7}
                    testID={`option-${option.value}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.optionTitle}>{option.title}</Text>
                      <Text style={s.optionBody}>{option.description}</Text>
                    </View>
                    <View style={[s.radio, selected && s.radioSelected]}>
                      {selected && <View style={s.radioDot} />}
                    </View>
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

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  iconBtnFallback: { backgroundColor: CARD },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  sectionLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, paddingHorizontal: 4, marginBottom: 8,
  },
  rowsCard: {
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 15,
  },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)', marginLeft: 16 },
  rowLabel: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  rowValue: { color: TEXT_SECONDARY, fontSize: 14 },
  footnote: {
    color: TEXT_SECONDARY, fontSize: 12, lineHeight: 18,
    paddingHorizontal: 4, marginTop: 14,
  },

  intro: { color: TEXT_PRIMARY, fontSize: 15, lineHeight: 22, marginBottom: 26 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 16,
  },
  optionTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  optionBody: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 20, marginTop: 5 },
  radio: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: ORANGE },
  radioDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: ORANGE },
})
