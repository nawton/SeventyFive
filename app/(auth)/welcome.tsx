import { useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  ImageBackground,
  Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeIn, FadeInLeft, FadeInRight, FadeInUp } from 'react-native-reanimated'
import { CARD, ACCENT, accentAlpha } from '@/lib/theme'
import { ONBOARDING_IMAGES } from '@/lib/onboardingImages'

const { width } = Dimensions.get('window')

// =============================================================================
// VÄLKOMST — story i fem slides med helskärmsbilder (Runna-känsla).
// Tryck på höger halva = nästa, vänster = föregående. Texten ligger
// förankrad i botten ovanpå en mörk gradient; egna foton släpps i
// assets/onboarding/ (se src/lib/onboardingImages.ts), tills dess gradient.
// =============================================================================

const TASKS = [
  { icon: 'barbell-outline',    color: '#FFA817', label: 'Träna varje dag' },
  { icon: 'restaurant-outline', color: '#66BB6A', label: 'Håll din kost' },
  { icon: 'water-outline',      color: '#00BCD4', label: 'Drick ditt vatten' },
  { icon: 'book-outline',       color: '#AB47BC', label: 'Läs 10 sidor' },
  { icon: 'camera-outline',     color: '#EC407A', label: 'Ta ett framstegsfoto' },
] as const

const SLIDES: Array<{
  key: string
  kicker: string
  title: string
  body: string
  /** Gradient-fallback tills en riktig bild lagts i assets/onboarding/ */
  gradient: [string, string, string]
  watermark: React.ComponentProps<typeof Ionicons>['name']
}> = [
  {
    key: 'brand',
    kicker: '75 DAGAR · 5 UPPGIFTER · INGA UNDANTAG',
    title: '',   // brand-sliden ritar wordmarket själv
    body: 'Utmaningen som förändrar din disciplin, ditt mindset och din kropp, en dag i taget.',
    gradient: ['#241303', '#140B04', '#0B0B0D'],
    watermark: 'flame',
  },
  {
    key: 'tasks',
    kicker: 'UTMANINGEN',
    title: 'Fem uppgifter,\nvarje dag',
    body: 'Bocka av dagens uppgifter och håll serien vid liv i 75 dagar. Missar du en dag börjar du om.',
    gradient: ['#0A1F12', '#081209', '#0B0B0D'],
    watermark: 'checkmark-done',
  },
  {
    key: 'training',
    kicker: 'TRÄNING & LÖPNING',
    title: 'Träna efter\ndin plan',
    body: 'Schemaguiden bygger veckans pass efter dina mål, och löpplanen trappas upp mot ditt lopp. Rundorna spåras med GPS.',
    gradient: ['#06182B', '#050F1A', '#0B0B0D'],
    watermark: 'barbell',
  },
  {
    key: 'progress',
    kicker: 'FRAMSTEG',
    title: 'Se framstegen\nsvart på vitt',
    body: 'Grafer, muskelkarta, personliga rekord och 26 medaljer att låsa upp. Samla poäng och klättra från brons till diamant.',
    gradient: ['#1C0F2B', '#110A18', '#0B0B0D'],
    watermark: 'stats-chart',
  },
  {
    key: 'community',
    kicker: 'COMMUNITY',
    title: 'Kör\ntillsammans',
    body: 'Skapa grupper, följ dina vänner och peppa varandras pass med gillanden och kommentarer. Allt är roligare när fler kör.',
    gradient: ['#03201F', '#031312', '#0B0B0D'],
    watermark: 'people',
  },
]

