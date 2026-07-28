import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '@/lib/supabase'
import { ScheduleWizard, type WizardResult } from '@/components/ScheduleWizard'
import { generateScheduleFromWizard } from '@/services/scheduleGenerator'
import { OnboardingStep, ONB } from '@/components/OnboardingStep'
import { useT } from '@/lib/i18n'

// =============================================================================
// Sista onboarding-steget: bygg veckoschemat med samma wizard som i appen.
// Ligger i samma onboardingram som quizet och nivåvalet — men utan tillbaka,
// utmaningen är redan accepterad.
// =============================================================================

const ORANGE = ONB.ORANGE
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
  const t = useT()
  const [wizardVisible, setWizardVisible] = useState(false)

  async function handleWizardFinish(result: WizardResult) {
    setWizardVisible(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.replace('/(auth)/login'); return }
      const count = await generateScheduleFromWizard(session.user.id, result)
      Alert.alert(t('Schema skapat'), t('{count} pass har lagts till i ditt veckoschema.', { count }))
    } catch (e: any) {
      Alert.alert(t('Kunde inte skapa schemat'), e.message)
    }
    router.replace('/(app)/dashboard')
  }

  return (
    <>
      <OnboardingStep
        step={5}
        title={t('Ditt träningsschema')}
        subtitle={t('Svara på några snabba frågor så bygger vi ett veckoschema med färdiga pass, anpassat efter ditt mål. Du kan ändra allt när som helst.')}
        footer={
          <>
            <TouchableOpacity onPress={() => setWizardVisible(true)} activeOpacity={0.85}>
              <LinearGradient
                colors={[ONB.ORANGE, ONB.ORANGE_DEEP]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>{t('Bygg mitt schema')}</Text>
                <Ionicons name="arrow-forward" size={17} color={ONB.NAVY} />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => router.replace('/(app)/dashboard')}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>{t('Hoppa över, ställ in senare')}</Text>
            </TouchableOpacity>
          </>
        }
      >
        {FEATURES.map(f => (
          <View key={f.icon} style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: f.color + '1A' }]}>
              <Ionicons name={f.icon} size={22} color={f.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>{t(f.title)}</Text>
              <Text style={styles.featureText}>{t(f.text)}</Text>
            </View>
          </View>
        ))}
      </OnboardingStep>

      <ScheduleWizard
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        onFinish={handleWizardFinish}
      />
    </>
  )
}

const styles = StyleSheet.create({
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: ONB.CARD,
    borderWidth: 1,
    borderColor: ONB.EDGE,
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
    color: ONB.OFFWHITE,
    fontSize: 15,
    fontWeight: '700',
  },
  featureText: {
    color: ONB.MUTED,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },

  primaryButton: {
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: ONB.ORANGE,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  primaryButtonText: {
    color: ONB.NAVY,
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
    color: ONB.MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
})
