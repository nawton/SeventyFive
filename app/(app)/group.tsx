import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActionSheetIOS, Platform, Share,
  Modal, Dimensions, Switch,
} from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@/components/Icon'
import { supabase } from '@/lib/supabase'
import { GlassCircleButton } from '@/components/GlassButton'
import {
  FeedAvatar, FeedWorkoutCard, workoutToPost, strengthToPosts, mergePosts, type FeedPost,
} from '@/components/FeedWorkoutCard'
import { GroupEditSheet } from '@/components/GroupEditSheet'
import { GroupInviteSheet } from '@/components/GroupInviteSheet'
import { fetchGroupFeedPage, type FeedPage } from '@/services/feed'
import { getFeedSocial, likePost, unlikePost, type PostSocial } from '@/services/social'
import { CardioSummaryView } from '@/components/CardioSummaryView'
import { GymSummaryView } from '@/components/stats/GymSummaryView'
import { getUnitSystem, type UnitSystem } from '@/lib/units'
import { promptReport, postReportMenu } from '@/lib/report'
import {
  getGroup, getGroupMembers, joinGroup, leaveGroup, approveMember, removeMember,
  deleteGroup, acceptGroupInvite, updateGroupSettings, transferGroupOwnership,
  type Group, type GroupMember,
} from '@/services/groups'
import {
  BG, CARD, BORDER, ACCENT, TEXT_PRIMARY, TEXT_SECONDARY, RED, useThemeStrings, useCardChrome, accentAlpha,
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
  const [membersOpen, setMembersOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [cardioRows, setCardioRows] = useState<FeedPage['cardio']>([])
  const [strengthRows, setStrengthRows] = useState<FeedPage['strength']>([])
  const [social, setSocial] = useState<Record<string, PostSocial>>({})
  const [selected, setSelected] = useState<FeedPost | null>(null)
  const [unit, setUnit] = useState<UnitSystem>('metric')

  const load = useCallback(async () => {
    if (!groupId) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    setMe(session.user.id)
    getUnitSystem().then(setUnit).catch(() => {})
    const [g, m, feed] = await Promise.all([
      getGroup(groupId),
      getGroupMembers(groupId),
      fetchGroupFeedPage(groupId),
    ])
    setGroup(g)
    setMembers(m)
    setCardioRows(feed.cardio)
    setStrengthRows(feed.strength)
  }, [groupId])

  useFocusEffect(useCallback(() => { load().catch(() => {}) }, [load]))

  const accepted = members.filter(m => m.status === 'accepted')
  const pending = members.filter(m => m.status === 'pending')
  const mine = members.find(m => m.id === me)
  const isOwner = group?.owner_id === me

  // Passflödet byggs som i communityt — namn/avatarer från medlemslistan
  const posts = useMemo(() => {
    const nameOf = (id: string) => members.find(m => m.id === id)?.name ?? 'Namnlös'
    const avatarOf = (id: string) => members.find(m => m.id === id)?.avatar_url ?? null
    const cardioPosts = cardioRows.map(r =>
      workoutToPost(r.workout, r.userId, nameOf(r.userId), avatarOf(r.userId)))
    const byUser = new Map<string, typeof strengthRows>()
    for (const r of strengthRows) {
      const list = byUser.get(r.userId)
      if (list) list.push(r)
      else byUser.set(r.userId, [r])
    }
    const gymPosts = Array.from(byUser.entries()).flatMap(([userId, rows]) =>
      strengthToPosts(rows.map(r => r.workout), userId, nameOf(userId), avatarOf(userId)))
    return mergePosts([...cardioPosts, ...gymPosts])
  }, [cardioRows, strengthRows, members])

  // Veckans topplista ur flödesraderna: km för cardiogrupper, pass för gym,
  // pass (+km) för Alla sporter. Veckan börjar på måndagen.
  const leaderboard = useMemo(() => {
    if (!group?.show_leaderboard) return []
    const start = new Date()
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    start.setHours(0, 0, 0, 0)
    const by = new Map<string, { id: string; km: number; cardioPasses: number; gymDays: Set<string> }>()
    const rowFor = (id: string) => {
      let row = by.get(id)
      if (!row) { row = { id, km: 0, cardioPasses: 0, gymDays: new Set() }; by.set(id, row) }
      return row
    }
    for (const r of cardioRows) {
      if (new Date(r.workout.created_at) < start) continue
      const row = rowFor(r.userId)
      row.km += r.workout.data.distance_km
      row.cardioPasses += 1
    }
    for (const r of strengthRows) {
      if (new Date(r.workout.created_at) < start) continue
      rowFor(r.userId).gymDays.add(r.workout.data.workout_date ?? r.workout.created_at.split('T')[0])
    }
    const cardioSport = ['running', 'cycling', 'walking'].includes(group.sport)
    return Array.from(by.values())
      .map(e => {
        const passes = e.cardioPasses + e.gymDays.size
        const km = Math.round(e.km * 10) / 10
        return {
          id: e.id,
          score: cardioSport ? e.km : passes,
          value: cardioSport
            ? `${km.toFixed(1).replace('.', ',')} km`
            : `${passes} pass`,
          meta: cardioSport
            ? `${passes} ${passes === 1 ? 'pass' : 'pass'}`
            : km > 0 ? `${km.toFixed(1).replace('.', ',')} km` : '',
        }
      })
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  }, [cardioRows, strengthRows, group])

  const postIdsKey = posts.map(p => p.id).join(',')
  useEffect(() => {
    if (posts.length === 0) return
    getFeedSocial(posts.map(p => p.id)).then(setSocial).catch(() => {})
    // postIdsKey fångar ändringar i uppsättningen — posts-referensen byts varje build
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postIdsKey])

  function toggleLike(post: FeedPost) {
    const current = social[post.id] ?? { likes: 0, likedByMe: false, comments: 0 }
    const next = !current.likedByMe
    const apply = (likedByMe: boolean, delta: number) =>
      setSocial(prev => ({
        ...prev,
        [post.id]: {
          ...(prev[post.id] ?? current),
          likedByMe,
          likes: Math.max(0, (prev[post.id]?.likes ?? 0) + delta),
        },
      }))
    apply(next, next ? 1 : -1)
    ;(next ? likePost(post.id, post.authorId) : unlikePost(post.id))
      .catch(() => apply(!next, next ? -1 : 1))
  }

  function openPost(post: FeedPost) {
    router.push({
      pathname: '/(app)/post',
      params: {
        postKey: post.id,
        ownerId: post.authorId,
        ownerName: post.authorName,
        ownerAvatar: post.authorAvatar ?? '',
        kind: post.kind,
        title: post.kind === 'cardio' ? post.workout.name : 'Gympass',
        createdAt: post.createdAt,
        meta: post.kind === 'cardio'
          ? `${post.distanceKm.toFixed(2).replace('.', ',')} km`
          : `${post.exercises} övningar`,
      },
    } as never)
  }

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

  // Skaparen får inställningssidan, alla andra kan anmäla gruppen
  function openMenu() {
    if (!group) return
    if (isOwner) {
      Haptics.selectionAsync()
      setSettingsOpen(true)
      return
    }
    promptReport('group', group.id, `Anmäl ${group.name}`)
  }

  function confirmDelete() {
    if (!group) return
    Alert.alert('Radera gruppen?', 'Det här går inte att ångra.', [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Radera', style: 'destructive', onPress: async () => {
        const ok = await deleteGroup(group.id).then(() => true).catch(() => false)
        if (!ok) { Alert.alert('Kunde inte radera', 'Försök igen.'); return }
        setSettingsOpen(false)
        router.back()
      } },
    ])
  }

  /** Ägaren väljer en accepterad medlem som ny ägare — själv blir man medlem */
  function transferOwnership() {
    if (!group) return
    const candidates = accepted.filter(m => m.id !== me)
    if (candidates.length === 0) {
      Alert.alert('Inga andra medlemmar', 'Det finns ingen att överlåta gruppen till ännu.')
      return
    }
    const pick = (m: GroupMember) => Alert.alert(
      `Överlåt gruppen till ${m.name ?? 'medlemmen'}?`,
      'Hen blir ny skapare och du blir vanlig medlem. Det här går inte att ångra själv.',
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Överlåt', style: 'destructive', onPress: async () => {
          try {
            await transferGroupOwnership(group.id, m.id)
            setSettingsOpen(false)
            await load()
          } catch {
            Alert.alert('Kunde inte överlåta', 'Kontrollera anslutningen och försök igen.')
          }
        } },
      ],
    )
    const names = candidates.slice(0, 8)
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Ny skapare',
          options: ['Avbryt', ...names.map(m => m.name ?? 'Namnlös')],
          cancelButtonIndex: 0,
        },
        i => { if (i > 0) pick(names[i - 1]) },
      )
    } else {
      Alert.alert('Ny skapare', undefined, [
        { text: 'Avbryt', style: 'cancel' },
        ...names.map(m => ({ text: m.name ?? 'Namnlös', onPress: () => pick(m) })),
      ])
    }
  }

  /** Optimistisk inställningsändring — backas vid fel */
  async function applySetting(patch: Partial<Pick<Group, 'is_private' | 'show_feed' | 'show_leaderboard' | 'allow_member_invites'>>) {
    if (!group) return
    Haptics.selectionAsync()
    const prev = group
    setGroup({ ...group, ...patch })
    try {
      setGroup(await updateGroupSettings(group.id, patch))
      if ('show_feed' in patch) await load()
    } catch {
      setGroup(prev)
      Alert.alert('Kunde inte spara', 'Kontrollera anslutningen och försök igen.')
    }
  }

  /** ⋯ på en medlemsrad: anmäl, och skaparen kan ta bort medlemmen */
  function memberMenu(m: GroupMember) {
    if (!group) return
    const canRemove = isOwner && m.role !== 'owner'
    const report = () => promptReport('user', m.id, `Anmäl ${m.name ?? 'medlemmen'}`)
    const remove = () => removeMember(group.id, m.id).then(load).catch(() => {})
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: m.name ?? 'Medlem',
          options: canRemove
            ? ['Avbryt', 'Anmäl medlemmen', 'Ta bort ur gruppen']
            : ['Avbryt', 'Anmäl medlemmen'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: canRemove ? 2 : undefined,
        },
        i => { if (i === 1) report(); else if (i === 2 && canRemove) remove() },
      )
    } else {
      Alert.alert(m.name ?? 'Medlem', undefined, [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Anmäl medlemmen', onPress: report },
        ...(canRemove ? [{ text: 'Ta bort ur gruppen', onPress: remove }] : []),
      ])
    }
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
        <GlassCircleButton icon="ellipsis-horizontal" size={40} iconColor={TEXT_PRIMARY}
          onPress={openMenu} fallbackStyle={s.iconFallback} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
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

          {/* Åtgärdscirklar som i förlagan — centrerade när de får plats,
              skrollbara i sidled när de blir fler */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.actionsScroll}
            contentContainerStyle={s.actionsRow}
          >
            {mine?.status === 'accepted' && (isOwner || group?.allow_member_invites !== false) && (
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
              onPress={() => { Haptics.selectionAsync(); setMembersOpen(true) }}
              testID="groupMembers" />
          </ScrollView>

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

        {/* Veckans topplista — bygger på samma flödesdata som passen nedan */}
        {mine?.status === 'accepted' && group?.show_leaderboard && group.show_feed && (
          <>
            <Text style={s.sectionLabel}>VECKANS TOPPLISTA</Text>
            <View style={[s.card, chrome]}>
              {leaderboard.length === 0 ? (
                <Text style={s.boardEmpty}>Inga pass den här veckan ännu.</Text>
              ) : leaderboard.map((e, i) => {
                const m = members.find(mm => mm.id === e.id)
                return (
                  <View key={e.id} style={[s.boardRow, i > 0 && s.rowDivider]}>
                    <Text style={[s.boardRank, i === 0 && { color: T.ACCENT }]}>{i + 1}</Text>
                    <FeedAvatar url={m?.avatar_url ?? null}
                      fallback={(m?.name ?? '?').charAt(0).toUpperCase()} size={34} />
                    <Text style={[s.boardName, e.id === me && { color: T.ACCENT }]} numberOfLines={1}>
                      {e.id === me ? 'Du' : m?.name ?? 'Namnlös'}
                    </Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.boardValue}>{e.value}</Text>
                      {e.meta ? <Text style={s.boardMeta}>{e.meta}</Text> : null}
                    </View>
                  </View>
                )
              })}
            </View>
          </>
        )}

        {/* Huvudsidan visar medlemmarnas pass — sporten filtreras i databasen */}
        <Text style={s.sectionLabel}>SENASTE PASS</Text>
        {mine?.status !== 'accepted' ? (
          <Text style={s.feedEmpty}>
            {group?.is_private
              ? 'Gå med i gruppen för att se medlemmarnas pass.'
              : 'Gå med i gruppen så ser du medlemmarnas pass här.'}
          </Text>
        ) : group && !group.show_feed ? (
          <Text style={s.feedEmpty}>
            Aktivitetsflödet är avstängt för den här gruppen.
            {isOwner ? ' Du kan slå på det i gruppinställningarna.' : ''}
          </Text>
        ) : posts.length === 0 ? (
          <Text style={s.feedEmpty}>
            Inga pass ännu — de dyker upp här när någon i gruppen loggar
            {group?.sport === 'gym' ? ' ett gympass' : group?.sport === 'all' ? ' ett pass' : ` ${SPORT_LABELS[group?.sport ?? 'all'].toLowerCase()}`}.
          </Text>
        ) : (
          <View style={{ gap: 12 }}>
            {posts.map(post => (
              <FeedWorkoutCard
                key={post.id}
                post={post}
                onOpen={setSelected}
                onAvatarPress={post.authorId !== me ? () => router.push({
                  pathname: '/(app)/athlete',
                  params: { userId: post.authorId, name: post.authorName, avatar: post.authorAvatar ?? '' },
                } as never) : undefined}
                social={social[post.id]}
                onToggleLike={() => toggleLike(post)}
                onOpenComments={() => openPost(post)}
                onMenuPress={post.authorId !== me
                  ? () => postReportMenu(post.id, post.authorId, post.authorName)
                  : undefined}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Gruppinställningar — bara skaparen, via ⋯ i headern. Bara riktiga,
          databasstödda inställningar: privat/offentlig och flödet på/av */}
      <Modal visible={settingsOpen} animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
        <SafeScreen style={s.screen}>
          <View style={s.header}>
            <View style={{ width: 40 }} />
            <Text style={s.headerTitle}>Gruppinställningar</Text>
            <GlassCircleButton icon="close" size={40} iconColor={TEXT_PRIMARY}
              onPress={() => setSettingsOpen(false)} fallbackStyle={s.iconFallback} />
          </View>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.sectionLabel}>VISNING</Text>
            <View style={[s.card, chrome]}>
              <View style={s.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.settingTitle}>Visa aktivitetsflöde</Text>
                  <Text style={s.settingBody}>
                    Medlemmarnas pass visas på gruppsidan. Avstängt döljer
                    flödet för alla i gruppen.
                  </Text>
                </View>
                <Switch
                  value={!!group?.show_feed}
                  onValueChange={v => applySetting({ show_feed: v })}
                  trackColor={{ false: BORDER, true: ACCENT }}
                  testID="setFeed"
                />
              </View>
              <View style={[s.settingRow, s.rowDivider]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.settingTitle}>Visa veckans topplista</Text>
                  <Text style={s.settingBody}>
                    Rankar medlemmarna efter veckans
                    {group && ['running', 'cycling', 'walking'].includes(group.sport)
                      ? ' kilometrar' : ' pass'} på gruppsidan.
                  </Text>
                </View>
                <Switch
                  value={!!group?.show_leaderboard}
                  onValueChange={v => applySetting({ show_leaderboard: v })}
                  trackColor={{ false: BORDER, true: ACCENT }}
                  testID="setLeaderboard"
                />
              </View>
            </View>

            <Text style={s.sectionLabel}>TILLSTÅND</Text>
            <View style={[s.card, chrome]}>
              <View style={s.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.settingTitle}>Privat grupp</Text>
                  <Text style={s.settingBody}>
                    Man begär medlemskap och bara du godkänner nya medlemmar.
                    Inbjudna går alltid med direkt.
                  </Text>
                </View>
                <Switch
                  value={!!group?.is_private}
                  onValueChange={v => applySetting({ is_private: v })}
                  trackColor={{ false: BORDER, true: ACCENT }}
                  testID="setPrivate"
                />
              </View>
              <View style={[s.settingRow, s.rowDivider]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.settingTitle}>Medlemmar kan bjuda in</Text>
                  <Text style={s.settingBody}>
                    Avstängt betyder att bara du kan bjuda in nya medlemmar.
                  </Text>
                </View>
                <Switch
                  value={group?.allow_member_invites !== false}
                  onValueChange={v => applySetting({ allow_member_invites: v })}
                  trackColor={{ false: BORDER, true: ACCENT }}
                  testID="setInvites"
                />
              </View>
            </View>

            <Text style={s.sectionLabel}>GRUPPEN</Text>
            <View style={[s.card, chrome]}>
              <TouchableOpacity style={s.settingLink} activeOpacity={0.7} testID="settingsEdit"
                onPress={() => { setSettingsOpen(false); setEditOpen(true) }}>
                <Text style={s.settingTitle}>Redigera grupp</Text>
                <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.settingLink, s.rowDivider]} activeOpacity={0.7} testID="settingsMembers"
                onPress={() => { setSettingsOpen(false); setMembersOpen(true) }}>
                <Text style={s.settingTitle}>Medlemmar och förfrågningar</Text>
                <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.settingLink, s.rowDivider]} activeOpacity={0.7} testID="settingsTransfer"
                onPress={transferOwnership}>
                <Text style={s.settingTitle}>Överlåt ägarskap</Text>
                <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.deleteRow} onPress={confirmDelete} testID="settingsDelete">
              <Text style={s.deleteText}>Radera gruppen</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeScreen>
      </Modal>

      {/* Kortet öppnar själva passet — pratbubblan leder till kommentarerna */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected?.kind === 'cardio' && (
          <CardioSummaryView
            workout={selected.workout}
            title={selected.workout.name}
            dateLabel={new Date(selected.createdAt).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
            avatarUrl={selected.authorAvatar}
            unit={unit}
            onClose={() => setSelected(null)}
            effortReadOnly={selected.authorId !== me}
            social={{
              postKey: selected.id,
              ownerId: selected.authorId,
              onOpenComments: () => {
                const post = selected
                setSelected(null)
                openPost(post)
              },
            }}
          />
        )}
        {selected?.kind === 'strength' && (
          <GymSummaryView
            name="Gympass"
            dateLabel={new Date(selected.createdAt).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
            logged={selected.workouts}
            plannedNames={[]}
            allWorkouts={selected.workouts}
            onClose={() => setSelected(null)}
            social={{
              postKey: selected.id,
              ownerId: selected.authorId,
              onOpenComments: () => {
                const post = selected
                setSelected(null)
                openPost(post)
              },
            }}
          />
        )}
      </Modal>

      {/* Medlemmarna bor bakom Medlemmar-cirkeln — inte på huvudsidan */}
      <Modal visible={membersOpen} animationType="slide" onRequestClose={() => setMembersOpen(false)}>
        <SafeScreen style={s.screen}>
          <View style={s.header}>
            <View style={{ width: 40 }} />
            <Text style={s.headerTitle}>Medlemmar</Text>
            <GlassCircleButton icon="close" size={40} iconColor={TEXT_PRIMARY}
              onPress={() => setMembersOpen(false)} fallbackStyle={s.iconFallback} />
          </View>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
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

            <Text style={s.sectionLabel}>
              {accepted.length} {accepted.length === 1 ? 'MEDLEM' : 'MEDLEMMAR'}
            </Text>
            <View style={[s.card, chrome]}>
              {accepted.map((m, i) => (
                <TouchableOpacity
                  key={m.id}
                  style={[s.memberRow, i > 0 && s.rowDivider]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (m.id === me) return
                    setMembersOpen(false)
                    router.push({
                      pathname: '/(app)/athlete',
                      params: { userId: m.id, name: m.name ?? 'Namnlös', avatar: m.avatar_url ?? '' },
                    } as never)
                  }}
                >
                  <FeedAvatar url={m.avatar_url} fallback={(m.name ?? '?').charAt(0).toUpperCase()} size={44} />
                  <Text style={s.memberName} numberOfLines={1}>{m.name ?? 'Namnlös'}</Text>
                  {m.role === 'owner' && (
                    <View style={[s.tag, { backgroundColor: accentAlpha('14') }]}>
                      <Text style={[s.tagText, { color: T.ACCENT }]}>Skapare</Text>
                    </View>
                  )}
                  {m.id !== me && (
                    <TouchableOpacity onPress={() => memberMenu(m)} hitSlop={10} testID={`memberMenu-${m.id}`}>
                      <Ionicons name="ellipsis-horizontal" size={17} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </SafeScreen>
      </Modal>

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
      <Text style={s.actionLabel} numberOfLines={1}>{label}</Text>
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

  // Negativa marginaler låter raden blöda ut till skärmkanterna så
  // skrollningen känns naturlig; flexGrow centrerar när allt får plats
  actionsScroll: { alignSelf: 'stretch', marginTop: 12, marginHorizontal: -20 },
  actionsRow: {
    flexGrow: 1, flexDirection: 'row', justifyContent: 'center',
    alignItems: 'flex-start', gap: 26, paddingHorizontal: 20,
  },
  action: { alignItems: 'center', gap: 7 },
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
  feedEmpty: {
    color: TEXT_SECONDARY, fontSize: 14, lineHeight: 21,
    textAlign: 'center', paddingVertical: 26, paddingHorizontal: 20,
  },

  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  boardRank: { width: 20, color: TEXT_SECONDARY, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  boardName: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  boardValue: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },
  boardMeta: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 1 },
  boardEmpty: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', paddingVertical: 16 },

  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  settingTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  settingBody: { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 18, marginTop: 3 },
  settingLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 15,
  },
  deleteRow: { alignItems: 'center', marginTop: 22, paddingVertical: 10 },
  deleteText: { color: RED, fontSize: 15, fontWeight: '600' },
  card: { backgroundColor: CARD, borderRadius: 16, paddingHorizontal: 14 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.25)' },
  memberName: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  pill: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '700' },
})
