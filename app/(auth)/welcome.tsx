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
import { SafeScreen } from '@/components/SafeScreen'
import { router } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInLeft, FadeInRight, FadeInUp } from 'react-native-reanimated'
import {
  BG, CARD, CARD_BORDER, TEXT_SECONDARY, ACCENT, CARDIO_BLUE, RED,
  NUM_FONT, accentAlpha,
} from '@/lib/theme'

const { width } = Dimensions.get('window')

// =============================================================================
// VÄLKOMST — story i fem slides i appens eget designspråk: mörk botten,
// kort med ram (inte glow), orange accent och blå cardio. Höger halva =
// nästa slide, vänster = föregående. Sista sliden har vägarna in.
// =============================================================================

const TASKS = [
  { icon: 'barbell-outline',    color: '#FFA817', label: 'Träna 45 min',         done: true },
  { icon: 'restaurant-outline', color: '#66BB6A', label: 'Håll din kost',        done: true },
  { icon: 'water-outline',      color: '#00BCD4', label: 'Drick 3 liter vatten', done: true },
  { icon: 'book-outline',       color: '#AB47BC', label: 'Läs 10 sidor',         done: false },
  { icon: 'camera-outline',     color: '#EC407A', label: 'Ta ett framstegsfoto', done: false },
] as const

const SLIDES = ['brand', 'tasks', 'training', 'progress', 'community'] as const
type SlideKey = typeof SLIDES[number]

const COPY: Record<Exclude<SlideKey, 'brand'>, { kicker: string; title: string; body: string }> = {
  tasks: {
    kicker: 'UTMANINGEN',
    title: 'Fem uppgifter, varje dag',
    body: 'Bocka av dagens uppgifter och håll serien vid liv i 75 dagar. Missar du en dag börjar du om.',
  },
  training: {
    kicker: 'TRÄNING',
    title: 'Ditt schema, dina pass',
    body: 'Schemaguiden bygger veckans pass efter dina mål, med löpplan som trappas upp och GPS på rundorna.',
  },
  progress: {
    kicker: 'FRAMSTEG',
    title: 'Följ dina framsteg',
    body: 'Formkurva, muskelkarta, personliga rekord och 26 medaljer. Samla poäng och klättra mot Diamant.',
  },
  community: {
    kicker: 'COMMUNITY',
    title: 'Kör tillsammans',
    body: 'Skapa grupper, följ dina vänner och peppa varandras pass med gillanden och kommentarer.',
  },
}

// ─── Mockkort i appens kortspråk: CARD-botten, tunn ram, inga skuggor ────────

function DayCounterPill() {
  return (
    <View style={m.dayPill}>
      <Text style={m.dayPillNum}>42</Text>
      <Text style={m.dayPillSlash}>/75</Text>
    </View>
  )
}

function TaskMock() {
  return (
    <View style={m.card}>
      <View style={m.headRow}>
        <View>
          <Text style={m.label}>IDAG</Text>
          <Text style={m.big}>3 av 5 klara</Text>
        </View>
        <DayCounterPill />
      </View>
      <View style={m.barTrack}><View style={[m.barFill, { width: '60%' }]} /></View>
      {TASKS.map(t => (
        <View key={t.label} style={m.row}>
          <View style={[m.rowIcon, { backgroundColor: t.color + '1A' }]}>
            <Ionicons name={t.icon} size={15} color={t.color} />
          </View>
          <Text style={[m.rowText, t.done && m.rowTextDone]}>{t.label}</Text>
          {t.done
            ? <View style={m.checkOn}><Ionicons name="checkmark" size={12} color="#000" /></View>
            : <View style={m.checkOff} />}
        </View>
      ))}
    </View>
  )
}

function SessionMock() {
  const exercises = [
    { name: 'Bänkpress',             sets: '4 × 8',  done: true },
    { name: 'Lutande hantelpress',   sets: '3 × 10', done: true },
    { name: 'Dips',                  sets: '3 × max', done: false },
    { name: 'Triceps pushdown',      sets: '3 × 12', done: false },
  ]
  return (
    <View style={{ gap: 10 }}>
      <View style={m.card}>
        <View style={m.headRow}>
          <View>
            <Text style={m.label}>MÅNDAG</Text>
            <Text style={m.big}>Bröst & Triceps</Text>
          </View>
          <View style={m.tagChip}>
            <Ionicons name="barbell-outline" size={12} color={ACCENT} />
            <Text style={m.tagChipText}>4 övningar</Text>
          </View>
        </View>
        {exercises.map(ex => (
          <View key={ex.name} style={m.row}>
            <Text style={m.rowText}>{ex.name}</Text>
            <Text style={m.rowNum}>{ex.sets}</Text>
            {ex.done
              ? <View style={m.checkOn}><Ionicons name="checkmark" size={12} color="#000" /></View>
              : <View style={m.checkOff} />}
          </View>
        ))}
      </View>
      <View style={m.card}>
        <View style={m.headRow}>
          <View>
            <Text style={[m.label, { color: CARDIO_BLUE }]}>TISDAG · LÖPNING</Text>
            <Text style={m.big}>Intervaller 6×400 m</Text>
          </View>
          <Ionicons name="navigate" size={18} color={CARDIO_BLUE} />
        </View>
        <Text style={m.dim}>Vecka 3 av 8 · tempo 5:05–5:20 /km</Text>
      </View>
    </View>
  )
}

