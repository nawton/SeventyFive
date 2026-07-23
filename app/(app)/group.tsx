import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActionSheetIOS, Platform,
} from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@/components/Icon'
import { supabase } from '@/lib/supabase'
import { GlassCircleButton } from '@/components/GlassButton'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import {
  getGroup, getGroupMembers, joinGroup, leaveGroup, approveMember, removeMember,
  deleteGroup, type Group, type GroupMember,
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

export default function GroupScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>()
  const groupId = typeof params.groupId === 'string' ? params.groupId : null
  const T = useThemeStrings()
  const chrome = useCardChrome()
  const light = T.TEXT_PRIMARY !== '#FFFFFF'
  const pillEdge = light ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.35)'

  const [me, setMe] = useState<string | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])

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

  async function handleJoinLeave() {
    if (!group || !me) return
    Haptics.selectionAsync()
    try {
      if (!mine) {
        await joinGroup(group.id, me, group.is_private)
      } else if (isOwner) {
        return
      } else {
        await leaveGroup(group.id, me)
      }
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

  const joinLabel = !mine
    ? (group?.is_private ? 'Begär medlemskap' : 'Gå med')
    : mine.status === 'pending' ? 'Förfrågan skickad' : isOwner ? 'Skapare' : 'Medlem'

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

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <FeedAvatar url={group?.avatar_url ?? null} fallback={(group?.name ?? '?').charAt(0).toUpperCase()} size={92} />
          <Text style={s.name}>{group?.name ?? ''}</Text>
          <View style={s.metaRow}>
            <Ionicons name={group?.is_private ? 'lock-closed-outline' : 'earth-outline'} size={13} color={TEXT_SECONDARY} />
            <Text style={s.meta}>
              {group?.is_private ? 'Privat' : 'Offentlig'}
              {' · '}{SPORT_LABELS[group?.sport ?? 'all']}
              {group?.location ? ` · ${group.location}` : ' · Global'}
            </Text>
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

          <TouchableOpacity
            style={[s.joinBtn, { borderColor: !mine ? T.ACCENT : pillEdge }]}
            onPress={handleJoinLeave}
            onLongPress={() => { if (mine && !isOwner) handleJoinLeave() }}
            activeOpacity={0.8}
            disabled={isOwner || mine?.status === 'pending'}
            testID="groupJoin"
          >
            <Text style={[s.joinText, !mine && { color: T.ACCENT }]}>{joinLabel}</Text>
          </TouchableOpacity>
          {mine && !isOwner && mine.status === 'accepted' && (
            <TouchableOpacity onPress={handleJoinLeave} hitSlop={8}>
              <Text style={s.leave}>Lämna gruppen</Text>
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

        <Text style={s.sectionLabel}>{accepted.length} {accepted.length === 1 ? 'MEDLEM' : 'MEDLEMMAR'}</Text>
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
    </SafeScreen>
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
  name: { color: TEXT_PRIMARY, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { color: TEXT_SECONDARY, fontSize: 13 },
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
