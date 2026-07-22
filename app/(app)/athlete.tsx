import { useCallback, useState } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/services/profile'
import { getCardioWorkouts, type CardioWorkout } from '@/services/cardioWorkouts'
import { getStrengthWorkouts, type StrengthWorkout } from '@/services/strengthWorkouts'
import {
  getFollowCounts, getFollowStatus, follow, unfollow, subscribeToFollows,
  type FollowCounts, type FollowStatus,
} from '@/services/follows'
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
  const [unit, setUnit] = useState<UnitSystem>('metric')
  // Vänförfrågningar: min status mot den visade profilen och profilens
  // räknare. Uppdateras optimistiskt vid tryck och live via realtime.
  const [followStatus, setFollowStatus] = useState<FollowStatus>('none')
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 })

  const statsUnlocked = isOwn || followStatus === 'accepted'

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
        const status = await getFollowStatus(otherId!).catch(() => 'none' as FollowStatus)
        if (!alive) return
        setFollowStatus(status)
        if (status !== 'accepted') return
        // Godkänd förfrågan — RLS släpper igenom personens pass
        const [all, strength] = await Promise.all([
          getCardioWorkouts(otherId!, 200).catch(() => [] as CardioWorkout[]),
          getStrengthWorkouts(otherId!, 500).catch(() => [] as StrengthWorkout[]),
        ])
        if (!alive) return
        setWorkouts(all)
        setGymCount(strengthToPosts(strength, '', null).length)
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
      setGymCount(strengthToPosts(strength, '', null).length)
    })
    return () => { alive = false; unsubscribe?.() }
  }, [otherId, paramName, paramAvatar]))

  function toggleFollow() {
    if (isOwn || !otherId) return   // man kan inte följa sig själv
    Haptics.selectionAsync()
    const prev = followStatus
    if (prev === 'none') {
      // Skicka vänförfrågan — räknarna rörs inte förrän den godkänts
      setFollowStatus('pending')
      follow(otherId).catch(() => setFollowStatus('none'))
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
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <GlassCircleButton
          icon="chevron-back"
          size={40}
          iconColor={TEXT_PRIMARY}
          onPress={() => router.back()}
          fallbackStyle={s.iconBtnFallback}
        />
        <View style={{ width: 40 }} />
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
          onToggleFollow={toggleFollow}
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
        />
      </ScrollView>
    </SafeAreaView>
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
