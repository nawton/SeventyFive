import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, useColorScheme } from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@/components/Icon'
import { GlassCircleButton } from '@/components/GlassButton'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { promptReport } from '@/lib/report'
import { blockUser, unblockUser, isBlockedByMe } from '@/services/blocks'
import { getFollowStatus, type FollowStatus } from '@/services/follows'
import {
  BG, CARD, RED, TEXT_PRIMARY, TEXT_SECONDARY, useCardChrome,
} from '@/lib/theme'
import { useT } from '@/lib/i18n'

// =============================================================================
// ALTERNATIV FÖR EN ANNAN PERSONS PROFIL — samma inställningsspråk som
// Allmänt: sektioner med rader i stället för en trång popup, så det är
// lätt att fylla på med fler alternativ framöver.
// =============================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const chrome = useCardChrome()
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={[s.sectionCard, chrome]}>{children}</View>
    </View>
  )
}

function SettingRow({ icon, label, onPress, danger, last }: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  onPress: () => void
  danger?: boolean
  last?: boolean
}) {
  const divider = useColorScheme() === 'light' ? 'rgba(0,0,0,0.05)' : '#2C2C2E'
  return (
    <TouchableOpacity
      style={[s.row, !last && [s.rowBorder, { borderBottomColor: divider }]]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={s.rowLeft}>
        <Ionicons name={icon} size={20} color={danger ? RED : TEXT_SECONDARY} />
        <Text style={[s.rowLabel, danger && { color: RED }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
    </TouchableOpacity>
  )
}

export default function AthleteOptionsScreen() {
  const t = useT()
  const params = useLocalSearchParams<{ userId?: string; name?: string; avatar?: string }>()
  const userId = typeof params.userId === 'string' && params.userId ? params.userId : null
  const name = typeof params.name === 'string' && params.name ? params.name : t('Profil')
  const avatar = typeof params.avatar === 'string' && params.avatar ? params.avatar : null

  const [blocked, setBlocked] = useState(false)
  const [followStatus, setFollowStatus] = useState<FollowStatus>('none')

  useFocusEffect(useCallback(() => {
    let alive = true
    if (!userId) return
    isBlockedByMe(userId).then(b => { if (alive) setBlocked(b) }).catch(() => {})
    getFollowStatus(userId).then(st => { if (alive) setFollowStatus(st) }).catch(() => {})
    return () => { alive = false }
  }, [userId]))

  function toggleBlock() {
    if (!userId) return
    if (blocked) {
      Haptics.selectionAsync()
      setBlocked(false)
      unblockUser(userId).catch(() => setBlocked(true))
      return
    }
    Alert.alert(
      t('Blockera {name}?', { name: name.split(' ')[0] }),
      t('Ni slutar följa varandra, kan inte skicka nya förfrågningar eller meddelanden och hittar inte varandra i sökningen. Personen meddelas inte.'),
      [
        { text: t('Avbryt'), style: 'cancel' },
        { text: t('Blockera'), style: 'destructive', onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
          setBlocked(true)
          blockUser(userId).catch(() => setBlocked(false))
        } },
      ],
    )
  }

  return (
    <SafeScreen style={s.screen}>
      <View style={s.header}>
        <GlassCircleButton icon="chevron-back" size={40} iconColor={TEXT_PRIMARY}
          onPress={() => router.back()} fallbackStyle={s.iconFallback} />
        <Text style={s.headerTitle} numberOfLines={1}>{t('Alternativ')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Vem sidan gäller — informationskänslan användaren bad om */}
        <View style={s.hero}>
          <FeedAvatar url={avatar} fallback={name.charAt(0).toUpperCase()} size={72} />
          <Text style={s.heroName} numberOfLines={1}>{name}</Text>
          {blocked && <Text style={s.heroBlocked}>{t('Blockerad')}</Text>}
        </View>

        <Section title={t('Kontakt')}>
          <SettingRow icon="chatbubble-outline" label={t('Skicka meddelande')} last={followStatus !== 'accepted' || blocked}
            onPress={() => userId && router.push({
              pathname: '/(app)/chat',
              params: { userId, name, avatar: avatar ?? '' },
            } as never)} />
          {followStatus === 'accepted' && !blocked && (
            <>
              <SettingRow icon="people-outline" label={t('Följare')}
                onPress={() => userId && router.push({
                  pathname: '/(app)/following',
                  params: { tab: 'followers', userId, name },
                } as never)} />
              <SettingRow icon="person-add-outline" label={t('Följer')} last
                onPress={() => userId && router.push({
                  pathname: '/(app)/following',
                  params: { tab: 'following', userId, name },
                } as never)} />
            </>
          )}
        </Section>

        <Section title={t('Säkerhet')}>
          <SettingRow icon="flag-outline" label={t('Anmäl användaren')}
            onPress={() => userId && promptReport('user', userId, t('Anmäl {name}', { name }))} />
          <SettingRow
            icon="ban-outline"
            label={blocked ? t('Avblockera') : t('Blockera användaren')}
            danger={!blocked}
            last
            onPress={toggleBlock}
          />
        </Section>
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
  iconFallback: { backgroundColor: CARD },
  headerTitle: { flex: 1, textAlign: 'center', color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  scroll: { paddingHorizontal: 20, paddingBottom: 60, gap: 22 },
  hero: { alignItems: 'center', gap: 8, paddingTop: 12 },
  heroName: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800' },
  heroBlocked: { color: RED, fontSize: 13, fontWeight: '600' },

  section: { gap: 8 },
  sectionTitle: {
    color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600',
    letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 4,
  },
  // Ingen overflow hidden — den äter upp chrome-skuggan i ljust läge
  sectionCard: { backgroundColor: CARD, borderRadius: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
  },
  rowBorder: { borderBottomWidth: 1 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { color: TEXT_PRIMARY, fontSize: 15 },
})
