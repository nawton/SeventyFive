import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { ScheduleWizard, type WizardResult } from '@/components/ScheduleWizard'
import { generateScheduleFromWizard } from '@/services/scheduleGenerator'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

// Sista onboarding-steget: bygg veckoschemat med samma wizard som i appen.
// Ersätter den gamla "Bygg din dag"-skärmen vars tider aldrig användes.

const FEATURES = [
  { icon: 'flag-outline',     text: 'Välj mål: löpning eller muskelbygge' },
  { icon: 'calendar-outline', text: 'Passen läggs ut på dina träningsdagar' },
  { icon: 'create-outline',   text: 'Färdiga pass med övningar, set och reps' },
] as const

export default function SetupScheduleScreen() {
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
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>

        <View style={styles.header}>
          <Text style={styles.stepLabel}>STEG 5 AV 5</Text>
          <Text style={styles.title}>Ditt träningsschema</Text>
          <Text style={styles.subtitle}>
            Svara på några snabba frågor så bygger vi ett veckoschema med färdiga
            pass, anpassat efter ditt mål. Du kan ändra allt när som helst.
          </Text>
        </View>

        <View style={styles.card}>
          {FEATURES.map((f, i) => (
            <View key={i} style={[styles.featureRow, i > 0 && styles.featureRowBorder]}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={17} color={ORANGE} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => setWizardVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Bygg mitt schema</Text>
          <Ionicons name="arrow-forward" size={17} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.replace('/(app)/dashboard')}
        >
          <Text style={styles.skipText}>Hoppa över, ställ in senare</Text>
        </TouchableOpacity>
      </View>

      <ScheduleWizard
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        onFinish={handleWizardFinish}
      />
    </SafeAreaView>
  )
}

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
  header: {
    gap: 8,
  },
  stepLabel: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 36,
  },
  subtitle: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    overflow: 'hidden',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  featureRowBorder: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: ORANGE + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  skipText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
})
