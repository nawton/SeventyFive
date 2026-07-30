import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share,
  Modal, ActivityIndicator,
} from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@/components/Icon'
import { supabase } from '@/lib/supabase'
import { GlassCircleButton } from '@/components/GlassButton'
import { GlassSegment } from '@/components/GlassSegment'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { CoachWorkoutSheet } from '@/components/CoachWorkoutSheet'
import { useT, dateLocale } from '@/lib/i18n'
import { getExercises, type Exercise } from '@/services/exercises'
import {
  getOrganization, getOrgMembers, getCoachWorkouts, getMyAdoptions,
  adoptCoachWorkout, deleteCoachWorkout, updateMemberRole, removeOrgMember,
  leaveOrganization, updateMyShareLevel, updateMyShareWith, getOrgGroups, getMyLinkableGroups,
  linkGroupToOrg, getOrgLeaderboard, getOrgTotals, getAdoptionStatus,
  type Organization, type OrgMember, type CoachWorkout, type ShareLevel,
  type OrgGroup, type OrgLeaderboardRow, type AdoptionStatus, type ShareWith,
} from '@/services/organizations'
import { getWeekBounds } from '@/components/stats/statsShared'
import {
  BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, RED, useThemeStrings, useCardChrome, useHeroChrome,
} from '@/lib/theme'

// =============================================================================
// FÖRENINGSSIDAN — koden att dela ut (admin/coach), tränarpassen med
// "Lägg till i mitt schema", medlemslistan med roller och min egen
// delningsnivå. Rollreglerna upprätthålls av RLS, knapparna är bara UI.
// =============================================================================

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', coach: 'Coach', member: 'Medlem' }
const SHARE_LABELS: Record<ShareLevel, string> = {
  base: 'Bas', detailed: 'Detaljerad', full: 'Full',
}
const SHARE_HINTS: Record<ShareLevel, string> = {
  base: 'Föreningen ser din streak och antal pass',
  detailed: 'Föreningen ser även volym, distans och PR',
  full: 'Föreningen ser även progression per övning',
}

