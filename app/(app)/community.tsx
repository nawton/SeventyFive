import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, Modal, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { AppRefreshControl, useAppRefresh } from '@/components/AppRefresh'
import { GroupWizard } from '@/components/GroupWizard'
import { GroupSearchSheet } from '@/components/GroupSearchSheet'
import { OrgSheet } from '@/components/OrgSheet'
import { getMyGroups } from '@/services/groups'
import { getMyOrganizations } from '@/services/organizations'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/services/profile'
import { fetchFeedPage, FEED_PAGE_SIZE, type FeedPage } from '@/services/feed'
import { getFollowLists } from '@/services/follows'
import {
  getFeedSocial, likePost, unlikePost, type PostSocial,
} from '@/services/social'
import { getUnitSystem, type UnitSystem } from '@/lib/units'
import { postReportMenu } from '@/lib/report'
import { useT, dateLocale } from '@/lib/i18n'
import { GlassSegment } from '@/components/GlassSegment'
import { GlassCircleButton } from '@/components/GlassButton'
import { CardioSummaryView } from '@/components/CardioSummaryView'
import { GymSummaryView } from '@/components/stats/GymSummaryView'
import {
  FeedWorkoutCard, FeedAvatar, workoutToPost, strengthToPosts, mergePosts, type FeedPost,
} from '@/components/FeedWorkoutCard'
import { getPassMetaForPosts } from '@/services/gymPassMeta'
import { useTabBarShrinkOnScroll } from '@/lib/tabBar'
import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT, useThemeStrings, THEME_DARK, useCardChrome, ACCENT_CONTRAST } from '@/lib/theme'
import { TAB_CONTENT_PAD } from '@/lib/glass'

// =============================================================================
// COMMUNITY — flödet visar dina OCH dina godkända vänners pass (löprundor
// och gympass), blandade kronologiskt. Hämtas via get_feed-RPC:n — EN
// fråga oavsett antal vänner — med oändlig scroll (cursor-paginering på
// tidsstämpeln). Tryck på ett kort öppnar samma passdetaljvy som
// statistiken, avataren öppnar personens profil, pratbubblan
// diskussionssidan. Grupper är en platshållare.
// =============================================================================

// Testerna (och ev. andra skärmar) når hjälparna via den delade modulen
export { relativeDayLabel, dayPartTitle } from '@/components/FeedWorkoutCard'

type Segment = 'feed' | 'groups'
type Filter = 'all' | 'cardio' | 'strength'

const FILTERS: Array<{ key: Filter; label: string; icon?: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'all', label: 'Alla' },
  { key: 'cardio', label: 'Cardio', icon: 'fitness-outline' },
  { key: 'strength', label: 'Gym', icon: 'barbell-outline' },
]

