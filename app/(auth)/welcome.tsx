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
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated'
import { ACCENT, NUM_FONT, accentAlpha } from '@/lib/theme'

const { width } = Dimensions.get('window')
const CARD_W = width - 52

// =============================================================================
// VÄLKOMST — story i fem slides, Runna-stil: mörk botten, stor rubrik
// överst, en återskapad mini-UI av appen i mitten och Skapa konto/Logga in
// alltid synliga längst ner. Höger halva = nästa slide, vänster = föregående.
// =============================================================================

const BG_DARK = '#0B0B0D'
const MOCK_CARD = '#17171B'
const MOCK_BORDER = 'rgba(255,255,255,0.08)'
const MOCK_TEXT = '#F2F2F5'
const MOCK_DIM = 'rgba(255,255,255,0.45)'

const SLIDES = ['brand', 'tasks', 'training', 'progress', 'community'] as const
type SlideKey = typeof SLIDES[number]

const TITLES: Record<SlideKey, string> = {
  brand:     '75 dagar som\nförändrar allt.',
  tasks:     'Fem uppgifter,\nvarje dag.',
  training:  'En träningsplan\nbyggd för dig.',
  progress:  'Se dina framsteg\nsvart på vitt.',
  community: 'Allt är roligare\ntillsammans.',
}

// ─── Mini-UI: uppgiftskortet (slide 1 + 2) ───────────────────────────────────

const MOCK_TASKS = [
  { icon: 'barbell-outline',    color: '#FFA817', label: 'Träna 45 min',         done: true },
  { icon: 'restaurant-outline', color: '#66BB6A', label: 'Håll din kost',        done: true },
  { icon: 'water-outline',      color: '#00BCD4', label: 'Drick 3 liter vatten', done: true },
  { icon: 'book-outline',       color: '#AB47BC', label: 'Läs 10 sidor',         done: false },
  { icon: 'camera-outline',     color: '#EC407A', label: 'Ta ett framstegsfoto', done: false },
] as const

function TaskMock({ compact }: { compact?: boolean }) {
  const tasks = compact ? MOCK_TASKS.slice(0, 3) : MOCK_TASKS
  return (
    <View style={[m.card, m.cardGlow]}>
      <View style={m.headRow}>
        <View>
          <Text style={m.dim}>Dagens uppgifter</Text>
          <Text style={m.big}>Dag <Text style={m.num}>42</Text><Text style={m.dim}> av 75</Text></Text>
        </View>
        <View style={m.streakChip}>
          <Ionicons name="flame" size={13} color={ACCENT} />
          <Text style={m.streakText}>12 i rad</Text>
        </View>
      </View>
      <View style={m.barTrack}><View style={[m.barFill, { width: '56%' }]} /></View>
      {tasks.map(t => (
        <View key={t.label} style={m.taskRow}>
          <View style={[m.taskIcon, { backgroundColor: t.color + '22' }]}>
            <Ionicons name={t.icon} size={15} color={t.color} />
          </View>
          <Text style={[m.taskLabel, t.done && m.taskLabelDone]}>{t.label}</Text>
          {t.done
            ? <View style={m.checkOn}><Ionicons name="checkmark" size={12} color="#000" /></View>
            : <View style={m.checkOff} />}
        </View>
      ))}
    </View>
  )
}

// ─── Mini-UI: veckoschemat (slide 3) ─────────────────────────────────────────

const MOCK_WEEK = [
  { day: 'MÅN', color: '#AB47BC', name: 'Långpass',        meta: '8 km',            done: true },
  { day: 'TIS', color: '#66BB6A', name: 'Lugnt pass',      meta: '6 km',            done: false },
  { day: 'ONS', color: '#FFA817', name: 'Intervaller',     meta: '6×400 m',         done: false },
  { day: 'TOR', color: '#FF3B4A', name: 'Bröst & Triceps', meta: '8 övningar',      done: false },
  { day: 'FRE', color: '#3FA7FF', name: 'Backpass',        meta: '8 km',            done: false },
] as const

