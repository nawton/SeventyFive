import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import { supabase } from '@/lib/supabase'
import { acceptChallenge as saveChallenge } from '@/services/challenge'
import { OnboardingStep, ONB } from '@/components/OnboardingStep'

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
  /** Vad som händer vid en missad dag — texten under Acceptera-knappen */
  missText: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────

// Reglerna speglar Jämför nivåerna-tabellen — håll dem i synk med hemsidan
const LEVELS: Record<Level, LevelConfig> = {
  normal: {
    slug: 'normal',
    name: 'Normal',
    tagline: 'En stark start. Hållbar förändring.',
    rules: [
      '4 träningspass i veckan',
      'Följ din kostplan',
      'Drick 2 liter vatten',
      'Läsning och progressfoton är valfria',
      'En dags marginal per vecka',
    ],
    color: '#3BE862',
    warning: '',
    missText: 'Missar du en dag har du en dags marginal per vecka.',
  },
  hard: {
    slug: 'hard',
    name: 'Hard',
    tagline: 'Disciplin bygger karaktär.',
    rules: [
      '1 träningspass per dag, ett utomhus',
      'Håll din kost, noll fuskmat',
      'Drick 3 liter vatten',
      'Läs 10 sidor per dag',
      'Ta ett progressfoto varje dag',
    ],
    color: '#FFA817',
    warning: 'Hard kräver träning varje dag med ett pass utomhus, 10 sidor läsning och progressfoto varje dag i 75 dagar. Missar du en dag börjar du om från dag 1.',
    missText: 'Missar du en dag börjar utmaningen om från dag 1.',
  },
  extreme: {
    slug: 'extreme',
    name: 'Extreme',
    tagline: 'Bara de starkaste klarar detta.',
    rules: [
      '2 träningspass per dag',
      'Strikt kostplan, inga undantag',
      'Drick 4 liter vatten',
      'Läs 10 sidor per dag',
      'Ta ett progressfoto varje dag',
      'Kall dusch varje morgon',
    ],
    color: '#FF3B4A',
    warning: 'Extreme kräver två pass per dag, strikt kost, 4 liter vatten, 10 sidor läsning och kall dusch varje morgon, i 75 dagar utan vilodagar. Missar du en dag börjar du om från dag 1.',
    missText: 'Missar du en dag börjar utmaningen om från dag 1, utan undantag.',
  },
}

const LEVEL_ORDER: Level[] = ['normal', 'hard', 'extreme']

