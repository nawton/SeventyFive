import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { acceptChallenge as saveChallenge } from '@/services/challenge'

// ─── Types ────────────────────────────────────────────────────────────────────

type Level = 'normal' | 'hard' | 'extreme'

interface LevelConfig {
  slug: Level
  name: string
  tagline: string
  rules: string[]
  color: string
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
  },
}

function getRecommendedLevel(pressure: string): Level {
  if (pressure === 'extreme') return 'extreme'
  if (pressure === 'hard') return 'hard'
  return 'normal'
}

import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT } from '@/lib/theme'

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RecommendationScreen() {
  const params = useLocalSearchParams<{ why: string; goal: string; pressure: string; startDay?: string }>()
  const recommendedLevel = getRecommendedLevel(params.pressure ?? 'normal')
  const [selectedLevel, setSelectedLevel] = useState<Level>(recommendedLevel)
  const [loading, setLoading] = useState(false)
  const level = LEVELS[selectedLevel]

  async function handleAccept() {
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

  return (
    <SafeScreen style={styles.screen}>
      <View style={styles.container}>

        {/* Label */}
        <View style={styles.top}>
          <Text style={styles.stepLabel}>Steg 4 av 5</Text>
          <Text style={styles.recommendedLabel}>Din rekommenderade nivå</Text>
          <Text style={[styles.levelName, { color: level.color }]}>{level.name}</Text>
          <Text style={styles.tagline}>{level.tagline}</Text>
        </View>

        {/* Rules card */}
        <View style={styles.card}>
          <Text style={styles.rulesTitle}>Reglerna</Text>
          <View style={styles.rulesList}>
            {level.rules.map((rule, i) => (
              <View key={i} style={styles.ruleRow}>
                <View style={[styles.ruleDot, { backgroundColor: level.color }]} />
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Level switcher */}
        <View style={styles.switcher}>
          <Text style={styles.switcherLabel}>Vill du välja en annan nivå?</Text>
          <View style={styles.switcherButtons}>
            {(Object.keys(LEVELS) as Level[]).map((slug) => (
              <TouchableOpacity
                key={slug}
                style={[
                  styles.switcherButton,
                  selectedLevel === slug && {
                    backgroundColor: level.color + '22',
                  },
                ]}
                onPress={() => setSelectedLevel(slug)}
              >
                <Text
                  style={[
                    styles.switcherButtonText,
                    selectedLevel === slug && { color: level.color, fontWeight: '700' },
                  ]}
                >
                  {LEVELS[slug].name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </View>

      {/* Accept */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: level.color }, loading && { opacity: 0.5 }]}
          onPress={handleAccept}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.acceptButtonText}>Acceptera utmaningen</Text>
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
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 28,
  },
  top: {
    gap: 6,
  },
  stepLabel: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  recommendedLabel: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  levelName: {
    fontSize: 48,
    fontWeight: '700',
  },
  tagline: {
    color: TEXT_SECONDARY,
    fontSize: 16,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  rulesTitle: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '600',
  },
  rulesList: {
    gap: 12,
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
    fontSize: 15,
    flex: 1,
  },
  switcher: {
    gap: 12,
  },
  switcherLabel: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },
  switcherButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  switcherButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: CARD,
  },
  switcherButtonText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 12,
  },
  acceptButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
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
