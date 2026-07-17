import { useEffect, useState } from 'react'
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
import { router, useLocalSearchParams } from 'expo-router'
import { useURL } from 'expo-linking'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

/** Plockar ut auth-tokens ur deep link-fragmentet (#access_token=…&refresh_token=…) */
function parseTokens(url: string): { access_token: string; refresh_token: string } | null {
  const frag = url.split('#')[1]
  if (!frag) return null
  const params = new URLSearchParams(frag)
  const access_token  = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  return access_token && refresh_token ? { access_token, refresh_token } : null
}

export default function ChangePasswordScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>()
  const url = useURL()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [saving, setSaving]     = useState(false)
  // 'checking' tills vi vet om en session finns (via deep link-tokens eller inloggning)
  const [status, setStatus] = useState<'checking' | 'ready' | 'no-session'>('checking')

  useEffect(() => {
    async function establishSession() {
      // 1) Kom vi via återställningslänken? Sätt sessionen från tokens i URL:en
      const tokens = url ? parseTokens(url) : null
      if (tokens) {
        const { error } = await supabase.auth.setSession(tokens)
        if (!error) { setStatus('ready'); return }
      }
      // 2) Annars: redan inloggad (Byt lösenord från profilen)
      const { data: { session } } = await supabase.auth.getSession()
      setStatus(session ? 'ready' : 'no-session')
    }
    establishSession()
  }, [url])

  async function handleSave() {
    if (password.length < 6) {
      Alert.alert('För kort lösenord', 'Lösenordet måste vara minst 6 tecken.')
      return
    }
    if (password !== confirm) {
      Alert.alert('Lösenorden matchar inte', 'Kontrollera att du skrivit samma lösenord två gånger.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      Alert.alert('Lösenordet är ändrat', 'Använd ditt nya lösenord nästa gång du loggar in.', [
        {
          text: 'OK',
          onPress: () => {
            if (from === 'profile') router.back()
            else router.replace('/(app)/dashboard')
          },
        },
      ])
    } catch (e: any) {
      Alert.alert('Kunde inte byta lösenord', e.message ?? 'Försök igen.')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'checking') {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  if (status === 'no-session') {
    return (
      <SafeAreaView style={s.screen}>
        <View style={[s.body, { justifyContent: 'center' }]}>
          <View style={s.bigIcon}>
            <Ionicons name="alert-circle-outline" size={40} color={ORANGE} />
          </View>
          <Text style={s.title}>Länken har gått ut</Text>
          <Text style={s.sub}>
            Återställningslänkar är giltiga en begränsad tid. Begär en ny från inloggningssidan.
          </Text>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={s.primaryBtnText}>Till inloggningen</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        {from === 'profile' ? (
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
        <Text style={s.headerTitle}>Nytt lösenord</Text>
        <TouchableOpacity
          style={[s.checkBtn, !(password.length >= 6 && password === confirm) && s.checkBtnDisabled]}
          onPress={handleSave}
          disabled={saving || !(password.length >= 6 && password === confirm)}
          activeOpacity={0.7}
        >
          {saving
            ? <ActivityIndicator color={ORANGE} size="small" />
            : <Ionicons name="checkmark" size={22} color={password.length >= 6 && password === confirm ? ORANGE : TEXT_SECONDARY} />}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.body}>
          <Text style={s.fieldLabel}>NYTT LÖSENORD</Text>
          <View style={s.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color={TEXT_SECONDARY} />
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Minst 6 tecken"
              placeholderTextColor={TEXT_SECONDARY}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={8}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={TEXT_SECONDARY} />
            </TouchableOpacity>
          </View>

          <Text style={[s.fieldLabel, { marginTop: 14 }]}>BEKRÄFTA LÖSENORD</Text>
          <View style={s.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color={TEXT_SECONDARY} />
            <TextInput
              style={s.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Samma lösenord igen"
              placeholderTextColor={TEXT_SECONDARY}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
            {confirm.length > 0 && (
              <Ionicons
                name={confirm === password ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={confirm === password ? '#4CAF50' : '#E53935'}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  checkBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: ORANGE + '60',
  },
  checkBtnDisabled: { borderColor: BORDER },
  body: { paddingHorizontal: 20, paddingTop: 24, gap: 8, flex: 1 },
  bigIcon: {
    width: 84, height: 84, borderRadius: 42, alignSelf: 'center',
    backgroundColor: ORANGE + '18',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  title: { color: TEXT_PRIMARY, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  sub:   { color: TEXT_SECONDARY, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  fieldLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, paddingHorizontal: 4,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14,
  },
  input: { flex: 1, color: TEXT_PRIMARY, fontSize: 16, paddingVertical: 14 },
  primaryBtn: {
    backgroundColor: ORANGE, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 12,
  },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
})
