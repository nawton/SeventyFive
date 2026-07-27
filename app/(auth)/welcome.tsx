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
import { BG, CARD, ACCENT, accentAlpha } from '@/lib/theme'

const { width } = Dimensions.get('window')

// =============================================================================
// VÄLKOMST — story-bläddring i fem slides som presenterar appen.
// Tryck på höger halva = nästa, vänster halva = föregående. Sista sliden
// har Skapa konto/Logga in, plus dagväljaren för den som redan börjat.
// =============================================================================

const TASKS = [
  { icon: 'barbell-outline',    color: '#FFA817', label: 'Träna varje dag' },
  { icon: 'restaurant-outline', color: '#66BB6A', label: 'Håll din kost' },
  { icon: 'water-outline',      color: '#00BCD4', label: 'Drick ditt vatten' },
  { icon: 'book-outline',       color: '#AB47BC', label: 'Läs 10 sidor' },
  { icon: 'camera-outline',     color: '#EC407A', label: 'Ta ett framstegsfoto' },
] as const

type Bubble = { icon: React.ComponentProps<typeof Ionicons>['name']; color: string }

const SLIDES: Array<{
  key: string
  title: string
  body: string
  bubbles?: Bubble[]
}> = [
  {
    key: 'brand',
    title: '',   // brand-sliden ritar sin egen rubrik
    body: 'Utmaningen som förändrar din disciplin, ditt mindset och din kropp, en dag i taget.',
  },
  {
    key: 'tasks',
    title: 'Fem uppgifter,\nvarje dag',
    body: 'Bocka av dagens uppgifter och håll serien vid liv i 75 dagar. Missar du en dag börjar du om.',
  },
  {
    key: 'training',
    title: 'Träna efter\ndin plan',
    body: 'Schemaguiden bygger veckans pass efter dina mål, och löpplanen trappas upp mot ditt lopp. Rundorna spåras med GPS.',
    bubbles: [
      { icon: 'barbell-outline',  color: '#FFA817' },
      { icon: 'navigate-outline', color: '#3FA7FF' },
      { icon: 'map-outline',      color: '#66BB6A' },
    ],
  },
  {
    key: 'progress',
    title: 'Se framstegen\nsvart på vitt',
    body: 'Grafer, muskelkarta, personliga rekord och 26 medaljer att låsa upp. Samla poäng och klättra från brons till diamant.',
    bubbles: [
      { icon: 'stats-chart-outline', color: '#3FA7FF' },
      { icon: 'body-outline',        color: '#FFA817' },
      { icon: 'medal-outline',       color: '#FFD54F' },
      { icon: 'trophy-outline',      color: '#B45CFF' },
    ],
  },
  {
    key: 'community',
    title: 'Kör\ntillsammans',
    body: 'Skapa grupper, följ dina vänner och peppa varandras pass med gillanden och kommentarer. Allt är roligare när fler kör.',
    bubbles: [
      { icon: 'people-outline',     color: '#66BB6A' },
      { icon: 'heart-outline',      color: '#FF3B4A' },
      { icon: 'chatbubble-outline', color: '#00BCD4' },
    ],
  },
]

export default function Welcome() {
  const [index, setIndex] = useState(0)
  const dirRef = useRef<1 | -1>(1)
  const [dayModalVisible, setDayModalVisible] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const isLast = index === SLIDES.length - 1
  const slide = SLIDES[index]

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

      {/* Fem segment som fylls i takt med bläddringen */}
      <View style={s.progressRow} pointerEvents="none">
        {SLIDES.map((sl, i) => (
          <View key={sl.key} style={s.progressTrack}>
            {i <= index && <View style={s.progressFill} />}
          </View>
        ))}
      </View>

      {/* Slidens innehåll släpper igenom tryck till zonerna under */}
      <View style={[s.content, isLast && { paddingBottom: 210 }]} pointerEvents="none">
        <Animated.View
          key={slide.key}
          entering={(dirRef.current === 1 ? FadeInRight : FadeInLeft).duration(260)}
          style={s.slide}
        >
          {slide.key === 'brand' ? (
            <>
              <View style={s.titleRow}>
                <Text style={s.appName}>SeventyFive</Text>
                <Text style={s.byNawton}>by Nawton</Text>
              </View>
              <Text style={s.tagline}>75 dagar. 5 uppgifter. Inga undantag.</Text>
              <Text style={s.body}>{slide.body}</Text>
              <View style={s.bubbleRow}>
                {TASKS.map(t => (
                  <View key={t.icon} style={[s.bubble, { backgroundColor: t.color + '1A' }]}>
                    <Ionicons name={t.icon} size={22} color={t.color} />
                  </View>
                ))}
              </View>
              <Text style={s.hint}>Tryck på höger sida för att bläddra</Text>
            </>
          ) : (
            <>
              {slide.key === 'tasks' ? (
                <View style={s.taskList}>
                  {TASKS.map(t => (
                    <View key={t.icon} style={s.taskRow}>
                      <View style={[s.bubble, { backgroundColor: t.color + '1A' }]}>
                        <Ionicons name={t.icon} size={22} color={t.color} />
                      </View>
                      <Text style={s.taskLabel}>{t.label}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={s.bubbleRow}>
                  {slide.bubbles?.map(b => (
                    <View key={b.icon} style={[s.bubbleBig, { backgroundColor: b.color + '1A' }]}>
                      <Ionicons name={b.icon} size={30} color={b.color} />
                    </View>
                  ))}
                </View>
              )}
              <Text style={s.slideTitle}>{slide.title}</Text>
              <Text style={s.body}>{slide.body}</Text>
            </>
          )}
        </Animated.View>
      </View>

      {/* Sista sliden: vägarna in — ovanpå tryckzonerna */}
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

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  // Tryckzoner — under innehållet, hela skärmen
  tapRow:  { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  tapZone: { flex: 1 },

  // Story-progress
  progressRow: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: 20, paddingTop: 10,
  },
  progressTrack: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden',
  },
  progressFill: { flex: 1, borderRadius: 2, backgroundColor: ACCENT },

  content: {
    flex: 1, paddingHorizontal: 28,
    justifyContent: 'center', paddingBottom: 60,
  },
  slide: { gap: 18 },

  // Brand-sliden
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  appName: {
    color: '#FFFFFF', fontSize: 42, fontWeight: '800',
    letterSpacing: -1, lineHeight: 44,
  },
  byNawton: { color: ACCENT, fontSize: 13, fontWeight: '600', letterSpacing: 0.3, paddingBottom: 6 },
  tagline:  { color: '#8A8A8E', fontSize: 15, fontWeight: '600' },
  hint:     { color: '#555', fontSize: 12, marginTop: 10 },

  // Innehållsslides
  slideTitle: {
    color: '#FFFFFF', fontSize: 34, fontWeight: '800',
    letterSpacing: -0.5, lineHeight: 40,
  },
  body: { color: '#9A9AA0', fontSize: 15, lineHeight: 23 },

  bubbleRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  bubble: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  bubbleBig: {
    width: 62, height: 62, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },

  taskList: { gap: 12, marginBottom: 6 },
  taskRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  taskLabel: { color: '#EDEDEF', fontSize: 16, fontWeight: '600' },

  // CTA-lagret på sista sliden
  ctas: {
    position: 'absolute', left: 28, right: 28, bottom: 36, gap: 12,
  },
  primaryBtn: {
    backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 14,
  },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  secondaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  tertiaryBtn: { paddingVertical: 6, alignItems: 'center' },
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
