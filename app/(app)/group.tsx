import { useCallback, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActionSheetIOS, Platform, Share,
  Modal, Dimensions,
} from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@/components/Icon'
import { supabase } from '@/lib/supabase'
import { GlassCircleButton } from '@/components/GlassButton'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { GroupEditSheet } from '@/components/GroupEditSheet'
import { GroupInviteSheet } from '@/components/GroupInviteSheet'
import {
  getGroup, getGroupMembers, joinGroup, leaveGroup, approveMember, removeMember,
  deleteGroup, acceptGroupInvite, type Group, type GroupMember,
} from '@/services/groups'
import {
  BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, RED, useThemeStrings, useCardChrome, accentAlpha,
} from '@/lib/theme'

// =============================================================================
// GRUPPSIDA — bild, namn, taggar och medlemmar. Gå med direkt (offentlig)
// eller begär medlemskap (privat); skaparen godkänner väntande och kan
// radera gruppen. Reglerna upprätthålls av RLS, inte av knapparna.
// =============================================================================

const SPORT_LABELS: Record<string, string> = {
  all: 'Alla sporter', running: 'Löpning', cycling: 'Cykling', walking: 'Promenad', gym: 'Gym',
}
const SPORT_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  all: 'infinite-outline', running: 'fitness-outline', cycling: 'bicycle-outline',
  walking: 'walk-outline', gym: 'barbell-outline',
}

