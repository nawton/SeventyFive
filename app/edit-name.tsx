import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { getProfile, updateProfile } from '@/services/profile'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

const MAX_NAME_LENGTH = 40

export default function EditNameScreen() {
  const [name, setName]       = useState('')
  const [initial, setInitial] = useState('')
  const [userId, setUserId]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        setUserId(session.user.id)
        const profile = await getProfile(session.user.id)
        if (profile?.name) { setName(profile.name); setInitial(profile.name) }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const trimmed  = name.trim()
  const canSave  = trimmed.length > 0 && trimmed !== initial && !saving

  async function handleSave() {
    if (!trimmed) { Alert.alert('Ange ett namn'); return }
    if (!userId) return
    setSaving(true)
    try {
      await updateProfile(userId, { name: trimmed })
      router.back()
    } catch (e: any) {
      Alert.alert('Något gick fel', e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>

      {/* ── Header: tillbaka · titel · bock ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.title}>Visningsnamn</Text>
        <TouchableOpacity
          style={[styles.checkBtn, !canSave && styles.checkBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
          activeOpacity={0.7}
        >
          {saving
            ? <ActivityIndicator color={ORANGE} size="small" />
            : <Ionicons name="checkmark" size={22} color={canSave ? ORANGE : TEXT_SECONDARY} />}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          <Text style={styles.fieldLabel}>VISNINGSNAMN</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={18} color={TEXT_SECONDARY} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ditt namn"
              placeholderTextColor={TEXT_SECONDARY}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={MAX_NAME_LENGTH}
              autoFocus
            />
            {name.length > 0 && (
              <TouchableOpacity onPress={() => setName('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.hint}>
            Namnet visas på din profil och på dashboarden. {name.length}/{MAX_NAME_LENGTH}
          </Text>
        </View>
      </KeyboardAvoidingView>

    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: BG,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  checkBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center',
  },
  checkBtnDisabled: { backgroundColor: CARD },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  body: { paddingHorizontal: 20, paddingTop: 24, gap: 8 },
  fieldLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, paddingHorizontal: 4,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD, borderRadius: 12, paddingHorizontal: 14,
  },
  input: { flex: 1, color: TEXT_PRIMARY, fontSize: 16, paddingVertical: 14 },
  hint:  { color: TEXT_SECONDARY, fontSize: 12, paddingHorizontal: 4, marginTop: 2 },
})
