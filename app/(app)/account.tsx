import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable,
  TextInput, Keyboard,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { getProfile, updateProfile } from '@/services/profile'
import { setBodyWeightKg } from '@/lib/prefs'
import { splitName, combineName } from '@/lib/profileName'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { TAB_CONTENT_PAD } from '@/lib/glass'
import { GlassPill } from '@/components/GlassButton'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Picker } from '@react-native-picker/picker'

// =============================================================================
// PROFILINSTÄLLNINGAR — namn, födelsedatum, kön, vikt, längd och konto.
// Datum/vikt/längd väljs med hjulväljare (iOS-pickerkänslan). Vikten speglas
// till kaloriberäkningens lokala inställning. Språket är låst till svenska
// tills fler språk finns.
// =============================================================================

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

type SheetKind = null | 'birth' | 'weight' | 'height'

// Utanför skärmkomponenten — en inline-definierad Row blir en NY komponenttyp
// varje render, vilket monterar om raderna i onödan (och kan sluka tryck som
// landar mitt i en omrendering)
function Row({ label, value, onPress, locked }: {
  label: string; value: string; onPress?: () => void; locked?: boolean
}) {
  return (
    <TouchableOpacity
      style={[styles.row, locked && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
      {locked
        ? <Ionicons name="lock-closed-outline" size={14} color={TEXT_SECONDARY} />
        : onPress && <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />}
    </TouchableOpacity>
  )
}

export default function AccountScreen() {
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail]   = useState('')
  const [first, setFirst]   = useState('')
  const [last, setLast]     = useState('')
  const [birthDate, setBirthDate] = useState<string | null>(null)   // YYYY-MM-DD
  const [gender, setGender]       = useState<string | null>(null)
  const [weightKg, setWeightKg]   = useState<number | null>(null)
  const [heightCm, setHeightCm]   = useState<number | null>(null)

  const [sheet, setSheet] = useState<SheetKind>(null)

  // Utkast — committas först på Klar. Apples inbyggda hjul används rakt av.
  const [dDate, setDDate] = useState(new Date(2000, 0, 9))
  const WEIGHTS = range(30, 200)
  const [wInt, setWInt] = useState(75)
  const [wDec, setWDec] = useState(0)
  const HEIGHTS = range(120, 220)
  const [hCm, setHCm] = useState(175)

  useFocusEffect(useCallback(() => {
    let alive = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user || !alive) return
      setUserId(session.user.id)
      setEmail(session.user.email ?? '')
      getProfile(session.user.id).then(p => {
        if (!alive || !p) return
        const parts = splitName(p.name)
        setFirst(parts.first)
        setLast(parts.last)
        setBirthDate(p.birth_date ?? null)
        setGender(p.gender ?? null)
        setWeightKg(p.weight_kg != null ? Number(p.weight_kg) : null)
        setHeightCm(p.height_cm ?? null)
      }).catch(() => {})
    })
    return () => { alive = false }
  }, []))

  function save(updates: Parameters<typeof updateProfile>[1]) {
    if (!userId) return
    updateProfile(userId, updates).catch(() => {})
  }

  function saveNames() {
    save({ name: combineName(first, last) })
  }
  function doneEditingNames() {
    Keyboard.dismiss()
    saveNames()
  }

  // ── Sheets ─────────────────────────────────────────────────────────────────

  function openBirth() {
    setDDate(birthDate ? new Date(birthDate + 'T12:00:00') : new Date(2000, 0, 9))
    setSheet('birth')
  }
  function saveBirth() {
    const iso = `${dDate.getFullYear()}-${String(dDate.getMonth() + 1).padStart(2, '0')}-${String(dDate.getDate()).padStart(2, '0')}`
    setBirthDate(iso)
    save({ birth_date: iso })
    setSheet(null)
  }

  function openWeight() {
    const w = weightKg ?? 75
    setWInt(Math.min(200, Math.max(30, Math.floor(w))))
    setWDec(Math.round((w % 1) * 10) % 10)
    setSheet('weight')
  }
  function saveWeight() {
    const w = wInt + wDec / 10
    setWeightKg(w)
    save({ weight_kg: w })
    setBodyWeightKg(w).catch(() => {})   // kaloriberäkningen läser härifrån
    setSheet(null)
  }

  function openHeight() {
    setHCm(heightCm ?? 175)
    setSheet('height')
  }
  function saveHeight() {
    setHeightCm(hCm)
    save({ height_cm: hCm })
    setSheet(null)
  }

  const birthLabel = birthDate ?? 'Ej angivet'
  const weightLabel = weightKg != null ? `${String(weightKg).replace('.', ',')} kg` : 'Ej specificerad'
  const heightLabel = heightCm != null ? `${heightCm} cm` : 'Ej specificerad'

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.title}>Profilinställningar</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.rowsCard}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Förnamn</Text>
            <TextInput
              style={styles.rowInput}
              value={first}
              onChangeText={setFirst}
              onBlur={saveNames}
              returnKeyType="done"
              onSubmitEditing={doneEditingNames}
              placeholder="Lägg till"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Efternamn</Text>
            <TextInput
              style={styles.rowInput}
              value={last}
              onChangeText={setLast}
              onBlur={saveNames}
              returnKeyType="done"
              onSubmitEditing={doneEditingNames}
              placeholder="Lägg till"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
          </View>
          <View style={styles.rowDivider} />
          <Row label="Födelsedatum" value={birthLabel} onPress={openBirth} />
          <View style={styles.rowDivider} />
          <Row label="Kön" value={gender ?? 'Ej angivet'} onPress={() => router.push('/gender' as never)} />
          <View style={styles.rowDivider} />
          <Row label="Vikt" value={weightLabel} onPress={openWeight} />
          <View style={styles.rowDivider} />
          <Row label="Längd" value={heightLabel} onPress={openHeight} />
          <View style={styles.rowDivider} />
          <Row label="Språk" value="Svenska" locked />
        </View>

        <Text style={styles.sectionLabel}>KONTO</Text>
        <View style={styles.rowsCard}>
          <Row label="Lösenord" value="••••••••" onPress={() => router.push('/change-password?from=profile' as never)} />
          <View style={styles.rowDivider} />
          <Row label="E-post" value={email} locked />
        </View>
      </ScrollView>

      {/* ── Flytande panel med Apples hjul + Klar-pill (som förlagan) ── */}
      <Modal visible={sheet !== null} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.overlay} onPress={() => setSheet(null)}>
          <View style={styles.floatWrap} pointerEvents="box-none">
            {/* Som iOS egna Done på sifferknappsatsen: rent liquid glass,
                dragbar (håll och dra — fjädrar tillbaka) */}
            <GlassPill
              onPress={sheet === 'birth' ? saveBirth : sheet === 'weight' ? saveWeight : saveHeight}
              draggable
              style={styles.klarPill}
              tint="transparent"
              fallbackStyle={styles.klarFallback}
            >
              <Text style={styles.klarPillText}>Done</Text>
            </GlassPill>
            <Pressable style={styles.pickerPanel} onPress={() => {}}>
            {sheet === 'birth' && (
              <DateTimePicker
                value={dDate}
                mode="date"
                display="spinner"
                locale="sv-SE"
                themeVariant="dark"
                maximumDate={new Date()}
                onChange={(_e, d) => { if (d) setDDate(d) }}
                style={styles.datePicker}
              />
            )}

            {sheet === 'weight' && (
              <View style={styles.pickerRow}>
                <Picker
                  selectedValue={wInt}
                  onValueChange={v => setWInt(Number(v))}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  {WEIGHTS.map(w => <Picker.Item key={w} label={String(w)} value={w} />)}
                </Picker>
                <Picker
                  selectedValue={wDec}
                  onValueChange={v => setWDec(Number(v))}
                  style={styles.pickerNarrow}
                  itemStyle={styles.pickerItem}
                >
                  {range(0, 9).map(d => <Picker.Item key={d} label={`,${d}`} value={d} />)}
                </Picker>
                <Text style={styles.wheelUnit}>kg</Text>
              </View>
            )}

            {sheet === 'height' && (
              <View style={styles.pickerRow}>
                <Picker
                  selectedValue={hCm}
                  onValueChange={v => setHCm(Number(v))}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  {HEIGHTS.map(h => <Picker.Item key={h} label={String(h)} value={h} />)}
                </Picker>
                <Text style={styles.wheelUnit}>cm</Text>
              </View>
            )}

            </Pressable>
          </View>
        </Pressable>
      </Modal>

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 + TAB_CONTENT_PAD },

  sectionLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, paddingHorizontal: 4, marginTop: 24, marginBottom: 8,
  },
  rowsCard: { backgroundColor: CARD, borderRadius: 14, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 15,
  },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)', marginLeft: 16 },
  rowLabel: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  rowValue: { flex: 1, color: TEXT_SECONDARY, fontSize: 14, textAlign: 'right' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-end' },
  floatWrap: { paddingHorizontal: 8, paddingBottom: 28, alignItems: 'flex-end', gap: 10 },
  pickerPanel: {
    alignSelf: 'stretch',
    backgroundColor: CARD, borderRadius: 28,
    borderWidth: 1, borderColor: BORDER,
    paddingVertical: 10,
  },
  klarWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'flex-end', padding: 14,
  },
  klarPill: { borderRadius: 24, paddingHorizontal: 26, paddingVertical: 12 },
  klarFallback: { backgroundColor: 'rgba(40,40,44,0.96)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  klarPillText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  rowInput: {
    flex: 1, color: TEXT_PRIMARY, fontSize: 15, textAlign: 'right', padding: 0,
  },
  datePicker: { alignSelf: 'center' },
  pickerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  picker: { width: 110, height: 216 },
  pickerNarrow: { width: 80, height: 216 },
  pickerItem: { color: TEXT_PRIMARY, fontSize: 22 },
  wheelUnit: { color: TEXT_SECONDARY, fontSize: 18, fontWeight: '700', marginLeft: 8 },

})
