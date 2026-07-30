import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import { supabase } from '@/lib/supabase'
import { GlassCircleButton } from '@/components/GlassButton'
import { getActiveChallenge, calculateCurrentDay } from '@/services/challenge'
import { MILESTONES } from '@/components/stats/statsShared'
import { useT } from '@/lib/i18n'
import {
  BG, CARD, GREEN, TEXT_PRIMARY, TEXT_SECONDARY, useCardChrome, useHeroChrome,
} from '@/lib/theme'

// =============================================================================
// MILSTOLPSSIDAN — öppnas från milstolpekortet på översikten. Mörk
// hjältepanel med nästa milstolpe (beskrivning + progressbar) och listan
// med alla nio: uppnådda med grön bock, pågående med accentbricka,
// kommande låsta. Samma hjältepanelyta som översikten (useHeroChrome).
// =============================================================================

const HERO = {
  track: '#2B3352',
  arc: '#F2A25F',
  iconBg: '#262C4A',
  sub: '#9AA3BC',
}

export default function MilestonesScreen() {
  const t = useT()
  const chrome = useCardChrome()
  const H = useHeroChrome()
  const [currentDay, setCurrentDay] = useState(0)

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const challenge = await getActiveChallenge(session.user.id)
    if (!challenge) return
    setCurrentDay(calculateCurrentDay(challenge.start_date))
  }, [])

  useFocusEffect(useCallback(() => { load().catch(() => {}) }, [load]))

  // Pågående = första milstolpen som dagen inte passerat än
  const active = MILESTONES.find(m => currentDay <= m.day) ?? MILESTONES[MILESTONES.length - 1]
  const daysLeft = Math.max(0, active.day - currentDay)
  const progress = Math.min(1, Math.max(0.03, currentDay / active.day))

  return (
    <SafeScreen style={s.screen}>
      <View style={s.topBar}>
        <GlassCircleButton icon="chevron-back" size={40} iconColor={TEXT_PRIMARY}
          onPress={() => router.back()} fallbackStyle={{ backgroundColor: CARD }} />
        <Text style={s.topTitle}>{t('Milstolpar')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hjältepanelen: nästa milstolpe */}
        <View style={[s.hero, H.card]}>
          <View style={[s.heroIcon, { backgroundColor: H.iconBg }]}>
            <Ionicons name="flag-outline" size={30} color={HERO.arc} />
          </View>
          <Text style={s.heroTitle}>{t(active.label).replace(/!$/, '')}</Text>
          <Text style={[s.heroDesc, { color: H.sub }]}>{t(active.desc)}</Text>
          <View style={[s.heroTrack, { backgroundColor: H.track }]}>
            <View style={[s.heroFill, { width: `${Math.round(progress * 100)}%` as never }]} />
          </View>
          <View style={s.heroFoot}>
            <Text style={[s.heroFootText, { color: H.sub }]}>{t('Dag {n} av {m}', { n: currentDay, m: active.day })}</Text>
            <Text style={[s.heroFootText, { color: H.sub }]}>
              {daysLeft === 1 ? t('1 dag kvar') : t('{n} dagar kvar', { n: daysLeft })}
            </Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>{t('Alla milstolpar')}</Text>
        {MILESTONES.map(m => {
          const reached = currentDay > m.day
          const isActive = m.day === active.day && !reached
          return (
            <View
              key={m.day}
              style={[s.row, chrome, !reached && !isActive && s.rowLocked]}
              testID={`milestone-${m.day}`}
            >
              <View style={[
                s.badge,
                reached && { backgroundColor: 'rgba(46,158,87,0.14)' },
                isActive && { backgroundColor: 'rgba(242,162,95,0.18)' },
              ]}>
                {reached
                  ? <Ionicons name="checkmark" size={18} color={GREEN} />
                  : <Text style={[s.badgeNum, isActive && { color: HERO.arc }]}>{m.day}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, !reached && !isActive && { color: TEXT_SECONDARY }]} numberOfLines={1}>
                  {t(m.label).replace(/!$/, '')}
                </Text>
                <Text style={s.rowSub} numberOfLines={1}>
                  {reached
                    ? t('Uppnådd')
                    : isActive
                      ? t('Pågår · dag {n} av {m}', { n: currentDay, m: m.day })
                      : t(m.short)}
                </Text>
              </View>
              {!reached && !isActive && (
                <Ionicons name="lock-closed-outline" size={17} color={TEXT_SECONDARY} />
              )}
            </View>
          )
        })}
      </ScrollView>
    </SafeScreen>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  topTitle: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800' },
  scroll: { paddingHorizontal: 16, paddingBottom: 60, paddingTop: 6 },

  hero: {
    alignItems: 'center', borderRadius: 24,
    paddingVertical: 24, paddingHorizontal: 22, marginBottom: 20,
  },
  heroIcon: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: HERO.iconBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  heroDesc: {
    color: HERO.sub, fontSize: 14, lineHeight: 20, textAlign: 'center',
    marginTop: 8, marginBottom: 18,
  },
  heroTrack: {
    alignSelf: 'stretch', height: 8, borderRadius: 4,
    backgroundColor: HERO.track, overflow: 'hidden',
  },
  heroFill: { height: 8, borderRadius: 4, backgroundColor: HERO.arc },
  heroFoot: {
    alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 10,
  },
  heroFootText: { color: HERO.sub, fontSize: 13, fontWeight: '600' },

  sectionTitle: { color: TEXT_PRIMARY, fontSize: 19, fontWeight: '800', marginBottom: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: CARD, borderRadius: 18, padding: 14, marginBottom: 10,
  },
  rowLocked: { opacity: 0.6 },
  badge: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(128,128,128,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  badgeNum: { color: TEXT_SECONDARY, fontSize: 15, fontWeight: '800' },
  rowTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  rowSub: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
})
