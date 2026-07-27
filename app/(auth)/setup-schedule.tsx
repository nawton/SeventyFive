import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '@/lib/supabase'
import { ScheduleWizard, type WizardResult } from '@/components/ScheduleWizard'
import { generateScheduleFromWizard } from '@/services/scheduleGenerator'

// =============================================================================
// Sista onboarding-steget: bygg veckoschemat med samma wizard som i appen.
// Samma mörka marinblå tema som inloggningen och välkomstflödet.
// =============================================================================

const NAVY      = '#05080F'
const NAVY_TOP  = '#080D18'
const EDGE      = 'rgba(255,255,255,0.08)'
const OFFWHITE  = '#F4F5FA'
const MUTED     = 'rgba(244,245,250,0.62)'
const ORANGE      = '#FFA817'
const ORANGE_DEEP = '#FF7A1A'
const BLUE  = '#3FA7FF'
const GREEN = '#66BB6A'

const FEATURES = [
  {
    icon: 'trophy-outline' as const,
    color: ORANGE,
    title: 'Välj ditt mål',
    text: 'Löpning mot ett lopp eller muskelbygge på gymmet',
  },
  {
    icon: 'calendar-outline' as const,
    color: BLUE,
    title: 'Veckan planeras åt dig',
    text: 'Passen läggs ut på de dagar du vill träna',
  },
  {
    icon: 'checkmark-done-outline' as const,
    color: GREEN,
    title: 'Färdiga pass',
    text: 'Övningar, set och reps klara att köra, ändra när du vill',
  },
]

export default function SetupScheduleScreen() {
  const insets = useSafeAreaInsets()
  const [wizardVisible, setWizardVisible] = useState(false)

  async function handleWizardFinish(result: WizardResult) {
    setWizardVisible(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.replace('/(auth)/login'); return }
      const count = await generateScheduleFromWizard(session.user.id, result)
      Alert.alert('Schema skapat', `${count} pass har lagts till i ditt veckoschema.`)
    } catch (e: any) {
      Alert.alert('Kunde inte skapa schemat', e.message)
    }
    router.replace('/(app)/dashboard')
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={[NAVY_TOP, NAVY]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={[styles.container, { paddingTop: insets.top + 36 }]}>
        <View style={styles.header}>
          <Text style={styles.stepLabel}>STEG 4 AV 4</Text>
          <Text style={styles.title}>Ditt träningsschema</Text>
          <Text style={styles.subtitle}>
            Svara på några snabba frågor så bygger vi ett veckoschema med färdiga
            pass, anpassat efter ditt mål. Du kan ändra allt när som helst.
          </Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map(f => (
            <View key={f.icon} style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: f.color + '1A' }]}>
                <Ionicons name={f.icon} size={22} color={f.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: 18 + insets.bottom }]}>
        <TouchableOpacity onPress={() => setWizardVisible(true)} activeOpacity={0.85}>
          <LinearGradient
            colors={[ORANGE, ORANGE_DEEP]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Bygg mitt schema</Text>
            <Ionicons name="arrow-forward" size={17} color={NAVY} />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.replace('/(app)/dashboard')}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Hoppa över, ställ in senare</Text>
        </TouchableOpacity>
      </View>

      <ScheduleWizard
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        onFinish={handleWizardFinish}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NAVY },
  container: {
    flex: 1,
    paddingHorizontal: 26,
    gap: 26,
  },
  header: { gap: 8 },
  stepLabel: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: OFFWHITE,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
  },

  features: { gap: 12 },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: EDGE,
    borderRadius: 18,
    padding: 16,
  },
  featureIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    color: OFFWHITE,
    fontSize: 15,
    fontWeight: '700',
  },
  featureText: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },

  footer: {
    paddingHorizontal: 26,
    gap: 10,
  },
  primaryButton: {
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  primaryButtonText: {
    color: NAVY,
    fontSize: 16,
    fontWeight: '800',
  },
  skipButton: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  skipText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
})