function ProgressMock() {
  const bars = [0.35, 0.55, 0.42, 0.7, 0.58, 0.9]
  return (
    <View style={{ gap: 10 }}>
      <View style={m.card}>
        <View style={m.headRow}>
          <View>
            <Text style={m.label}>FORMKURVA</Text>
            <Text style={m.big}>Vecka för vecka</Text>
          </View>
          <View style={m.tagChip}>
            <Ionicons name="trophy-outline" size={12} color={ACCENT} />
            <Text style={m.tagChipText}>Platina</Text>
          </View>
        </View>
        <View style={m.chartRow}>
          {bars.map((h, i) => (
            <View key={i} style={m.chartCol}>
              <View style={[m.chartBar, { height: 10 + h * 58 }, i === bars.length - 1 && { backgroundColor: ACCENT }]} />
            </View>
          ))}
        </View>
      </View>
      <View style={m.card}>
        <View style={m.headRow}>
          <Text style={m.rowText}>Medaljer</Text>
          <Text style={m.dim}><Text style={m.rowNum}>18</Text> av 26</Text>
        </View>
        <View style={m.medalRow}>
          {(['#FFD54F', '#B0BEC5', '#FF8A65'] as const).map((c, i) => (
            <View key={i} style={[m.medal, { borderColor: c, backgroundColor: c + '1A' }]}>
              <Ionicons name="medal-outline" size={15} color={c} />
            </View>
          ))}
          <Text style={m.dim}>+15 att låsa upp</Text>
        </View>
      </View>
    </View>
  )
}

function FeedMock() {
  return (
    <View style={{ gap: 10 }}>
      <View style={m.card}>
        <View style={m.feedHead}>
          <View style={m.avatar}><Text style={m.avatarText}>E</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={m.rowText}>Elin Berg</Text>
            <Text style={m.dim}>Team Sthlm · för 2 h sedan</Text>
          </View>
          <Ionicons name="navigate" size={16} color={CARDIO_BLUE} />
        </View>
        <Text style={m.dim}>
          Löpning · <Text style={m.rowNum}>7,03 km</Text> · <Text style={m.rowNum}>5:12</Text> /km
        </Text>
        <View style={m.routeStrip}>
          {[14, 28, 20, 38, 24, 42, 18, 32, 22].map((h, i) => (
            <View key={i} style={[m.routePt, { height: h }]} />
          ))}
        </View>
        <View style={m.socialRow}>
          <Ionicons name="heart" size={16} color={RED} />
          <Text style={m.dim}>12</Text>
          <Ionicons name="chatbubble-outline" size={14} color={TEXT_SECONDARY} style={{ marginLeft: 10 }} />
          <Text style={m.dim}>3</Text>
        </View>
      </View>
      <View style={m.card}>
        <View style={m.feedHead}>
          <View style={[m.avatar, { backgroundColor: 'rgba(102,187,106,0.15)' }]}>
            <Ionicons name="people" size={14} color="#66BB6A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={m.rowText}>Team Sthlm</Text>
            <Text style={m.dim}>8 medlemmar · 3 kör just nu</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

// ─── Skärmen ─────────────────────────────────────────────────────────────────

export default function Welcome() {
  const [index, setIndex] = useState(0)
  const dirRef = useRef<1 | -1>(1)
  const [dayModalVisible, setDayModalVisible] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const slideKey = SLIDES[index]
  const isLast = index === SLIDES.length - 1

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
    <SafeScreen style={s.screen}>
      {/* Fingertoppsnavigering som stories: hela ytan är tryckbar */}
      <View style={s.tapRow}>
        <Pressable style={s.tapZone} onPress={() => go(-1)} testID="storyPrev" />
        <Pressable style={s.tapZone} onPress={() => go(1)} testID="storyNext" />
      </View>

      {/* Story-progress i appens orange */}
      <View style={s.progressRow} pointerEvents="none">
        {SLIDES.map((k, i) => (
          <View key={k} style={s.progressTrack}>
            {i <= index && <View style={s.progressFill} />}
          </View>
        ))}
      </View>

      <View style={[s.content, isLast && { paddingBottom: 168 }]} pointerEvents="none">
        <Animated.View
          key={slideKey}
          entering={(dirRef.current === 1 ? FadeInRight : FadeInLeft).duration(280)}
          style={s.slide}
        >
          {slideKey === 'brand' ? (
            <>
              <View style={s.titleRow}>
                <Text style={s.appName}>SeventyFive</Text>
                <Text style={s.byNawton}>by Nawton</Text>
              </View>
              <Text style={s.tagline}>75 dagar. 5 uppgifter. Inga undantag.</Text>
              <Text style={s.desc}>
                Utmaningen som förändrar din disciplin, ditt mindset och din kropp, en dag i taget.
              </Text>
              <View style={s.iconStrip}>
                {TASKS.map(t => (
                  <View key={t.icon} style={[s.iconBubble, { backgroundColor: t.color + '1A' }]}>
                    <Ionicons name={t.icon} size={22} color={t.color} />
                  </View>
                ))}
              </View>
              <Text style={s.hint}>Tryck på höger sida för att bläddra</Text>
            </>
          ) : (
            <>
              <Text style={s.kicker}>{COPY[slideKey].kicker}</Text>
              <Text style={s.title}>{COPY[slideKey].title}</Text>
              <Text style={s.desc}>{COPY[slideKey].body}</Text>
              <View style={s.showcase}>
                {slideKey === 'tasks' && <TaskMock />}
                {slideKey === 'training' && <SessionMock />}
                {slideKey === 'progress' && <ProgressMock />}
                {slideKey === 'community' && <FeedMock />}
              </View>
            </>
          )}
        </Animated.View>
      </View>

      {/* Sista sliden: vägarna in, ovanpå tryckzonerna */}
      {isLast && (
        <Animated.View entering={FadeInUp.duration(300)} style={s.ctas}>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => router.push({ pathname: '/(auth)/login', params: { mode: 'register' } })}
            activeOpacity={0.85}
            testID="welcomeRegister"
          >
            <Text style={s.primaryBtnText}>Skapa konto</Text>
            <Ionicons name="arrow-forward" size={17} color="#000" />
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
        </Animated.View>
      )}

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
    </SafeScreen>
  )
}