function WeekMock() {
  return (
    <View>
      <View style={[m.card, m.cardGlow]}>
        <Text style={m.dim}>17–23 aug</Text>
        <Text style={m.big}>Vecka 3</Text>
        <View style={m.segRow}>
          {[1, 0.2, 0.2, 0.2, 0.2].map((o, i) => (
            <View key={i} style={[m.seg, { opacity: o }]} />
          ))}
        </View>
        <View style={m.summaryRow}>
          <View style={m.summaryItem}>
            <Ionicons name="barbell-outline" size={13} color={ACCENT} />
            <Text style={m.dimSmall}>Pass: <Text style={m.numSmall}>1/5</Text></Text>
          </View>
          <View style={m.summaryItem}>
            <Ionicons name="footsteps-outline" size={13} color={ACCENT} />
            <Text style={m.dimSmall}>Distans: <Text style={m.numSmall}>8/42 km</Text></Text>
          </View>
        </View>
        {MOCK_WEEK.map(w => (
          <View key={w.day} style={m.taskRow}>
            <Text style={m.weekDay}>{w.day}</Text>
            <View style={[m.weekDot, { backgroundColor: w.color }]} />
            <Text style={m.taskLabel} numberOfLines={1}>
              {w.name}<Text style={m.dimSmall}>  ·  {w.meta}</Text>
            </Text>
            {w.done && <View style={m.checkOn}><Ionicons name="checkmark" size={12} color="#000" /></View>}
          </View>
        ))}
      </View>
      {/* Nästa vecka skymtar under, som i förlagan */}
      <View style={m.peekCard}>
        <Text style={m.dim}>24–30 aug</Text>
        <Text style={[m.big, { opacity: 0.5 }]}>Vecka 4</Text>
      </View>
    </View>
  )
}

// ─── Mini-UI: framsteg (slide 4) ─────────────────────────────────────────────

function ProgressMock() {
  const bars = [0.35, 0.55, 0.42, 0.7, 0.58, 0.9]
  return (
    <View>
      <View style={[m.card, m.cardGlow]}>
        <View style={m.headRow}>
          <View>
            <Text style={m.dim}>Formkurva</Text>
            <Text style={m.big}>Vecka för vecka</Text>
          </View>
          <View style={m.levelChip}>
            <Ionicons name="trophy" size={12} color="#CFE4F5" />
            <Text style={m.levelText}>Platina</Text>
          </View>
        </View>
        <View style={m.chartRow}>
          {bars.map((h, i) => (
            <View key={i} style={m.chartCol}>
              <View style={[m.chartBar, { height: 12 + h * 64 }, i === bars.length - 1 && { backgroundColor: ACCENT }]} />
            </View>
          ))}
        </View>
      </View>
      <View style={[m.card, m.floatCard]}>
        <View style={m.headRow}>
          <Text style={m.taskLabel}>Medaljer</Text>
          <Text style={m.dimSmall}><Text style={m.numSmall}>18</Text> av 26</Text>
        </View>
        <View style={m.medalRow}>
          {(['#FFD54F', '#B0BEC5', '#FF8A65'] as const).map((c, i) => (
            <View key={i} style={[m.medal, { backgroundColor: c + '26', borderColor: c }]}>
              <Ionicons name="medal" size={15} color={c} />
            </View>
          ))}
          <Text style={[m.dimSmall, { marginLeft: 4 }]}>+15 till</Text>
        </View>
      </View>
    </View>
  )
}

// ─── Mini-UI: flödet (slide 5) ───────────────────────────────────────────────

