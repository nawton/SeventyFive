import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/services/profile'
import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, GREEN, NUM_FONT, MINT } from '@/lib/theme'
import { PREMIUM_PLANS, PREMIUM_BENEFITS, type PlanKey } from '@/lib/premiumPlans'
import {
  getSubscription, isPremium, startCheckout, openBillingPortal,
  FREE_SUBSCRIPTION, type Subscription,
} from '@/services/subscription'

// =============================================================================
// PREMIUM — paywallen. Lugn, luftig och centrerad (Runna-känslan): krona,
// personlig rubrik, checklista, planval och EN mint-CTA — inga stora orange
// knappar. Har man redan Premium blir sidan en statusvy med Hantera.
// =============================================================================

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
}

export default function PremiumScreen() {
  const insets = useSafeAreaInsets()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [firstName, setFirstName] = useState('')
  const [plan, setPlan] = useState<PlanKey>('annual')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => {
    let alive = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { if (alive) setSub(FREE_SUBSCRIPTION); return }
      getSubscription(session.user.id)
        .then(s => { if (alive) setSub(s) })
        .catch(() => { if (alive) setSub(FREE_SUBSCRIPTION) })
      getProfile(session.user.id)
        .then(p => { if (alive && p?.name) setFirstName(p.name.split(' ')[0]) })
        .catch(() => {})
    })
    return () => { alive = false }
  }, [])

  useFocusEffect(reload)

  async function handleStart() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setBusy(true)
    try {
      await startCheckout(plan)
      reload()
    } catch (e) {
      Alert.alert('Kunde inte starta betalningen', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleManage() {
    Haptics.selectionAsync()
    setBusy(true)
    try {
      await openBillingPortal()
      reload()
    } catch (e) {
      Alert.alert('Kunde inte öppna kundportalen', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const premium = sub !== null && isPremium(sub)

  return (
    <View style={s.screen}>
      {/* Stäng — paywallen är alltid frivillig att lämna */}
      <TouchableOpacity
        style={[s.closeBtn, { top: insets.top + 10 }]}
        onPress={() => router.back()}
        hitSlop={12}
        activeOpacity={0.7}
      >
        <Ionicons name="close" size={26} color={TEXT_PRIMARY} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 56, paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.crownWrap}>
          <View style={s.crownCircle}>
            <MaterialCommunityIcons name="crown-outline" size={40} color={TEXT_PRIMARY} />
          </View>
        </View>

        {sub === null ? (
          <ActivityIndicator color={MINT} style={{ marginTop: 40 }} />
        ) : premium ? (
          <>
            <Text style={s.title}>Du har Premium</Text>
            <Text style={s.subtitle}>
              {sub.cancel_at_period_end
                ? `Avslutas ${fmtDate(sub.current_period_end)} — förnyas inte`
                : `Förnyas ${fmtDate(sub.current_period_end)}`}
            </Text>

            <View style={s.benefits}>
              {PREMIUM_BENEFITS.map(b => (
                <View key={b} style={s.benefitRow}>
                  <View style={s.checkCircle}>
                    <Ionicons name="checkmark" size={14} color={GREEN} />
                  </View>
                  <Text style={s.benefitText}>{b}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={s.title}>Lås upp din{'\n'}personliga träningsplan</Text>
            <Text style={s.subtitle}>{firstName ? `${firstName}, kom igång idag` : 'Kom igång idag'}</Text>

            <View style={s.benefits}>
              {PREMIUM_BENEFITS.map(b => (
                <View key={b} style={s.benefitRow}>
                  <View style={s.checkCircle}>
                    <Ionicons name="checkmark" size={14} color={GREEN} />
                  </View>
                  <Text style={s.benefitText}>{b}</Text>
                </View>
              ))}
            </View>

            {/* Planval — årlig förvald med spara-badge */}
            <View style={s.plans}>
              {PREMIUM_PLANS.map(p => {
                const selected = plan === p.key
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[s.planCard, selected && s.planCardActive]}
                    onPress={() => { Haptics.selectionAsync(); setPlan(p.key) }}
                    activeOpacity={0.85}
                  >
                    <View style={s.planHead}>
                      <Text style={s.planTitle}>{p.title}</Text>
                      {p.badge && (
                        <View style={s.saveBadge}>
                          <Text style={s.saveBadgeText}>{p.badge}</Text>
                        </View>
                      )}
                    </View>
                    <View style={s.planPriceRow}>
                      <Text style={s.planPrice}>{p.price}</Text>
                      <Text style={s.planPerWeek}>{p.perWeek}</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Fast sidfot — mint-CTA, aldrig orange */}
      {sub !== null && (
        <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[s.cta, busy && { opacity: 0.6 }]}
            onPress={premium ? handleManage : handleStart}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy
              ? <ActivityIndicator color="#04211C" />
              : <Text style={s.ctaText}>{premium ? 'Hantera abonnemang' : 'Kom igång nu'}</Text>}
          </TouchableOpacity>
          <Text style={s.footerNote}>
            {premium
              ? 'Byt kort, se kvitton eller säg upp — via Stripe'
              : 'Avsluta när du vill — hanteras säkert av Stripe'}
          </Text>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  closeBtn: { position: 'absolute', right: 18, zIndex: 10 },
  scroll: { paddingHorizontal: 24 },

  crownWrap: { alignItems: 'center', marginBottom: 20 },
  crownCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },

  title: {
    color: TEXT_PRIMARY, fontSize: 30, fontWeight: '800',
    textAlign: 'center', lineHeight: 37, letterSpacing: -0.5,
  },
  subtitle: {
    color: TEXT_SECONDARY, fontSize: 17, textAlign: 'center', marginTop: 8,
  },

  benefits: { marginTop: 28, gap: 18 },
  benefitRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12, marginTop: 1,
    borderWidth: 1.5, borderColor: GREEN,
    alignItems: 'center', justifyContent: 'center',
  },
  benefitText: { color: TEXT_PRIMARY, fontSize: 15, lineHeight: 22, flex: 1 },

  plans: { marginTop: 26, gap: 12 },
  planCard: {
    backgroundColor: CARD, borderRadius: 16, padding: 18,
    borderWidth: 1.5, borderColor: BORDER, gap: 8,
  },
  planCardActive: { borderColor: MINT },
  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '800' },
  saveBadge: {
    backgroundColor: MINT, borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  saveBadgeText: { color: '#04211C', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  planPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planPrice: { color: TEXT_PRIMARY, fontSize: 16, fontFamily: NUM_FONT },
  planPerWeek: { color: TEXT_SECONDARY, fontSize: 14, fontFamily: NUM_FONT },

  footer: { paddingHorizontal: 24, paddingTop: 12, gap: 10 },
  cta: {
    backgroundColor: MINT, borderRadius: 28, paddingVertical: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { color: '#04211C', fontSize: 17, fontWeight: '800' },
  footerNote: { color: TEXT_SECONDARY, fontSize: 12.5, textAlign: 'center' },
})
