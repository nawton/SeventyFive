import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import { GlassCircleButton } from '@/components/GlassButton'
import { GlassSegment } from '@/components/GlassSegment'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { getOrgMemberStats, type OrgMemberStats } from '@/services/organizations'
import { getStreakOf } from '@/services/dailyLog'
import { isoWeekNum, parseLocalDate, toLocalDateString } from '@/lib/date'
import { BG, CARD, GREEN, TEXT_PRIMARY, TEXT_SECONDARY, useThemeStrings, useCardChrome } from '@/lib/theme'
import { useT, dateLocale } from '@/lib/i18n'

// =============================================================================
// MEDLEMSSIDAN I FÖRENINGEN — coachens uppföljningsvy. Coacher kan
// förhandsvisa hur sidan ser ut för vanliga medlemmar (integritetskollen).
// Progressionen visar bara övningar ur föreningens tränarpass: coachen
// följer det coachen skickat ut. Vad som syns styrs av medlemmens
// delningsnivå och synlighetsval, filtrerat i databasen.
// =============================================================================

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', coach: 'Coach', member: 'Medlem' }
const LEVEL_LABELS: Record<string, string> = { base: 'Bas', detailed: 'Detaljerad', full: 'Full' }
const GYM = '#EE7C4B'

export default function OrgMemberScreen() {
  const t = useT()
  const T = useThemeStrings()
  const chrome = useCardChrome()
  const params = useLocalSearchParams<{
    orgId?: string; memberId?: string; name?: string; avatar?: string; role?: string; staff?: string
  }>()
  const orgId = params.orgId ?? ''
  const memberId = params.memberId ?? ''
  const viewerIsStaff = params.staff === '1'

  const [stats, setStats] = useState<OrgMemberStats | null>(null)
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<'coach' | 'member'>('coach')

  useFocusEffect(useCallback(() => {
    if (!orgId || !memberId) return
    setLoading(true)
    Promise.all([
      getOrgMemberStats(orgId, memberId).catch(() => null),
      getStreakOf(memberId).catch(() => 0),
    ]).then(([st, sk]) => {
      setStats(st)
      setStreak(typeof sk === 'number' ? sk : 0)
    }).finally(() => setLoading(false))
  }, [orgId, memberId]))

  const fmtVol = (kg: number) => kg >= 1000
    ? `${(kg / 1000).toFixed(1).replace('.', ',')} t`
    : `${Math.round(kg).toLocaleString(dateLocale())} kg`

  const todayIso = toLocalDateString(new Date())
  const activeLabel = stats?.last_active == null
    ? t('inte aktiv än')
    : stats.last_active === todayIso
      ? t('aktiv idag')
      : t('senast aktiv {d}', {
          d: parseLocalDate(stats.last_active).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }).replace('.', ''),
        })

  // Medlemsförhandsvisningen döljer detaljerna oavsett vad RPC:n gav
  const showLocked = stats != null && (stats.staff_only || (viewerIsStaff && preview === 'member'))
  const showDetails = stats != null && !showLocked && stats.km_week != null
  const weekNo = isoWeekNum(new Date())

  return (
    <SafeScreen style={s.screen}>
      <View style={s.topBar}>
        <GlassCircleButton icon="chevron-back" size={40} iconColor={TEXT_PRIMARY}
          onPress={() => router.back()} fallbackStyle={{ backgroundColor: CARD }} />
        <FeedAvatar url={params.avatar || null} fallback={(params.name ?? '?').charAt(0).toUpperCase()} size={42} />
        <View style={{ flex: 1 }}>
          <Text maxFontSizeMultiplier={1.15} style={s.topTitle} numberOfLines={1}>{params.name ?? t('Medlem')}</Text>
          <Text style={s.topSub} numberOfLines={1}>
            {t(ROLE_LABELS[params.role ?? 'member'])} · {activeLabel}
          </Text>
        </View>
      </View>

      {/* Coacher kan förhandsvisa medlemsvyn — integritetskollen */}
      {viewerIsStaff && (
        <View style={s.previewRow}>
          <Text style={s.previewLabel}>{t('Förhandsvisa som:')}</Text>
          <View style={{ flex: 1 }}>
            <GlassSegment
              value={preview}
              options={[{ key: 'coach', label: t('Coach') }, { key: 'member', label: t('Medlem') }]}
              onChange={setPreview}
            />
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator color={T.ACCENT} style={{ marginTop: 60 }} />}

        {!loading && stats && (
          <>
            {viewerIsStaff && preview === 'coach' && (
              <View style={[s.shareNote, { backgroundColor: 'rgba(46,158,87,0.10)' }]}>
                <Ionicons name="eye-outline" size={17} color={GREEN} />
                <Text style={s.shareNoteText}>
                  {t('{name} delar {level} med coacherna, du ser det som coach.', {
                    name: (params.name ?? '').split(' ')[0] || t('Medlemmen'),
                    level: t(LEVEL_LABELS[stats.share_level]),
                  })}
                </Text>
              </View>
            )}

            {/* Nyckeltalsraden: pass v.X, km (om delat) och streak */}
            <View style={[s.statCard, chrome]}>
              <View style={s.statCell}>
                <Text style={s.statVal}>{stats.passes_week}</Text>
                <Text style={s.statLbl}>{t('Pass v.{n}', { n: weekNo })}</Text>
              </View>
              {showDetails && (
                <>
                  <View style={s.statDivider} />
                  <View style={s.statCell}>
                    <Text style={[s.statVal, { color: T.ACCENT }]}>
                      {(stats.km_week ?? 0).toFixed(1).replace('.', ',')}
                    </Text>
                    <Text style={s.statLbl}>km</Text>
                  </View>
                </>
              )}
              <View style={s.statDivider} />
              <View style={s.statCell}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="flame" size={15} color={GYM} />
                  <Text style={s.statVal}>{streak}</Text>
                </View>
                <Text style={s.statLbl}>{t('Streak')}</Text>
              </View>
            </View>

            {/* Låst läge: medlemsvyn eller på riktigt coachlåst */}
            {showLocked && (
              <View style={[s.lockCard, chrome]}>
                <View style={s.lockIcon}>
                  <Ionicons name="lock-closed-outline" size={26} color={TEXT_SECONDARY} />
                </View>
                <Text maxFontSizeMultiplier={1.15} style={s.lockTitle}>
                  {t('{name} delar detaljerna bara med coacherna', {
                    name: (params.name ?? '').split(' ')[0] || t('Medlemmen'),
                  })}
                </Text>
                <Text style={s.lockBody}>
                  {t('Pass och streak syns för alla i föreningen.')}
                  {'\n'}
                  {t('Detaljer visas om {name} väljer hela föreningen.', {
                    name: (params.name ?? '').split(' ')[0] || t('medlemmen'),
                  })}
                </Text>
              </View>
            )}

            {/* Senaste gympasset */}
            {!showLocked && showDetails && stats.last_gym && (
              <View style={[s.card, chrome]}>
                <Text maxFontSizeMultiplier={1.15} style={s.cardTitle}>{t('Senaste pass')}</Text>
                <View style={s.gymRow}>
                  <View style={[s.gymIcon, { backgroundColor: `${GYM}1C` }]}>
                    <Ionicons name="barbell-outline" size={20} color={GYM} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.gymName} numberOfLines={1}>{stats.last_gym.title ?? t('Gympass')}</Text>
                    <Text style={s.gymMeta}>
                      {parseLocalDate(stats.last_gym.date).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.gymVol, { color: GYM }]}>{fmtVol(stats.last_gym.volume)}</Text>
                    <Text style={s.gymMeta}>
                      {t('{a} övn · {b} set', { a: stats.last_gym.exercises, b: stats.last_gym.sets })}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Progression på tränarpassens övningar */}
            {!showLocked && stats.coach_progress != null && (
              <View style={[s.card, chrome]}>
                <Text maxFontSizeMultiplier={1.15} style={s.cardTitle}>{t('Progression per övning')}</Text>
                {stats.coach_progress.length === 0 ? (
                  <Text style={s.emptyText}>
                    {t('Fylls på när {name} kör övningarna ur tränarpassen.', {
                      name: (params.name ?? '').split(' ')[0] || t('medlemmen'),
                    })}
                  </Text>
                ) : stats.coach_progress.map((ex, i) => (
                  <View key={ex.name} style={[s.progRow, i > 0 && s.progRowBorder]}>
                    <Text style={s.progName} numberOfLines={1}>{t(ex.name)}</Text>
                    <Text style={s.progKg}>
                      {ex.kg % 1 === 0 ? ex.kg : ex.kg.toFixed(1).replace('.', ',')} kg
                    </Text>
                    <Text style={[s.progDelta, ex.delta > 0 ? { color: GREEN } : { color: TEXT_SECONDARY }]}>
                      {ex.delta > 0
                        ? `+${ex.delta % 1 === 0 ? ex.delta : ex.delta.toFixed(1).replace('.', ',')} kg`
                        : ex.delta < 0
                          ? `${ex.delta % 1 === 0 ? ex.delta : ex.delta.toFixed(1).replace('.', ',')} kg`
                          : '±0'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {!loading && !stats && (
          <Text style={s.emptyText}>{t('Kunde inte hämta statistiken just nu.')}</Text>
        )}
      </ScrollView>
    </SafeScreen>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  topTitle: { color: TEXT_PRIMARY, fontSize: 19, fontWeight: '800' },
  topSub: { color: TEXT_SECONDARY, fontSize: 12.5, marginTop: 1 },
  previewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 8,
  },
  previewLabel: { color: TEXT_SECONDARY, fontSize: 13.5 },
  scroll: { paddingHorizontal: 16, paddingBottom: 60, paddingTop: 6, gap: 14 },

  shareNote: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    borderRadius: 14, padding: 13,
  },
  shareNoteText: { flex: 1, color: TEXT_PRIMARY, fontSize: 13, lineHeight: 18 },

  statCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 18, paddingVertical: 16,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(128,128,128,0.25)' },
  statVal: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800' },
  statLbl: { color: TEXT_SECONDARY, fontSize: 12.5 },

  card: { backgroundColor: CARD, borderRadius: 20, padding: 16 },
  cardTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '800', marginBottom: 12 },

  lockCard: {
    backgroundColor: CARD, borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 10,
  },
  lockIcon: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: 'rgba(128,128,128,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  lockTitle: { color: TEXT_PRIMARY, fontSize: 15.5, fontWeight: '800', textAlign: 'center' },
  lockBody: { color: TEXT_SECONDARY, fontSize: 13.5, lineHeight: 20, textAlign: 'center' },

  gymRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gymIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  gymName: { color: TEXT_PRIMARY, fontSize: 15.5, fontWeight: '800' },
  gymMeta: { color: TEXT_SECONDARY, fontSize: 12.5, marginTop: 2 },
  gymVol: { fontSize: 15.5, fontWeight: '800' },

  progRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  progRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.18)' },
  progName: { flex: 1, color: TEXT_PRIMARY, fontSize: 14.5, fontWeight: '600' },
  progKg: { color: TEXT_PRIMARY, fontSize: 14.5, fontWeight: '800' },
  progDelta: { minWidth: 52, textAlign: 'right', fontSize: 13.5, fontWeight: '700' },

  emptyText: { color: TEXT_SECONDARY, fontSize: 13.5, lineHeight: 19 },
})