function FeedMock() {
  return (
    <View>
      <View style={[m.card, m.cardGlow]}>
        <View style={m.headRow}>
          <View style={m.feedHead}>
            <View style={m.avatar}><Text style={m.avatarText}>E</Text></View>
            <View>
              <Text style={m.taskLabel}>Elin Berg</Text>
              <Text style={m.dimSmall}>Team Sthlm · för 2 h sedan</Text>
            </View>
          </View>
        </View>
        <Text style={[m.taskLabel, { marginTop: 2 }]}>Tisdagsintervaller avklarade</Text>
        <View style={m.summaryRow}>
          <Text style={m.dimSmall}>Löpning · <Text style={m.numSmall}>7,03 km</Text> · <Text style={m.numSmall}>5:12</Text> /km</Text>
        </View>
        <View style={m.routeStrip}>
          {[14, 30, 20, 40, 26, 44, 18, 34, 24].map((h, i) => (
            <View key={i} style={[m.routePt, { height: h }]} />
          ))}
        </View>
        <View style={m.socialRow}>
          <Ionicons name="heart" size={16} color="#FF3B4A" />
          <Text style={m.dimSmall}>12</Text>
          <Ionicons name="chatbubble-outline" size={14} color={MOCK_DIM} style={{ marginLeft: 10 }} />
          <Text style={m.dimSmall}>3</Text>
        </View>
      </View>
      <View style={[m.card, m.floatCard]}>
        <View style={m.headRow}>
          <View style={m.feedHead}>
            <View style={[m.avatar, { backgroundColor: '#66BB6A26' }]}>
              <Ionicons name="people" size={14} color="#66BB6A" />
            </View>
            <View>
              <Text style={m.taskLabel}>Team Sthlm</Text>
              <Text style={m.dimSmall}>8 medlemmar · 3 kör just nu</Text>
            </View>
          </View>
        </View>
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
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const slideKey = SLIDES[index]

  function go(dir: 1 | -1) {
    const next = Math.min(SLIDES.length - 1, Math.max(0, index + dir))
    if (next === index) return
    dirRef.current = dir
    Haptics.selectionAsync()
    setIndex(next)
  }

  function confirmDay() {
    if (!selectedDay) return
    setDayModalVisible(false)
    router.push({ pathname: '/(auth)/login', params: { startDay: String(selectedDay) } })
  }

  return (
    <View style={s.screen}>
      {/* Fingertoppsnavigering som stories: hela ytan är tryckbar */}
      <View style={s.tapRow}>
        <Pressable style={s.tapZone} onPress={() => go(-1)} testID="storyPrev" />
        <Pressable style={s.tapZone} onPress={() => go(1)} testID="storyNext" />
      </View>

      {/* Story-progress */}
      <View style={[s.progressRow, { paddingTop: insets.top + 10 }]} pointerEvents="none">
        {SLIDES.map((k, i) => (
          <View key={k} style={s.progressTrack}>
            {i <= index && <View style={s.progressFill} />}
          </View>
        ))}
      </View>

      {/* Rubrik överst + mini-UI i mitten, som förlagan */}
      <View style={s.content} pointerEvents="none">
        <Animated.View
          key={slideKey}
          entering={(dirRef.current === 1 ? FadeInRight : FadeInLeft).duration(280)}
          style={s.slide}
        >
          <View style={s.brandRow}>
            <Text style={s.brandName}>SeventyFive</Text>
            <Text style={s.brandBy}>by Nawton</Text>
          </View>
          <Text style={s.title}>{TITLES[slideKey]}</Text>

          <View style={s.showcase}>
            {slideKey === 'brand' && <TaskMock compact />}
            {slideKey === 'tasks' && <TaskMock />}
            {slideKey === 'training' && <WeekMock />}
            {slideKey === 'progress' && <ProgressMock />}
            {slideKey === 'community' && <FeedMock />}
          </View>
        </Animated.View>
      </View>

      {/* Vägarna in — alltid synliga, ovanpå tryckzonerna */}
      <View style={[s.ctas, { bottom: 18 + insets.bottom }]}>
        <TouchableOpacity
          style={s.primaryBtn}
          onPress={() => router.push({ pathname: '/(auth)/login', params: { mode: 'register' } })}
          activeOpacity={0.85}
          testID="welcomeRegister"
        >
          <Text style={s.primaryBtnText}>Skapa konto</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.secondaryBtn}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.8}
          testID="welcomeLogin"
        >
          <Text style={s.secondaryBtnText}>Logga in</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.tertiaryBtn}
          onPress={() => setDayModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={s.tertiaryBtnText}>Jag har redan börjat, välj dag</Text>
        </TouchableOpacity>
      </View>

      {/* ── Dagväljaren för den som redan är mitt i utmaningen ── */}
      <Modal
        visible={dayModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDayModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Vilken dag är du på?</Text>
            <Text style={s.sheetSub}>Välj din nuvarande dag i utmaningen</Text>

            <ScrollView
              style={{ maxHeight: 260 }}
              contentContainerStyle={s.dayGrid}
              showsVerticalScrollIndicator={false}
            >
              {Array.from({ length: 74 }, (_, i) => i + 1).map(day => (
                <TouchableOpacity
                  key={day}
                  style={[s.dayBtn, selectedDay === day && s.dayBtnActive]}
                  onPress={() => setSelectedDay(day)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.dayBtnText, selectedDay === day && s.dayBtnTextActive]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={s.sheetFooter}>
              <TouchableOpacity
                style={[s.confirmBtn, !selectedDay && s.confirmBtnDisabled]}
                onPress={confirmDay}
                disabled={!selectedDay}
                activeOpacity={0.85}
              >
                <Text style={s.confirmBtnText}>
                  {selectedDay ? `Fortsätt från dag ${selectedDay}` : 'Välj en dag'}
                </Text>
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
  screen: { flex: 1, backgroundColor: BG_DARK },

  tapRow:  { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  tapZone: { flex: 1 },

  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20 },
  progressTrack: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden',
  },
  progressFill: { flex: 1, borderRadius: 2, backgroundColor: '#FFFFFF' },

  content: { flex: 1, paddingHorizontal: 26, paddingTop: 26, paddingBottom: 170 },
  slide:   { flex: 1 },

  brandRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 14 },
  brandName: { color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  brandBy:   { color: ACCENT, fontSize: 11, fontWeight: '600' },

  title: {
    color: '#FFFFFF', fontSize: 36, fontWeight: '800',
    letterSpacing: -0.6, lineHeight: 42,
  },

  showcase: { flex: 1, justifyContent: 'center', paddingTop: 18 },

  ctas: { position: 'absolute', left: 26, right: 26, gap: 10 },
  primaryBtn: {
    backgroundColor: ACCENT, borderRadius: 999, paddingVertical: 16,
    alignItems: 'center',
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14,
  },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 999, paddingVertical: 15, alignItems: 'center',
    backgroundColor: '#F2F2F5',
  },
  secondaryBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  tertiaryBtn: { paddingVertical: 4, alignItems: 'center' },
  tertiaryBtnText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '500' },

  // Dagväljaren
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#1C1C1F',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 20, paddingBottom: 36,
  },
  sheetHandle: {
    width: 40, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.45)', alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { color: '#FFF', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  sheetSub:   { color: '#666', fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 16 },

  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  dayBtn: {
    width: (width - 40 - 8 * 6) / 7,
    aspectRatio: 1, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  dayBtnActive:     { backgroundColor: accentAlpha('26') },
  dayBtnText:       { color: '#888', fontSize: 13, fontWeight: '600' },
  dayBtnTextActive: { color: ACCENT, fontWeight: '700' },

  sheetFooter: { gap: 10, marginTop: 16 },
  confirmBtn: {
    backgroundColor: ACCENT, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.35 },
  confirmBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  cancelBtn: {
    borderRadius: 14, paddingVertical: 13, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cancelBtnText: { color: '#666', fontSize: 14 },
})

// ─── Mini-UI-styles (mockkorten) ─────────────────────────────────────────────

const m = StyleSheet.create({
  card: {
    width: CARD_W, alignSelf: 'center',
    backgroundColor: MOCK_CARD, borderRadius: 20, padding: 18, gap: 10,
    borderWidth: 1, borderColor: MOCK_BORDER,
  },
  // Huvudkortet får appfärgens kant med mjuk lyster, som förlagans teal-ram
  cardGlow: {
    borderWidth: 1.5, borderColor: accentAlpha('99'),
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25, shadowRadius: 18, elevation: 6,
  },
  peekCard: {
    width: CARD_W - 16, alignSelf: 'center',
    backgroundColor: MOCK_CARD, borderRadius: 20,
    paddingHorizontal: 18, paddingTop: 14, height: 74, overflow: 'hidden',
    borderWidth: 1, borderColor: MOCK_BORDER,
    marginTop: 12, opacity: 0.65,
  },
  floatCard: {
    width: CARD_W - 44, marginTop: 12, alignSelf: 'flex-end',
  },

  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dim:      { color: MOCK_DIM, fontSize: 12, fontWeight: '600' },
  dimSmall: { color: MOCK_DIM, fontSize: 12 },
  big:      { color: MOCK_TEXT, fontSize: 22, fontWeight: '800', marginTop: 1 },
  num:      { color: MOCK_TEXT, fontFamily: NUM_FONT, fontSize: 22 },
  numSmall: { color: MOCK_TEXT, fontFamily: NUM_FONT, fontSize: 12 },

  streakChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: accentAlpha('1E'), borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  streakText: { color: ACCENT, fontSize: 12, fontWeight: '700' },

  barTrack: {
    height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden', marginBottom: 2,
  },
  barFill: { flex: 1, borderRadius: 3, backgroundColor: ACCENT },

  taskRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  taskLabel:     { color: MOCK_TEXT, fontSize: 14, fontWeight: '600', flex: 1 },
  taskLabelDone: { color: MOCK_DIM, textDecorationLine: 'line-through' },
  checkOn: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#66BB6A',
    alignItems: 'center', justifyContent: 'center',
  },
  checkOff: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)',
  },

  segRow: { flexDirection: 'row', gap: 5, marginTop: 4 },
  seg:    { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' },
  summaryRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  weekDay: { color: MOCK_DIM, fontSize: 11, fontWeight: '800', width: 32, letterSpacing: 0.5 },
  weekDot: { width: 22, height: 22, borderRadius: 7 },

  levelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(207,228,245,0.14)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  levelText: { color: '#CFE4F5', fontSize: 12, fontWeight: '700' },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8, height: 80 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  chartBar: {
    width: '100%', borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  medalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  medal: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  feedHead:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: accentAlpha('26'),
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: ACCENT, fontSize: 15, fontWeight: '800' },
  routeStrip: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 4,
    height: 48, marginTop: 4,
  },
  routePt: { flex: 1, borderRadius: 3, backgroundColor: 'rgba(63,167,255,0.55)' },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
})
