import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { getProfile, updateProfile } from '@/services/profile'
import { splitName, combineName } from '@/lib/profileName'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY } from '@/lib/theme'

// =============================================================================
// FÖRNAMN/EFTERNAMN — egen sida (nås från Profilinställningar). Redigerar ena
// halvan; sparas ihop till profilens enda namnfält.
// =============================================================================

export default function NameEditScreen() {
  const { part } = useLocalSearchParams<{ part?: string }>()
  const isFirst = part !== 'last'
  const [userId, setUserId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [other, setOther] = useState('')   // den andra namnhalvan — följer med vid spar

  useFocusEffect(useCallback(() => {
    let alive = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user || !alive) return
      setUserId(session.user.id)
      getProfile(session.user.id).then(p => {
        if (!alive) return
        const { first, last } = splitName(p?.name)
        setDraft(isFirst ? first : last)
        setOther(isFirst ? last : first)
      }).catch(() => {})
    })
    return () => { alive = false }
  }, [isFirst]))

  function saveAndClose() {
    if (userId) {
      const name = isFirst ? combineName(draft, other) : combineName(other, draft)
      updateProfile(userId, { name }).catch(() => {})
    }
    router.back()
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.title}>{isFirst ? 'Förnamn' : 'Efternamn'}</Text>
        <TouchableOpacity onPress={saveAndClose} hitSlop={8} style={s.saveBtn}>
          <Text style={s.saveText}>Spara</Text>
        </TouchableOpacity>
      </View>

      <View style={s.body}>
        <TextInput
          style={s.input}
          value={draft}
          onChangeText={setDraft}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={saveAndClose}
          placeholder={isFirst ? 'Anton' : 'Wretenberg'}
          placeholderTextColor="rgba(255,255,255,0.25)"
        />
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
  saveBtn: { width: 40, alignItems: 'flex-end' },
  saveText: { color: ORANGE, fontSize: 16, fontWeight: '800' },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  input: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    color: TEXT_PRIMARY, fontSize: 17, paddingHorizontal: 16, paddingVertical: 14,
  },
})
