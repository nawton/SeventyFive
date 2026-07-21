import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { GREEN } from '@/lib/theme'
import {
  getSubscription, isPremium,
  FREE_SUBSCRIPTION, type Subscription,
} from '@/services/subscription'

// =============================================================================
// PREMIUM-BANNERN på profilsidan — gradient med krona (Runna-stil), hela
// ytan leder till /premium. Gratis: pitch + PRENUMERERA. Premium: status.
// Statusen ägs av stripe-webhooken; bannern läser om den vid varje fokus.
// =============================================================================

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
}

export function SubscriptionCard({ name }: { name?: string }) {
  const [sub, setSub] = useState<Subscription | null>(null)

  const reload = useCallback(() => {
    let alive = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { if (alive) setSub(FREE_SUBSCRIPTION); return }
      getSubscription(session.user.id)
        .then(sb => { if (alive) setSub(sb) })
        .catch(() => { if (alive) setSub(FREE_SUBSCRIPTION) })
    })
    return () => { alive = false }
  }, [])

  useFocusEffect(reload)

  if (sub === null) return null   // laddar — bannern dyker upp när svaret kommit

  const premium = isPremium(sub)
  const firstName = name?.split(' ')[0]
  const pastDue = !premium && (sub.status === 'past_due' || sub.status === 'unpaid')

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => { Haptics.selectionAsync(); router.push('/premium') }}
    >
      <LinearGradient
        colors={premium ? ['#1E5A4C', '#2F7A5F'] : ['#2E6E5C', '#7A4A32']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.banner}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.title}>
            {premium
              ? 'SeventyFive Premium'
              : firstName ? `${firstName}, skaffa Premium` : 'Skaffa SeventyFive Premium'}
          </Text>
          <Text style={s.sub}>
            {premium
              ? sub.cancel_at_period_end
                ? `Avslutas ${fmtDate(sub.current_period_end)}`
                : `Aktivt · förnyas ${fmtDate(sub.current_period_end)}`
              : pastDue
                ? 'Betalningen misslyckades — uppdatera ditt kort'
                : 'Lås upp löpplaner, intervallguidning och full statistik'}
          </Text>
          <Text style={s.action}>
            {premium ? 'HANTERA' : pastDue ? 'UPPDATERA BETALNING' : 'PRENUMERERA'}
          </Text>
        </View>
        <MaterialCommunityIcons
          name={premium ? 'crown' : 'crown-outline'}
          size={54}
          color={premium ? GREEN : 'rgba(255,255,255,0.9)'}
        />
      </LinearGradient>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  banner: {
    borderRadius: 18, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  title:  { color: '#fff', fontSize: 18, fontWeight: '800' },
  sub:    { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18, marginTop: 4 },
  action: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginTop: 12 },
})