export default function Welcome() {
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(0)
  const dirRef = useRef<1 | -1>(1)
  const [dayModalVisible, setDayModalVisible] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const isLast = index === SLIDES.length - 1
  const slide = SLIDES[index]
  const photo = ONBOARDING_IMAGES[slide.key]

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

      {/* ── Bakgrund: foto när det finns, annars slidens gradient ── */}
      <Animated.View key={`bg-${slide.key}`} entering={FadeIn.duration(350)} style={StyleSheet.absoluteFill}>
        {photo ? (
          <ImageBackground source={photo} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient colors={slide.gradient} style={StyleSheet.absoluteFill}>
            <Ionicons name={slide.watermark} size={380} color="rgba(255,255,255,0.045)" style={s.watermark} />
          </LinearGradient>
        )}
        {/* Mörk toning nedåt så texten alltid går att läsa, även på foton */}
        <LinearGradient
          colors={['rgba(11,11,13,0)', 'rgba(11,11,13,0.55)', 'rgba(11,11,13,0.96)']}
          locations={[0.30, 0.62, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── Fingertoppsnavigering som stories: hela ytan är tryckbar ── */}
      <View style={s.tapRow}>
        <Pressable style={s.tapZone} onPress={() => go(-1)} testID="storyPrev" />
        <Pressable style={s.tapZone} onPress={() => go(1)} testID="storyNext" />
      </View>

      {/* ── Story-progress ── */}
      <View style={[s.progressRow, { paddingTop: insets.top + 10 }]} pointerEvents="none">
        {SLIDES.map((sl, i) => (
          <View key={sl.key} style={s.progressTrack}>
            {i <= index && <View style={s.progressFill} />}
          </View>
        ))}
      </View>

      {/* ── Textblocket förankrat i botten, Runna-stil ── */}
      <View
        style={[s.content, { paddingBottom: (isLast ? 196 : 56) + insets.bottom }]}
        pointerEvents="none"
      >
        <Animated.View
          key={slide.key}
          entering={(dirRef.current === 1 ? FadeInRight : FadeInLeft).duration(280)}
          style={s.slide}
        >
          <Text style={s.kicker}>{slide.kicker}</Text>

          {slide.key === 'brand' ? (
            <View style={s.titleRow}>
              <Text style={s.appName}>SeventyFive</Text>
              <Text style={s.byNawton}>by Nawton</Text>
            </View>
          ) : (
            <Text style={s.slideTitle}>{slide.title}</Text>
          )}

          <Text style={s.body}>{slide.body}</Text>

          {slide.key === 'tasks' && (
            <View style={s.chipColumn}>
              {TASKS.map(t => (
                <View key={t.icon} style={s.chip}>
                  <Ionicons name={t.icon} size={16} color={t.color} />
                  <Text style={s.chipText}>{t.label}</Text>
                </View>
              ))}
            </View>
          )}

          {slide.key === 'brand' && (
            <View style={s.iconStrip}>
              {TASKS.map(t => (
                <View key={t.icon} style={[s.bubble, { backgroundColor: t.color + '26' }]}>
                  <Ionicons name={t.icon} size={20} color={t.color} />
                </View>
              ))}
            </View>
          )}

          {index === 0 && <Text style={s.hint}>Tryck på höger sida för att bläddra</Text>}
        </Animated.View>
      </View>

      {/* ── Sista sliden: vägarna in, ovanpå tryckzonerna ── */}
      {isLast && (
        <Animated.View
          entering={FadeInUp.duration(300)}
          style={[s.ctas, { bottom: 24 + insets.bottom }]}
        >
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
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0B0D' },

  watermark: {
    position: 'absolute', right: -90, top: '16%',
    transform: [{ rotate: '-8deg' }],
  },

  // Tryckzoner — under innehållet, hela skärmen
  tapRow:  { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  tapZone: { flex: 1 },

  // Story-progress
  progressRow: {
    flexDirection: 'row', gap: 6, paddingHorizontal: 20,
  },
  progressTrack: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden',
  },
  progressFill: { flex: 1, borderRadius: 2, backgroundColor: '#FFFFFF' },

  // Textblocket i botten
  content: { flex: 1, paddingHorizontal: 26, justifyContent: 'flex-end' },
  slide:   { gap: 14 },

  kicker: {
    color: ACCENT, fontSize: 12, fontWeight: '800', letterSpacing: 1.6,
  },

  // Brand-sliden
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' },
  appName: {
    color: '#FFFFFF', fontSize: 44, fontWeight: '800',
    letterSpacing: -1, lineHeight: 48,
  },
  byNawton: { color: ACCENT, fontSize: 13, fontWeight: '600', letterSpacing: 0.3, paddingBottom: 8 },
  hint:     { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6 },

  slideTitle: {
    color: '#FFFFFF', fontSize: 38, fontWeight: '800',
    letterSpacing: -0.5, lineHeight: 43,
  },
  body: { color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 23 },

  // Uppgiftschips på slide 2 — kompakta pills istället för lista
  chipColumn: { gap: 8, marginTop: 4, alignItems: 'flex-start' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 999,
    paddingHorizontal: 13, paddingVertical: 7,
  },
  chipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  iconStrip: { flexDirection: 'row', gap: 10, marginTop: 4 },
  bubble: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },

  // CTA-lagret på sista sliden
  ctas: { position: 'absolute', left: 26, right: 26, gap: 10 },
  primaryBtn: {
    backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14,
  },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  secondaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  tertiaryBtn: { paddingVertical: 6, alignItems: 'center' },
  tertiaryBtnText: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '500' },

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
