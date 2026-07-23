import { useCallback, useState } from 'react'
import { View, StyleSheet, ScrollView, Alert } from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/services/profile'
import { getCardioWorkouts, type CardioWorkout } from '@/services/cardioWorkouts'
import { getStrengthWorkouts, type StrengthWorkout } from '@/services/strengthWorkouts'
import { fetchUserWorkouts } from '@/services/feed'
import { getActiveChallenge } from '@/services/challenge'
import { getStreak } from '@/services/dailyLog'
import {
  getFollowCounts, getFollowStatus, follow, unfollow, subscribeToFollows,
  type FollowCounts, type FollowStatus,
} from '@/services/follows'
import { blockUser, unblockUser, isBlocked } from '@/services/blocks'
import { reportContent } from '@/services/reports'
import { strengthToPosts } from '@/components/FeedWorkoutCard'
import { AthleteOverview } from '@/components/AthleteOverview'
import { GlassCircleButton } from '@/components/GlassButton'
import { getUnitSystem, type UnitSystem } from '@/lib/units'
import { BG, CARD, TEXT_PRIMARY } from '@/lib/theme'
import { TAB_CONTENT_PAD } from '@/lib/glass'

// =============================================================================
// ATLETPROFIL — öppnas från flödeskortens avatar och sökningen. Själva vyn
// bor i AthleteOverview (delad med profilfliken); den här skärmen sköter
// laddning, params och följ-logiken. Utan userId-param visas den egna
// profilen; med userId någon annans (namn/avatar följer med som params).
// =============================================================================

// Testerna (och ev. andra skärmar) når hjälparna via den delade modulen
export { activeLabel, buildWeekBuckets } from '@/components/AthleteOverview'