function EmptyState({ icon, title, body, ctaLabel, onCta }: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  title: string
  body: string
  ctaLabel?: string
  onCta?: () => void
}) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={44} color={TEXT_SECONDARY} />
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
      {ctaLabel && onCta && (
        <TouchableOpacity style={[s.emptyCta, { borderColor: useThemeStrings().ACCENT }]} onPress={onCta} activeOpacity={0.8} testID="emptyCta">
          <Ionicons name="search" size={15} color={ACCENT} />
          <Text style={s.emptyCtaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function CommunityScreen() {
  const t = useT()
  const [segment, setSegment] = useState<Segment>('feed')
  const [filter, setFilter] = useState<Filter>('all')
  const [loaded, setLoaded] = useState(false)
  const [ownId, setOwnId] = useState<string | null>(null)
  const [unit, setUnit] = useState<UnitSystem>('metric')
  const [selected, setSelected] = useState<FeedPost | null>(null)
  // Gillanden/kommentarsantal per inlägg
  const [social, setSocial] = useState<Record<string, PostSocial>>({})
  // Råa flödesrader (ackumulerade sidor) + författarnas namn/avatarer.
  // Inläggen byggs om från helheten så gympass-grupperingen aldrig
  // klipps mitt i en dag vid sidgränser.
  const [authors, setAuthors] = useState<Record<string, { name: string; avatar: string | null }>>({})
  const [cardioRows, setCardioRows] = useState<FeedPage['cardio']>([])
  const [strengthRows, setStrengthRows] = useState<FeedPage['strength']>([])
  const [oldest, setOldest] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const loadingMoreRef = useRef(false)
  const onScroll = useTabBarShrinkOnScroll()

  const posts = useMemo(() => {
    const nameOf = (id: string) => authors[id]?.name ?? t('Namnlös')
    const avatarOf = (id: string) => authors[id]?.avatar ?? null
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
  }, [cardioRows, strengthRows, authors])

  // Gillanden/kommentarsantal följer med när inläggen ändras
  const [passMeta, setPassMeta] = useState<Record<string, { title: string | null; note: string | null; photo_path: string | null }>>({})
  const postIdsKey = posts.map(p => p.id).join(',')
  useEffect(() => {
    if (posts.length === 0) return
    getFeedSocial(posts.map(p => p.id)).then(setSocial).catch(() => {})
    getPassMetaForPosts(posts).then(setPassMeta).catch(() => {})
    // postIdsKey fångar ändringar i uppsättningen — posts-referensen byts varje build
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postIdsKey])

  // Pratbubblan öppnar inläggets diskussionssida (Strava-stil)
  function openDiscussion(post: FeedPost) {
    router.push({
      pathname: '/(app)/post',
      params: {
        postKey: post.id,
        ownerId: post.authorId,
        ownerName: post.authorName,
        ownerAvatar: post.authorAvatar ?? '',
        kind: post.kind,
        title: post.kind === 'cardio' ? post.workout.name : t('Gympass'),
        createdAt: post.createdAt,
        meta: post.kind === 'cardio'
          ? `${post.distanceKm.toFixed(2).replace('.', ',')} km`
          : t('{n} övningar', { n: post.exercises }),
      },
    } as never)
  }

  // Delad mellan fokus-laddningen och pull-to-refresh — hämtar namnen
  // (en gång) och flödets FÖRSTA sida via RPC:n
  const loadFeed = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const uid = session.user.id
    setOwnId(uid)
    const [profile, lists, page] = await Promise.all([
      getProfile(uid).catch(() => null),
      getFollowLists(uid).catch(() => ({ followers: [], following: [] })),
      fetchFeedPage(),
    ])
    const map: Record<string, { name: string; avatar: string | null }> = {
      [uid]: {
        name: profile?.name || session.user.email?.split('@')[0] || t('Jag'),
        avatar: profile?.avatar_url ?? null,
      },
    }
    for (const p of lists.following) {
      map[p.id] = { name: p.name ?? t('Namnlös'), avatar: p.avatar_url }
    }
    setAuthors(map)
    setCardioRows(page.cardio)
    setStrengthRows(page.strength)
    setOldest(page.oldest)
    setHasMore(page.count >= FEED_PAGE_SIZE)
    setLoaded(true)
  }, [])

  useFocusEffect(useCallback(() => {
    getUnitSystem().then(setUnit).catch(() => {})
    loadFeed()
  }, [loadFeed]))

  const { refreshing, onRefresh } = useAppRefresh(loadFeed)
  // Grupper: mina grupper + skaparguiden. Föreningar: join via kod/skapa.
  const [myGroups, setMyGroups] = useState<Awaited<ReturnType<typeof getMyGroups>>>([])
  const [myOrgs, setMyOrgs] = useState<Awaited<ReturnType<typeof getMyOrganizations>>>([])
  const [wizardOpen, setWizardOpen] = useState(false)
  const [groupSearchOpen, setGroupSearchOpen] = useState(false)
  const [orgMode, setOrgMode] = useState<'join' | 'create' | null>(null)
  const [meId, setMeId] = useState<string | null>(null)
  const chrome = useCardChrome()
  const loadGroups = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    setMeId(session.user.id)
    const [groups, orgs] = await Promise.all([
      getMyGroups(session.user.id),
      getMyOrganizations(session.user.id).catch(() => []),
    ])
    setMyGroups(groups)
    setMyOrgs(orgs)
  }, [])
  useFocusEffect(useCallback(() => { loadGroups().catch(() => {}) }, [loadGroups]))
  // En skapa-knapp för båda: valet grupp eller förening görs i dialogen
  function createMenu() {
    Haptics.selectionAsync()
    Alert.alert(t('Skapa'), t('Vad vill du skapa?'), [
      { text: t('Avbryt'), style: 'cancel' },
      { text: t('Förening'), onPress: () => setOrgMode('create') },
      { text: t('Grupp'), onPress: () => setWizardOpen(true) },
    ])
  }

  // Chipramar som strängar per schema — dynamiska ramfärger fryser i modaler
  const T = useThemeStrings()
  const chipEdge = T.TEXT_PRIMARY === '#FFFFFF' ? THEME_DARK.BORDER : 'transparent'

  // Oändlig scroll: nästa sida börjar där förra slutade (cursor)
  async function loadMore() {
    if (!hasMore || loadingMoreRef.current || !oldest) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const page = await fetchFeedPage(oldest)
      // Dedupe på pass-id — cursorkrockar på exakt samma tidsstämpel
      setCardioRows(prev => {
        const seen = new Set(prev.map(r => r.workout.id))
        return [...prev, ...page.cardio.filter(r => !seen.has(r.workout.id))]
      })
      setStrengthRows(prev => {
        const seen = new Set(prev.map(r => r.workout.id))
        return [...prev, ...page.strength.filter(r => !seen.has(r.workout.id))]
      })
      setOldest(page.oldest ?? oldest)
      setHasMore(page.count >= FEED_PAGE_SIZE)
    } catch {
      // nästa scroll försöker igen
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }

  // Optimistiskt gilla/ogilla — backas vid fel. Notisen till passägaren
  // sköter databasen + realtime.
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

  return (
    <SafeScreen style={s.screen} edges={['top']}>
      {/* Rent otonat glas i tummen (som förlagan) + följer-knapp till höger */}
      <View style={s.segmentRow}>
        <View style={{ flex: 1 }}>
          <GlassSegment
            value={segment}
            options={[{ key: 'feed', label: t('Flöde') }, { key: 'groups', label: t('Grupper') }]}
            onChange={setSegment}
            tint={null}
          />
        </View>
        <GlassCircleButton
          icon="person-add-outline"
          size={44}
          iconColor={TEXT_PRIMARY}
          onPress={() => router.push('/(app)/search-users' as never)}
          fallbackStyle={s.followBtnFallback}
          testID="addPeople"
        />
      </View>

      {segment === 'groups' ? (
        <ScrollView contentContainerStyle={s.groupsScroll} showsVerticalScrollIndicator={false}>
          {/* Stor sökruta — grupper och föreningskoder i samma fält */}
          <TouchableOpacity
            style={[s.searchField, chrome]}
            onPress={() => setGroupSearchOpen(true)}
            activeOpacity={0.8}
            testID="searchGroups"
          >
            <Ionicons name="search" size={18} color={TEXT_SECONDARY} />
            <Text style={s.searchFieldText}>{t('Sök grupper eller ange kod')}</Text>
          </TouchableOpacity>

          {/* Föreningskortet — medlemskap eller gå med via kod */}
          <View style={[s.orgCard, chrome]}>
            <View style={s.orgCardHead}>
              <View style={[s.orgIcon, { backgroundColor: `${T.ACCENT}12` }]}>
                <Ionicons name="home-outline" size={20} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.groupName}>{t('Förening')}</Text>
                {myOrgs.length === 0 && (
                  <Text style={s.groupMeta}>{t('Du är inte med i någon förening än')}</Text>
                )}
              </View>
              <TouchableOpacity
                style={[s.joinCodeBtn, { backgroundColor: `${T.ACCENT}12` }]}
                onPress={() => setOrgMode('join')}
                activeOpacity={0.8}
                testID="joinOrg"
              >
                <Text style={[s.joinCodeText, { color: T.ACCENT }]}>{t('Gå med via kod')}</Text>
              </TouchableOpacity>
            </View>
            {myOrgs.map(o => (
              <TouchableOpacity
                key={o.id}
                style={s.orgRow}
                activeOpacity={0.75}
                testID={`org-${o.id}`}
                onPress={() => router.push({ pathname: '/(app)/organization', params: { orgId: o.id, name: o.name } } as never)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.groupName} numberOfLines={1}>{o.name}</Text>
                  <Text style={s.groupMeta}>
                    {o.memberCount === 1 ? t('1 medlem') : t('{n} medlemmar', { n: o.memberCount })}
                    {o.myRole !== 'member' ? ` · ${o.myRole === 'admin' ? t('Admin') : t('Coach')}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.myGroupsHead}>
            <Text style={[s.groupsLabel, { marginTop: 0 }]}>{t('MINA GRUPPER')}</Text>
            <TouchableOpacity style={s.createChip} onPress={createMenu} activeOpacity={0.85} testID="createAny">
              <Ionicons name="add" size={16} color={ACCENT_CONTRAST} />
              <Text style={[s.groupActionText, { color: ACCENT_CONTRAST }]}>{t('Skapa')}</Text>
            </TouchableOpacity>
          </View>
          {myGroups.map(g => (
            <TouchableOpacity
              key={g.id}
              style={[s.groupRow, chrome]}
              activeOpacity={0.75}
              testID={`group-${g.id}`}
              onPress={() => router.push({ pathname: '/(app)/group', params: { groupId: g.id, name: g.name, avatar: g.avatar_url ?? '' } } as never)}
            >
              <FeedAvatar url={g.avatar_url} fallback={g.name.charAt(0).toUpperCase()} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={s.groupName} numberOfLines={1}>{g.name}</Text>
                <Text style={s.groupMeta}>
                  {g.myStatus === 'pending' ? t('Förfrågan skickad')
                    : g.myStatus === 'invited' ? t('Inbjuden, tryck för att svara')
                    : g.memberCount === 1 ? t('1 medlem') : t('{n} medlemmar', { n: g.memberCount })}
                  {g.is_private ? ` · ${t('Privat')}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={TEXT_SECONDARY} />
            </TouchableOpacity>
          ))}

          {myGroups.length === 0 && (
            <View style={s.groupsEmpty}>
              <Ionicons name="people-outline" size={44} color={TEXT_SECONDARY} />
              <Text style={s.groupsEmptyTitle}>{t('Inga grupper ännu')}</Text>
              <Text style={s.groupsEmptyBody}>
                {t('Skapa en grupp och peppa varandra genom utmaningen, eller sök upp en som redan finns.')}
              </Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={filter === 'all' ? posts : posts.filter(p => p.kind === filter)}
          keyExtractor={p => p.id}
          renderItem={({ item }) => (
            <FeedWorkoutCard
              post={item}
              meta={passMeta[item.id]}
              onOpen={setSelected}
              social={social[item.id]}
              onToggleLike={() => toggleLike(item)}
              onOpenComments={() => openDiscussion(item)}
              onMenuPress={item.authorId !== ownId
                ? () => postReportMenu(item.id, item.authorId, item.authorName)
                : undefined}
              // Egen avatar → profilfliken (hela egna profilen med foton),
              // väns avatar → deras atletprofil
              onAvatarPress={() => {
                if (item.authorId === ownId) {
                  router.push('/(app)/profile' as never)
                } else {
                  router.push({
                    pathname: '/(app)/athlete',
                    params: { userId: item.authorId, name: item.authorName, avatar: item.authorAvatar ?? '' },
                  } as never)
                }
              }}
            />
          )}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} testID="feedRefresh" />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore
            ? <ActivityIndicator color={ACCENT} style={{ paddingVertical: 16 }} />
            : null}
          // Chipsen scrollar med flödet — headern förblir ren
          ListHeaderComponent={
            <View style={s.chipsRow}>
              {FILTERS.map(f => {
                const on = f.key === filter
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[s.chip, { borderColor: on ? T.ACCENT : chipEdge }]}
                    onPress={() => {
                      if (f.key === filter) return
                      Haptics.selectionAsync()
                      setFilter(f.key)
                    }}
                    activeOpacity={0.8}
                  >
                    {f.icon && <Ionicons name={f.icon} size={14} color={on ? ACCENT : TEXT_PRIMARY} />}
                    <Text style={[s.chipText, on && s.chipTextActive]}>{t(f.label)}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          }
          ListEmptyComponent={loaded ? (
            <EmptyState
              icon="megaphone-outline"
              title={filter === 'strength' ? t('Inga gympass i flödet')
                : filter === 'cardio' ? t('Inga cardio-pass i flödet')
                : t('Inget i flödet ännu')}
              body={filter === 'all'
                ? t('Dina och dina vänners pass dyker upp här. Hitta vänner och börja följa varandra!')
                : t('Passen dyker upp här så fort de loggas.')}
              ctaLabel={filter === 'all' ? t('Hitta vänner') : undefined}
              onCta={filter === 'all'
                ? () => router.push('/(app)/search-users' as never)
                : undefined}
            />
          ) : null}
        />
      )}

      {/* Samma detaljvyer som statistiken — utan radering härifrån, och
          skrivskyddat betyg på vänners pass */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected?.kind === 'cardio' && (
          <CardioSummaryView
            workout={selected.workout}
            title={selected.workout.name}
            dateLabel={new Date(selected.createdAt).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}
            avatarUrl={selected.authorAvatar}
            unit={unit}
            onClose={() => setSelected(null)}
            effortReadOnly={selected.authorId !== ownId}
            social={{
              postKey: selected.id,
              ownerId: selected.authorId,
              onOpenComments: () => {
                const post = selected
                setSelected(null)
                openDiscussion(post)
              },
            }}
          />
        )}
        {selected?.kind === 'strength' && (
          <GymSummaryView
            name={t('Gympass')}
            authorName={selected.authorName}
            avatarUrl={selected.authorAvatar}
            ownerId={selected.authorId}
            workoutDate={selected.workoutDate}
            passKey={selected.passKey}
            dateLabel={new Date(selected.createdAt).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}
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
                openDiscussion(post)
              },
            }}
          />
        )}
      </Modal>

      <GroupWizard
        visible={wizardOpen}
        userId={meId}
        onClose={() => setWizardOpen(false)}
        onCreated={g => {
          setWizardOpen(false)
          loadGroups().catch(() => {})
          router.push({ pathname: '/(app)/group', params: { groupId: g.id, name: g.name, avatar: g.avatar_url ?? '' } } as never)
        }}
      />

      <GroupSearchSheet
        visible={groupSearchOpen}
        onClose={() => setGroupSearchOpen(false)}
        onOpenGroup={g => {
          setGroupSearchOpen(false)
          router.push({ pathname: '/(app)/group', params: { groupId: g.id, name: g.name, avatar: g.avatar_url ?? '' } } as never)
        }}
        onOrgJoined={o => {
          setGroupSearchOpen(false)
          loadGroups().catch(() => {})
          router.push({ pathname: '/(app)/organization', params: { orgId: o.id, name: o.name } } as never)
        }}
      />

      <OrgSheet
        visible={orgMode !== null}
        mode={orgMode ?? 'join'}
        userId={meId}
        onClose={() => setOrgMode(null)}
        onDone={o => {
          setOrgMode(null)
          loadGroups().catch(() => {})
          router.push({ pathname: '/(app)/organization', params: { orgId: o.id, name: o.name } } as never)
        }}
      />

    </SafeScreen>
  )
}

