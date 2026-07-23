import { useEffect, useState } from 'react'
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Share, Dimensions,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import QRCode from 'react-native-qrcode-svg'
import { SafeScreen } from '@/components/SafeScreen'
import { GlassCircleButton } from '@/components/GlassButton'
import { AppTextInput } from '@/components/AppTextInput'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { Ionicons } from '@/components/Icon'
import { groupQrValue } from '@/lib/groupQr'
import { getFollowLists, type FollowProfile } from '@/services/follows'
import { inviteToGroup, type Group, type GroupMember } from '@/services/groups'
import { BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, useThemeStrings } from '@/lib/theme'

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
  const [qrOpen, setQrOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)

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
      message: `Häng med i gruppen "${group.name}" i SeventyFive! ${groupQrValue(group.id)}`,
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
          <View style={s.circleRow}>
            <TouchableOpacity style={s.shareAction} activeOpacity={0.7} testID="inviteQr"
              onPress={() => { Haptics.selectionAsync(); setQrOpen(true) }}>
              <View style={s.shareCircle}>
                <Ionicons name="qr-code-outline" size={24} color={TEXT_PRIMARY} />
              </View>
              <Text style={s.shareLabel}>QR-kod</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.shareAction} onPress={share} activeOpacity={0.7} testID="inviteShare">
              <View style={s.shareCircle}>
                <Ionicons name="share-outline" size={24} color={TEXT_PRIMARY} />
              </View>
              <Text style={s.shareLabel}>Dela</Text>
            </TouchableOpacity>
          </View>

          <AppTextInput
            style={s.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Sök bland dina följare"
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
              Inga följare ännu, dela gruppen så kan andra gå med själva.
            </Text>
          )}
        </ScrollView>

        {/* QR-sidan — koden i accentfärgen med 75-loggan i mitten. ecl H
            tål att loggan täcker mitten av koden */}
        <Modal visible={qrOpen} animationType="slide" onRequestClose={() => setQrOpen(false)}>
          <SafeScreen style={s.qrScreen}>
            <View style={s.qrHeader}>
              <GlassCircleButton icon="chevron-back" size={40} iconColor={TEXT_PRIMARY}
                onPress={() => setQrOpen(false)} fallbackStyle={s.qrIconFallback} />
              <Text style={s.qrHeaderTitle}>QR-kod</Text>
              <View style={{ width: 40 }} />
            </View>
            <View style={s.qrBody}>
              <TouchableOpacity onPress={() => setImageOpen(true)} activeOpacity={0.75} testID="qrAvatar">
                <FeedAvatar url={group?.avatar_url ?? null}
                  fallback={(group?.name ?? '?').charAt(0).toUpperCase()} size={84} />
              </TouchableOpacity>
              <Text style={s.qrTitle}>Skanna för att gå med{'\n'}i {group?.name ?? ''}</Text>
              <View style={s.qrBox}>
                {group && (
                  <QRCode value={groupQrValue(group.id)} size={244}
                    color={T.ACCENT} backgroundColor="transparent" ecl="H" />
                )}
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <View style={s.qrLogoWrap}>
                    <View style={[s.qrLogo, { backgroundColor: T.BG }]}>
                      <Text style={[s.qrLogoText, { color: T.ACCENT }]}>75</Text>
                    </View>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={[s.qrShareBtn, { borderColor: T.ACCENT }]}
                onPress={share} activeOpacity={0.8} testID="qrShare">
                <Text style={[s.qrShareText, { color: T.ACCENT }]}>Dela länk</Text>
              </TouchableOpacity>
            </View>

            {/* Tryck på gruppbilden → förstorad vy */}
            <Modal visible={imageOpen} transparent animationType="fade" onRequestClose={() => setImageOpen(false)}>
              <TouchableOpacity style={s.imageBackdrop} activeOpacity={1} onPress={() => setImageOpen(false)}>
                <FeedAvatar url={group?.avatar_url ?? null}
                  fallback={(group?.name ?? '?').charAt(0).toUpperCase()}
                  size={Dimensions.get('window').width - 88} />
              </TouchableOpacity>
            </Modal>
          </SafeScreen>
        </Modal>
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
  circleRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 34,
    marginTop: 10, marginBottom: 20,
  },
  shareAction: { alignItems: 'center', gap: 7 },
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

  qrScreen: { flex: 1, backgroundColor: BG },
  qrHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  qrIconFallback: { backgroundColor: CARD },
  qrHeaderTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  qrBody: { flex: 1, alignItems: 'center', paddingTop: 28, paddingHorizontal: 28, gap: 22 },
  qrTitle: {
    color: TEXT_PRIMARY, fontSize: 21, fontWeight: '800',
    textAlign: 'center', lineHeight: 28,
  },
  qrBox: { padding: 14 },
  qrLogoWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  qrLogo: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  qrLogoText: { fontFamily: NUM_FONT, fontSize: 24, letterSpacing: -1 },
  qrShareBtn: {
    borderWidth: 1.5, borderRadius: 999,
    paddingHorizontal: 26, paddingVertical: 12, marginTop: 6,
  },
  qrShareText: { fontSize: 15, fontWeight: '700' },
  imageBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
})