// ─── Skärmens styles ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  tapRow:  { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  tapZone: { flex: 1 },

  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 10 },
  progressTrack: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden',
  },
  progressFill: { flex: 1, borderRadius: 2, backgroundColor: ACCENT },

  content: {
    flex: 1, paddingHorizontal: 28,
    justifyContent: 'center', paddingBottom: 48,
  },
  slide: { gap: 14 },

  // Brand-sliden — samma uttryck som appens gamla välkomstsida
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  appName: {
    color: '#FFFFFF', fontSize: 42, fontWeight: '800',
    letterSpacing: -1, lineHeight: 44,
  },
  byNawton: { color: ACCENT, fontSize: 13, fontWeight: '600', letterSpacing: 0.3, paddingBottom: 6 },
  tagline:  { color: '#8A8A8E', fontSize: 15, fontWeight: '600' },
  hint:     { color: '#555', fontSize: 12, marginTop: 8 },

  iconStrip: { flexDirection: 'row', gap: 10, marginTop: 8 },
  iconBubble: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },

  // Innehållsslides — appens sektionsetiketter och rubriker
  kicker: {
    color: TEXT_SECONDARY, fontSize: 12, fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    color: '#FFFFFF', fontSize: 30, fontWeight: '800',
    letterSpacing: -0.5, lineHeight: 36,
  },
  desc: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 21 },
  showcase: { marginTop: 10 },

  // CTA-lagret på sista sliden — appens knappform
  ctas: { position: 'absolute', left: 28, right: 28, bottom: 32, gap: 10 },
  primaryBtn: {
    backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  secondaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  tertiaryBtn: { paddingVertical: 5, alignItems: 'center' },
  tertiaryBtnText: { color: '#666', fontSize: 13, fontWeight: '500' },

  // Dagväljaren
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: CARD,
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

// ─── Mockkortens styles — appens kortspråk: ram, inte glow ───────────────────

const m = StyleSheet.create({
  card: {
    backgroundColor: CARD, borderRadius: 16, padding: 16, gap: 10,
    borderWidth: 1, borderColor: CARD_BORDER,
  },

  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1,
  },
  big: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 2 },
  dim: { color: TEXT_SECONDARY, fontSize: 12 },

  dayPill: {
    flexDirection: 'row', alignItems: 'baseline',
    backgroundColor: accentAlpha('1A'), borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  dayPillNum:   { color: ACCENT, fontFamily: NUM_FONT, fontSize: 16 },
  dayPillSlash: { color: TEXT_SECONDARY, fontFamily: NUM_FONT, fontSize: 12 },

  barTrack: {
    height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: { flex: 1, borderRadius: 3, backgroundColor: ACCENT },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText:     { color: '#EDEDEF', fontSize: 14, fontWeight: '600', flex: 1 },
  rowTextDone: { color: TEXT_SECONDARY, textDecorationLine: 'line-through' },
  rowNum:      { color: '#EDEDEF', fontFamily: NUM_FONT, fontSize: 13 },

  checkOn: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOff: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },

  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: accentAlpha('1A'), borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  tagChipText: { color: ACCENT, fontSize: 12, fontWeight: '700' },

  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 72, marginTop: 2 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  chartBar: { width: '100%', borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.14)' },

  medalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  medal: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  feedHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: accentAlpha('1F'),
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: ACCENT, fontSize: 15, fontWeight: '800' },
  routeStrip: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 44,
  },
  routePt:   { flex: 1, borderRadius: 3, backgroundColor: 'rgba(63,167,255,0.5)' },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
})
