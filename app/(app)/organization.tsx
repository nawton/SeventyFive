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
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { CoachWorkoutSheet } from '@/components/CoachWorkoutSheet'
import { useT, dateLocale } from '@/lib/i18n'
import { getExercises, type Exercise } from '@/services/exercises'
import {
  getOrganization, getOrgMembers, getCoachWorkouts, getMyAdoptions,
  adoptCoachWorkout, deleteCoachWorkout, updateMemberRole, removeOrgMember,
  leaveOrganization, updateMyShareLevel,
  type Organization, type OrgMember, type CoachWorkout, type ShareLevel,
} from '@/services/organizations'
import {
  BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, RED, useThemeStrings, useCardChrome,
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
  base: 'Streak och antal pass',
  detailed: 'Även volym, distans och PR',
  full: 'Även progression per övning',
}

export default function OrganizationScreen() {
  const t = useT()
  const T = useThemeStrings()
  const chrome = useCardChrome()
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

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user || !orgId) return
    const uid = session.user.id
    setMeId(uid)
    const [o, mem, ws] = await Promise.all([
      getOrganization(orgId),
      getOrgMembers(orgId),
      getCoachWorkouts(orgId),
    ])
    setOrg(o)
    setMembers(mem)
    setWorkouts(ws)
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

  return (
    <SafeScreen style={s.screen}>
      <View style={s.topBar}>
        <GlassCircleButton icon="chevron-back" size={40} iconColor={TEXT_PRIMARY}
          onPress={() => router.back()} fallbackStyle={{ backgroundColor: CARD }} />
        <Text style={s.topTitle} numberOfLines={1}>{org?.name ?? params.name ?? t('Förening')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {org?.description ? <Text style={s.desc}>{org.description}</Text> : null}

        {/* Koden — admin och coach delar ut den */}
        {isStaff && org && (
          <TouchableOpacity style={[s.codeCard, chrome]} onPress={shareCode} activeOpacity={0.8} testID="shareCode">
            <View style={{ flex: 1 }}>
              <Text style={s.codeLabel}>{t('FÖRENINGENS KOD')}</Text>
              <Text style={[s.codeValue, { color: T.ACCENT }]}>{org.join_code}</Text>
              <Text style={s.codeHint}>{t('Tryck för att dela med medlemmarna')}</Text>
            </View>
            <Ionicons name="share-outline" size={22} color={T.ACCENT} />
          </TouchableOpacity>
        )}

        {/* Tränarpassen */}
        <View style={s.sectionHead}>
          <Text style={s.sectionLabel}>{t('TRÄNARPASS')}</Text>
          {isStaff && (
            <TouchableOpacity onPress={() => setCoachOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="newCoachWorkout">
              <Ionicons name="add-circle-outline" size={24} color={T.ACCENT} />
            </TouchableOpacity>
          )}
        </View>
        {workouts.length === 0 && (
          <Text style={s.emptyText}>
            {isStaff
              ? t('Publicera ett pass så kan medlemmarna lägga in det i sina scheman.')
              : t('Inga tränarpass ännu. De dyker upp här när din coach publicerar dem.')}
          </Text>
        )}
        {workouts.map(w => (
          <TouchableOpacity
            key={w.id}
            style={[s.workoutRow, chrome]}
            onPress={() => setDetail(w)}
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

        {/* Min delning — vad andra i föreningen ser av min statistik */}
        {me && (
          <>
            <Text style={s.sectionLabel}>{t('MIN DELNING')}</Text>
            <TouchableOpacity style={[s.shareRow, chrome]} onPress={cycleShareLevel} activeOpacity={0.8} testID="shareLevel">
              <Ionicons name="eye-outline" size={19} color={T.ACCENT} />
              <View style={{ flex: 1 }}>
                <Text style={s.shareValue}>{t(SHARE_LABELS[me.share_level])}</Text>
                <Text style={s.shareHint}>{t(SHARE_HINTS[me.share_level])}</Text>
              </View>
              <Ionicons name="swap-horizontal" size={17} color={TEXT_SECONDARY} />
            </TouchableOpacity>
          </>
        )}

        {/* Medlemmarna */}
        <Text style={s.sectionLabel}>
          {members.length === 1 ? t('1 MEDLEM') : t('{n} MEDLEMMAR', { n: members.length })}
        </Text>
        <View style={[s.memberCard, chrome]}>
          {members.map((m, i) => (
            <TouchableOpacity
              key={m.id}
              style={[s.memberRow, i < members.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: hairline }]}
              onPress={() => memberMenu(m)}
              activeOpacity={isAdmin && m.id !== meId ? 0.7 : 1}
              testID={`orgMember-${m.id}`}
            >
              <FeedAvatar url={m.avatar_url} fallback={(m.name ?? '?').charAt(0).toUpperCase()} size={40} />
              <Text style={s.memberName} numberOfLines={1}>
                {m.id === meId ? t('Jag') : m.name ?? t('Namnlös')}
              </Text>
              {m.role !== 'member' && (
                <View style={[s.rolePill, { backgroundColor: `${T.ACCENT}16` }]}>
                  <Text style={[s.roleText, { color: T.ACCENT }]}>{t(ROLE_LABELS[m.role])}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={s.leaveBtn} onPress={confirmLeave} activeOpacity={0.7} testID="leaveOrg">
          <Text style={s.leaveText}>{t('Lämna föreningen')}</Text>
        </TouchableOpacity>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8, gap: 12,
  },
  topTitle: { flex: 1, color: TEXT_PRIMARY, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },
  desc: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  codeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 16, padding: 16, marginBottom: 6,
  },
  codeLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  codeValue: { fontSize: 28, fontWeight: '800', letterSpacing: 6, marginVertical: 2 },
  codeHint: { color: TEXT_SECONDARY, fontSize: 12 },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 18, marginBottom: 8,
  },
  sectionLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    marginTop: 18, marginBottom: 8,
  },
  emptyText: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 20 },
  workoutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 16, padding: 14, marginBottom: 8,
  },
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
  shareRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 16, padding: 14,
  },
  shareValue: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },
  shareHint: { color: TEXT_SECONDARY, fontSize: 12.5, marginTop: 1 },
  memberCard: { backgroundColor: CARD, borderRadius: 16, paddingHorizontal: 14 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  memberName: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  rolePill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  roleText: { fontSize: 12, fontWeight: '700' },
  leaveBtn: { alignItems: 'center', marginTop: 26 },
  leaveText: { color: RED, fontSize: 15, fontWeight: '700' },

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
})
