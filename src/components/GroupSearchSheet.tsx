import { useEffect, useState } from 'react'
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { SafeScreen } from '@/components/SafeScreen'
import { GlassCircleButton } from '@/components/GlassButton'
import { AppTextInput } from '@/components/AppTextInput'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { Ionicons } from '@/components/Icon'
import { GroupScanSheet } from '@/components/GroupScanSheet'
import { searchGroups, type Group } from '@/services/groups'
import {
  BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, useThemeStrings, useCardChrome,
} from '@/lib/theme'

// =============================================================================
// HITTA GRUPPER — sök på namn bland alla grupper, eller skanna en QR-kod.
// Träffarna leder till gruppsidan där man går med som vanligt.
// =============================================================================

export function GroupSearchSheet({ visible, onClose, onOpenGroup }: {
  visible: boolean
  onClose: () => void
  onOpenGroup: (group: Group) => void
}) {
  const T = useThemeStrings()
  const chrome = useCardChrome()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<Group & { memberCount: number }>>([])
  const [searching, setSearching] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)

  useEffect(() => {
    if (visible) { setQuery(''); setResults([]); setSearching(false) }
  }, [visible])

  // Debounce: sök när man slutat skriva, från två tecken
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(() => {
      searchGroups(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const q = query.trim()

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeScreen style={s.screen}>
        <View style={s.header}>
          <View style={{ width: 40 }} />
          <Text style={s.headerTitle}>Hitta grupper</Text>
          <GlassCircleButton icon="close" size={40} iconColor={TEXT_PRIMARY}
            onPress={onClose} fallbackStyle={s.iconFallback} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <AppTextInput
            style={s.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Sök på gruppens namn"
            autoFocus
            testID="groupSearchInput"
          />

          <TouchableOpacity style={[s.scanRow, chrome]} activeOpacity={0.75} testID="scanGroup"
            onPress={() => { Haptics.selectionAsync(); setScanOpen(true) }}>
            <Ionicons name="qr-code-outline" size={19} color={T.ACCENT} />
            <Text style={s.scanText}>Skanna QR-kod</Text>
            <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
          </TouchableOpacity>

          {searching && <ActivityIndicator style={{ marginTop: 24 }} color={TEXT_SECONDARY} />}

          {!searching && results.map(g => (
            <TouchableOpacity key={g.id} style={[s.row, chrome]} activeOpacity={0.75}
              onPress={() => onOpenGroup(g)} testID={`found-${g.id}`}>
              <FeedAvatar url={g.avatar_url} fallback={g.name.charAt(0).toUpperCase()} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowName} numberOfLines={1}>{g.name}</Text>
                <Text style={s.rowMeta}>
                  {g.memberCount} {g.memberCount === 1 ? 'medlem' : 'medlemmar'}
                  {g.is_private ? ' · Privat' : ''}
                  {g.location ? ` · ${g.location}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={TEXT_SECONDARY} />
            </TouchableOpacity>
          ))}

          {!searching && q.length >= 2 && results.length === 0 && (
            <Text style={s.empty}>Inga grupper matchade &quot;{q}&quot;.</Text>
          )}
        </ScrollView>

        <GroupScanSheet
          visible={scanOpen}
          onClose={() => setScanOpen(false)}
          onFound={g => { setScanOpen(false); onOpenGroup(g) }}
        />
      </SafeScreen>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  iconFallback: { backgroundColor: CARD },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  search: {
    backgroundColor: CARD, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 16,
  },
  scanRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
  },
  scanText: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 16, padding: 14,
  },
  rowName: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  rowMeta: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
  empty: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', marginTop: 24 },
})