export default function GroupScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>()
  const groupId = typeof params.groupId === 'string' ? params.groupId : null
  const T = useThemeStrings()
  const chrome = useCardChrome()
  const light = T.TEXT_PRIMARY !== '#FFFFFF'
  const pillEdge = light ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.35)'
  const circleEdge = light ? 'rgba(0,0,0,0.10)' : 'transparent'

  const [me, setMe] = useState<string | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const membersY = useRef(0)

  const load = useCallback(async () => {
    if (!groupId) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    setMe(session.user.id)
    const [g, m] = await Promise.all([getGroup(groupId), getGroupMembers(groupId)])
    setGroup(g)
    setMembers(m)
  }, [groupId])

  useFocusEffect(useCallback(() => { load().catch(() => {}) }, [load]))

  const accepted = members.filter(m => m.status === 'accepted')
  const pending = members.filter(m => m.status === 'pending')
  const mine = members.find(m => m.id === me)
  const isOwner = group?.owner_id === me

  async function handleJoin() {
    if (!group || !me) return
    Haptics.selectionAsync()
    try {
      if (mine?.status === 'invited') await acceptGroupInvite(group.id)
      else if (!mine) await joinGroup(group.id, me, group.is_private)
      else return
      await load()
    } catch {
      Alert.alert('Något gick fel', 'Kontrollera anslutningen och försök igen.')
    }
  }

  /** Avböj inbjudan eller lämna gruppen — samma sak i databasen: raden bort */
  async function declineOrLeave() {
    if (!group || !me) return
    Haptics.selectionAsync()
    try {
      await leaveGroup(group.id, me)
      await load()
    } catch {
      Alert.alert('Något gick fel', 'Kontrollera anslutningen och försök igen.')
    }
  }

  function openMenu() {
    if (!isOwner || !group) return
    const destroy = () => Alert.alert('Radera gruppen?', 'Det här går inte att ångra.', [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Radera', style: 'destructive', onPress: async () => {
        const ok = await deleteGroup(group.id).then(() => true).catch(() => false)
        if (!ok) { Alert.alert('Kunde inte radera', 'Försök igen.'); return }
        router.back()
      } },
    ])
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Avbryt', 'Radera gruppen'], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
        i => { if (i === 1) destroy() },
      )
    } else destroy()
  }

  function shareGroup() {
    if (!group) return
    Haptics.selectionAsync()
    Share.share({
      message: `Kolla in gruppen "${group.name}" i SeventyFive${group.description ? ` — ${group.description}` : ''}`,
    }).catch(() => {})
  }

  const joinLabel = !mine
    ? (group?.is_private ? 'Begär medlemskap' : 'Gå med')
    : mine.status === 'invited' ? 'Acceptera inbjudan' : 'Förfrågan skickad'
  const joinActive = !mine || mine.status === 'invited'

  return (
    <SafeScreen style={s.screen}>
      <View style={s.header}>
        <GlassCircleButton icon="chevron-back" size={40} iconColor={TEXT_PRIMARY}
          onPress={() => router.back()} fallbackStyle={s.iconFallback} />
        <Text style={s.headerTitle} numberOfLines={1}>{group?.name ?? 'Grupp'}</Text>
        {isOwner ? (
          <GlassCircleButton icon="ellipsis-horizontal" size={40} iconColor={TEXT_PRIMARY}
            onPress={openMenu} fallbackStyle={s.iconFallback} />
        ) : <View style={{ width: 40 }} />}
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <TouchableOpacity onPress={() => setImageOpen(true)} activeOpacity={0.75} testID="groupAvatar">
            <FeedAvatar url={group?.avatar_url ?? null} fallback={(group?.name ?? '?').charAt(0).toUpperCase()} size={92} />
          </TouchableOpacity>
          <Text style={s.name}>{group?.name ?? ''}</Text>
          <View style={s.metaRow}>
            <View style={s.metaItem}>
              <Ionicons name={SPORT_ICONS[group?.sport ?? 'all']} size={14} color={TEXT_SECONDARY} />
              <Text style={s.meta}>{SPORT_LABELS[group?.sport ?? 'all']}</Text>
            </View>
            <View style={s.metaItem}>
              <Ionicons name="people-outline" size={14} color={TEXT_SECONDARY} />
              <Text style={s.meta}>{accepted.length} {accepted.length === 1 ? 'medlem' : 'medlemmar'}</Text>
            </View>
            <View style={s.metaItem}>
              <Ionicons name={group?.is_private ? 'lock-closed-outline' : 'earth-outline'} size={14} color={TEXT_SECONDARY} />
              <Text style={s.meta}>{group?.is_private ? 'Privat' : 'Offentlig'}</Text>
            </View>
            {group?.location ? (
              <View style={s.metaItem}>
                <Ionicons name="location-outline" size={14} color={TEXT_SECONDARY} />
                <Text style={s.meta}>{group.location}</Text>
              </View>
            ) : null}
          </View>
          {group?.tags?.length ? (
            <View style={s.tagRow}>
              {group.tags.map(t => (
                <View key={t} style={[s.tag, { backgroundColor: accentAlpha('14') }]}>
                  <Text style={[s.tagText, { color: T.ACCENT }]}>{t}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {group?.description ? <Text style={s.desc}>{group.description}</Text> : null}

          {/* Åtgärdscirklar som i förlagan — medlemmar bjuder in, skaparen redigerar */}
          <View style={s.actionsRow}>
            {mine?.status === 'accepted' && (
              <ActionCircle icon="person-add-outline" label="Bjud in" edge={circleEdge}
                onPress={() => { Haptics.selectionAsync(); setInviteOpen(true) }} testID="groupInvite" />
            )}
            {isOwner && (
              <ActionCircle icon="pencil-outline" label="Redigera" edge={circleEdge}
                onPress={() => { Haptics.selectionAsync(); setEditOpen(true) }} testID="groupEdit" />
            )}
            <ActionCircle icon="share-outline" label="Dela" edge={circleEdge}
              onPress={shareGroup} testID="groupShare" />
            <ActionCircle icon="people-outline" label="Medlemmar" edge={circleEdge}
              onPress={() => scrollRef.current?.scrollTo({ y: Math.max(0, membersY.current - 8), animated: true })}
              testID="groupMembers" />
          </View>

          {mine?.status !== 'accepted' && (
            <TouchableOpacity
              style={[s.joinBtn, { borderColor: joinActive ? T.ACCENT : pillEdge }]}
              onPress={handleJoin}
              activeOpacity={0.8}
              disabled={mine?.status === 'pending'}
              testID="groupJoin"
            >
              <Text style={[s.joinText, joinActive && { color: T.ACCENT }]}>{joinLabel}</Text>
            </TouchableOpacity>
          )}
          {mine && !isOwner && mine.status !== 'pending' && (
            <TouchableOpacity onPress={declineOrLeave} hitSlop={8}>
              <Text style={s.leave}>{mine.status === 'invited' ? 'Avböj inbjudan' : 'Lämna gruppen'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Väntande förfrågningar — bara skaparen */}
        {isOwner && pending.length > 0 && (
          <>
            <Text style={s.sectionLabel}>VÄNTANDE FÖRFRÅGNINGAR</Text>
            <View style={[s.card, chrome]}>
              {pending.map((m, i) => (
                <View key={m.id} style={[s.memberRow, i > 0 && s.rowDivider]}>
                  <FeedAvatar url={m.avatar_url} fallback={(m.name ?? '?').charAt(0).toUpperCase()} size={44} />
                  <Text style={s.memberName} numberOfLines={1}>{m.name ?? 'Namnlös'}</Text>
                  <TouchableOpacity style={[s.pill, { borderColor: T.ACCENT }]} testID={`approve-${m.id}`}
                    onPress={() => approveMember(group!.id, m.id).then(load).catch(() => {})}>
                    <Text style={[s.pillText, { color: T.ACCENT }]}>Godkänn</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.pill, { borderColor: pillEdge }]}
                    onPress={() => removeMember(group!.id, m.id).then(load).catch(() => {})}>
                    <Text style={s.pillText}>Avböj</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={s.sectionLabel} onLayout={e => { membersY.current = e.nativeEvent.layout.y }}>
          {accepted.length} {accepted.length === 1 ? 'MEDLEM' : 'MEDLEMMAR'}
        </Text>
        <View style={[s.card, chrome]}>
          {accepted.map((m, i) => (
            <TouchableOpacity
              key={m.id}
              style={[s.memberRow, i > 0 && s.rowDivider]}
              activeOpacity={0.7}
              onPress={() => m.id !== me && router.push({
                pathname: '/(app)/athlete',
                params: { userId: m.id, name: m.name ?? 'Namnlös', avatar: m.avatar_url ?? '' },
              } as never)}
            >
              <FeedAvatar url={m.avatar_url} fallback={(m.name ?? '?').charAt(0).toUpperCase()} size={44} />
              <Text style={s.memberName} numberOfLines={1}>{m.name ?? 'Namnlös'}</Text>
              {m.role === 'owner' && (
                <View style={[s.tag, { backgroundColor: accentAlpha('14') }]}>
                  <Text style={[s.tagText, { color: T.ACCENT }]}>Skapare</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <GroupEditSheet
        visible={editOpen}
        userId={me}
        group={group}
        onClose={() => setEditOpen(false)}
        onSaved={g => { setEditOpen(false); setGroup(g); load().catch(() => {}) }}
      />

      <GroupInviteSheet
        visible={inviteOpen}
        userId={me}
        group={group}
        members={members}
        onClose={() => setInviteOpen(false)}
        onInvited={() => load().catch(() => {})}
      />

      {/* Tryck på gruppbilden → förstorad vy, tryck igen för att stänga */}
      <Modal visible={imageOpen} transparent animationType="fade" onRequestClose={() => setImageOpen(false)}>
        <TouchableOpacity style={s.imageBackdrop} activeOpacity={1}
          onPress={() => setImageOpen(false)} testID="imageViewer">
          <FeedAvatar url={group?.avatar_url ?? null}
            fallback={(group?.name ?? '?').charAt(0).toUpperCase()}
            size={Dimensions.get('window').width - 88} />
        </TouchableOpacity>
      </Modal>
    </SafeScreen>
  )
}

function ActionCircle({ icon, label, edge, onPress, testID }: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  edge: string
  onPress: () => void
  testID?: string
}) {
  return (
    <TouchableOpacity style={s.action} onPress={onPress} activeOpacity={0.7} testID={testID}>
      <View style={[s.actionCircle, { borderColor: edge }]}>
        <Ionicons name={icon} size={22} color={TEXT_PRIMARY} />
      </View>
      <Text style={s.actionLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, paddingHorizontal: 16, paddingVertical: 10,
  },
  iconFallback: { backgroundColor: CARD },
  headerTitle: { flex: 1, textAlign: 'center', color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  hero: { alignItems: 'center', paddingTop: 10, paddingBottom: 22, gap: 10 },
  imageBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  name: { color: TEXT_PRIMARY, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  metaRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    justifyContent: 'center', columnGap: 16, rowGap: 6,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },

  actionsRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start',
    gap: 26, marginTop: 12, alignSelf: 'stretch',
  },
  action: { alignItems: 'center', gap: 7, maxWidth: 76 },
  actionCircle: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: CARD,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  tag: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, fontWeight: '700' },
  desc: { color: TEXT_PRIMARY, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 4 },

  joinBtn: {
    alignSelf: 'stretch', marginTop: 10, borderRadius: 26, paddingVertical: 13,
    borderWidth: 1.5, alignItems: 'center',
  },
  joinText: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  leave: { color: RED, fontSize: 13, fontWeight: '600', marginTop: 8 },

  sectionLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 8, marginTop: 14, paddingHorizontal: 4,
  },
  card: { backgroundColor: CARD, borderRadius: 16, paddingHorizontal: 14 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.25)' },
  memberName: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  pill: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '700' },
})