// Kompakt jämförelse — samma innehåll som hemsidans Jämför nivåerna-tabell
const COMPARE: Array<{ label: string; values: [string, string, string] }> = [
  { label: 'Dagliga uppgifter',      values: ['4 st', '5 st', '6 st'] },
  { label: 'Träningskrav',           values: ['4 pass/vecka', '1 pass/dag, ett utomhus', '2 pass/dag'] },
  { label: 'Vattenmål',              values: ['2 liter', '3 liter', '4 liter'] },
  { label: 'Läsning',                values: ['Valfritt', '10 sidor/dag', '10 sidor/dag'] },
  { label: 'Progressbilder',         values: ['Valfritt', 'Varje dag', 'Varje dag'] },
  { label: 'Återhämtning',           values: ['3 vilodagar/vecka', 'Lätta pass räknas', 'Inga vilodagar'] },
  { label: 'Flexibilitet',           values: ['Hög', 'Låg', 'Ingen'] },
  { label: 'Omstart vid missad dag', values: ['Nej, 1 dags marginal/vecka', 'Ja, från dag 1', 'Ja, från dag 1'] },
]

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RecommendationScreen() {
  const params = useLocalSearchParams<{ why: string; goal: string; startDay?: string }>()
  // Normal förvald — det är rätt val för de flesta
  const [selectedLevel, setSelectedLevel] = useState<Level>('normal')
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
        // Nivåvalet ÄR pressvalet numera — quizets steg 3 togs bort
        pressure: selectedLevel,
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
    <OnboardingStep
      step={3}
      title="Välj din nivå"
      subtitle="Nivåerna skiljer sig mycket åt. Läs igenom vad som krävs innan du bestämmer dig."
      onBack={() => router.back()}
      scroll
      footer={
        <>
          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: level.color }, loading && { opacity: 0.5 }]}
            onPress={handleAccept}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={ONB.NAVY} />
              : <Text style={styles.acceptButtonText}>Acceptera utmaningen: {level.name}</Text>
            }
          </TouchableOpacity>
          <Text style={styles.disclaimer}>
            {params.startDay ? `Du startar på dag ${params.startDay}. ` : 'Dag 1 börjar idag. '}
            {level.missText}
          </Text>
        </>
      }
    >
        {/* Rådet: Normal passar de flesta */}
        <View style={styles.adviceBox}>
          <Ionicons name="information-circle" size={19} color={ONB.ORANGE} />
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
                  <Text style={[styles.levelName, { color: l.color }]}>{l.name}</Text>
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
                      <Ionicons name="checkmark-circle" size={17} color={l.color} />
                      <Text style={styles.ruleText}>{rule}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          )
        })}

        {/* Jämförelsen — kravet på egen rad med tre luftiga kolumner under,
            och den valda nivåns kolumn tonad i nivåns färg */}
        <View style={styles.compareCard}>
          <Text style={styles.compareTitle}>Jämför nivåerna</Text>
          <View style={styles.compareValues}>
            {LEVEL_ORDER.map(slug => (
              <View
                key={slug}
                style={[styles.compareHeadCell, selectedLevel === slug && { backgroundColor: LEVELS[slug].color + '1F' }]}
              >
                <Text style={[styles.compareHead, { color: LEVELS[slug].color }]}>
                  {LEVELS[slug].name}
                </Text>
              </View>
            ))}
          </View>
          {COMPARE.map(row => (
            <View key={row.label} style={styles.compareBlock}>
              <Text style={styles.compareLabel}>{row.label.toUpperCase()}</Text>
              <View style={styles.compareValues}>
                {row.values.map((val, i) => {
                  const slug = LEVEL_ORDER[i]
                  const active = selectedLevel === slug
                  return (
                    <View
                      key={slug}
                      style={[styles.compareCell, active && { backgroundColor: LEVELS[slug].color + '14' }]}
                    >
                      <Text style={[styles.compareValue, active && styles.compareValueActive]}>{val}</Text>
                    </View>
                  )
                })}
              </View>
            </View>
          ))}
        </View>
    </OnboardingStep>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  adviceBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255,168,23,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,168,23,0.30)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
  },
  adviceText: {
    flex: 1,
    color: ONB.OFFWHITE,
    fontSize: 13,
    lineHeight: 19,
  },
  adviceStrong: {
    color: ONB.ORANGE,
    fontWeight: '800',
  },

  levelCard: {
    backgroundColor: ONB.CARD,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: ONB.EDGE,
    padding: 16,
    gap: 14,
  },
  levelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelName: {
    fontSize: 22,
    fontWeight: '800',
  },
  tagline: {
    color: ONB.MUTED,
    fontSize: 13,
    marginTop: 2,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.22)',
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
  ruleText: {
    color: ONB.OFFWHITE,
    fontSize: 14,
    flex: 1,
  },

  compareCard: {
    backgroundColor: ONB.CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ONB.EDGE,
    padding: 18,
    gap: 16,
    marginTop: 4,
  },
  compareTitle: {
    color: ONB.OFFWHITE,
    fontSize: 17,
    fontWeight: '800',
  },
  compareValues: {
    flexDirection: 'row',
    gap: 8,
  },
  compareHeadCell: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  compareHead: {
    fontSize: 14,
    fontWeight: '800',
  },
  compareBlock: {
    gap: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.14)',
    paddingTop: 13,
  },
  compareLabel: {
    color: ONB.MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  compareCell: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  compareValue: {
    color: ONB.MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  compareValueActive: {
    color: ONB.OFFWHITE,
    fontWeight: '600',
  },

  acceptButton: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: ONB.NAVY,
    fontSize: 16,
    fontWeight: '800',
  },
  disclaimer: {
    color: ONB.MUTED,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
})
