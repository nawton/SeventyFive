import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '@/lib/supabase'
import { AppTextInput } from '@/components/AppTextInput'

// Samma palett som onboardingen och inloggningen — ett sammanhållet flöde
const NAVY      = '#05080F'
const NAVY_TOP  = '#080D18'
const EDGE      = 'rgba(255,255,255,0.08)'
const OFFWHITE  = '#F4F5FA'
const MUTED     = 'rgba(244,245,250,0.62)'
const ORANGE      = '#FFA817'
const ORANGE_DEEP = '#FF7A1A'
const ORANGE_SOFT = 'rgba(255,168,23,0.14)'

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets()
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
    <View style={s.screen}>
      <LinearGradient colors={[NAVY_TOP, NAVY]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={[s.topBar, { marginTop: insets.top + 6 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={OFFWHITE} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.body}>
          {sent ? (
            <>
              <View style={s.bigIcon}>
                <Ionicons name="mail-open-outline" size={38} color={ORANGE} />
              </View>
              <Text style={s.title}>Kolla din mejl</Text>
              <Text style={s.sub}>
                Vi har skickat en återställningslänk till{'\n'}
                <Text style={s.subStrong}>{email.trim()}</Text>
                {'\n\n'}Öppna länken på den här enheten så får du välja ett nytt lösenord.
              </Text>
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85}>
                <LinearGradient
                  colors={[ORANGE, ORANGE_DEEP]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.primaryBtn}
                >
                  <Text style={s.primaryBtnText}>Tillbaka till inloggning</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={s.bigIcon}>
                <Ionicons name="lock-closed-outline" size={38} color={ORANGE} />
              </View>
              <Text style={s.title}>Glömt lösenordet?</Text>
              <Text style={s.sub}>
                Ange din e-postadress så skickar vi en länk där du kan välja ett nytt.
              </Text>

              <View style={s.inputWrapper}>
                <Ionicons name="mail-outline" size={18} color={MUTED} />
                <AppTextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="din@mejl.se"
                  placeholderTextColor="rgba(244,245,250,0.35)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                onPress={handleSend}
                disabled={sending}
                activeOpacity={0.85}
                style={sending && { opacity: 0.6 }}
              >
                <LinearGradient
                  colors={[ORANGE, ORANGE_DEEP]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.primaryBtn}
                >
                  {sending
                    ? <ActivityIndicator color={NAVY} />
                    : <Text style={s.primaryBtnText}>Skicka återställningslänk</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NAVY },

  topBar: { paddingHorizontal: 20, height: 40, justifyContent: 'center' },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },

  body: { flex: 1, paddingHorizontal: 26, paddingTop: 36, gap: 14 },
  bigIcon: {
    width: 84, height: 84, borderRadius: 42, alignSelf: 'center',
    backgroundColor: ORANGE_SOFT,
    borderWidth: 1.5, borderColor: 'rgba(255,168,23,0.35)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  title: {
    color: OFFWHITE, fontSize: 26, fontWeight: '800',
    letterSpacing: -0.4, textAlign: 'center',
  },
  sub:       { color: MUTED, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  subStrong: { color: OFFWHITE, fontWeight: '700' },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: EDGE,
    borderRadius: 16, paddingHorizontal: 16, marginTop: 10,
  },
  input: { flex: 1, color: OFFWHITE, fontSize: 16, paddingVertical: 15 },

  primaryBtn: {
    borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 8,
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28, shadowRadius: 14,
  },
  primaryBtnText: { color: NAVY, fontSize: 16, fontWeight: '800' },
})
