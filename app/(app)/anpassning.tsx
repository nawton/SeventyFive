import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, Switch, ScrollView, StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { GlassSegment } from '@/components/GlassSegment'
import { getUnitSystem, setUnitSystem, type UnitSystem } from '@/lib/units'
import { getTabBarShrinkEnabled, setTabBarShrinkEnabled } from '@/lib/tabBar'
import {
  getCardioStatsTheme, setCardioStatsTheme, type CardioStatsTheme,
  getVoiceCues, setVoiceCues,
  getDefaultMapStyle, setDefaultMapStyle, type MapStyleKey,
} from '@/lib/prefs'

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
  const [mapStyle, setMapStyle]     = useState<MapStyleKey>('satellite')

  useEffect(() => {
    getTabBarShrinkEnabled().then(setNavShrink)
    getUnitSystem().then(setUnit)
    getCardioStatsTheme().then(setStatsTheme)
    getVoiceCues().then(setVoice)
    getDefaultMapStyle().then(setMapStyle)
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
            <Text style={s.segHint}>Gäller i hela appen: pass, statistik och rekord</Text>
          </View>
        </Section>

        {/* Cardio */}
        <Section title="Cardio">
          <View style={[s.segBlock, s.rowBorder]}>
            <View style={s.segLabelRow}>
              <Ionicons name="map-outline" size={20} color={TEXT_SECONDARY} />
              <Text style={s.rowLabel}>Standardkarta</Text>
            </View>
            <GlassSegment
              value={mapStyle}
              options={[
                { key: 'standard',  label: 'Karta' },
                { key: 'satellite', label: 'Satellit' },
                { key: 'terrain',   label: 'Terräng' },
                { key: 'dark',      label: 'Natt' },
              ]}
              onChange={m => { setMapStyle(m); setDefaultMapStyle(m).catch(() => {}) }}
            />
            <Text style={s.segHint}>Kartan som visas när du startar ett cardiopass</Text>
          </View>
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
    backgroundColor: CARD, borderRadius: 16, overflow: 'hidden',
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
})
