import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, Switch, ScrollView, StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { GlassView } from 'expo-glass-effect'
import { LIQUID_GLASS } from '@/lib/glass'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { getUnitSystem, setUnitSystem, type UnitSystem } from '@/lib/units'
import { getTabBarShrinkEnabled, setTabBarShrinkEnabled } from '@/lib/tabBar'
import {
  getCardioStatsTheme, setCardioStatsTheme, type CardioStatsTheme,
  getVoiceCues, setVoiceCues,
} from '@/lib/prefs'

// Glaset måste animeras direkt på den nativa vyn för att linsen ska följa med
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView)

const SEG_SPRING = { damping: 17, stiffness: 240, mass: 0.8 } as const

// =============================================================================
// ANPASSNING — samlade stil- och beteendeinställningar:
// navbar-minimering, enheter (km/miles) och cardio-skärmens utseende/röst.
// =============================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionCard}>{children}</View>
    </View>
  )
}

/** Tvåvals-slider med glastumme (fjädrande) — samma design som enhetsväljaren */
function GlassSegment<T extends string>({
  value, options, onChange,
}: {
  value: T
  options: Array<{ key: T; label: string }>
  onChange: (v: T) => void
}) {
  const [segW, setSegW] = useState(0)
  const idx = Math.max(0, options.findIndex(o => o.key === value))
  const pos = useSharedValue(idx)
  useEffect(() => { pos.value = withSpring(idx, SEG_SPRING) }, [idx])
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value * (segW / options.length) }],
  }))

  function choose(k: T) {
    if (k === value) return
    Haptics.selectionAsync()
    onChange(k)
  }

  return (
    <View style={s.segTrack} onLayout={e => setSegW(e.nativeEvent.layout.width - 6)}>
      {segW > 0 && (LIQUID_GLASS ? (
        <AnimatedGlassView
          glassEffectStyle="regular"
          tintColor={ORANGE}
          style={[s.segThumb, s.segThumbGlass, { width: segW / options.length }, thumbStyle]}
        />
      ) : (
        <Animated.View style={[s.segThumb, { width: segW / options.length }, thumbStyle]} />
      ))}
      {options.map(o => (
        <TouchableOpacity key={o.key} style={s.segBtn} onPress={() => choose(o.key)} activeOpacity={0.8}>
          <Text style={[
            s.segText,
            value === o.key && (LIQUID_GLASS ? s.segTextActiveGlass : s.segTextActive),
          ]}>
            {o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

function SwitchRow({ icon, label, hint, value, onChange, last }: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  hint?: string
  value: boolean
  onChange: (v: boolean) => void
  last?: boolean
}) {
  return (
    <View style={[s.row, !last && s.rowBorder]}>
      <Ionicons name={icon} size={20} color={TEXT_SECONDARY} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {hint && <Text style={s.rowHint}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: BORDER, true: ORANGE }}
        thumbColor="#fff"
      />
    </View>
  )
}

export default function AnpassningScreen() {
  const [navShrink, setNavShrink]   = useState(false)
  const [unit, setUnit]             = useState<UnitSystem>('metric')
  const [statsTheme, setStatsTheme] = useState<CardioStatsTheme>('dark')
  const [voice, setVoice]           = useState(true)

  useEffect(() => {
    getTabBarShrinkEnabled().then(setNavShrink)
    getUnitSystem().then(setUnit)
    getCardioStatsTheme().then(setStatsTheme)
    getVoiceCues().then(setVoice)
  }, [])

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.titleRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={s.title}>Anpassning</Text>
        </View>

        {/* Navbar */}
        <Section title="Navbar">
          <SwitchRow
            icon="resize-outline"
            label="Minimera vid scroll"
            hint="Pillen krymper när du scrollar ner och växer vid scroll upp"
            value={navShrink}
            onChange={v => { setNavShrink(v); setTabBarShrinkEnabled(v) }}
            last
          />
        </Section>

        {/* Enheter */}
        <Section title="Enheter">
          <View style={s.segBlock}>
            <View style={s.segLabelRow}>
              <Ionicons name="speedometer-outline" size={20} color={TEXT_SECONDARY} />
              <Text style={s.rowLabel}>Distans och tempo</Text>
            </View>
            <GlassSegment
              value={unit}
              options={[
                { key: 'metric',   label: 'Kilometer' },
                { key: 'imperial', label: 'Miles' },
              ]}
              onChange={u => { setUnit(u); setUnitSystem(u).catch(() => {}) }}
            />
            <Text style={s.segHint}>Gäller i hela appen — pass, statistik och rekord</Text>
          </View>
        </Section>

        {/* Cardio */}
        <Section title="Cardio">
          <View style={[s.segBlock, s.rowBorder]}>
            <View style={s.segLabelRow}>
              <Ionicons name="contrast-outline" size={20} color={TEXT_SECONDARY} />
              <Text style={s.rowLabel}>Statistikkort under pass</Text>
            </View>
            <GlassSegment
              value={statsTheme}
              options={[
                { key: 'dark',  label: 'Mörkt' },
                { key: 'light', label: 'Ljust' },
              ]}
              onChange={t => { setStatsTheme(t); setCardioStatsTheme(t).catch(() => {}) }}
            />
          </View>
          <SwitchRow
            icon="volume-high-outline"
            label="Röstguidning"
            hint="Läser upp start, kilometersplittar och mål under passet"
            value={voice}
            onChange={v => { setVoice(v); setVoiceCues(v).catch(() => {}) }}
            last
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: TEXT_PRIMARY, fontSize: 28, fontWeight: '700' },

  section: { gap: 8 },
  sectionTitle: {
    color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600',
    letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  rowLabel: { color: TEXT_PRIMARY, fontSize: 15 },
  rowHint: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 3, lineHeight: 16 },

  segBlock: { padding: 16, gap: 12 },
  segLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  segHint: { color: TEXT_SECONDARY, fontSize: 12 },
  segTrack: {
    flexDirection: 'row', height: 44,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 3,
  },
  segThumb: {
    position: 'absolute', left: 3, top: 3, bottom: 3,
    borderRadius: 11, backgroundColor: ORANGE,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  segThumbGlass: { backgroundColor: 'transparent', overflow: 'hidden', shadowOpacity: 0 },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segText: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600' },
  segTextActive: { color: '#000', fontWeight: '700' },
  segTextActiveGlass: { color: '#fff', fontWeight: '700' },
})
