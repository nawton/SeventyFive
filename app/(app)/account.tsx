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
import DateTimePicker from '@react-native-community/datetimepicker'

// =============================================================================
// PROFILINSTÄLLNINGAR — namn, födelsedatum, kön, vikt, längd och konto.
// Datum/vikt/längd väljs med hjulväljare (iOS-pickerkänslan). Vikten speglas
// till kaloriberäkningens lokala inställning. Språket är låst till svenska
// tills fler språk finns.
// =============================================================================


type SheetKind = null | 'birth'

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

  // Födelsedatum: Apples hjul i panel, sparas direkt vid snurr.
  const [dDate, setDDate] = useState(new Date(2000, 0, 9))
  // Vikt/längd skrivs direkt i raden — sifferknappsatsen ger iOS egna Done-pill
  const [wDraft, setWDraft] = useState('')
  const [hDraft, setHDraft] = useState('')

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
        setWDraft(p.weight_kg != null ? String(Number(p.weight_kg)).replace('.', ',') : '')
        setHDraft(p.height_cm != null ? String(p.height_cm) : '')
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
  function commitBirth(d: Date) {
    setDDate(d)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setBirthDate(iso)
    save({ birth_date: iso })
  }

  function commitWeight() {
    const w = parseFloat(wDraft.replace(',', '.'))
    if (!Number.isFinite(w) || w < 30 || w > 250) { setWDraft(weightKg != null ? String(weightKg).replace('.', ',') : ''); return }
    const rounded = Math.round(w * 10) / 10
    setWeightKg(rounded)
    save({ weight_kg: rounded })
    setBodyWeightKg(rounded).catch(() => {})   // kaloriberäkningen läser härifrån
  }
  function commitHeight() {
    const h = parseInt(hDraft, 10)
    if (!Number.isFinite(h) || h < 100 || h > 250) { setHDraft(heightCm != null ? String(heightCm) : ''); return }
    setHeightCm(h)
    save({ height_cm: h })
  }

  const birthLabel = birthDate ?? 'Ej angivet'

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
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Vikt</Text>
            <TextInput
              style={styles.rowInput}
              value={wDraft}
              onChangeText={v => setWDraft(v.replace(/[^0-9,\.]/g, '').slice(0, 5))}
              onBlur={commitWeight}
              keyboardType="decimal-pad"
              placeholder="Ej specificerad"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
            <Text style={styles.rowUnit}>kg</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Längd</Text>
            <TextInput
              style={styles.rowInput}
              value={hDraft}
              onChangeText={v => setHDraft(v.replace(/[^0-9]/g, '').slice(0, 3))}
              onBlur={commitHeight}
              keyboardType="number-pad"
              placeholder="Ej specificerad"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
            <Text style={styles.rowUnit}>cm</Text>
          </View>
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

      {/* ── Födelsedatum: Apples hjul i flytande panel — sparar direkt vid
          snurr, tryck utanför stänger. Ingen egen knapp. ── */}
      <Modal visible={sheet === 'birth'} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.overlay} onPress={() => setSheet(null)}>
          <View style={styles.floatWrap} pointerEvents="box-none">
            <Pressable style={styles.pickerPanel} onPress={() => {}}>
              <DateTimePicker
                testID="birthPicker"
                value={dDate}
                mode="date"
                display="spinner"
                locale="sv-SE"
                themeVariant="dark"
                maximumDate={new Date()}
                onChange={(_e, d) => { if (d) commitBirth(d) }}
                style={styles.datePicker}
              />
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
  rowInput: {
    flex: 1, color: TEXT_PRIMARY, fontSize: 15, textAlign: 'right', padding: 0,
  },
  rowUnit: { color: TEXT_SECONDARY, fontSize: 14 },
  datePicker: { alignSelf: 'center' },

})
