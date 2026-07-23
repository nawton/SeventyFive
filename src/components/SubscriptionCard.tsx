import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, GREEN, MINT, CARD_BORDER } from '@/lib/theme'
import {
  getSubscription, isPremium,
  FREE_SUBSCRIPTION, type Subscription,
} from '@/services/subscription'

// =============================================================================
// PREMIUM-BANNERN på profilsidan — appens eget formspråk: mörkt kort med
// 1 px-ram och turkos accentkant, ingen gradient. Hela ytan leder till
// /premium. Statusen ägs av stripe-webhooken; läses om vid varje fokus.
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

  if (sub === null) return null   // laddar, bannern dyker upp när svaret kommit

  const premium = isPremium(sub)
  const firstName = name?.split(' ')[0]
  const pastDue = !premium && (sub.status === 'past_due' || sub.status === 'unpaid')
  const accent = premium ? GREEN : MINT

  return (
    <TouchableOpacity
      style={[s.card, { borderLeftColor: accent }]}
      activeOpacity={0.85}
      onPress={() => { Haptics.selectionAsync(); router.push('/premium') }}
    >
      <View style={[s.iconWrap, { backgroundColor: accent + '1C' }]}>
        <MaterialCommunityIcons
          name={premium ? 'crown' : 'crown-outline'}
          size={26}
          color={accent}
        />
      </View>
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
              ? 'Betalningen misslyckades, uppdatera ditt kort'
              : 'Lås upp löpplaner, intervallguidning och full statistik'}
        </Text>
        <Text style={[s.action, { color: accent }]}>
          {premium ? 'HANTERA' : pastDue ? 'UPPDATERA BETALNING' : 'PRENUMERERA'}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: CARD, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: CARD_BORDER,
    borderLeftWidth: 3,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  title:  { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '800' },
  sub:    { color: TEXT_SECONDARY, fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  action: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1.2, marginTop: 10 },
})
