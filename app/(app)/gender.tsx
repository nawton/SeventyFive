import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getProfile, updateProfile } from '@/services/profile'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

// =============================================================================
// KÖN — egen sida (nås från Profilinställningar) med de fyra vanliga
// alternativen. Valet sparas direkt och sidan stängs.
// =============================================================================

const OPTIONS = ['Man', 'Kvinna', 'Annat', 'Vill inte ange']

export default function GenderScreen() {
  const [gender, setGender] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useFocusEffect(useCallback(() => {
    let alive = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user || !alive) return
      setUserId(session.user.id)
      getProfile(session.user.id)
        .then(p => { if (alive) setGender(p?.gender ?? null) })
        .catch(() => {})
    })
    return () => { alive = false }
  }, []))

  function pick(g: string) {
    Haptics.selectionAsync()
    setGender(g)
    if (userId) updateProfile(userId, { gender: g }).catch(() => {})
    setTimeout(() => router.back(), 250)   // hinn se bocken landa
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.title}>Kön</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.list}>
        {OPTIONS.map(g => {
          const selected = gender === g
          return (
            <TouchableOpacity
              key={g}
              style={[s.optionRow, selected && s.optionRowActive]}
              onPress={() => pick(g)}
              activeOpacity={0.8}
            >
              <Text style={[s.optionText, selected && { color: ORANGE }]}>{g}</Text>
              {selected && <Ionicons name="checkmark-circle" size={20} color={ORANGE} />}
            </TouchableOpacity>
          )
        })}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  list: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16,
    borderWidth: 1, borderColor: BORDER,
  },
  optionRowActive: { borderColor: ORANGE, backgroundColor: ORANGE + '12' },
  optionText: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
})
