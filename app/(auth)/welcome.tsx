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
  type ColorValue,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { ACCENT, CARDIO_BLUE, NUM_FONT, accentAlpha } from '@/lib/theme'

const { width } = Dimensions.get('window')

// =============================================================================
// VÄLKOMST — immersiv onboarding i fem slides: mörk atmosfär, glödande
// hero i mitten, centrerad text, prickar och en stor Fortsätt-pill.
// Höger halva = nästa, vänster = föregående, knappen funkar också.
// Sista sliden byter till Skapa konto (gradient) och Logga in.
// =============================================================================

const BG_DARK = '#0A0A0C'
const HERO = Math.min(width - 100, 290)

const TASK_ICONS = [
  { icon: 'barbell-outline',    color: '#FFA817' },
  { icon: 'restaurant-outline', color: '#66BB6A' },
  { icon: 'water-outline',      color: '#00BCD4' },
  { icon: 'book-outline',       color: '#AB47BC' },
  { icon: 'camera-outline',     color: '#EC407A' },
] as const

const SLIDES = ['brand', 'tasks', 'training', 'progress', 'community'] as const
type SlideKey = typeof SLIDES[number]

const COPY: Record<SlideKey, { title: string; sub: string }> = {
  brand:     { title: '', sub: '75 dagar. 5 uppgifter. Inga undantag.' },
  tasks:     { title: 'Fem uppgifter,\nvarje dag', sub: 'Bocka av dagens uppgifter och håll serien vid liv i 75 dagar.' },
  training:  { title: 'Ditt schema,\ndina pass', sub: 'Schemaguiden bygger veckans pass och löpplanen trappas upp mot ditt lopp.' },
  progress:  { title: 'Följ dina\nframsteg', sub: 'Formkurva, rekord och 26 medaljer. Klättra från Brons till Diamant.' },
  community: { title: 'Kör\ntillsammans', sub: 'Grupper, vänner och pepp på varje pass. Allt är roligare tillsammans.' },
}

// ─── Glöden bakom varje hero: mjuka koncentriska cirklar ─────────────────────

function Glow({ color = ACCENT }: { color?: ColorValue }) {
  return (
    <>
      <View style={[g.circle, { width: HERO, height: HERO, borderRadius: HERO / 2, backgroundColor: color, opacity: 0.05 }]} />
      <View style={[g.circle, { width: HERO * 0.68, height: HERO * 0.68, borderRadius: HERO * 0.34, backgroundColor: color, opacity: 0.08 }]} />
      <View style={[g.circle, { width: HERO * 0.4, height: HERO * 0.4, borderRadius: HERO * 0.2, backgroundColor: color, opacity: 0.11 }]} />
    </>
  )
}

// ─── Heroes ──────────────────────────────────────────────────────────────────

function BrandHero() {
  return (
    <View style={g.hero}>
      <Glow />
      <Text style={g.brandNum}>75</Text>
      <View style={g.brandRow}>
        <Text style={g.brandName}>SeventyFive</Text>
        <Text style={g.brandBy}>by Nawton</Text>
      </View>
    </View>
  )
}

/** Uppgiftsikonerna i omloppsbana runt en glödande flamma */
function TasksHero() {
  const c = HERO / 2
  const spots = [
    { x: 0, y: -104 }, { x: 100, y: -32 }, { x: 62, y: 85 },
    { x: -62, y: 85 }, { x: -100, y: -32 },
  ]
  return (
    <View style={g.hero}>
      <Glow />
      <View style={g.orbitCenter}>
        <Ionicons name="flame" size={30} color={ACCENT} />
      </View>
      {TASK_ICONS.map((t, i) => (
        <View
          key={t.icon}
          style={[g.orbitBubble, {
            left: c + spots[i].x - 24, top: c + spots[i].y - 24,
            backgroundColor: '#141417', borderColor: t.color + '55',
          }]}
        >
          <Ionicons name={t.icon} size={20} color={t.color} />
        </View>
      ))}
    </View>
  )
}

