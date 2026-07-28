import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@/components/Icon'
import { useT } from '@/lib/i18n'

// =============================================================================
// ONBOARDINGRAMEN — gemensam layout för alla steg efter registreringen:
// marinblå bas som inloggningen, delade stegsegment överst, tillbaka-knapp
// på steg 2+ (steg 1 saknar den medvetet, man ska inte kunna backa ut till
// välkomstsidan efter att kontot skapats) och en fast knappyta längst ner.
// =============================================================================

export const ONB = {
  NAVY: '#05080F',
  NAVY_TOP: '#080D18',
  EDGE: 'rgba(255,255,255,0.08)',
  CARD: 'rgba(255,255,255,0.05)',
  OFFWHITE: '#F4F5FA',
  MUTED: 'rgba(244,245,250,0.62)',
  ORANGE: '#FFA817',
  ORANGE_DEEP: '#FF7A1A',
} as const

export function OnboardingStep({ step, total = 4, title, subtitle, onBack, scroll, children, footer }: {
  step: number
  total?: number
  title: string
  subtitle?: string
  /** Utelämnas på steg 1 — efter registreringen finns inget att backa till */
  onBack?: () => void
  /** Skrollande innehåll (nivåvalet) — knapparna ligger fast under ändå */
  scroll?: boolean
  children: React.ReactNode
  footer: React.ReactNode
}) {
  const t = useT()
  const insets = useSafeAreaInsets()
  return (
    <View style={s.screen}>
      <LinearGradient colors={[ONB.NAVY_TOP, ONB.NAVY]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={[s.topBar, { marginTop: insets.top + 6 }]}>
        {onBack ? (
          <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7} testID="onbBack">
            <Ionicons name="chevron-back" size={20} color={ONB.OFFWHITE} />
          </TouchableOpacity>
        ) : <View style={{ width: 38 }} />}
        <View style={s.segments}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[s.segment, i < step && s.segmentOn]} />
          ))}
        </View>
        <View style={{ width: 38 }} />
      </View>

      <View style={s.body}>
        <Text style={s.stepLabel}>{t('STEG {step} AV {total}', { step, total })}</Text>
        <Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={s.content}>{children}</View>
        )}
      </View>

      <View style={[s.footer, { paddingBottom: 18 + insets.bottom }]}>{footer}</View>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ONB.NAVY },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, height: 40, gap: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  segments: { flex: 1, flexDirection: 'row', gap: 6 },
  segment: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  segmentOn: { backgroundColor: ONB.ORANGE },

  body: { flex: 1, paddingHorizontal: 26, paddingTop: 22, gap: 8 },
  stepLabel: {
    color: ONB.ORANGE, fontSize: 12, fontWeight: '800', letterSpacing: 2,
  },
  title: {
    color: ONB.OFFWHITE, fontSize: 29, fontWeight: '800',
    letterSpacing: -0.4, lineHeight: 35,
  },
  subtitle: { color: ONB.MUTED, fontSize: 14, lineHeight: 21 },
  content: { flex: 1, gap: 12, paddingTop: 14 },
  scrollContent: { gap: 12, paddingTop: 14, paddingBottom: 16 },

  footer: { paddingHorizontal: 26, paddingTop: 10, gap: 10 },
})
