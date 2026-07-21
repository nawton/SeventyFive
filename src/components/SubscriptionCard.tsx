import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { ORANGE, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, GREEN } from '@/lib/theme'
import {
  getSubscription, isPremium, startCheckout, openBillingPortal,
  FREE_SUBSCRIPTION, type Subscription,
} from '@/services/subscription'

// =============================================================================
// ABONNEMANG — kortet på profilsidan. Gratisläge: pitch + Uppgradera
// (Stripe Checkout i webbläsaren). Premium: status, förnyelsedatum och
// Hantera (Stripes kundportal — byt kort, säg upp, kvitton).
// Statusen ägs av stripe-webhooken; kortet läser om den vid varje fokus,
// så den uppdateras när man kommer tillbaka från betalflödet.
// =============================================================================

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
}

export function SubscriptionCard() {
  const [sub, setSub] = useState<Subscription | null>(null)   // null = laddar
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => {
    let alive = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { if (alive) setSub(FREE_SUBSCRIPTION); return }
      getSubscription(session.user.id)
        .then(s => { if (alive) setSub(s) })
        .catch(() => { if (alive) setSub(FREE_SUBSCRIPTION) })
    })
    return () => { alive = false }
  }, [])

  useFocusEffect(reload)

  async function handleUpgrade() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setBusy(true)
    try {
      await startCheckout()
      reload()   // webhooken kan redan ha hunnit skriva
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

  if (sub === null) {
    return (
      <View style={s.card}>
        <ActivityIndicator color={ORANGE} />
      </View>
    )
  }

  const premium = isPremium(sub)

  if (!premium) {
    const pastDue = sub.status === 'past_due' || sub.status === 'unpaid'
    return (
      <View style={s.card}>
        <View style={s.headRow}>
          <View style={s.iconWrap}>
            <MaterialCommunityIcons name="crown-outline" size={22} color={ORANGE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>SeventyFive Premium</Text>
            <Text style={s.sub}>
              {pastDue
                ? 'Betalningen misslyckades — uppdatera ditt kort för att behålla Premium.'
                : 'Löpplaner mot ditt lopp, intervallguidning med röst och full statistik.'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[s.cta, busy && { opacity: 0.6 }]}
          onPress={pastDue ? handleManage : handleUpgrade}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy
            ? <ActivityIndicator color="#000" />
            : <>
                <Ionicons name={pastDue ? 'card-outline' : 'sparkles'} size={16} color="#000" />
                <Text style={s.ctaText}>{pastDue ? 'Uppdatera betalning' : 'Uppgradera'}</Text>
              </>}
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={s.card}>
      <View style={s.headRow}>
        <View style={[s.iconWrap, { backgroundColor: GREEN + '1E' }]}>
          <MaterialCommunityIcons name="crown" size={22} color={GREEN} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Text style={s.title}>Premium</Text>
            <View style={s.activeBadge}>
              <Text style={s.activeBadgeText}>{sub.status === 'trialing' ? 'PROVPERIOD' : 'AKTIVT'}</Text>
            </View>
          </View>
          <Text style={s.sub}>
            {sub.cancel_at_period_end
              ? `Avslutas ${fmtDate(sub.current_period_end)} — förnyas inte`
              : `Förnyas ${fmtDate(sub.current_period_end)}`}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[s.manageBtn, busy && { opacity: 0.6 }]}
        onPress={handleManage}
        disabled={busy}
        activeOpacity={0.8}
      >
        {busy
          ? <ActivityIndicator color={TEXT_PRIMARY} />
          : <>
              <Ionicons name="settings-outline" size={15} color={TEXT_PRIMARY} />
              <Text style={s.manageText}>Hantera abonnemang</Text>
            </>}
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: CARD, borderRadius: 18, padding: 16, gap: 14,
    borderWidth: 1, borderColor: BORDER,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: ORANGE + '1E',
    alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  sub:   { color: TEXT_SECONDARY, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  activeBadge: {
    backgroundColor: GREEN + '1E', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  activeBadgeText: { color: GREEN, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: ORANGE, borderRadius: 13, paddingVertical: 13,
  },
  ctaText: { color: '#000', fontSize: 15, fontWeight: '800' },
  manageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: 13, paddingVertical: 12,
    borderWidth: 1, borderColor: BORDER,
  },
  manageText: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
})
