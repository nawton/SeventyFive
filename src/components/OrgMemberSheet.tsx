import { useEffect, useState } from 'react'
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { Ionicons } from '@/components/Icon'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { getOrgMemberStats, type OrgMember, type OrgMemberStats } from '@/services/organizations'
import { getStreakOf } from '@/services/dailyLog'
import { TEXT_PRIMARY, TEXT_SECONDARY, useThemeStrings } from '@/lib/theme'
import { useT, dateLocale } from '@/lib/i18n'

// =============================================================================
// MEDLEMSSTATISTIKEN — bottenark som öppnas när man trycker på en medlem
// i föreningen. Visar det medlemmen valt att dela: basnivån ger pass och
// streak, detaljerad även distans, volym och tyngsta lyft, full även
// mest tränade övningar. Egna siffror visas alltid fullt ut.
// =============================================================================

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', coach: 'Coach', member: 'Medlem' }

export function OrgMemberSheet({ orgId, member, isMe, onClose }: {
  orgId: string
  /** null = stängt */
  member: OrgMember | null
  isMe: boolean
  onClose: () => void
}) {
  const t = useT()
  const T = useThemeStrings()
  const [stats, setStats] = useState<OrgMemberStats | null>(null)
  const [streak, setStreak] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!member) return
    setStats(null)
    setStreak(null)
    setLoading(true)
    Promise.all([
      getOrgMemberStats(orgId, member.id).catch(() => null),
      getStreakOf(member.id).catch(() => null),
    ]).then(([st, sk]) => {
      setStats(st)
      setStreak(typeof sk === 'number' ? sk : null)
    }).finally(() => setLoading(false))
  }, [member, orgId])

  if (!member) return null

  const fmtVol = (kg: number) => kg >= 1000
    ? `${(kg / 1000).toFixed(1).replace('.', ',')} t`
    : `${Math.round(kg).toLocaleString(dateLocale())} kg`

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} testID="memberStatsBackdrop" />
        <View style={[s.sheet, { backgroundColor: T.BG }]} testID="memberStatsSheet">
          <View style={s.handle} />

          <View style={s.head}>
            <FeedAvatar url={member.avatar_url} fallback={(member.name ?? '?').charAt(0).toUpperCase()} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>
                {member.name ?? t('Namnlös')}{isMe ? ` (${t('du')})` : ''}
              </Text>
              <Text style={s.role}>{t(ROLE_LABELS[member.role])}</Text>
            </View>
            {streak != null && streak > 0 && (
              <View style={[s.streakPill, { backgroundColor: 'rgba(238,124,75,0.14)' }]}>
                <Ionicons name="flame" size={14} color="#EE7C4B" />
                <Text style={s.streakText}>{streak}</Text>
              </View>
            )}
          </View>

          {loading && <ActivityIndicator color={T.ACCENT} style={{ marginVertical: 40 }} />}

          {!loading && stats && (
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Passen delas alltid (basnivån) */}
              <View style={s.grid}>
                <View style={[s.cell, { backgroundColor: 'rgba(128,128,128,0.08)' }]}>
                  <Text style={[s.cellVal, { color: T.ACCENT }]}>{stats.passes_week}</Text>
                  <Text style={s.cellLbl}>{t('pass senaste veckan')}</Text>
                </View>
                <View style={[s.cell, { backgroundColor: 'rgba(128,128,128,0.08)' }]}>
                  <Text style={[s.cellVal, { color: T.ACCENT }]}>{stats.passes_month}</Text>
                  <Text style={s.cellLbl}>{t('pass senaste 4 veckorna')}</Text>
                </View>
                {stats.km_month != null && (
                  <View style={[s.cell, { backgroundColor: 'rgba(128,128,128,0.08)' }]}>
                    <Text style={[s.cellVal, { color: T.ACCENT }]}>
                      {stats.km_month.toFixed(1).replace('.', ',')} km
                    </Text>
                    <Text style={s.cellLbl}>{t('distans, 4 veckor')}</Text>
                  </View>
                )}
                {stats.volume_month != null && (
                  <View style={[s.cell, { backgroundColor: 'rgba(128,128,128,0.08)' }]}>
                    <Text style={[s.cellVal, { color: T.ACCENT }]}>{fmtVol(stats.volume_month)}</Text>
                    <Text style={s.cellLbl}>{t('volym, 4 veckor')}</Text>
                  </View>
                )}
              </View>

              {stats.top_lift && (
                <View style={s.liftRow}>
                  <View style={[s.liftIcon, { backgroundColor: 'rgba(238,124,75,0.14)' }]}>
                    <Ionicons name="trophy-outline" size={18} color="#EE7C4B" />
                  </View>
                  <Text style={s.liftText} numberOfLines={1}>
                    {t('Tyngsta lyft: {n} kg', { n: stats.top_lift.kg })} · {t(stats.top_lift.name)}
                  </Text>
                </View>
              )}

              {stats.top_exercises && stats.top_exercises.length > 0 && (
                <>
                  <Text style={s.sectionLbl}>{t('MEST TRÄNADE ÖVNINGAR, 4 VECKOR')}</Text>
                  {stats.top_exercises.map(ex => (
                    <View key={ex.name} style={s.exRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.exName} numberOfLines={1}>{t(ex.name)}</Text>
                        <Text style={s.exMeta}>
                          {t('{sets} set · topp {kg} kg', { sets: ex.sets, kg: ex.top_kg % 1 === 0 ? ex.top_kg : ex.top_kg.toFixed(1).replace('.', ',') })}
                        </Text>
                      </View>
                      <Text style={[s.exVol, { color: T.ACCENT }]}>{fmtVol(ex.volume)}</Text>
                    </View>
                  ))}
                </>
              )}

              {/* Ärligt om vad som inte delas */}
              {stats.km_month == null && !isMe && (
                <View style={s.noteInset}>
                  <Ionicons name="eye-off-outline" size={16} color={TEXT_SECONDARY} />
                  <Text style={s.noteText}>
                    {t('{name} delar bara basnivån med föreningen.', { name: member.name ?? t('Medlemmen') })}
                  </Text>
                </View>
              )}
              {stats.km_month != null && stats.top_exercises == null && !isMe && (
                <View style={s.noteInset}>
                  <Ionicons name="eye-off-outline" size={16} color={TEXT_SECONDARY} />
                  <Text style={s.noteText}>
                    {t('{name} delar inte progression per övning.', { name: member.name ?? t('Medlemmen') })}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}

          {!loading && !stats && (
            <Text style={s.noteText}>{t('Kunde inte hämta statistiken just nu.')}</Text>
          )}
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 34,
  },
  handle: {
    alignSelf: 'center', width: 44, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.45)', marginBottom: 14,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  name: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '800' },
  role: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 1 },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
  },
  streakText: { color: '#EE7C4B', fontSize: 14, fontWeight: '800' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48%', borderRadius: 14, padding: 13, gap: 2, flexGrow: 1 },
  cellVal: { fontSize: 20, fontWeight: '800' },
  cellLbl: { color: TEXT_SECONDARY, fontSize: 12 },

  liftRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  liftIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  liftText: { flex: 1, color: TEXT_PRIMARY, fontSize: 14.5, fontWeight: '700' },

  sectionLbl: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
    marginTop: 18, marginBottom: 4,
  },
  exRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.16)',
  },
  exName: { color: TEXT_PRIMARY, fontSize: 14.5, fontWeight: '600' },
  exMeta: { color: TEXT_SECONDARY, fontSize: 12.5, marginTop: 1 },
  exVol: { fontSize: 14.5, fontWeight: '800' },

  noteInset: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(128,128,128,0.09)', borderRadius: 12,
    padding: 12, marginTop: 14,
  },
  noteText: { flex: 1, color: TEXT_SECONDARY, fontSize: 13, lineHeight: 18 },
})
