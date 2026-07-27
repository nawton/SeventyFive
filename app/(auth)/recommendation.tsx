import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import { supabase } from '@/lib/supabase'
import { acceptChallenge as saveChallenge } from '@/services/challenge'
import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT, accentAlpha } from '@/lib/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

type Level = 'normal' | 'hard' | 'extreme'

interface LevelConfig {
  slug: Level
  name: string
  tagline: string
  rules: string[]
  color: string
  /** Bekräftelsetexten innan man låser in en tuffare nivå — tom för Normal */
  warning: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const LEVELS: Record<Level, LevelConfig> = {
  normal: {
    slug: 'normal',
    name: 'Normal',
    tagline: 'En stark start. Hållbar förändring.',
    rules: [
      '1 träningspass per dag (45 min)',
      'Följ din kostplan',
      'Drick 3 liter vatten',
      'Läs 10 sidor',
      'Ta ett progressfoto',
    ],
    color: '#3BE862',
    warning: '',
  },
  hard: {
    slug: 'hard',
    name: 'Hard',
    tagline: 'Disciplin bygger karaktär.',
    rules: [
      '2 träningspass per dag (45 min vardera)',
      'Noll fuskmat',
      'Drick 4 liter vatten',
      'Läs 10 sidor',
      'Ta ett progressfoto',
    ],
    color: '#FFA817',
    warning: 'Hard kräver två träningspass varje dag i 75 dagar, utan undantag. Missar du en dag börjar du om från dag 1.',
  },
  extreme: {
    slug: 'extreme',
    name: 'Extreme',
    tagline: 'Bara de starkaste klarar detta.',
    rules: [
      '2 träningspass per dag (ett utomhus)',
      'Strikt kostplan, inga undantag',
      'Drick 4 liter vatten',
      'Läs 20 sidor',
      'Ta ett progressfoto',
      'Kall dusch varje morgon',
    ],
    color: '#FF3B4A',
    warning: 'Extreme kräver två pass per dag varav ett utomhus, strikt kost, 20 sidor läsning och kall dusch varje morgon, i 75 dagar utan undantag.',
  },
}

const LEVEL_ORDER: Level[] = ['normal', 'hard', 'extreme']

// Kompakt jämförelse — samma ordning som LEVEL_ORDER
const COMPARE: Array<{ label: string; values: [string, string, string] }> = [
  { label: 'Pass',       values: ['1 per dag', '2 per dag', '2 per dag, ett ute'] },
  { label: 'Kost',       values: ['Kostplan', 'Noll fuskmat', 'Strikt, inga undantag'] },
  { label: 'Vatten',     values: ['3 liter', '4 liter', '4 liter'] },
  { label: 'Läsning',    values: ['10 sidor', '10 sidor', '20 sidor'] },
  { label: 'Kall dusch', values: ['Nej', 'Nej', 'Varje morgon'] },
]

function getRecommendedLevel(pressure: string): Level {
  if (pressure === 'extreme') return 'extreme'
  if (pressure === 'hard') return 'hard'
  return 'normal'
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RecommendationScreen() {
  const params = useLocalSearchParams<{ why: string; goal: string; pressure: string; startDay?: string }>()
  const recommendedLevel = getRecommendedLevel(params.pressure ?? 'normal')
  const [selectedLevel, setSelectedLevel] = useState<Level>(recommendedLevel)
  const [loading, setLoading] = useState(false)
  const level = LEVELS[selectedLevel]

  async function doAccept() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.replace('/(auth)/login'); return }

      const startDay = params.startDay ? parseInt(params.startDay, 10) : 1

      await saveChallenge(user.id, selectedLevel, {
        why: params.why ?? '',
        goal: params.goal ?? '',
        pressure: params.pressure ?? 'normal',
      }, startDay)
      // Cast tills Metro genererat om typed routes för den nya skärmen
      router.replace('/(auth)/setup-schedule' as any)
    } catch (e: any) {
      Alert.alert('Något gick fel', e.message)
    } finally {
      setLoading(false)
    }
  }

  // Nivåerna skiljer sig mycket — tuffare nivåer kräver en extra bekräftelse
  function handleAccept() {
    if (selectedLevel === 'normal') {
      doAccept()
      return
    }
    Alert.alert(
      `Säker på ${level.name}?`,
      `${level.warning}\n\nDe flesta lyckas bäst med Normal, du kan alltid köra en tuffare nivå nästa utmaning.`,
      [
        { text: 'Byt till Normal', onPress: () => setSelectedLevel('normal') },
        { text: `Kör ${level.name}`, style: 'destructive', onPress: doAccept },
        { text: 'Avbryt', style: 'cancel' },
      ],
    )
  }

  return (
    <SafeScreen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepLabel}>Steg 4 av 5</Text>
        <Text style={styles.title}>Välj din nivå</Text>
        <Text style={styles.subtitle}>
          Nivåerna skiljer sig mycket åt. Läs igenom vad som krävs innan du bestämmer dig.
        </Text>

        {/* Rådet: Normal passar de flesta */}
        <View style={styles.adviceBox}>
          <Ionicons name="information-circle" size={19} color={ACCENT} />
          <Text style={styles.adviceText}>
            För de flesta är <Text style={styles.adviceStrong}>Normal</Text> det bästa valet.
            Välj Hard eller Extreme bara om du redan tränar mycket och är väldigt
            fokuserad, eller har extremt tydliga mål.
          </Text>
        </View>

        {/* Nivåkorten — vald nivå fäller ut sina regler */}
        {LEVEL_ORDER.map(slug => {
          const l = LEVELS[slug]
          const selected = selectedLevel === slug
          return (
            <TouchableOpacity
              key={slug}
              testID={`level-${slug}`}
              style={[styles.levelCard, selected && { borderColor: l.color, backgroundColor: l.color + '12' }]}
              onPress={() => setSelectedLevel(slug)}
              activeOpacity={0.85}
            >
              <View style={styles.levelHead}>
                <View style={{ flex: 1 }}>
                  <View style={styles.levelNameRow}>
                    <Text style={[styles.levelName, { color: l.color }]}>{l.name}</Text>
                    {slug === recommendedLevel && (
                      <View style={styles.recBadge}>
                        <Text style={styles.recBadgeText}>REKOMMENDERAD</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.tagline}>{l.tagline}</Text>
                </View>
                <View style={[styles.radio, selected && { borderColor: l.color, backgroundColor: l.color }]}>
                  {selected && <Ionicons name="checkmark" size={13} color="#000" />}
                </View>
              </View>

              {selected && (
                <View style={styles.rulesList}>
                  {l.rules.map((rule, i) => (
                    <View key={i} style={styles.ruleRow}>
                      <View style={[styles.ruleDot, { backgroundColor: l.color }]} />
                      <Text style={styles.ruleText}>{rule}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          )
        })}

        {/* Jämförelsen — så mycket skiljer nivåerna */}
        <View style={styles.compareCard}>
          <Text style={styles.compareTitle}>Jämför nivåerna</Text>
          <View style={styles.compareRow}>
            <View style={styles.compareLabelCell} />
            {LEVEL_ORDER.map(slug => (
              <Text key={slug} style={[styles.compareHead, { color: LEVELS[slug].color }]}>
                {LEVELS[slug].name}
              </Text>
            ))}
          </View>
          {COMPARE.map(row => (
            <View key={row.label} style={[styles.compareRow, styles.compareRowLine]}>
              <Text style={styles.compareLabelCell}>{row.label}</Text>
              {row.values.map((val, i) => (
                <Text key={i} style={styles.compareValue}>{val}</Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Acceptera */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: level.color }, loading && { opacity: 0.5 }]}
          onPress={handleAccept}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.acceptButtonText}>Acceptera utmaningen: {level.name}</Text>
          }
        </TouchableOpacity>
        <Text style={styles.disclaimer}>
          {params.startDay
            ? `Du startar på dag ${params.startDay}. Missar du en dag börjar utmaningen om från dag 1.`
            : 'Dag 1 börjar idag. Missar du en dag börjar utmaningen om från dag 1.'}
        </Text>
      </View>

    </SafeScreen>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 12,
  },
  stepLabel: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },

  adviceBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: accentAlpha('12'),
    borderWidth: 1,
    borderColor: accentAlpha('40'),
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
  },
  adviceText: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 13,
    lineHeight: 19,
  },
  adviceStrong: {
    color: ACCENT,
    fontWeight: '800',
  },

  levelCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 16,
    gap: 14,
  },
  levelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  levelName: {
    fontSize: 22,
    fontWeight: '800',
  },
  recBadge: {
    backgroundColor: accentAlpha('1E'),
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  recBadgeText: {
    color: ACCENT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tagline: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    marginTop: 2,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rulesList: {
    gap: 10,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ruleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  ruleText: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    flex: 1,
  },

  compareCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginTop: 4,
  },
  compareTitle: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compareRowLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    paddingTop: 10,
  },
  compareLabelCell: {
    width: 74,
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '600',
  },
  compareHead: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  compareValue: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 12,
    lineHeight: 16,
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 32,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  acceptButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
})