const s = StyleSheet.create({
  groupsScroll: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120, gap: 10 },
  groupRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 16, padding: 14,
  },
  groupName: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  groupMeta: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
  groupsEmpty: { alignItems: 'center', gap: 8, paddingTop: 60, paddingHorizontal: 30 },
  groupsEmptyTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginTop: 4 },
  groupsEmptyBody: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  groupActionText: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
  searchField: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD, borderRadius: 999,
    paddingHorizontal: 18, paddingVertical: 15,
  },
  searchFieldText: { color: TEXT_SECONDARY, fontSize: 15.5 },
  orgCard: { backgroundColor: CARD, borderRadius: 20, padding: 14 },
  orgCardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  joinCodeBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  joinCodeText: { fontSize: 13.5, fontWeight: '700' },
  orgRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.2)',
  },
  myGroupsHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 8,
  },
  createChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: ACCENT, borderRadius: 999,
    paddingHorizontal: 13, paddingVertical: 7,
  },
  groupsLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginTop: 8, paddingHorizontal: 4,
  },
  orgIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },

  screen: { flex: 1, backgroundColor: BG },
  segmentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  followBtnFallback: { backgroundColor: CARD },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 + TAB_CONTENT_PAD, gap: 16 },

  // Samma chipstil som atletprofilens typväljare
  chipsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 17,
    paddingHorizontal: 11, paddingVertical: 7,
    backgroundColor: CARD,
  },
  chipActive: {},
  chipText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: ACCENT, fontWeight: '700' },

  empty: { alignItems: 'center', gap: 8, paddingTop: 90, paddingHorizontal: 40 },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginTop: 6 },
  emptyBody: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: 14, paddingHorizontal: 18, paddingVertical: 11,
    borderRadius: 20, borderWidth: 1.5,
  },
  emptyCtaText: { color: ACCENT, fontSize: 14, fontWeight: '700' },
})
