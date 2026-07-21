import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/services/profile'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { TAB_CONTENT_PAD } from '@/lib/glass'

// =============================================================================
// KONTO — namn, lösenord och e-post. Nås via "Redigera profil"-pillen på
// profilsidan (Runna-flödet: profilhubb → kontouppgifter).
// =============================================================================

export default function AccountScreen() {
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')

  useFocusEffect(useCallback(() => {
    let alive = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      setEmail(session.user.email ?? '')
      getProfile(session.user.id)
        .then(p => { if (alive && p?.name) setName(p.name) })
        .catch(() => {})
    })
    return () => { alive = false }
  }, []))

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.title}>Konto</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.rowsCard}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/edit-name')}
            activeOpacity={0.7}
          >
            <View style={styles.rowIconBox}>
              <Ionicons name="person-outline" size={17} color={ORANGE} />
            </View>
            <Text style={styles.rowLabel}>Visningsnamn</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{name || 'Lägg till'}</Text>
            <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/change-password?from=profile' as never)}
            activeOpacity={0.7}
          >
            <View style={styles.rowIconBox}>
              <Ionicons name="lock-closed-outline" size={17} color={ORANGE} />
            </View>
            <Text style={styles.rowLabel}>Lösenord</Text>
            <Text style={styles.rowValue} numberOfLines={1}>••••••••</Text>
            <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <View style={[styles.row, { opacity: 0.55 }]}>
            <View style={[styles.rowIconBox, { backgroundColor: BORDER }]}>
              <Ionicons name="mail-outline" size={17} color={TEXT_SECONDARY} />
            </View>
            <Text style={styles.rowLabel}>E-post</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{email}</Text>
            <Ionicons name="lock-closed-outline" size={14} color={TEXT_SECONDARY} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
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
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 + TAB_CONTENT_PAD },
  rowsCard: { backgroundColor: CARD, borderRadius: 14, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)', marginLeft: 60 },
  rowIconBox: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: ORANGE + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  rowValue: { flex: 1, color: TEXT_SECONDARY, fontSize: 14, textAlign: 'right' },
})
