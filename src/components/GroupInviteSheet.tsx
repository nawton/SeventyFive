import { useEffect, useState } from 'react'
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Share,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { SafeScreen } from '@/components/SafeScreen'
import { AppTextInput } from '@/components/AppTextInput'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { Ionicons } from '@/components/Icon'
import { getFollowLists, type FollowProfile } from '@/services/follows'
import { inviteToGroup, type Group, type GroupMember } from '@/services/groups'
import { BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, useThemeStrings } from '@/lib/theme'

// =============================================================================
// BJUD IN TILL GRUPPEN — som förlagan: sök bland dina följare, de som redan
// är med visas som "Deltar", resten kryssas i och bjuds in i en svep.
// Vi har inga grupplänkar/QR ännu, så delning sker via delningsarket.
// =============================================================================

export function GroupInviteSheet({ visible, userId, group, members, onClose, onInvited }: {
  visible: boolean
  userId: string | null
  group: Group | null
  members: GroupMember[]
  onClose: () => void
  onInvited: () => void
}) {
  const T = useThemeStrings()
  const light = T.TEXT_PRIMARY !== '#FFFFFF'
  const boxEdge = light ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.4)'

  const [followers, setFollowers] = useState<FollowProfile[]>([])
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!visible || !userId) return
    setSearch(''); setSelected(new Set()); setLoaded(false)
    getFollowLists(userId)
      .then(l => setFollowers(l.followers))
      .catch(() => setFollowers([]))
      .finally(() => setLoaded(true))
  }, [visible, userId])

  const statusOf = (id: string) => members.find(m => m.id === id)?.status ?? null

  function toggle(id: string) {
    Haptics.selectionAsync()
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function share() {
    if (!group) return
    Haptics.selectionAsync()
    Share.share({
      message: `Häng med i gruppen "${group.name}" i SeventyFive! Öppna Community → Grupper och gå med.`,
    }).catch(() => {})
  }

  async function send() {
    if (!group || selected.size === 0) return
    setSending(true)
    try {
      await inviteToGroup(group.id, Array.from(selected))
      Haptics.selectionAsync()
      onInvited()
      onClose()
    } catch {
      Alert.alert('Kunde inte bjuda in', 'Kontrollera anslutningen och försök igen.')
    } finally {
      setSending(false)
    }
  }

  const q = search.trim().toLowerCase()
  const filtered = q
    ? followers.filter(f => (f.name ?? '').toLowerCase().includes(q))
    : followers

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeScreen style={s.screen}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={8} testID="inviteClose">
            <Text style={s.headerBtn}>Stäng</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Bjud in till gruppen</Text>
          <TouchableOpacity onPress={send} hitSlop={8} disabled={selected.size === 0 || sending} testID="inviteSend">
            {sending
              ? <ActivityIndicator size="small" color={T.ACCENT} />
              : <Text style={[s.headerBtn, { color: T.ACCENT }, selected.size === 0 && { opacity: 0.4 }]}>Bjud in</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.shareAction} onPress={share} activeOpacity={0.7} testID="inviteShare">
            <View style={s.shareCircle}>
              <Ionicons name="share-outline" size={24} color={TEXT_PRIMARY} />
            </View>
            <Text style={s.shareLabel}>Dela</Text>
          </TouchableOpacity>

          <AppTextInput
            style={s.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Sök efter idrottare som följer dig"
            testID="inviteSearch"
          />

          {filtered.map(f => {
            const st = statusOf(f.id)
            const on = selected.has(f.id)
            return (
              <TouchableOpacity
                key={f.id}
                style={s.row}
                activeOpacity={0.7}
                disabled={st !== null}
                onPress={() => toggle(f.id)}
                testID={`invite-${f.id}`}
              >
                <FeedAvatar url={f.avatar_url} fallback={(f.name ?? '?').charAt(0).toUpperCase()} size={46} />
                <Text style={s.rowName} numberOfLines={1}>{f.name ?? 'Namnlös'}</Text>
                {st === 'accepted' ? <Text style={s.already}>Deltar</Text>
                  : st === 'invited' ? <Text style={s.already}>Inbjuden</Text>
                  : st === 'pending' ? <Text style={s.already}>Väntar</Text>
                  : (
                    <View style={[s.checkbox, { borderColor: on ? T.ACCENT : boxEdge }, on && { backgroundColor: T.ACCENT }]}>
                      {on && <Ionicons name="checkmark" size={15} color={light ? '#fff' : '#000'} />}
                    </View>
                  )}
              </TouchableOpacity>
            )
          })}

          {loaded && followers.length === 0 && (
            <Text style={s.empty}>
              Inga följare ännu — dela gruppen så kan andra gå med själva.
            </Text>
          )}
        </ScrollView>
      </SafeScreen>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  headerBtn: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  shareAction: { alignItems: 'center', gap: 7, marginTop: 10, marginBottom: 20 },
  shareCircle: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: CARD,
    alignItems: 'center', justifyContent: 'center',
  },
  shareLabel: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' },

  search: {
    backgroundColor: CARD, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 16, marginBottom: 12,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowName: { flex: 1, color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  already: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600' },
  checkbox: {
    width: 26, height: 26, borderRadius: 8, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  empty: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 30 },
})
