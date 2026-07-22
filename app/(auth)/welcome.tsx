import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated'

const { width } = Dimensions.get('window')

const ORANGE = '#FFA817'
const BG     = '#0A0A0C'
const CARD   = '#1C1C1E'
const BORDER = '#2C2C2E'

const TASK_ICONS = [
  { icon: 'barbell-outline',    color: '#FFA817' },
  { icon: 'restaurant-outline', color: '#66BB6A' },
  { icon: 'water-outline',      color: '#00BCD4' },
  { icon: 'book-outline',       color: '#AB47BC' },
  { icon: 'camera-outline',     color: '#EC407A' },
] as const

export default function Welcome() {
  const [dayModalVisible, setDayModalVisible] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  function confirmDay() {
    if (!selectedDay) return
    setDayModalVisible(false)
    router.push({ pathname: '/(auth)/login', params: { startDay: String(selectedDay) } })
  }

  return (
    <SafeScreen style={s.screen}>
      <View style={s.container}>

        {/* ── Branding ── */}
        <Animated.View entering={FadeIn.duration(700)} style={s.top}>
          <View style={s.titleRow}>
            <Text style={s.appName}>SeventyFive</Text>
            <Text style={s.byNawton}>by Nawton</Text>
          </View>
          <Text style={s.tagline}>75 dagar. 5 uppgifter. Inga undantag.</Text>
          <Text style={s.desc}>
            Utmaningen som förändrar din disciplin, ditt mindset och din kropp — en dag i taget.
          </Text>
        </Animated.View>

        {/* ── Task icon strip ── */}
        <Animated.View entering={FadeInDown.duration(500).delay(250)} style={s.iconStrip}>
          {TASK_ICONS.map((t, i) => (
            <View key={i} style={[s.iconBubble, { backgroundColor: t.color + '1A' }]}>
              <Ionicons name={t.icon} size={22} color={t.color} />
            </View>
          ))}
        </Animated.View>

        {/* ── CTAs ── */}
        <Animated.View entering={FadeInUp.duration(500).delay(400)} style={s.ctas}>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={s.primaryBtnText}>Kom igång</Text>
            <Ionicons name="arrow-forward" size={17} color="#000" />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={() => setDayModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={s.secondaryBtnText}>Jag har redan börjat, välj dag</Text>
          </TouchableOpacity>
        </Animated.View>

      </View>

      {/* ── Day picker modal ── */}
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
  screen:    { flex: 1, backgroundColor: BG },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    gap: 36,
  },

  // Branding
  top: { gap: 14 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 44,
  },
  byNawton: {
    color: ORANGE,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    paddingBottom: 6,
  },
  tagline: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
  },
  desc: {
    color: '#444',
    fontSize: 14,
    lineHeight: 22,
  },

  // Icon strip
  iconStrip: {
    flexDirection: 'row',
    gap: 10,
  },
  iconBubble: {
    width: 48, height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // CTAs
  ctas: { gap: 12 },
  primaryBtn: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
  },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  secondaryBtnText: { color: '#555', fontSize: 14, fontWeight: '500' },

  // Modal
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
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: BORDER, alignSelf: 'center', marginBottom: 20,
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
  dayBtnActive:     { backgroundColor: ORANGE + '26' },
  dayBtnText:       { color: '#888', fontSize: 13, fontWeight: '600' },
  dayBtnTextActive: { color: ORANGE, fontWeight: '700' },

  sheetFooter: { gap: 10, marginTop: 16 },
  confirmBtn: {
    backgroundColor: ORANGE, borderRadius: 14,
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
