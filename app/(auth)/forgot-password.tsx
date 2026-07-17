import { useState } from 'react'
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
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

export default function ForgotPasswordScreen() {
  const [email, setEmail]     = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)

  async function handleSend() {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed.includes('@')) {
      Alert.alert('Ange din e-postadress')
      return
    }
    setSending(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: 'seventyfive://change-password',
      })
      if (error) throw error
      setSent(true)
    } catch (e: any) {
      Alert.alert('Kunde inte skicka', e.message ?? 'Försök igen om en stund.')
    } finally {
      setSending(false)
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.body}>
          {sent ? (
            <>
              <View style={s.bigIcon}>
                <Ionicons name="mail-open-outline" size={40} color={ORANGE} />
              </View>
              <Text style={s.title}>Kolla din mejl</Text>
              <Text style={s.sub}>
                Vi har skickat en återställningslänk till{'\n'}
                <Text style={{ color: TEXT_PRIMARY, fontWeight: '600' }}>{email.trim()}</Text>
                {'\n\n'}Öppna länken på den här enheten så får du välja ett nytt lösenord.
              </Text>
              <TouchableOpacity style={s.primaryBtn} onPress={() => router.back()} activeOpacity={0.85}>
                <Text style={s.primaryBtnText}>Tillbaka till inloggning</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={s.bigIcon}>
                <Ionicons name="lock-closed-outline" size={40} color={ORANGE} />
              </View>
              <Text style={s.title}>Glömt lösenordet?</Text>
              <Text style={s.sub}>
                Ange din e-postadress så skickar vi en länk där du kan välja ett nytt.
              </Text>

              <View style={s.inputWrapper}>
                <Ionicons name="mail-outline" size={18} color={TEXT_SECONDARY} />
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="din@mejl.se"
                  placeholderTextColor={TEXT_SECONDARY}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[s.primaryBtn, sending && { opacity: 0.6 }]}
                onPress={handleSend}
                disabled={sending}
                activeOpacity={0.85}
              >
                {sending
                  ? <ActivityIndicator color="#000" />
                  : <Text style={s.primaryBtnText}>Skicka återställningslänk</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 32, gap: 14 },
  bigIcon: {
    width: 84, height: 84, borderRadius: 42, alignSelf: 'center',
    backgroundColor: ORANGE + '18',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  title: { color: TEXT_PRIMARY, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  sub:   { color: TEXT_SECONDARY, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, marginTop: 10,
  },
  input: { flex: 1, color: TEXT_PRIMARY, fontSize: 16, paddingVertical: 14 },
  primaryBtn: {
    backgroundColor: ORANGE, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
})