export default function AthleteScreen() {
  const params = useLocalSearchParams<{ userId?: string; name?: string; avatar?: string }>()
  const otherId = typeof params.userId === 'string' && params.userId.length > 0 ? params.userId : null
  const paramName = typeof params.name === 'string' ? params.name : ''
  const paramAvatar = typeof params.avatar === 'string' && params.avatar.length > 0 ? params.avatar : null
  const [isOwn, setIsOwn] = useState(otherId === null)
  const [name, setName] = useState(paramName)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(paramAvatar)
  const [workouts, setWorkouts] = useState<CardioWorkout[]>([])
  const [gymCount, setGymCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [unit, setUnit] = useState<UnitSystem>('metric')
  // Vänförfrågningar: min status mot den visade profilen och profilens
  // räknare. Uppdateras optimistiskt vid tryck och live via realtime.
  const [followStatus, setFollowStatus] = useState<FollowStatus>('none')
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 })
  const [blocked, setBlocked] = useState(false)

  const statsUnlocked = !blocked && (isOwn || followStatus === 'accepted')

  useFocusEffect(useCallback(() => {
    let alive = true
    let unsubscribe: (() => void) | null = null
    getUnitSystem().then(u => { if (alive) setUnit(u) })
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user || !alive) return
      const own = otherId === null || otherId === session.user.id
      setIsOwn(own)

      // Räknarna gäller den VISADE profilen och hålls färska via realtime —
      // följer någon dig medan sidan är öppen tickar siffran upp direkt
      const viewedId = own ? session.user.id : otherId!
      const loadCounts = () => {
        getFollowCounts(viewedId).then(c => { if (alive) setCounts(c) }).catch(() => {})
      }
      loadCounts()
      unsubscribe = subscribeToFollows(viewedId, loadCounts)

      if (!own) {
        // Skärmen ligger kvar monterad i tab-navigatorn — utan explicit
        // synk här visas första besökta profilen för alltid
        setName(paramName)
        setAvatarUrl(paramAvatar)
        setWorkouts([])
        setGymCount(0)
        setFollowStatus('none')
        setBlocked(false)
        isBlocked(otherId!).then(v => { if (alive) setBlocked(v) }).catch(() => {})
        const status = await getFollowStatus(otherId!).catch(() => 'none' as FollowStatus)
        if (!alive) return
        setFollowStatus(status)
        if (status !== 'accepted') return
        // Godkänd förfrågan — serverstrippad läsväg (rutter döljs om
        // ägaren valt det; RLS avgör åtkomsten)
        const shared = await fetchUserWorkouts(otherId!)
          .catch(() => ({ cardio: [], strength: [] }))
        if (!alive) return
        setWorkouts(shared.cardio.map(r => r.workout))
        setGymCount(strengthToPosts(shared.strength.map(r => r.workout), '', '', null).length)
        return
      }
      const [profile, all, strength] = await Promise.all([
        getProfile(session.user.id).catch(() => null),
        getCardioWorkouts(session.user.id, 200).catch(() => [] as CardioWorkout[]),
        getStrengthWorkouts(session.user.id, 500).catch(() => [] as StrengthWorkout[]),
      ])
      if (!alive) return
      setName(profile?.name || session.user.email?.split('@')[0] || '')
      setAvatarUrl(profile?.avatar_url ?? null)
      setWorkouts(all)
      // Gymdagar räknas som pass i aktivitetsknappen — samma gruppering
      // som flödet använder
      setGymCount(strengthToPosts(strength, '', '', null).length)
      // Streakräknaren (ersätter Totalt km på egna profilen)
      getActiveChallenge(session.user.id)
        .then(c => c ? getStreak(c.id) : 0)
        .then(days => { if (alive) setStreak(days) })
        .catch(() => {})
    })
    return () => { alive = false; unsubscribe?.() }
  }, [otherId, paramName, paramAvatar]))

  // ⋯-menyn: rapportera användaren och blockera/avblockera
  function openProfileMenu() {
    if (!otherId) return
    Alert.alert(name || 'Profil', undefined, [
      {
        text: 'Rapportera användaren',
        onPress: () => {
          reportContent('user', otherId)
            .then(() => Alert.alert('Tack', 'Rapporten är mottagen och granskas av teamet.'))
            .catch(() => {})
        },
      },
      blocked
        ? { text: 'Avblockera', onPress: handleBlockToggle }
        : { text: 'Blockera användaren', style: 'destructive', onPress: handleBlockToggle },
      { text: 'Avbryt', style: 'cancel' },
    ])
  }

  // Avblockera direkt från knappen; blockera via ⋯-menyn med bekräftelse
  function handleBlockToggle() {
    if (!otherId) return
    if (blocked) {
      Haptics.selectionAsync()
      setBlocked(false)
      unblockUser(otherId).catch(() => setBlocked(true))
      return
    }
    Alert.alert(
      `Blockera ${name.split(' ')[0] || 'användaren'}?`,
      'Ni slutar följa varandra, kan inte skicka nya förfrågningar och hittar inte varandra i sökningen. Personen meddelas inte.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Blockera',
          style: 'destructive',
          onPress: () => {
            setBlocked(true)
            setFollowStatus('none')
            setWorkouts([])
            setGymCount(0)
            blockUser(otherId).catch(() => setBlocked(false))
          },
        },
      ]
    )
  }

  function toggleFollow() {
    if (isOwn || !otherId) return   // man kan inte följa sig själv
    if (blocked) { handleBlockToggle(); return }   // knappen är Avblockera
    Haptics.selectionAsync()
    const prev = followStatus
    if (prev === 'none') {
      // Skicka vänförfrågan. Servern sätter statusen: privat profil →
      // pending, offentlig profil → accepted direkt (då hämtas statistiken
      // på en gång)
      setFollowStatus('pending')
      follow(otherId)
        .then(() => getFollowStatus(otherId))
        .then(async status => {
          setFollowStatus(status)
          if (status !== 'accepted') return
          setCounts(c => ({ ...c, followers: c.followers + 1 }))
          const shared = await fetchUserWorkouts(otherId)
            .catch(() => ({ cardio: [], strength: [] }))
          setWorkouts(shared.cardio.map(r => r.workout))
          setGymCount(strengthToPosts(shared.strength.map(r => r.workout), '', '', null).length)
        })
        .catch(() => setFollowStatus('none'))
    } else {
      // Ångra förfrågan eller avfölj — godkända följen sänker räknaren
      setFollowStatus('none')
      if (prev === 'accepted') {
        setWorkouts([])
        setGymCount(0)
        setCounts(c => ({ ...c, followers: Math.max(0, c.followers - 1) }))
      }
      unfollow(otherId).catch(() => {
        setFollowStatus(prev)
        if (prev === 'accepted') setCounts(c => ({ ...c, followers: c.followers + 1 }))
      })
    }
  }

  return (
    <SafeScreen style={s.screen}>
      <View style={s.header}>
        <GlassCircleButton
          icon="chevron-back"
          size={40}
          iconColor={TEXT_PRIMARY}
          onPress={() => router.back()}
          fallbackStyle={s.iconBtnFallback}
        />
        {/* ⋯-menyn: rapportera + blockera — bara på andras profiler */}
        {!isOwn ? (
          <GlassCircleButton
            icon="ellipsis-horizontal"
            size={40}
            iconColor={TEXT_PRIMARY}
            onPress={openProfileMenu}
            fallbackStyle={s.iconBtnFallback}
          />
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <AthleteOverview
          isOwn={isOwn}
          name={name}
          avatarUrl={avatarUrl}
          workouts={workouts}
          gymCount={gymCount}
          counts={counts}
          unit={unit}
          followStatus={followStatus}
          statsUnlocked={statsUnlocked}
          blocked={blocked}
          onToggleFollow={toggleFollow}
          onMessage={otherId ? () => router.push({
            pathname: '/(app)/chat',
            params: { userId: otherId, name, avatar: avatarUrl ?? '' },
          } as never) : undefined}
          // Tomma params när det är egna — skriver över kvarliggande
          onOpenActivities={() => router.push({
            pathname: '/(app)/activities',
            params: isOwn
              ? { userId: '', name: '', avatar: '' }
              : { userId: otherId!, name, avatar: avatarUrl ?? '' },
          } as never)}
          // Listorna visar egna relationer — bara egna räknare är tryckbara
          onPressFollows={isOwn
            ? tab => router.push({ pathname: '/(app)/following', params: { tab } } as never)
            : undefined}
          streak={isOwn ? streak : undefined}
          onPressStreak={() => router.push('/(app)/streak' as never)}
        />
      </ScrollView>
    </SafeScreen>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  iconBtnFallback: { backgroundColor: CARD },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 + TAB_CONTENT_PAD },
})
