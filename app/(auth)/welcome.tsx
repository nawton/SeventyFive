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
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated'

const { width } = Dimensions.get('window')

const ORANGE = '#FF8F00'
const BG     = '#111111'
const CARD   = '#1C1C1E'
const BORDER = '#2C2C2E'

const FEATURES = [
  { icon: 'barbell-outline',    label: '2 träningspass per dag',     sub: 'Ett pass kan vara utomhus' },
  { icon: 'restaurant-outline', label: 'Följ din kost strikt',       sub: 'Ingen fuskmat, inga undantag' },
  { icon: 'water-outline',      label: 'Drick 4 liter vatten',       sub: 'Varje dag utan undantag' },
  { icon: 'book-outline',       label: 'Läs 10 sidor',               sub: 'Facklitteratur eller självutveckling' },
  { icon: 'camera-outline',     label: 'Ta ett framstegsfoto',       sub: 'Dokumentera din resa' },
] as const

export default function Welcome() {
  const [dayModalVisible, setDayModalVisible] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  function startFresh() {
    router.push('/(auth)/login')
  }

  function confirmDay() {
    if (!selectedDay) return
    setDayModalVisible(false)
    router.push({ pathname: '/(auth)/login', params: { startDay: String(selectedDay) } })
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Logo ── */}
        <Animated.View entering={FadeIn.duration(600)} style={styles.logoSection}>
          <Text style={styles.brand}>NAWTON</Text>
          <Text style={styles.appName}>SeventyFive</Text>
          <Text style={styles.tagline}>75 dagar. Inga undantag. En ny version av dig.</Text>
        </Animated.View>

        {/* ── What is 75 Hard ── */}
        <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.descCard}>
          <View style={styles.descBadge}>
            <Text style={styles.descBadgeText}>VAD ÄR 75 HARD?</Text>
          </View>
          <Text style={styles.descText}>
            75 Hard är ett mentalt disciplinprogram skapat av Andy Frisella.
            I 75 dagar följer du fem dagliga regler — varje dag, utan undantag.
            Missar du en enda uppgift börjar du om från dag 1.
          </Text>
          <View style={styles.descStat}>
            <Text style={styles.descStatNum}>75</Text>
            <Text style={styles.descStatLabel}>dagar</Text>
            <View style={styles.descStatDivider} />
            <Text style={styles.descStatNum}>5</Text>
            <Text style={styles.descStatLabel}>uppgifter/dag</Text>
            <View style={styles.descStatDivider} />
            <Text style={styles.descStatNum}>0</Text>
            <Text style={styles.descStatLabel}>undantag</Text>
          </View>
        </Animated.View>

        {/* ── Features ── */}
        <Animated.View entering={FadeInDown.duration(500).delay(350)} style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>DAGENS 5 UPPGIFTER</Text>
          <View style={styles.featuresList}>
            {FEATURES.map((f, i) => (
              <Animated.View
                key={f.label}
                entering={FadeInDown.duration(400).delay(400 + i * 80)}
                style={styles.featureRow}
              >
                <View style={styles.featureIcon}>
                  <Ionicons name={f.icon} size={20} color={ORANGE} />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureLabel}>{f.label}</Text>
                  <Text style={styles.featureSub}>{f.sub}</Text>
                </View>
                <View style={styles.featureNum}>
                  <Text style={styles.featureNumText}>{i + 1}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* ── CTAs ── */}
        <Animated.View entering={FadeInUp.duration(500).delay(850)} style={styles.ctaSection}>
          <TouchableOpacity style={styles.primaryBtn} onPress={startFresh} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Starta dag 1 idag</Text>
            <Ionicons name="arrow-forward" size={18} color="#000" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setDayModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={17} color={ORANGE} />
            <Text style={styles.secondaryBtnText}>Jag har redan börjat — välj dag</Text>
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>

      {/* ── Day picker modal ── */}
      <Modal
        visible={dayModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDayModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Vilken dag är du på?</Text>
            <Text style={styles.sheetSub}>Välj din nuvarande dag i utmaningen</Text>

            <ScrollView
              style={styles.dayGrid}
              contentContainerStyle={styles.dayGridContent}
              showsVerticalScrollIndicator={false}
            >
              {Array.from({ length: 74 }, (_, i) => i + 1).map(day => (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayBtn, selectedDay === day && styles.dayBtnActive]}
                  onPress={() => setSelectedDay(day)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayBtnText, selectedDay === day && styles.dayBtnTextActive]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={[styles.confirmBtn, !selectedDay && styles.confirmBtnDisabled]}
                onPress={confirmDay}
                disabled={!selectedDay}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmBtnText}>
                  {selectedDay ? `Fortsätt från dag ${selectedDay}` : 'Välj en dag'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDayModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Avbryt</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: BG },
  scroll:  { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, gap: 28 },

  // Logo
  logoSection: { gap: 10, paddingTop: 8 },
  brand: {
    color: ORANGE, fontSize: 11, fontWeight: '700',
    letterSpacing: 6,
  },
  appName: {
    color: '#FFFFFF', fontSize: 44, fontWeight: '800', lineHeight: 48,
  },
  tagline: {
    color: '#666', fontSize: 15, lineHeight: 22,
  },

  // Description card
  descCard: {
    backgroundColor: CARD, borderRadius: 18,
    borderWidth: 1, borderColor: BORDER,
    padding: 20, gap: 14,
  },
  descBadge: {
    backgroundColor: ORANGE + '20', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: 'flex-start',
    borderWidth: 1, borderColor: ORANGE + '40',
  },
  descBadgeText: {
    color: ORANGE, fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
  },
  descText: {
    color: '#AAAAAA', fontSize: 14, lineHeight: 21,
  },
  descStat: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingTop: 4,
  },
  descStatNum: {
    color: '#FFFFFF', fontSize: 22, fontWeight: '800',
  },
  descStatLabel: {
    color: '#666', fontSize: 11, fontWeight: '500',
  },
  descStatDivider: {
    width: 1, height: 24, backgroundColor: BORDER,
  },

  // Features
  featuresSection: { gap: 14 },
  featuresTitle: {
    color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
  },
  featuresList: { gap: 8 },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: BORDER,
  },
  featureIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: ORANGE + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { flex: 1, gap: 2 },
  featureLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  featureSub:   { color: '#666', fontSize: 12 },
  featureNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  featureNumText: { color: '#888', fontSize: 11, fontWeight: '700' },

  // CTAs
  ctaSection: { gap: 12 },
  primaryBtn: {
    backgroundColor: ORANGE, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14,
  },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5, borderColor: ORANGE + '50',
    backgroundColor: ORANGE + '08',
  },
  secondaryBtnText: { color: ORANGE, fontSize: 15, fontWeight: '600' },

  // Modal
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 20, paddingBottom: 32,
    maxHeight: '75%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: BORDER, alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: {
    color: '#FFF', fontSize: 20, fontWeight: '700', textAlign: 'center',
  },
  sheetSub: {
    color: '#666', fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 16,
  },
  dayGrid:        { maxHeight: 260 },
  dayGridContent: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 8, paddingBottom: 8,
  },
  dayBtn: {
    width: (width - 40 - 8 * 6) / 7,
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: BG,
    borderWidth: 1.5, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  dayBtnActive: {
    backgroundColor: ORANGE + '20', borderColor: ORANGE,
  },
  dayBtnText: { color: '#888', fontSize: 13, fontWeight: '600' },
  dayBtnTextActive: { color: ORANGE, fontWeight: '700' },

  sheetFooter: { gap: 10, marginTop: 16 },
  confirmBtn: {
    backgroundColor: ORANGE, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.35 },
  confirmBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  cancelBtn: {
    borderRadius: 14, paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  cancelBtnText: { color: '#666', fontSize: 14, fontWeight: '500' },
})
