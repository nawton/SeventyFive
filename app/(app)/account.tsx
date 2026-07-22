import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable,
  TextInput, Keyboard, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { getProfile, updateProfile } from '@/services/profile'
import { setBodyWeightKg } from '@/lib/prefs'
import { splitName, combineName } from '@/lib/profileName'
import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { TAB_CONTENT_PAD } from '@/lib/glass'
import { GlassPill } from '@/components/GlassButton'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Picker } from '@react-native-picker/picker'

// =============================================================================
// PROFILINSTÄLLNINGAR — namn, födelsedatum, kön, vikt, längd och konto.
// Namn skrivs inline med Apples tangentbord; datum/vikt/längd öppnar en
// flytande hjulpanel. Båda får en flytande "Klar"-pill i liquid glass med
// iOS-systemblått (som referensens tangentbordsknapp). Vikten speglas till
// kaloriberäkningens lokala inställning. Språket är låst till svenska tills
// fler språk finns.
// =============================================================================

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

const KG_PER_LB = 0.45359237
const WEIGHTS_KG = range(30, 200)
const WEIGHTS_LB = range(66, 440)
const HEIGHTS = range(120, 220)

/** Delar upp t.ex. 75,96 i hjuldelar {int: 76, dec: 0} med tiondelscarry */
function wheelParts(v: number) {
  const r = Math.round(v * 10) / 10
  let int = Math.floor(r)
  let dec = Math.round((r - int) * 10)
  if (dec === 10) { int += 1; dec = 0 }
  return { int, dec }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

type SheetKind = null | 'birth' | 'weight' | 'height'

// Utanför skärmkomponenten — en inline-definierad Row blir en NY komponenttyp
// varje render, vilket monterar om raderna i onödan (och kan sluka tryck som
// landar mitt i en omrendering)
function Row({ label, value, onPress, locked, chevron = true }: {
  label: string; value: string; onPress?: () => void; locked?: boolean; chevron?: boolean
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
        : onPress && chevron && <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />}
    </TouchableOpacity>
  )
}