/** Stigande staplar mot toppen, flaggan på sista */
function TrainingHero() {
  const bars = [0.16, 0.3, 0.24, 0.46, 0.62, 0.54, 0.86]
  return (
    <View style={g.hero}>
      <Glow />
      <View style={g.barsRow}>
        {bars.map((h, i) => {
          const last = i === bars.length - 1
          return (
            <View key={i} style={g.barCol}>
              {last && (
                <View style={g.flagWrap}>
                  <Ionicons name="flag" size={17} color="#000" />
                </View>
              )}
              <View style={[g.bar, { height: 24 + h * 130 }, last && { backgroundColor: ACCENT }]} />
            </View>
          )
        })}
      </View>
    </View>
  )
}

/** Glödande pokal med svävande statistikchips */
function ProgressHero() {
  return (
    <View style={g.hero}>
      <Glow />
      <View style={g.trophyWrap}>
        <Ionicons name="trophy" size={52} color={ACCENT} />
      </View>
      <View style={[g.chip, { top: 18, left: 0 }]}>
        <Ionicons name="medal-outline" size={13} color="#FFD54F" />
        <Text style={g.chipText}>18 av 26</Text>
      </View>
      <View style={[g.chip, { top: 52, right: -6 }]}>
        <Ionicons name="shield-outline" size={13} color="#CFE4F5" />
        <Text style={g.chipText}>Platina</Text>
      </View>
      <View style={[g.chip, { bottom: 26, left: 14 }]}>
        <Ionicons name="trending-up-outline" size={13} color={CARDIO_BLUE} />
        <Text style={g.chipText}>Nytt PR 100 kg</Text>
      </View>
    </View>
  )
}

