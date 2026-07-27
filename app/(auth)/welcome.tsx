import { useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated'
import { NUM_FONT } from '@/lib/theme'

const { width } = Dimensions.get('window')

// =============================================================================
// ONBOARDING — fem sidor som välkomnar, förklarar utmaningen, schemat,
// statistiken och communityn. Mörk marinblå bas och varm orange accent.
// Navigering: Nästa-knapp, tillbaka på steg 2–5, Hoppa över, samt tryck
// på höger/vänster halva. Knapparna bor i en egen bottensektion och
// täcker aldrig innehållet.
// =============================================================================

const NAVY      = '#05080F'
const NAVY_TOP  = '#080D18'
const CARD_NAVY = '#0D1524'
const EDGE      = 'rgba(255,255,255,0.08)'
const OFFWHITE  = '#F4F5FA'
const MUTED     = 'rgba(244,245,250,0.62)'
const ORANGE      = '#FFA817'
const ORANGE_DEEP = '#FF7A1A'
const ORANGE_SOFT = 'rgba(255,168,23,0.14)'
const BLUE  = '#3FA7FF'
const GREEN = '#66BB6A'

const DAY_ITEM_W = 54

const SLIDES = ['valkommen', 'utmaningen', 'schemat', 'statistiken', 'community'] as const
type SlideKey = typeof SLIDES[number]

const COPY: Record<SlideKey, { title: string; body: string }> = {
  valkommen: {
    title: 'Välkommen till SeventyFive',
    body: 'Bygg disciplin, skapa bättre vanor och utvecklas en dag i taget under 75 dagar.',
  },
  utmaningen: {
    title: 'Vad är en 75 challenge?',
    body: 'Dagliga vanor under 75 dagar som bygger disciplin. Det handlar inte bara om träning, utan om struktur, fokus och personlig utveckling.',
  },
  schemat: {
    title: 'Planera ditt schema och dina pass',
    body: 'Skapa struktur i din vecka med träningspass och tydliga rutiner. Se ditt schema, följ dina pass och håll dig på rätt väg varje dag.',
  },
  statistiken: {
    title: 'Följ dina pass och se din utveckling',
    body: 'Logga träningen, följ din aktivitet och få tydlig statistik som håller motivationen uppe.',
  },
  community: {
    title: 'Utvecklas tillsammans med andra',
    body: 'Gå med i grupper, dela din resa och håll motivationen uppe tillsammans.',
  },
}

// ─── Sida 2: utmaningen — dagskortet med alla fem uppgifterna ────────────────

function ChallengeVisual() {
  return (
    <View style={v.mockCard}>
      <View style={v.mockHead}>
        <View>
          <Text style={v.mockLabel}>DAGENS UPPGIFTER</Text>
          <Text style={v.mockTitle}>Dag <Text style={v.mockNum}>12</Text> av 75</Text>
        </View>
        <View style={v.ringBadge}><Text style={v.ringBadgeText}>3/5</Text></View>
      </View>
      <View style={v.mockBar}><View style={[v.mockBarFill, { width: '60%' }]} /></View>
      {[
        'Träna 45 minuter', 'Håll din kost', 'Drick 3 liter vatten',
        'Läs 10 sidor', 'Ta ett framstegsfoto',
      ].map((t, i) => (
        <View key={t} style={v.mockRow}>
          <View style={[v.tick, i < 3 && v.tickOn]}>
            {i < 3 && <Ionicons name="checkmark" size={11} color="#0A1120" />}
          </View>
          <Text style={[v.mockRowText, i < 3 && v.mockRowDone]}>{t}</Text>
        </View>
      ))}
    </View>
  )
}

// ─── Sida 3: veckoschemat ────────────────────────────────────────────────────

const WEEK = [
  { day: 'Måndag',  pass: 'Överkropp',       color: ORANGE, icon: 'barbell-outline' },
  { day: 'Tisdag',  pass: 'Löpning 6 km',    color: BLUE,   icon: 'navigate-outline' },
  { day: 'Onsdag',  pass: 'Underkropp',      color: ORANGE, icon: 'barbell-outline', active: true },
  { day: 'Torsdag', pass: 'Promenad',        color: GREEN,  icon: 'walk-outline' },
  { day: 'Fredag',  pass: 'Push-pass',       color: ORANGE, icon: 'barbell-outline' },
  { day: 'Lördag',  pass: 'Cykling',         color: BLUE,   icon: 'bicycle-outline' },
  { day: 'Söndag',  pass: 'Vila och stretch', color: 'rgba(244,245,250,0.4)', icon: 'moon-outline' },
] as const

function ScheduleVisual() {
  return (
    <View style={v.mockCard}>
      <Text style={v.mockLabel}>DIN VECKA</Text>
      {WEEK.map(w => (
        <View key={w.day} style={[v.weekRow, 'active' in w && w.active && v.weekRowActive]}>
          <Text style={[v.weekDay, 'active' in w && w.active && { color: ORANGE }]}>{w.day}</Text>
          <View style={[v.weekIcon, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
            <Ionicons name={w.icon} size={13} color={w.color} />
          </View>
          <Text style={v.weekPass}>{w.pass}</Text>
          {'active' in w && w.active && <Text style={v.weekToday}>IDAG</Text>}
        </View>
      ))}
    </View>
  )
}

// ─── Sida 4: statistiken ─────────────────────────────────────────────────────

function StatsVisual() {
  const bars = [0.3, 0.52, 0.4, 0.66, 0.5, 0.8, 0.92]
  return (
    <View style={{ gap: 12 }}>
      <View style={v.mockCard}>
        <View style={v.mockHead}>
          <View>
            <Text style={v.mockLabel}>DIN AKTIVITET</Text>
            <Text style={v.mockTitle}>Dag <Text style={v.mockNum}>42</Text> av 75</Text>
          </View>
          <View style={v.streakBadge}>
            <Ionicons name="flame" size={13} color={ORANGE} />
            <Text style={v.streakText}>12 dagar i rad</Text>
          </View>
        </View>
        <View style={v.chartRow}>
          {bars.map((h, i) => (
            <View key={i} style={v.chartCol}>
              <View style={[v.chartBar, { height: 12 + h * 74 }, i === bars.length - 1 && { backgroundColor: ORANGE }]} />
            </View>
          ))}
        </View>
      </View>
      <View style={v.statRow}>
        {[
          { label: 'Veckans pass', value: '5' },
          { label: 'Streak', value: '12' },
          { label: 'Progress', value: '56 %' },
        ].map(c => (
          <View key={c.label} style={v.statCard}>
            <Text style={v.statValue}>{c.value}</Text>
            <Text style={v.statLabel}>{c.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ─── Sida 5: communityn ──────────────────────────────────────────────────────

const GROUPS = [
  { name: '75 Challenge Nybörjare', members: '128 medlemmar', color: ORANGE, letter: '75' },
  { name: 'Löpargruppen',           members: '64 medlemmar',  color: BLUE,   letter: 'L' },
] as const

/** Kompakt: ett enda kort så texten och knapparna alltid får plats under */
function CommunityVisual() {
  return (
    <View style={[v.mockCard, { gap: 11 }]}>
      <Text style={v.mockLabel}>GRUPPER</Text>
      {GROUPS.map(gr => (
        <View key={gr.name} style={v.groupRow}>
          <View style={[v.groupAvatar, { backgroundColor: gr.color + '22' }]}>
            <Text style={[v.groupLetter, { color: gr.color }]}>{gr.letter}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={v.groupName}>{gr.name}</Text>
            <Text style={v.groupMeta}>{gr.members}</Text>
          </View>
          <View style={v.joinPill}><Text style={v.joinPillText}>Gå med</Text></View>
        </View>
      ))}
      <View style={v.cardDivider} />
      <View style={v.groupRow}>
        <View style={[v.groupAvatar, { backgroundColor: ORANGE_SOFT }]}>
          <Text style={[v.groupLetter, { color: ORANGE }]}>E</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={v.groupName}>Elin Berg delade ett pass</Text>
          <Text style={v.groupMeta}>Löpning · 7,03 km · 5:12 /km</Text>
        </View>
        <Ionicons name="heart" size={16} color="#FF3B4A" />
      </View>
    </View>
  )
}

// ─── Skärmen ─────────────────────────────────────────────────────────────────

export default function Welcome() {
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(0)
  const dirRef = useRef<1 | -1>(1)
  const [dayModalVisible, setDayModalVisible] = useState(false)
  const [selectedDay, setSelectedDay] = useState(1)
  const dayScrollRef = useRef<ScrollView>(null)

  const slideKey = SLIDES[index]
  const isLast = index === SLIDES.length - 1

  function goTo(next: number, dir: 1 | -1) {
    if (next === index || next < 0 || next > SLIDES.length - 1) return
    dirRef.current = dir
    Haptics.selectionAsync()
    setIndex(next)
  }
  const go = (dir: 1 | -1) => goTo(index + dir, dir)

  function confirmDay() {
    setDayModalVisible(false)
    router.push({ pathname: '/(auth)/login', params: { startDay: String(selectedDay) } })
  }

  // Hjulet och siffran hålls i synk: knapparna och tryck scrollar hjulet dit
  function setDay(day: number, scroll = true) {
    const clamped = Math.min(74, Math.max(1, day))
    if (clamped !== selectedDay) {
      Haptics.selectionAsync()
      setSelectedDay(clamped)
    }
    if (scroll) dayScrollRef.current?.scrollTo({ x: (clamped - 1) * DAY_ITEM_W, animated: true })
  }

  return (
    <View style={s.screen}>
      {/* Mörk marinblå bas med mjuk gradient uppifrån */}
      <LinearGradient colors={[NAVY_TOP, NAVY]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      {/* Tryck på halvorna bläddrar, som ett komplement till knapparna */}
      <View style={s.tapRow}>
        <Pressable style={s.tapZone} onPress={() => go(-1)} testID="storyPrev" />
        <Pressable style={s.tapZone} onPress={() => go(1)} testID="storyNext" />
      </View>

      {/* Topprad: tillbaka på steg 2–5, Hoppa över fram till sista sidan */}
      <View style={[s.topBar, { marginTop: insets.top + 6 }]}>
        {index > 0 ? (
          <TouchableOpacity style={s.backBtn} onPress={() => go(-1)} activeOpacity={0.7} testID="welcomeBack">
            <Ionicons name="chevron-back" size={20} color={OFFWHITE} />
          </TouchableOpacity>
        ) : <View style={{ width: 38 }} />}
        {!isLast ? (
          <TouchableOpacity onPress={() => goTo(SLIDES.length - 1, 1)} activeOpacity={0.7} hitSlop={10} testID="welcomeSkip">
            <Text style={s.skipText}>Hoppa över</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 38 }} />}
      </View>

      {/* Innehållet: visual + rubrik + text. Släpper igenom tryck till halvorna */}
      <View style={s.content} pointerEvents="none">
        <Animated.View key={`v-${slideKey}`} entering={FadeInUp.duration(340)} style={s.visualArea}>
          {slideKey === 'valkommen' && (
            <View style={v.brandMark}>
              <Text style={v.brandMarkText}>75</Text>
            </View>
          )}
          {slideKey === 'utmaningen' && <ChallengeVisual />}
          {slideKey === 'schemat' && <ScheduleVisual />}
          {slideKey === 'statistiken' && <StatsVisual />}
          {slideKey === 'community' && <CommunityVisual />}
        </Animated.View>

        <Animated.View key={`t-${slideKey}`} entering={FadeInDown.duration(340)} style={s.textArea}>
          <Text style={s.title}>{COPY[slideKey].title}</Text>
          <Text style={s.body}>{COPY[slideKey].body}</Text>
          {slideKey === 'valkommen' && <Text style={s.tagline}>Din resa börjar här.</Text>}
        </Animated.View>
      </View>

      {/* Prickar + knappar i en egen bottensektion — täcker aldrig innehållet */}
      <View style={[s.bottom, { paddingBottom: 16 + insets.bottom }]}>
        <View style={s.dotsRow}>
          {SLIDES.map((k, i) => (
            <View key={k} style={[s.dot, i === index && s.dotActive]} />
          ))}
        </View>

        {isLast ? (
          <Animated.View entering={FadeIn.duration(300)} style={{ gap: 10 }}>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(auth)/login', params: { mode: 'register' } })}
              activeOpacity={0.85}
              testID="welcomeRegister"
            >
              <LinearGradient
                colors={[ORANGE, ORANGE_DEEP]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.primaryBtn}
              >
                <Text style={s.primaryText}>Registrera dig</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.outlineBtn}
              onPress={() => router.push('/(auth)/login')}
              activeOpacity={0.8}
              testID="welcomeLogin"
            >
              <Text style={s.outlineText}>Logga in</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.dayLink} onPress={() => setDayModalVisible(true)} activeOpacity={0.7}>
              <Ionicons name="calendar-outline" size={14} color={MUTED} />
              <Text style={s.dayLinkText}>Jag har redan börjat, välj dag</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <TouchableOpacity onPress={() => go(1)} activeOpacity={0.85} testID="welcomeContinue">
            <LinearGradient
              colors={[ORANGE, ORANGE_DEEP]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.primaryBtn}
            >
              <Text style={s.primaryText}>Nästa</Text>
              <Ionicons name="arrow-forward" size={17} color="#0A1120" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Dagväljaren för den som redan är mitt i utmaningen ── */}
      <Modal
        visible={dayModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDayModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.sheet, { paddingBottom: 24 + insets.bottom }]}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Vilken dag är du på?</Text>
            <Text style={s.sheetSub}>Dra i hjulet eller stega dig fram</Text>

            {/* Stora dagsiffran med finjustering */}
            <View style={s.dayReadout}>
              <TouchableOpacity style={s.stepBtn} onPress={() => setDay(selectedDay - 1)}
                activeOpacity={0.7} testID="dayMinus">
                <Ionicons name="remove" size={22} color={OFFWHITE} />
              </TouchableOpacity>
              <View style={s.dayCenter}>
                <Text style={s.dayWord}>DAG</Text>
                <Text style={s.dayBigNum}>{selectedDay}</Text>
                <Text style={s.dayOf}>av 75</Text>
              </View>
              <TouchableOpacity style={s.stepBtn} onPress={() => setDay(selectedDay + 1)}
                activeOpacity={0.7} testID="dayPlus">
                <Ionicons name="add" size={22} color={OFFWHITE} />
              </TouchableOpacity>
            </View>

            <View style={s.dayProgress}>
              <View style={[s.dayProgressFill, { width: `${(selectedDay / 75) * 100}%` }]} />
            </View>

            {/* Linjalhjulet: snappar per dag, mitten är vald */}
            <ScrollView
              ref={dayScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={DAY_ITEM_W}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: (width - 40 - DAY_ITEM_W) / 2 }}
              scrollEventThrottle={16}
              onScroll={e => {
                const i = Math.min(73, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / DAY_ITEM_W)))
                if (i + 1 !== selectedDay) setDay(i + 1, false)
              }}
              style={s.wheel}
            >
              {Array.from({ length: 74 }, (_, i) => i + 1).map(day => (
                <Pressable key={day} style={s.wheelItem} onPress={() => setDay(day)}>
                  <View style={[s.wheelCircle, selectedDay === day && s.wheelCircleActive]}>
                    <Text style={[s.wheelNum, selectedDay === day && s.wheelNumActive]}>{day}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            <View style={s.sheetFooter}>
              <TouchableOpacity onPress={confirmDay} activeOpacity={0.85}>
                <LinearGradient
                  colors={[ORANGE, ORANGE_DEEP]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.confirmBtn}
                >
                  <Text style={s.confirmBtnText}>Fortsätt från dag {selectedDay}</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setDayModalVisible(false)}>
                <Text style={s.cancelBtnText}>Avbryt</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// ─── Skärmens styles ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NAVY },

  tapRow:  { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  tapZone: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, height: 40,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  skipText: { color: MUTED, fontSize: 14, fontWeight: '600' },

  content: { flex: 1, paddingHorizontal: 26, justifyContent: 'center', gap: 18 },
  visualArea: { justifyContent: 'center' },
  textArea:   { gap: 8 },

  title: {
    color: OFFWHITE, fontSize: 25, fontWeight: '800',
    letterSpacing: -0.4, lineHeight: 31,
  },
  body:    { color: MUTED, fontSize: 14, lineHeight: 21 },
  tagline: { color: ORANGE, fontSize: 14, fontWeight: '700', marginTop: 2 },

  bottom: { paddingHorizontal: 26, paddingTop: 8, gap: 16 },
  dotsRow: { flexDirection: 'row', gap: 7, justifyContent: 'center' },
  dot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: 'rgba(244,245,250,0.22)',
  },
  dotActive: { width: 22, backgroundColor: ORANGE },

  primaryBtn: {
    borderRadius: 999, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28, shadowRadius: 14,
  },
  primaryText: { color: '#0A1120', fontSize: 16, fontWeight: '800' },
  outlineBtn: {
    borderRadius: 999, paddingVertical: 15, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(244,245,250,0.25)',
  },
  outlineText: { color: OFFWHITE, fontSize: 15, fontWeight: '700' },
  dayLink: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 999,
    paddingHorizontal: 15, paddingVertical: 9, marginTop: 2,
  },
  dayLinkText: { color: MUTED, fontSize: 13, fontWeight: '600' },

  // Dagväljaren
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#111A2C',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 20, paddingBottom: 36,
  },
  sheetHandle: {
    width: 40, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.45)', alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { color: OFFWHITE, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  sheetSub:   { color: MUTED, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 18 },

  // Dagväljaren: stor siffra + stegknappar + linjalhjul
  dayReadout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 26,
  },
  stepBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: EDGE,
    alignItems: 'center', justifyContent: 'center',
  },
  dayCenter: { alignItems: 'center' },
  dayWord: {
    color: MUTED, fontSize: 11, fontWeight: '800', letterSpacing: 2.5,
  },
  dayBigNum: {
    color: ORANGE, fontFamily: NUM_FONT, fontSize: 64, lineHeight: 70,
  },
  dayOf: { color: MUTED, fontSize: 13, fontWeight: '600', marginTop: -4 },

  dayProgress: {
    height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden', marginTop: 16, marginHorizontal: 6,
  },
  dayProgressFill: { height: '100%', borderRadius: 3, backgroundColor: ORANGE },

  wheel: { marginTop: 16, marginHorizontal: -20, flexGrow: 0 },
  wheelItem: { width: DAY_ITEM_W, alignItems: 'center', paddingVertical: 4 },
  wheelCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  wheelCircleActive: { backgroundColor: ORANGE_SOFT, borderWidth: 1.5, borderColor: ORANGE },
  wheelNum:       { color: 'rgba(244,245,250,0.4)', fontSize: 15, fontFamily: NUM_FONT },
  wheelNumActive: { color: ORANGE, fontSize: 17 },

  sheetFooter: { gap: 10, marginTop: 20 },
  confirmBtn: {
    borderRadius: 999, paddingVertical: 15, alignItems: 'center',
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 12,
  },
  confirmBtnText: { color: '#0A1120', fontSize: 15, fontWeight: '800' },
  cancelBtn: {
    borderRadius: 999, paddingVertical: 13, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(244,245,250,0.22)',
  },
  cancelBtnText: { color: MUTED, fontSize: 14, fontWeight: '600' },
})

// ─── Visuella delarnas styles ────────────────────────────────────────────────

const v = StyleSheet.create({
  // Sida 1: brandmarket — ren typografi tills riktiga foton läggs in
  brandMark: {
    width: 148, height: 148, borderRadius: 74, alignSelf: 'center',
    backgroundColor: ORANGE_SOFT, borderWidth: 1.5, borderColor: 'rgba(255,168,23,0.35)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  brandMarkText: { color: ORANGE, fontFamily: NUM_FONT, fontSize: 64 },

  // Mockkorten — stora rundade kort med mjuka kanter
  mockCard: {
    backgroundColor: CARD_NAVY, borderRadius: 26, padding: 18, gap: 10,
    borderWidth: 1, borderColor: EDGE,
  },
  mockHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mockLabel: { color: MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  mockTitle: { color: OFFWHITE, fontSize: 19, fontWeight: '800', marginTop: 2 },
  mockNum:   { color: ORANGE, fontFamily: NUM_FONT, fontSize: 19 },

  ringBadge: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2.5, borderColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
  },
  ringBadgeText: { color: OFFWHITE, fontFamily: NUM_FONT, fontSize: 13 },

  mockBar:     { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  mockBarFill: { flex: 1, borderRadius: 3, backgroundColor: ORANGE },

  mockRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tick: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(244,245,250,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  tickOn:      { backgroundColor: ORANGE, borderColor: ORANGE },
  mockRowText: { color: OFFWHITE, fontSize: 14, fontWeight: '600' },
  mockRowDone: { color: MUTED, textDecorationLine: 'line-through' },

  chipWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  habitChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  habitChipText: { color: OFFWHITE, fontSize: 12, fontWeight: '600' },

  // Sida 3: veckan
  weekRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 7, paddingHorizontal: 10, borderRadius: 14,
  },
  weekRowActive: { backgroundColor: ORANGE_SOFT },
  weekDay:  { color: MUTED, fontSize: 12, fontWeight: '700', width: 64 },
  weekIcon: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  weekPass:  { color: OFFWHITE, fontSize: 14, fontWeight: '600', flex: 1 },
  weekToday: { color: ORANGE, fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  // Sida 4: statistiken
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 92, marginTop: 4 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  chartBar: { width: '100%', borderRadius: 6, backgroundColor: 'rgba(63,167,255,0.35)' },

  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: ORANGE_SOFT, borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 6,
  },
  streakText: { color: ORANGE, fontSize: 12, fontWeight: '700' },

  statRow:  { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: CARD_NAVY, borderRadius: 20,
    borderWidth: 1, borderColor: EDGE,
    paddingVertical: 14, alignItems: 'center', gap: 2,
  },
  statValue: { color: OFFWHITE, fontFamily: NUM_FONT, fontSize: 20 },
  statLabel: { color: MUTED, fontSize: 11, fontWeight: '600' },

  // Sida 5: communityn
  groupRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  groupLetter: { fontSize: 14, fontWeight: '800' },
  groupName:   { color: OFFWHITE, fontSize: 14, fontWeight: '700' },
  groupMeta:   { color: MUTED, fontSize: 12, marginTop: 1 },
  cardDivider: { height: 1, backgroundColor: EDGE, marginVertical: 1 },
  joinPill: {
    backgroundColor: ORANGE_SOFT, borderRadius: 999,
    paddingHorizontal: 13, paddingVertical: 7,
  },
  joinPillText: { color: ORANGE, fontSize: 12, fontWeight: '700' },
})
