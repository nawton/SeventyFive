import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import { CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, CARD_BORDER } from '@/lib/theme'
import { MedalBadge } from '@/components/MedalBadge'
import { getAchievementSummary, type AchievementSummary } from '@/services/achievementSummary'
import { getActiveChallenge } from '@/services/challenge'
import { supabase } from '@/lib/supabase'

// =============================================================================
// REKORD & MEDALJER — Runna Levels-stil: tre överlappande medaljhexagoner,
// stor rubrik och räknarna som undertext. Självförsörjande (laddar sin egen
// sammanfattning vid fokus) så kortet kan bo på flera skärmar.
// =============================================================================

export function RecordsCard() {
  const [summary, setSummary] = useState<AchievementSummary | null>(null)

  useFocusEffect(useCallback(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return
      const challenge = await getActiveChallenge(session.user.id).catch(() => null)
      getAchievementSummary(session.user.id, challenge?.id ?? null)
        .then(s => { if (alive) setSummary(s) })
        .catch(() => {})
    })
    return () => { alive = false }
  }, []))

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => router.push('/records')}
      activeOpacity={0.85}
    >
      <View style={s.medalStack}>
        <View style={s.medalBack}><MedalBadge tier="bronze" unlocked size={46} /></View>
        <View style={s.medalMid}><MedalBadge tier="silver" unlocked size={50} /></View>
        <View style={s.medalFront}><MedalBadge tier="gold" unlocked size={56} /></View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Rekord & medaljer</Text>
        <Text style={s.sub}>
          {summary
            ? `${summary.medalsUnlocked} av ${summary.medalsTotal} medaljer · ${summary.recordCount} rekord`
            : 'Samla poäng. Nå dina mål.'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={TEXT_SECONDARY} />
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: CARD, borderRadius: 18,
    borderWidth: 1, borderColor: CARD_BORDER,
    paddingVertical: 18, paddingHorizontal: 16,
  },
  medalStack: { width: 96, height: 56, justifyContent: 'center' },
  medalBack:  { position: 'absolute', left: 0, opacity: 0.9 },
  medalMid:   { position: 'absolute', left: 22, zIndex: 1 },
  medalFront: { position: 'absolute', left: 44, zIndex: 2 },
  title: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sub:   { color: TEXT_SECONDARY, fontSize: 13, marginTop: 3, lineHeight: 18 },
})