/** Vänkretsen: avatarer runt ett glödande hjärta */
function CommunityHero() {
  return (
    <View style={g.hero}>
      <Glow color="#FF3B4A" />
      <View style={g.heartWrap}>
        <Ionicons name="heart" size={40} color="#FF3B4A" />
      </View>
      {[
        { label: 'E', color: '#FFA817',   x: -92, y: -58 },
        { label: 'H', color: CARDIO_BLUE, x: 92,  y: -46 },
        { label: 'V', color: '#66BB6A',   x: -66, y: 82 },
        { label: 'A', color: '#AB47BC',   x: 76,  y: 76 },
      ].map(p => (
        <View
          key={p.label}
          style={[g.orbitBubble, {
            left: HERO / 2 + p.x - 24, top: HERO / 2 + p.y - 24,
            backgroundColor: p.color + '22', borderColor: p.color + '66',
          }]}
        >
          <Text style={[g.avatarLetter, { color: p.color }]}>{p.label}</Text>
        </View>
      ))}
      <View style={[g.chip, { bottom: 4, alignSelf: 'center' }]}>
        <Ionicons name="people-outline" size={13} color="#66BB6A" />
        <Text style={g.chipText}>Team Sthlm · 8 medlemmar</Text>
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
    <View style={s.screen}>
      {/* Svag atmosfär uppifrån */}
      <LinearGradient
        colors={['#151312', BG_DARK]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Fingertoppsnavigering: hela ytan är tryckbar */}
      <View style={s.tapRow}>
        <Pressable style={s.tapZone} onPress={() => go(-1)} testID="storyPrev" />
        <Pressable style={s.tapZone} onPress={() => go(1)} testID="storyNext" />
      </View>

      {/* Innehållet: hero i mitten, centrerad text under */}
      <View style={[s.content, { paddingTop: insets.top + 24 }]} pointerEvents="none">
        <Animated.View key={slideKey} entering={FadeIn.duration(320)} style={s.heroArea}>
          {slideKey === 'brand' && <BrandHero />}
          {slideKey === 'tasks' && <TasksHero />}
          {slideKey === 'training' && <TrainingHero />}
          {slideKey === 'progress' && <ProgressHero />}
          {slideKey === 'community' && <CommunityHero />}
        </Animated.View>

        <Animated.View key={`t-${slideKey}`} entering={FadeInDown.duration(320)} style={s.textArea}>
          {slideKey !== 'brand' && <Text style={s.title}>{COPY[slideKey].title}</Text>}
          <Text style={s.sub}>{COPY[slideKey].sub}</Text>
        </Animated.View>

        {/* Prickarna */}
        <View style={s.dotsRow}>
          {SLIDES.map((k, i) => (
            <View key={k} style={[s.dot, i === index && s.dotActive]} />
          ))}
        </View>
      </View>

      {/* Knapparna — ovanpå tryckzonerna */}
      <View style={[s.ctas, { bottom: 18 + insets.bottom }]}>
        {isLast ? (
          <Animated.View entering={FadeIn.duration(300)} style={{ gap: 10 }}>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(auth)/login', params: { mode: 'register' } })}
              activeOpacity={0.85}
              testID="welcomeRegister"
            >
              <LinearGradient
                colors={['#FFB84D', '#FF7A1A']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.pill}
              >
                <Text style={s.pillTextDark}>Skapa konto</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.pill, s.pillGhost]}
              onPress={() => router.push('/(auth)/login')}
              activeOpacity={0.8}
              testID="welcomeLogin"
            >
              <Text style={s.pillTextLight}>Logga in</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.tertiaryBtn}
              onPress={() => setDayModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={s.tertiaryText}>Jag har redan börjat, välj dag</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <TouchableOpacity
            style={[s.pill, s.pillWhite]}
            onPress={() => go(1)}
            activeOpacity={0.85}
            testID="welcomeContinue"
          >
            <Text style={s.pillTextDark}>Fortsätt</Text>
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

  content: { flex: 1, alignItems: 'center', paddingHorizontal: 34, paddingBottom: 150 },
  heroArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textArea: { alignItems: 'center', gap: 10, minHeight: 132 },

  title: {
    color: '#FFFFFF', fontSize: 30, fontWeight: '800',
    letterSpacing: -0.5, lineHeight: 36, textAlign: 'center',
  },
  sub: {
    color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 21,
    textAlign: 'center', maxWidth: 300,
  },

  dotsRow: { flexDirection: 'row', gap: 7, marginTop: 18 },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  dotActive: { width: 18, backgroundColor: ACCENT },

  ctas: { position: 'absolute', left: 26, right: 26 },
  pill: {
    borderRadius: 999, paddingVertical: 17, alignItems: 'center', justifyContent: 'center',
  },
  pillWhite: { backgroundColor: '#F4F4F6' },
  pillGhost: { backgroundColor: 'rgba(255,255,255,0.09)' },
  pillTextDark:  { color: '#000', fontSize: 16, fontWeight: '700' },
  pillTextLight: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  tertiaryBtn:  { paddingVertical: 4, alignItems: 'center' },
  tertiaryText: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '500' },

  // Dagväljaren
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#1B1B1E',
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

// ─── Hero-styles ─────────────────────────────────────────────────────────────

const g = StyleSheet.create({
  hero: {
    width: HERO, height: HERO,
    alignItems: 'center', justifyContent: 'center',
  },
  circle: { position: 'absolute' },

  brandNum: {
    color: ACCENT, fontFamily: NUM_FONT, fontSize: 108, lineHeight: 116,
    textShadowColor: accentAlpha('66'), textShadowRadius: 24, textShadowOffset: { width: 0, height: 0 },
  },
  brandRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  brandName: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  brandBy:   { color: ACCENT, fontSize: 12, fontWeight: '600' },

  orbitCenter: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#141417', borderWidth: 1, borderColor: accentAlpha('55'),
    alignItems: 'center', justifyContent: 'center',
  },
  orbitBubble: {
    position: 'absolute', width: 48, height: 48, borderRadius: 24,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 17, fontWeight: '800' },

  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, height: HERO * 0.72 },
  barCol:  { alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  bar: {
    width: 22, borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  flagWrap: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },

  trophyWrap: {
    width: 108, height: 108, borderRadius: 54,
    backgroundColor: '#141417', borderWidth: 1, borderColor: accentAlpha('55'),
    alignItems: 'center', justifyContent: 'center',
  },
  heartWrap: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: '#141417', borderWidth: 1, borderColor: 'rgba(255,59,74,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },

  chip: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(20,20,23,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6,
  },
  chipText: { color: '#EDEDEF', fontSize: 12, fontWeight: '600' },
})
