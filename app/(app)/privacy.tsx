import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, Modal, Switch, FlatList, Alert,
} from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getProfile, updateProfile } from '@/services/profile'
import { getBlockedUsers, unblockUser } from '@/services/blocks'
import type { FollowProfile } from '@/services/follows'
import { FeedAvatar } from '@/components/FeedWorkoutCard'
import { GlassCircleButton } from '@/components/GlassButton'
import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, DIVIDER, ACCENT, useCardChrome, useThemeStrings } from '@/lib/theme'

// =============================================================================
// INTEGRITETSINSTÄLLNINGAR — Strava-mönstret: lista med nuvarande värde,
// undersida med radioval och förklaringar. Alla val är PÅ RIKTIGT:
// sökbarheten filtreras i search_profiles, profilvalet styr triggern som
// auto-godkänner följare (is_public), och aktivitetssynligheten
// upprätthålls av RLS-policyerna på pass/gillanden/kommentarer.
// Framstegsfoton är alltid privata oavsett val.
// =============================================================================

type SettingKey = 'search' | 'profile' | 'activities'

// Kartsynlighetens klippavstånd: snäppsteg om 200 m upp till 1,6 km
const TRIM_MAX = 1600
const TRIM_STEP = 200
const TRIM_LABELS = [0, 400, 800, 1200, 1600]

/** Snäppande slider med punkter på spåret, som förlagan — tick-etiketterna
 *  under går också att trycka på för att hoppa direkt till ett värde */
function TrimSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [trackW, setTrackW] = useState(0)
  const last = useRef(value)
  useEffect(() => { last.current = value }, [value])

  function commit(v: number) {
    if (v === last.current) return
    last.current = v
    Haptics.selectionAsync()
    onChange(v)
  }

  function setFromX(x: number) {
    if (trackW <= 0) return
    const raw = (x / trackW) * TRIM_MAX
    commit(Math.min(TRIM_MAX, Math.max(0, Math.round(raw / TRIM_STEP) * TRIM_STEP)))
  }

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(e => { runOnJS(setFromX)(e.x) })
    .onUpdate(e => { runOnJS(setFromX)(e.x) })

  const pct = value / TRIM_MAX
  const steps = Array.from({ length: TRIM_MAX / TRIM_STEP - 1 }, (_, i) => (i + 1) * TRIM_STEP)

  return (
    <View>
      <GestureDetector gesture={pan}>
        <View style={s.sliderHit} onLayout={e => setTrackW(e.nativeEvent.layout.width)}>
          <View style={s.sliderTrack}>
            <View style={[s.sliderFill, { width: `${pct * 100}%` as never }]} />
          </View>
          {trackW > 0 && steps.map(m => (
            <View
              key={m}
              style={[
                s.sliderDot,
                { left: (m / TRIM_MAX) * trackW - 2 },
                m <= value && s.sliderDotDone,
              ]}
            />
          ))}
          <View style={[s.sliderThumb, { left: Math.max(0, Math.min(trackW - 22, pct * trackW - 11)) }]} />
        </View>
      </GestureDetector>
      <View style={s.sliderLabels}>
        {TRIM_LABELS.map(m => (
          <Pressable key={m} onPress={() => commit(m)} hitSlop={10} testID={`trim-${m}`}>
            <Text style={[s.sliderLabel, value === m && s.sliderLabelActive]}>
              {m === 0 ? 'Av' : String(m)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

interface Option {
  value: string
  title: string
  description: string
}

const SETTINGS: Record<SettingKey, {
  label: string
  intro: string
  options: Option[]
}> = {
  search: {
    label: 'Sökning',
    intro: 'Välj om andra kan hitta dig via sökningen. Du kan alltid söka och skicka förfrågningar själv, oavsett val.',
    options: [
      {
        value: 'all',
        title: 'Alla',
        description: 'Alla i SeventyFive kan hitta dig via sökningen och skicka en vänförfrågan.',
      },
      {
        value: 'none',
        title: 'Ingen',
        description: 'Du går inte att hitta via sökningen. Befintliga följare påverkas inte.',
      },
    ],
  },
  profile: {
    label: 'Profil',
    intro: 'Välj om nya följare behöver ditt godkännande. Först när någon följer dig kan de se din statistik.',
    options: [
      {
        value: 'all',
        title: 'Alla',
        description: 'Nya följare godkänns automatiskt och ser din statistik direkt. Väntande förfrågningar godkänns när du väljer detta.',
      },
      {
        value: 'approval',
        title: 'Godkännande krävs',
        description: 'Du godkänner varje vänförfrågan i notiscentret innan personen kan följa dig och se din statistik.',
      },
    ],
  },
  activities: {
    label: 'Aktiviteter',
    intro: 'Välj vem som ser dina pass i flödet och din statistik. Framstegsfoton är alltid privata, oavsett vad du väljer här.',
    options: [
      {
        value: 'followers',
        title: 'Följare',
        description: 'Godkända följare ser dina pass i flödet, din statistik och kan gilla och kommentera.',
      },
      {
        value: 'private',
        title: 'Bara du',
        description: 'Dina pass och din statistik är helt privata, även för godkända följare. Ingen kan gilla eller kommentera dina pass.',
      },
    ],
  },
}

export default function PrivacyScreen() {
  const chrome = useCardChrome()
  // Radioringar som strängar — dynamiska ramfärger fryser i modaler
  const T = useThemeStrings()
  const radioEdge = T.TEXT_PRIMARY === '#FFFFFF' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.28)'
  const [userId, setUserId] = useState<string | null>(null)
  const [searchable, setSearchable] = useState(true)
  const [isPublic, setIsPublic] = useState(false)
  const [activityVisibility, setActivityVisibility] = useState<'followers' | 'private'>('followers')
  const [picker, setPicker] = useState<SettingKey | null>(null)
  // Ytterligare inställningar
  const [trimMeters, setTrimMeters] = useState(0)
  const [hideRouteMaps, setHideRouteMaps] = useState(false)
  const [mapsOpen, setMapsOpen] = useState(false)
  const [mapsView, setMapsView] = useState<'menu' | 'trim' | 'hide'>('menu')
  const [blockedOpen, setBlockedOpen] = useState(false)
  const [blocked, setBlocked] = useState<FollowProfile[]>([])

  function applyProfile(p: NonNullable<Awaited<ReturnType<typeof getProfile>>>) {
    setSearchable(p.searchable ?? true)
    setIsPublic(p.is_public ?? false)
    setActivityVisibility(p.activity_visibility ?? 'followers')
    setTrimMeters(p.trim_route_meters ?? 0)
    setHideRouteMaps(p.hide_route_maps ?? false)
  }

  useFocusEffect(useCallback(() => {
    let alive = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user || !alive) return
      setUserId(session.user.id)
      getProfile(session.user.id).then(p => {
        if (alive && p) applyProfile(p)
      }).catch(() => {})
      getBlockedUsers().then(list => { if (alive) setBlocked(list) }).catch(() => {})
    })
    return () => { alive = false }
  }, []))

  function handleUnblock(id: string) {
    Haptics.selectionAsync()
    setBlocked(prev => prev.filter(p => p.id !== id))
    unblockUser(id).catch(() => {
      getBlockedUsers().then(setBlocked).catch(() => {})
    })
  }

  // Misslyckad sparning får ALDRIG se lyckad ut på en integritetssida —
  // säg till och ställ tillbaka reglagen till databasens faktiska läge
  function save(updates: Parameters<typeof updateProfile>[1]) {
    if (!userId) return
    updateProfile(userId, updates).catch(() => {
      Alert.alert('Kunde inte spara', 'Ändringen sparades inte, kontrollera anslutningen och försök igen.')
      getProfile(userId).then(p => { if (p) applyProfile(p) }).catch(() => {})
    })
  }

  const currentValue: Record<SettingKey, string> = {
    search: searchable ? 'all' : 'none',
    profile: isPublic ? 'all' : 'approval',
    activities: activityVisibility,
  }

  const displayValue: Record<SettingKey, string> = {
    search: searchable ? 'Alla' : 'Ingen',
    profile: isPublic ? 'Alla' : 'Godkännande krävs',
    activities: activityVisibility === 'followers' ? 'Följare' : 'Bara du',
  }

  function select(key: SettingKey, value: string) {
    Haptics.selectionAsync()
    if (key === 'search') {
      const next = value === 'all'
      setSearchable(next)
      save({ searchable: next })
    } else if (key === 'profile') {
      const next = value === 'all'
      setIsPublic(next)
      save({ is_public: next })
    } else {
      const next = value as 'followers' | 'private'
      setActivityVisibility(next)
      save({ activity_visibility: next })
    }
  }

  const active = picker ? SETTINGS[picker] : null

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
        <Text style={s.title}>Integritet</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.sectionLabel}>VAR DU VISAS</Text>
        <View style={[s.rowsCard, chrome]}>
          {(Object.keys(SETTINGS) as SettingKey[]).map((key, i) => (
            <View key={key}>
              {i > 0 && <View style={s.rowDivider} />}
              <TouchableOpacity
                style={s.row}
                onPress={() => setPicker(key)}
                activeOpacity={0.7}
                testID={`privacy-${key}`}
              >
                <Text style={s.rowLabel}>{SETTINGS[key].label}</Text>
                <Text style={s.rowValue}>{displayValue[key]}</Text>
                <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Text style={s.footnote}>
          Framstegsfoton är alltid privata och delas aldrig med någon.
        </Text>

        <Text style={[s.sectionLabel, { marginTop: 26 }]}>YTTERLIGARE INSTÄLLNINGAR</Text>
        <View style={[s.rowsCard, chrome]}>
          <TouchableOpacity
            style={s.row}
            onPress={() => { setMapsView('menu'); setMapsOpen(true) }}
            activeOpacity={0.7}
            testID="privacy-maps"
          >
            <Text style={s.rowLabel}>Kartsynlighet</Text>
            <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
          </TouchableOpacity>
          <View style={s.rowDivider} />
          <TouchableOpacity
            style={s.row}
            onPress={() => setBlockedOpen(true)}
            activeOpacity={0.7}
            testID="privacy-blocked"
          >
            <Text style={s.rowLabel}>Blockerade konton</Text>
            {blocked.length > 0 && <Text style={s.rowValue}>{blocked.length}</Text>}
            <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Kartsynlighet, som förlagan: en meny med två val — klippavstånd
          för start/slut (slider) och dölj kartor helt. Undervyerna byter
          innehåll i samma modal; bakåtpilen går till menyn först. */}
      <Modal visible={mapsOpen} animationType="slide" onRequestClose={() => setMapsOpen(false)}>
        {/* Gester (sliderns pan) når inte in i en RN-modal utan egen rot */}
        <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeScreen style={s.screen}>
          <View style={s.header}>
            <GlassCircleButton
              icon="chevron-back"
              size={40}
              iconColor={TEXT_PRIMARY}
              onPress={() => (mapsView === 'menu' ? setMapsOpen(false) : setMapsView('menu'))}
              fallbackStyle={s.iconBtnFallback}
            />
            <Text style={s.title}>
              {mapsView === 'menu' ? 'Kartsynlighet'
                : mapsView === 'trim' ? 'Dölj start och slut'
                : 'Dölj alla kartor'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {mapsView === 'menu' && (
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
              <View style={[s.rowsCard, chrome]}>
                <TouchableOpacity
                  style={s.row}
                  onPress={() => setMapsView('trim')}
                  activeOpacity={0.7}
                  testID="maps-trim"
                >
                  <Ionicons name="location-outline" size={20} color={TEXT_SECONDARY} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.menuLabel}>Dölj start- och slutpunkter</Text>
                    <Text style={s.rowSub}>
                      {trimMeters === 0 ? 'Av' : `${trimMeters} m döljs i varje ände`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
                </TouchableOpacity>
                <View style={s.rowDivider} />
                <TouchableOpacity
                  style={s.row}
                  onPress={() => setMapsView('hide')}
                  activeOpacity={0.7}
                  testID="maps-hide"
                >
                  <Ionicons name="eye-off-outline" size={20} color={TEXT_SECONDARY} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.menuLabel}>Dölj dina kartor helt för andra</Text>
                    <Text style={s.rowSub}>{hideRouteMaps ? 'På' : 'Av'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {mapsView === 'trim' && (
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
              <Text style={s.intro}>
                Dölj starten och slutet på alla framtida rutter med ett
                ungefärligt avstånd. Punkterna klipps bort innan passet sparas
                och lagras aldrig.
              </Text>
              <Text style={s.trimValue}>
                {trimMeters === 0 ? 'Inga dolda meter' : `${trimMeters} dolda meter`}
              </Text>
              <TrimSlider
                value={trimMeters}
                onChange={v => {
                  setTrimMeters(v)
                  save({ trim_route_meters: v })
                }}
              />
              <Text style={s.footnote}>
                Tidigare pass påverkas inte, och distans och kalorier räknas
                fortfarande på hela rundan.
              </Text>
            </ScrollView>
          )}

          {mapsView === 'hide' && (
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
              <View style={s.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.optionTitle}>Dölj alla kartor</Text>
                  <Text style={s.optionBody}>
                    Dina rutter visas aldrig för följare, varken i flödet, på
                    din profil eller i passdetaljerna. Du ser dem alltid själv.
                  </Text>
                </View>
                <Switch
                  value={hideRouteMaps}
                  onValueChange={v => {
                    Haptics.selectionAsync()
                    setHideRouteMaps(v)
                    save({ hide_route_maps: v })
                  }}
                  trackColor={{ false: BORDER, true: ACCENT }}
                  thumbColor="#fff"
                  testID="hideMapsSwitch"
                />
              </View>
            </ScrollView>
          )}
        </SafeScreen>
        </GestureHandlerRootView>
      </Modal>

      {/* Blockerade konton — lista med avblockering */}
      <Modal visible={blockedOpen} animationType="slide" onRequestClose={() => setBlockedOpen(false)}>
        <SafeScreen style={s.screen}>
          <View style={s.header}>
            <GlassCircleButton
              icon="chevron-back"
              size={40}
              iconColor={TEXT_PRIMARY}
              onPress={() => setBlockedOpen(false)}
              fallbackStyle={s.iconBtnFallback}
            />
            <Text style={s.title}>Blockerade konton</Text>
            <View style={{ width: 40 }} />
          </View>
          <FlatList
            data={blocked}
            keyExtractor={p => p.id}
            renderItem={({ item }) => (
              <View style={s.blockedRow}>
                <FeedAvatar
                  url={item.avatar_url}
                  fallback={(item.name ?? '?').charAt(0).toUpperCase()}
                  size={46}
                />
                <Text style={s.blockedName} numberOfLines={1}>{item.name ?? 'Namnlös'}</Text>
                <TouchableOpacity
                  style={s.unblockPill}
                  onPress={() => handleUnblock(item.id)}
                  activeOpacity={0.8}
                  testID={`unblock-${item.id}`}
                >
                  <Text style={s.unblockText}>Avblockera</Text>
                </TouchableOpacity>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={s.rowDivider} />}
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="ban-outline" size={40} color={TEXT_SECONDARY} />
                <Text style={s.emptyTitle}>Inga blockerade konton</Text>
              </View>
            }
          />
        </SafeScreen>
      </Modal>

      {/* Undersidan: förklaring + radioval, som förlagan */}
      <Modal visible={picker !== null} animationType="slide" onRequestClose={() => setPicker(null)}>
        <SafeScreen style={s.screen}>
          <View style={s.header}>
            <GlassCircleButton
              icon="chevron-back"
              size={40}
              iconColor={TEXT_PRIMARY}
              onPress={() => setPicker(null)}
              fallbackStyle={s.iconBtnFallback}
            />
            <Text style={s.title}>{active?.label ?? ''}</Text>
            <View style={{ width: 40 }} />
          </View>

          {picker && active && (
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
              <Text style={s.intro}>{active.intro}</Text>
              {active.options.map(option => {
                const selected = currentValue[picker] === option.value
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={s.option}
                    onPress={() => select(picker, option.value)}
                    activeOpacity={0.7}
                    testID={`option-${option.value}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.optionTitle}>{option.title}</Text>
                      <Text style={s.optionBody}>{option.description}</Text>
                    </View>
                    <View style={[s.radio, { borderColor: selected ? T.ACCENT : radioEdge }]}>
                      {selected && <View style={[s.radioDot, { backgroundColor: T.ACCENT }]} />}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}
        </SafeScreen>
      </Modal>
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
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  sectionLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, paddingHorizontal: 4, marginBottom: 8,
  },
  rowsCard: {
    backgroundColor: CARD, borderRadius: 14,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 15,
  },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: DIVIDER, marginLeft: 16 },
  rowLabel: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  rowValue: { color: TEXT_SECONDARY, fontSize: 14 },
  footnote: {
    color: TEXT_SECONDARY, fontSize: 12, lineHeight: 18,
    paddingHorizontal: 4, marginTop: 14,
  },

  intro: { color: TEXT_PRIMARY, fontSize: 15, lineHeight: 22, marginBottom: 26 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 16,
  },
  optionTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  optionBody: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 20, marginTop: 5 },
  radio: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 13, height: 13, borderRadius: 7 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 16,
  },

  menuLabel: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  rowSub: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 3 },
  trimValue: {
    color: TEXT_PRIMARY, fontSize: 17, fontWeight: '800',
    textAlign: 'center', marginBottom: 14,
  },
  sliderHit: { height: 34, justifyContent: 'center' },
  sliderTrack: {
    height: 4, borderRadius: 2,
    backgroundColor: DIVIDER, overflow: 'hidden',
  },
  sliderFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 2 },
  sliderDot: {
    position: 'absolute', width: 4, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  sliderDotDone: { backgroundColor: ACCENT },
  sliderThumb: {
    position: 'absolute', width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: 4, elevation: 4,
  },
  sliderLabels: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 10,
  },
  sliderLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  sliderLabelActive: { color: TEXT_PRIMARY },
  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  blockedName: { flex: 1, color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  unblockPill: {
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7,
  },
  unblockText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 8, paddingTop: 70 },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700', marginTop: 4 },
})