export default function OrganizationScreen() {
  const t = useT()
  const T = useThemeStrings()
  const chrome = useCardChrome()
  const H = useHeroChrome()
  const params = useLocalSearchParams<{ orgId?: string; name?: string }>()
  const orgId = params.orgId ?? ''
  const hairline = 'rgba(128,128,128,0.18)'

  const [meId, setMeId] = useState<string | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [workouts, setWorkouts] = useState<CoachWorkout[]>([])
  const [adopted, setAdopted] = useState<Set<string>>(new Set())
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [coachOpen, setCoachOpen] = useState(false)
  const [detail, setDetail] = useState<CoachWorkout | null>(null)
  const [adopting, setAdopting] = useState(false)
  const [orgGroups, setOrgGroups] = useState<OrgGroup[]>([])
  const [board, setBoard] = useState<OrgLeaderboardRow[]>([])
  const [totals, setTotals] = useState<{ km: number; passes: number }>({ km: 0, passes: 0 })
  const [status, setStatus] = useState<AdoptionStatus[] | null>(null)
  const [tab, setTab] = useState<'overview' | 'workouts' | 'members'>('overview')


  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user || !orgId) return
    const uid = session.user.id
    setMeId(uid)
    const week = getWeekBounds(0)
    const sinceIso = new Date(`${week.start}T00:00:00`).toISOString()
    const [o, mem, ws, gs, lb, tot] = await Promise.all([
      getOrganization(orgId),
      getOrgMembers(orgId),
      getCoachWorkouts(orgId),
      getOrgGroups(orgId),
      getOrgLeaderboard(orgId, sinceIso),
      getOrgTotals(orgId, sinceIso),
    ])
    setOrg(o)
    setMembers(mem)
    setWorkouts(ws)
    setOrgGroups(gs)
    setBoard(lb)
    setTotals(tot)
    setAdopted(await getMyAdoptions(uid, ws.map(w => w.id)))
  }, [orgId])

  useFocusEffect(useCallback(() => {
    load().catch(() => {})
    // Övningslistan behövs bara för tränarpass-skaparen — ladda i bakgrunden
    getExercises().then(setExercises).catch(() => {})
  }, [load]))

  const me = members.find(m => m.id === meId)
  const isStaff = me?.role === 'admin' || me?.role === 'coach'
  const isAdmin = me?.role === 'admin'

  function shareCode() {
    if (!org) return
    Share.share({
      message: t('Gå med i {name} i SeventyFive-appen med koden {code}', { name: org.name, code: org.join_code }),
    }).catch(() => {})
  }

  // Admin trycker på en medlem: rollbyte eller borttagning
  function memberMenu(m: OrgMember) {
    if (!isAdmin || m.id === meId) return
    const nextRole = m.role === 'coach' ? 'member' : 'coach'
    Alert.alert(m.name ?? t('Medlem'), undefined, [
      { text: t('Avbryt'), style: 'cancel' },
      {
        text: nextRole === 'coach' ? t('Gör till coach') : t('Gör till medlem'),
        onPress: () => updateMemberRole(orgId, m.id, nextRole).then(load).catch(() => {}),
      },
      {
        text: t('Ta bort ur föreningen'), style: 'destructive',
        onPress: () => removeOrgMember(orgId, m.id).then(load).catch(() => {}),
      },
    ])
  }

  function confirmLeave() {
    if (!meId) return
    Alert.alert(t('Lämna föreningen'), t('Vill du lämna {name}?', { name: org?.name ?? '' }), [
      { text: t('Avbryt'), style: 'cancel' },
      {
        text: t('Lämna'), style: 'destructive',
        onPress: () => leaveOrganization(orgId, meId).then(() => router.back()).catch(() => {}),
      },
    ])
  }

  function cycleShareLevel() {
    if (!me || !meId) return
    const order: ShareLevel[] = ['base', 'detailed', 'full']
    const next = order[(order.indexOf(me.share_level) + 1) % order.length]
    Haptics.selectionAsync()
    setMembers(prev => prev.map(m => m.id === meId ? { ...m, share_level: next } : m))
    updateMyShareLevel(orgId, meId, next).catch(() => load())
  }

  function toggleShareWith() {
    if (!me || !meId) return
    const next: ShareWith = me.share_with === 'staff' ? 'org' : 'staff'
    Haptics.selectionAsync()
    setMembers(prev => prev.map(m => m.id === meId ? { ...m, share_with: next } : m))
    updateMyShareWith(orgId, meId, next).catch(() => load())
  }

  async function adopt(w: CoachWorkout) {
    if (!meId || adopting) return
    try {
      setAdopting(true)
      await adoptCoachWorkout(meId, w)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setAdopted(prev => new Set(prev).add(w.id))
      setDetail(null)
      Alert.alert(t('Tillagt i schemat'), t('Passet ligger nu på dagens datum i ditt schema.'))
    } catch {
      Alert.alert(t('Kunde inte lägga till'), t('Något gick fel. Försök igen.'))
    } finally {
      setAdopting(false)
    }
  }

  function openDetail(w: CoachWorkout) {
    setDetail(w)
    setStatus(null)
    if (isStaff) getAdoptionStatus(w.id).then(setStatus).catch(() => {})
  }

  // Koppla en av mina grupper till föreningen — triggern i databasen
  // kräver att jag är medlem, RLS att jag äger gruppen
  async function linkGroup() {
    if (!meId) return
    const candidates = await getMyLinkableGroups(meId).catch(() => [])
    if (candidates.length === 0) {
      Alert.alert(t('Inga grupper att koppla'), t('Du behöver äga en grupp som inte redan hör till en förening.'))
      return
    }
    Alert.alert(t('Koppla grupp'), t('Vilken av dina grupper ska höra till föreningen?'), [
      { text: t('Avbryt'), style: 'cancel' },
      ...candidates.slice(0, 3).map(g => ({
        text: g.name,
        onPress: () => linkGroupToOrg(g.id, orgId).then(load).catch(() => {}),
      })),
    ])
  }

  function openMemberPage(m: OrgMember) {
    router.push({
      pathname: '/(app)/org-member',
      params: {
        orgId, memberId: m.id, name: m.name ?? '', avatar: m.avatar_url ?? '',
        role: m.role, staff: isStaff ? '1' : '0',
      },
    } as never)
  }

  function workoutMenu(w: CoachWorkout) {
    if (!isStaff) return
    Alert.alert(w.name, undefined, [
      { text: t('Avbryt'), style: 'cancel' },
      {
        text: t('Ta bort passet'), style: 'destructive',
        onPress: () => deleteCoachWorkout(w.id).then(load).catch(() => {}),
      },
    ])
  }

  const onAccent = T.TEXT_PRIMARY === '#FFFFFF' ? '#000000' : '#FFFFFF'
  const myName = members.find(m => m.id === meId)?.name ?? t('Jag')
  const sortedBoard = [...board].sort((a, b) => (b.cardio_passes + b.gym_days) - (a.cardio_passes + a.gym_days)).slice(0, 10)

  return (
    <SafeScreen style={s.screen}>
      <View style={s.topBar}>
        <GlassCircleButton icon="chevron-back" size={40} iconColor={TEXT_PRIMARY}
          onPress={() => router.back()} fallbackStyle={{ backgroundColor: CARD }} />
        <View style={{ flex: 1 }}>
          <Text maxFontSizeMultiplier={1.15} style={s.topTitle} numberOfLines={1}>{org?.name ?? params.name ?? t('Förening')}</Text>
          <Text maxFontSizeMultiplier={1.15} style={s.topSub} numberOfLines={1}>
            {t('Förening')} · {members.length === 1 ? t('1 medlem') : t('{n} medlemmar', { n: members.length })}
            {me ? ` · ${me.role === 'admin' ? t('du är admin') : me.role === 'coach' ? t('du är coach') : t('du är medlem')}` : ''}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.segmentWrap}>
        <GlassSegment
          value={tab}
          options={[
            { key: 'overview', label: t('Översikt') },
            { key: 'workouts', label: t('Pass') },
            { key: 'members', label: t('Medlemmar') },
          ]}
          onChange={setTab}
        />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'overview' && (<>
        {/* Marinblå panel: veckans totaler + koden att bjuda in med */}
        <View style={[s.hero, H.card]}>
          <Text maxFontSizeMultiplier={1.15} style={s.heroLabel}>{t('TILLSAMMANS DENNA VECKA')}</Text>
          <View style={s.heroStatsRow}>
            <Text maxFontSizeMultiplier={1.15} style={s.heroStat}>
              {totals.passes}
              <Text style={[s.heroStatUnit, { color: H.sub }]}> {t('pass')}</Text>
            </Text>
            <Text maxFontSizeMultiplier={1.15} style={s.heroStat}>
              {totals.km.toFixed(1).replace('.', ',')}
              <Text style={[s.heroStatUnit, { color: H.sub }]}> km</Text>
            </Text>
          </View>
          {isStaff && org && (
            <>
              <View style={[s.heroDivider, { backgroundColor: H.divider }]} />
              <View style={s.heroCodeRow}>
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={1.15} style={[s.heroLabel, { color: H.sub }]}>{t('BJUD IN MED KOD')}</Text>
                  <Text maxFontSizeMultiplier={1.15} style={s.heroCode}>{org.join_code}</Text>
                </View>
                <TouchableOpacity style={s.shareBtn} onPress={shareCode} activeOpacity={0.8} testID="shareCode">
                  <Ionicons name="share-outline" size={15} color="#FFFFFF" />
                  <Text style={s.shareBtnText}>{t('Dela')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        </>)}

        {tab === 'workouts' && (<>
        {/* Tränarpassen */}
        <View style={[s.card, chrome]}>
          <View style={s.cardHead}>
            <Text maxFontSizeMultiplier={1.15} style={s.cardTitle}>{t('Tränarpass')}</Text>
            {isStaff && (
              <TouchableOpacity
                style={[s.solidBtn, { backgroundColor: T.ACCENT }]}
                onPress={() => setCoachOpen(true)}
                activeOpacity={0.85}
                testID="newCoachWorkout"
              >
                <Text maxFontSizeMultiplier={1.15} style={[s.solidBtnText, { color: onAccent }]}>+ {t('Publicera')}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={s.cardSub}>
            {isStaff
              ? t('Pass du publicerar kan medlemmarna lägga in i sina scheman.')
              : t('Pass från din coach kan läggas in i ditt schema.')}
          </Text>
          {workouts.length === 0 ? (
            <View style={s.emptyInset}>
              <Ionicons name="calendar-outline" size={17} color={TEXT_SECONDARY} />
              <Text style={s.emptyInsetText}>{t('Inga pass publicerade än')}</Text>
            </View>
          ) : workouts.map((w, i) => (
            <TouchableOpacity
              key={w.id}
              style={[s.innerRow, i > 0 && s.innerRowBorder]}
              onPress={() => openDetail(w)}
              onLongPress={() => workoutMenu(w)}
              activeOpacity={0.75}
              testID={`coachWorkout-${w.id}`}
            >
              <View style={[s.workoutIcon, { backgroundColor: `${T.ACCENT}14` }]}>
                <Ionicons name={w.session_type === 'gym' ? 'barbell-outline' : 'fitness-outline'} size={19} color={T.ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.workoutName} numberOfLines={1}>{w.name}</Text>
                <Text style={s.workoutMeta} numberOfLines={1}>
                  {w.session_type === 'gym'
                    ? t('{n} övningar', { n: w.exercises.length })
                    : t('Cardio')}
                  {w.audience === 'selected' ? ` · ${t('Utvalda')}` : ''}
                  {' · '}
                  {new Date(w.created_at).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })}
                </Text>
              </View>
              {adopted.has(w.id)
                ? <View style={[s.adoptedPill, { backgroundColor: `${T.ACCENT}16` }]}>
                    <Ionicons name="checkmark" size={13} color={T.ACCENT} />
                    <Text style={[s.adoptedText, { color: T.ACCENT }]}>{t('Tillagt')}</Text>
                  </View>
                : <Ionicons name="chevron-forward" size={17} color={TEXT_SECONDARY} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Så funkar tränarpass — tre steg */}
        <View style={[s.card, chrome]}>
          <Text maxFontSizeMultiplier={1.15} style={s.cardTitle}>{t('Så funkar tränarpass')}</Text>
          {[
            t('Bygg passet: namn, typ och övningar'),
            t('Välj vilka som ser det: hela föreningen eller en kopplad grupp'),
            t('Medlemmarna lägger in passet i sitt eget veckoschema med ett tryck'),
          ].map((step, i) => (
            <View key={i} style={s.stepRow}>
              <View style={[s.stepNum, { backgroundColor: `${T.ACCENT}14` }]}>
                <Text style={[s.stepNumText, { color: T.ACCENT }]}>{i + 1}</Text>
              </View>
              <Text style={s.stepText}>{step}</Text>
            </View>
          ))}
        </View>
        </>)}

        {tab === 'overview' && (<>
        {/* Veckans topplista */}
        <View style={[s.card, chrome]}>
          <Text maxFontSizeMultiplier={1.15} style={s.cardTitle}>{t('Veckans topplista')}</Text>
          {sortedBoard.map((r, i) => {
            const m = members.find(x => x.id === r.user_id)
            const name = m?.name ?? t('Namnlös')
            return (
              <TouchableOpacity
                key={r.user_id}
                style={[s.innerRow, i > 0 && s.innerRowBorder]}
                onPress={() => m && openMemberPage(m)}
                activeOpacity={0.7}
                testID={`boardRow-${r.user_id}`}
              >
                <Text style={[s.boardRank, i === 0 && { color: '#D6A319' }]}>{i + 1}</Text>
                <FeedAvatar url={m?.avatar_url ?? null} fallback={name.charAt(0).toUpperCase()} size={36} />
                <Text style={s.memberName} numberOfLines={1}>
                  {r.user_id === meId ? `${name} (${t('du')})` : name}
                </Text>
                <Text maxFontSizeMultiplier={1.2} style={[s.boardMeta, { color: T.ACCENT }]}>
                  {r.cardio_passes + r.gym_days === 1 ? t('1 pass') : t('{n} pass', { n: r.cardio_passes + r.gym_days })}
                  {r.km != null && r.km > 0 ? <Text style={s.boardKm}>{` · ${r.km.toFixed(1).replace('.', ',')} km`}</Text> : null}
                </Text>
              </TouchableOpacity>
            )
          })}
          {members.length === 1 && (
            <View style={[s.infoInset, { backgroundColor: `${T.ACCENT}0E` }]}>
              <Ionicons name="people-outline" size={17} color={T.ACCENT} />
              <Text style={s.infoInsetText}>{t('Bjud in fler med koden så blir det en riktig liga.')}</Text>
            </View>
          )}
        </View>

        {/* Grupperna som hör till föreningen */}
        <View style={[s.card, chrome]}>
          <View style={s.cardHead}>
            <Text maxFontSizeMultiplier={1.15} style={s.cardTitle}>{t('Grupper i föreningen')}</Text>
            <TouchableOpacity
              style={[s.tintBtn, { backgroundColor: `${T.ACCENT}12` }]}
              onPress={linkGroup}
              activeOpacity={0.8}
              testID="linkGroup"
            >
              <Text maxFontSizeMultiplier={1.15} style={[s.tintBtnText, { color: T.ACCENT }]}>{t('Koppla grupp')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.cardSub}>{t('Kopplade grupper kan få tränarpass riktade till sig.')}</Text>
          {orgGroups.length === 0 ? (
            <View style={s.emptyInset}>
              <Ionicons name="link-outline" size={17} color={TEXT_SECONDARY} />
              <Text style={s.emptyInsetText}>{t('Inga grupper kopplade än')}</Text>
            </View>
          ) : orgGroups.map((g, i) => (
            <TouchableOpacity
              key={g.id}
              style={[s.innerRow, i > 0 && s.innerRowBorder]}
              onPress={() => router.push({ pathname: '/(app)/group', params: { groupId: g.id, name: g.name, avatar: g.avatar_url ?? '' } } as never)}
              activeOpacity={0.75}
              testID={`orgGroup-${g.id}`}
            >
              <FeedAvatar url={g.avatar_url} fallback={g.name.charAt(0).toUpperCase()} size={38} />
              <Text style={[s.workoutName, { flex: 1 }]} numberOfLines={1}>{g.name}</Text>
              <Ionicons name="chevron-forward" size={17} color={TEXT_SECONDARY} />
            </TouchableOpacity>
          ))}
        </View>

        </>)}

        {tab === 'members' && (<>
        {/* Min delning + medlemmarna i samma kort */}
        <View style={[s.card, chrome]}>
          {me && (
            <TouchableOpacity style={s.shareHead} onPress={cycleShareLevel} activeOpacity={0.8} testID="shareLevel">
              <Ionicons name="eye-outline" size={19} color={TEXT_SECONDARY} />
              <View style={{ flex: 1 }}>
                <Text maxFontSizeMultiplier={1.2} style={s.shareTitle}>{t('Min delning: {level}', { level: t(SHARE_LABELS[me.share_level]) })}</Text>
                <Text style={s.cardSub2}>{t(SHARE_HINTS[me.share_level])}</Text>
              </View>
              <Text maxFontSizeMultiplier={1.15} style={[s.tintBtnText, { color: T.ACCENT }]}>{t('Ändra')}</Text>
            </TouchableOpacity>
          )}
          {members.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[s.innerRow, s.innerRowBorder]}
              onPress={() => openMemberPage(m)}
              onLongPress={() => memberMenu(m)}
              activeOpacity={0.7}
              testID={`orgMember-${m.id}`}
            >
              <FeedAvatar url={m.avatar_url} fallback={(m.name ?? '?').charAt(0).toUpperCase()} size={40} />
              <Text style={s.memberName} numberOfLines={1}>
                {m.id === meId ? `${myName} (${t('du')})` : m.name ?? t('Namnlös')}
              </Text>
              {m.role !== 'member' && (
                <View style={[s.rolePill, { backgroundColor: `${T.ACCENT}14` }]}>
                  <Text style={[s.roleText, { color: T.ACCENT }]}>{t(ROLE_LABELS[m.role])}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={s.leaveBtn} onPress={confirmLeave} activeOpacity={0.7} testID="leaveOrg">
          <Text maxFontSizeMultiplier={1.2} style={s.leaveText}>{t('Lämna föreningen')}</Text>
        </TouchableOpacity>
        </>)}
      </ScrollView>

      {/* Passdetaljen: övningarna, coachens notering och joina-knappen */}
      <Modal visible={!!detail} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
        <View style={s.detailBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setDetail(null)} activeOpacity={1} testID="detailBackdrop" />
          <View style={[s.detailSheet, { backgroundColor: T.BG }]}>
            <View style={s.detailHandle} />
            <Text style={s.detailTitle}>{detail?.name}</Text>
            {detail?.notes ? <Text style={s.detailNotes}>{detail.notes}</Text> : null}
            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              {detail?.session_type === 'gym' && detail.exercises.map((ex, i) => (
                <View key={i} style={[s.detailExRow, { borderBottomColor: hairline }]}>
                  <Text style={s.detailExName} numberOfLines={1}>{t(ex.exercise_name)}</Text>
                  <Text style={s.detailExMeta}>{ex.sets ?? 3} × {ex.reps ?? '10'}</Text>
                </View>
              ))}
              {detail?.session_type === 'cardio' && (
                <Text style={s.detailNotes}>{t('Cardiopass, detaljerna står i beskrivningen ovan.')}</Text>
              )}
            </ScrollView>
            {isStaff && status !== null && (
              <>
                <Text style={s.statusLabel}>{t('MEDLEMMARNAS STATUS')}</Text>
                {status.length === 0 && (
                  <Text style={s.detailNotes}>{t('Ingen har lagt till passet ännu.')}</Text>
                )}
                {status.map(a => (
                  <View key={a.id} style={s.statusRow}>
                    <FeedAvatar url={a.avatar_url} fallback={(a.name ?? '?').charAt(0).toUpperCase()} size={30} />
                    <Text style={s.statusName} numberOfLines={1}>{a.id === meId ? t('Jag') : a.name ?? t('Namnlös')}</Text>
                    <View style={[s.statusPill, { backgroundColor: a.completed ? `${T.ACCENT}16` : 'rgba(128,128,128,0.12)' }]}>
                      <Ionicons name={a.completed ? 'checkmark-circle' : 'time-outline'} size={13}
                        color={a.completed ? T.ACCENT : TEXT_SECONDARY} />
                      <Text style={[s.statusPillText, { color: a.completed ? T.ACCENT : TEXT_SECONDARY }]}>
                        {a.completed ? t('Har kört') : t('Tillagt')}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}
            {detail && adopted.has(detail.id) ? (
              <View style={[s.detailAdopted, { backgroundColor: `${T.ACCENT}12` }]}>
                <Ionicons name="checkmark-circle" size={18} color={T.ACCENT} />
                <Text style={[s.detailAdoptedText, { color: T.ACCENT }]}>{t('Ligger i ditt schema')}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[s.detailBtn, { backgroundColor: T.ACCENT }, adopting && { opacity: 0.6 }]}
                onPress={() => detail && adopt(detail)}
                disabled={adopting}
                activeOpacity={0.85}
                testID="adoptWorkout"
              >
                {adopting
                  ? <ActivityIndicator color={T.TEXT_PRIMARY === '#FFFFFF' ? '#000' : '#fff'} />
                  : <Text style={[s.detailBtnText, { color: T.TEXT_PRIMARY === '#FFFFFF' ? '#000000' : '#FFFFFF' }]}>
                      {t('Lägg till i mitt schema')}
                    </Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <CoachWorkoutSheet
        visible={coachOpen}
        orgId={orgId}
        userId={meId}
        members={members}
        groups={orgGroups}
        exercises={exercises}
        onClose={() => setCoachOpen(false)}
        onCreated={() => { setCoachOpen(false); load().catch(() => {}) }}
      />
    </SafeScreen>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  topTitle: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800' },
  topSub: { color: TEXT_SECONDARY, fontSize: 12.5, marginTop: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 60, paddingTop: 6, gap: 14 },
  segmentWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 14 },
  stepNum: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  stepNumText: { fontSize: 13, fontWeight: '800' },
  stepText: { flex: 1, color: TEXT_PRIMARY, fontSize: 14, lineHeight: 20 },

  hero: { borderRadius: 22, padding: 18 },
  heroLabel: { color: '#9AA3BC', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  heroStatsRow: { flexDirection: 'row', gap: 28, marginTop: 8 },
  heroStat: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  heroStatUnit: { color: '#9AA3BC', fontSize: 13.5, fontWeight: '700' },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 14 },
  heroCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroCode: { color: '#F2A25F', fontSize: 21, fontWeight: '800', letterSpacing: 5, marginTop: 4 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  shareBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  card: { backgroundColor: CARD, borderRadius: 20, padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '800' },
  cardSub: { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 18, marginTop: 6 },
  cardSub2: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
  solidBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  solidBtnText: { fontSize: 13.5, fontWeight: '800' },
  tintBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tintBtnText: { fontSize: 13.5, fontWeight: '700' },

  emptyInset: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: 'rgba(128,128,128,0.09)', borderRadius: 14,
    padding: 14, marginTop: 12,
  },
  emptyInsetText: { color: TEXT_SECONDARY, fontSize: 14 },
  infoInset: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    borderRadius: 14, padding: 13, marginTop: 12,
  },
  infoInsetText: { flex: 1, color: TEXT_PRIMARY, fontSize: 13, lineHeight: 18 },

  innerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, marginTop: 2 },
  innerRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.18)' },
  workoutIcon: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
  },
  workoutName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },
  workoutMeta: { color: TEXT_SECONDARY, fontSize: 12.5, marginTop: 2 },
  adoptedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5,
  },
  adoptedText: { fontSize: 12, fontWeight: '700' },

  boardRank: { width: 18, color: TEXT_SECONDARY, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  boardMeta: { fontSize: 13.5, fontWeight: '800' },
  boardKm: { color: TEXT_SECONDARY, fontSize: 12.5, fontWeight: '600' },
  memberName: { flex: 1, color: TEXT_PRIMARY, fontSize: 14.5, fontWeight: '600' },
  rolePill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  roleText: { fontSize: 12.5, fontWeight: '700' },

  shareHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12 },
  shareTitle: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '800' },

  leaveBtn: {
    alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(229,72,77,0.45)',
    borderRadius: 999, paddingVertical: 14, marginTop: 6,
  },
  leaveText: { color: RED, fontSize: 14.5, fontWeight: '700' },

  detailBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  detailSheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 22, paddingTop: 10, paddingBottom: 34,
  },
  detailHandle: {
    alignSelf: 'center', width: 44, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.45)', marginBottom: 14,
  },
  detailTitle: { color: TEXT_PRIMARY, fontSize: 19, fontWeight: '800' },
  detailNotes: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 20, marginTop: 6 },
  detailExRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailExName: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  detailExMeta: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600' },
  detailBtn: {
    borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 16,
  },
  detailBtnText: { fontSize: 16, fontWeight: '800' },
  detailAdopted: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: 16, paddingVertical: 14, marginTop: 16,
  },
  detailAdoptedText: { fontSize: 15, fontWeight: '700' },
  statusLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    marginTop: 16, marginBottom: 6,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  statusName: { flex: 1, color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4,
  },
  statusPillText: { fontSize: 12, fontWeight: '700' },
})