/** Flytande Klar-knapp — liquid glass i iOS-systemblått, dragbar som Apples egen */
function KlarPill({ onPress }: { onPress: () => void }) {
  return (
    <GlassPill
      onPress={onPress}
      draggable
      style={styles.klarPill}
      tint="rgba(10,132,255,0.75)"
      fallbackStyle={styles.klarFallback}
    >
      <Text style={styles.klarPillText}>Klar</Text>
    </GlassPill>
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
  const [nameFocus, setNameFocus] = useState(false)

  // Utkast — committas först på Klar. Apples inbyggda hjul används rakt av.
  const [dDate, setDDate] = useState(new Date(2000, 0, 9))
  const [wUnit, setWUnit] = useState<'kg' | 'lb'>('kg')
  const [wInt, setWInt] = useState(75)
  const [wDec, setWDec] = useState(0)
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

  // Klar-pillen ovanför tangentbordet försvinner när tangentbordet gör det,
  // oavsett hur det stängdes (Klar, retur eller tryck utanför)
  useEffect(() => {
    const ev = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const sub = Keyboard.addListener(ev, () => setNameFocus(false))
    return () => sub.remove()
  }, [])

  function save(updates: Parameters<typeof updateProfile>[1]) {
    if (!userId) return
    updateProfile(userId, updates).catch(() => {})
  }

  function saveNames() {
    save({ name: combineName(first, last) })
  }
  function doneEditingNames() {
    Keyboard.dismiss()
    setNameFocus(false)
    saveNames()
  }

  // ── Hjulpaneler ────────────────────────────────────────────────────────────

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

  function setWeightWheels(value: number, unit: 'kg' | 'lb') {
    const list = unit === 'kg' ? WEIGHTS_KG : WEIGHTS_LB
    const { int, dec } = wheelParts(value)
    setWInt(clamp(int, list[0], list[list.length - 1]))
    setWDec(dec)
  }
  function openWeight() {
    const kg = weightKg ?? 75
    setWeightWheels(wUnit === 'lb' ? kg / KG_PER_LB : kg, wUnit)
    setSheet('weight')
  }
  /** Byte av enhet i hjulet räknar om det redan valda värdet */
  function changeWeightUnit(next: 'kg' | 'lb') {
    if (next === wUnit) return
    const current = wInt + wDec / 10
    const converted = next === 'lb' ? current / KG_PER_LB : current * KG_PER_LB
    setWUnit(next)
    setWeightWheels(converted, next)
  }
  function saveWeight() {
    const value = wInt + wDec / 10
    const kg = Math.round((wUnit === 'lb' ? value * KG_PER_LB : value) * 10) / 10
    setWeightKg(kg)
    save({ weight_kg: kg })
    setBodyWeightKg(kg).catch(() => {})   // kaloriberäkningen läser härifrån
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

  const birthLabel  = birthDate ?? 'Ej angivet'
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
              onFocus={() => setNameFocus(true)}
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
              onFocus={() => setNameFocus(true)}
              onBlur={saveNames}
              returnKeyType="done"
              onSubmitEditing={doneEditingNames}
              placeholder="Lägg till"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
          </View>
          <View style={styles.rowDivider} />
          <Row label="Födelsedatum" value={birthLabel} onPress={openBirth} chevron={false} />
          <View style={styles.rowDivider} />
          <Row label="Kön" value={gender ?? 'Ej angivet'} onPress={() => router.push('/gender' as never)} />
          <View style={styles.rowDivider} />
          <Row label="Vikt" value={weightLabel} onPress={openWeight} chevron={false} />
          <View style={styles.rowDivider} />
          <Row label="Längd" value={heightLabel} onPress={openHeight} chevron={false} />
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

      {/* ── Flytande hjulpanel med Klar-pill (som referensen) — Klar committar,
          tryck utanför stänger utan att spara ── */}
      <Modal visible={sheet !== null} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable testID="sheetOverlay" style={styles.overlay} onPress={() => setSheet(null)}>
          <View style={styles.floatWrap} pointerEvents="box-none">
            <KlarPill onPress={sheet === 'birth' ? saveBirth : sheet === 'weight' ? saveWeight : saveHeight} />
            <Pressable style={styles.pickerPanel} onPress={() => {}}>
              {sheet === 'birth' && (
                <DateTimePicker
                  testID="birthPicker"
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
                    testID="weightIntPicker"
                    selectedValue={wInt}
                    onValueChange={v => setWInt(Number(v))}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    {(wUnit === 'kg' ? WEIGHTS_KG : WEIGHTS_LB).map(w =>
                      <Picker.Item key={w} label={String(w)} value={w} />)}
                  </Picker>
                  <Picker
                    testID="weightDecPicker"
                    selectedValue={wDec}
                    onValueChange={v => setWDec(Number(v))}
                    style={styles.pickerNarrow}
                    itemStyle={styles.pickerItem}
                  >
                    {range(0, 9).map(d => <Picker.Item key={d} label={`,${d}`} value={d} />)}
                  </Picker>
                  <Picker
                    testID="weightUnitPicker"
                    selectedValue={wUnit}
                    onValueChange={v => changeWeightUnit(v as 'kg' | 'lb')}
                    style={styles.pickerNarrow}
                    itemStyle={styles.pickerItem}
                  >
                    <Picker.Item label="kg" value="kg" />
                    <Picker.Item label="lb" value="lb" />
                  </Picker>
                </View>
              )}

              {sheet === 'height' && (
                <View style={styles.pickerRow}>
                  <Picker
                    testID="heightPicker"
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

      {/* Flytande Klar ovanför Apples tangentbord vid namnredigering */}
      {nameFocus && (
        <KeyboardAvoidingView
          style={styles.klarWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <KlarPill onPress={doneEditingNames} />
        </KeyboardAvoidingView>
      )}
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
  klarFallback: { backgroundColor: '#0A84FF' },
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
