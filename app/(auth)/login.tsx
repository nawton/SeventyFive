import { useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import { LinearGradient } from 'expo-linear-gradient'
import { signInWithGoogle } from '@/lib/oauth'
import { supabase } from '@/lib/supabase'
import { updateProfile } from '@/services/profile'
import { AppTextInput } from '@/components/AppTextInput'
import { useT } from '@/lib/i18n'

type Mode = 'login' | 'register'

// Samma palett som onboardingen — sidorna ska kännas som ett flöde
const NAVY      = '#05080F'
const NAVY_TOP  = '#080D18'
const EDGE      = 'rgba(255,255,255,0.08)'
const OFFWHITE  = '#F4F5FA'
const MUTED     = 'rgba(244,245,250,0.62)'
const ORANGE      = '#FFA817'
const ORANGE_DEEP = '#FF7A1A'

export default function LoginScreen() {
  const t = useT()
  const insets = useSafeAreaInsets()
  const { startDay, mode: modeParam } = useLocalSearchParams<{ startDay?: string; mode?: string }>()
  // Välkomstsidans "Registrera dig" landar direkt i registreringsläget
  const [mode, setMode] = useState<Mode>(modeParam === 'register' ? 'register' : 'login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const emailRef    = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)

  async function handleGoogle() {
    setGoogleLoading(true)
    try {
      const ok = await signInWithGoogle()
      if (ok) {
        // Samma routing som e-post: vald startdag ska följa med in i quizet
        router.replace(
          startDay
            ? { pathname: '/(auth)/quiz', params: { startDay } }
            : '/(app)/dashboard'
        )
      } else {
        Alert.alert(t('Google-inloggning misslyckades'), t('Försök igen.'))
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  async function handleSubmit() {
    const trimmedEmail = email.trim()
    const trimmedName  = name.trim()

    if (mode === 'register' && !trimmedName) {
      Alert.alert(t('Fyll i ditt namn'))
      return
    }
    if (!trimmedEmail || !password) {
      Alert.alert(t('Fyll i email och lösenord'))
      return
    }
    if (mode === 'register' && password.length < 8) {
      Alert.alert(t('Lösenordet är för kort'), t('Använd minst 8 tecken.'))
      return
    }

    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })
      if (error) {
        const msg = error.message.includes('Email not confirmed')
          ? t('Du behöver bekräfta din e-post. Kolla din inkorg.')
          : error.message.includes('Invalid login credentials')
          ? t('Fel e-post eller lösenord.')
          : error.message
        Alert.alert(t('Inloggning misslyckades'), msg)
      } else {
        // For login, dashboard decides routing (challenge may already exist)
        router.replace(
          startDay
            ? { pathname: '/(auth)/quiz', params: { startDay } }
            : '/(app)/dashboard'
        )
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      })
      if (error) {
        Alert.alert(t('Registrering misslyckades'), error.message)
      } else {
        if (data.user) {
          try { await updateProfile(data.user.id, { name: trimmedName }) } catch { /* non-blocking */ }
        }
        if (data.session) {
          // Ingen e-postbekräftelse krävs — hoppa direkt in i onboardingen
          router.replace({
            pathname: '/(auth)/quiz',
            params: startDay ? { startDay } : {},
          })
        } else {
          setName('')
          setPassword('')
          setMode('login')
          Alert.alert(
            t('Bekräfta din e-post'),
            t('Vi har skickat en länk till din inkorg. Klicka på den och logga sedan in här.')
          )
        }
      }
    }

    setLoading(false)
  }

  function switchMode() {
    setMode(m => m === 'login' ? 'register' : 'login')
    setName('')
    setEmail('')
    setPassword('')
  }

  return (
    <View style={styles.screen}>
      {/* Samma mörka marinblå bas som onboardingen */}
      <LinearGradient colors={[NAVY_TOP, NAVY]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.topBar, { marginTop: insets.top + 6 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={OFFWHITE} />
          </TouchableOpacity>
        </View>

        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Text style={styles.brandName}>{t('SeventyFive')}</Text>
              <Text style={styles.brandBy}>{t('by Nawton')}</Text>
            </View>
            <Text style={styles.title}>
              {mode === 'login' ? t('Logga in') : t('Skapa ditt konto')}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'login'
                ? t('Fortsätt din resa, en dag i taget.')
                : t('Din resa börjar här.')}
            </Text>
          </View>

          <View style={styles.form}>
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogle}
              disabled={googleLoading}
              activeOpacity={0.8}
            >
              {googleLoading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleText}>{t('Fortsätt med Google')}</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('eller')}</Text>
              <View style={styles.dividerLine} />
            </View>

            {mode === 'register' && (
              <AppTextInput
                style={styles.input}
                placeholder={t('Ditt namn')}
                placeholderTextColor="rgba(244,245,250,0.35)"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            )}
            <AppTextInput
              ref={emailRef}
              style={styles.input}
              placeholder={t('Email')}
              placeholderTextColor="rgba(244,245,250,0.35)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <AppTextInput
              ref={passwordRef}
              style={styles.input}
              placeholder={t('Lösenord')}
              placeholderTextColor="rgba(244,245,250,0.35)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
              style={loading && styles.disabled}
            >
              <LinearGradient
                colors={[ORANGE, ORANGE_DEEP]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.primaryButton}
              >
                {loading ? (
                  <ActivityIndicator color={NAVY} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {mode === 'login' ? t('Logga in') : t('Registrera dig')}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.links}>
            {mode === 'login' && (
              <TouchableOpacity
                style={styles.switchButton}
                onPress={() => router.push('/(auth)/forgot-password')}
              >
                <Text style={styles.switchText}>{t('Glömt lösenordet?')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.switchPill} onPress={switchMode}>
              <Text style={styles.switchPillText}>
                {mode === 'login'
                  ? <>{t('Inget konto?')} <Text style={styles.switchPillAction}>{t('Registrera dig')}</Text></>
                  : <>{t('Har du ett konto?')} <Text style={styles.switchPillAction}>{t('Logga in')}</Text></>}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NAVY },

  topBar: { paddingHorizontal: 20, height: 40, justifyContent: 'center' },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },

  container: {
    flex: 1, paddingHorizontal: 26,
    justifyContent: 'center', gap: 28, paddingBottom: 40,
  },

  header:   { gap: 6 },
  brandRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 },
  brandName: { color: 'rgba(244,245,250,0.55)', fontSize: 14, fontWeight: '800' },
  brandBy:   { color: ORANGE, fontSize: 11, fontWeight: '600' },
  title: {
    color: OFFWHITE, fontSize: 30, fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: { color: MUTED, fontSize: 14 },

  form: { gap: 12 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: EDGE,
    borderRadius: 16,
    paddingVertical: 15, paddingHorizontal: 18,
    color: OFFWHITE, fontSize: 16,
  },
  primaryButton: {
    borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 4,
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28, shadowRadius: 14,
  },
  disabled: { opacity: 0.6 },
  primaryButtonText: { color: NAVY, fontSize: 16, fontWeight: '800' },

  googleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 999, paddingVertical: 14,
  },
  googleIcon: { fontSize: 16, fontWeight: '700', color: '#4285F4' },
  googleText: { color: '#000000', fontSize: 15, fontWeight: '600' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: EDGE },
  dividerText: { color: MUTED, fontSize: 13 },

  links: { gap: 12, alignItems: 'center' },
  switchButton: { alignItems: 'center' },
  switchText:   { color: 'rgba(244,245,250,0.8)', fontSize: 14, fontWeight: '600' },
  switchPill: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 999,
    borderWidth: 1, borderColor: EDGE,
    paddingHorizontal: 18, paddingVertical: 11,
  },
  switchPillText:   { color: MUTED, fontSize: 14, fontWeight: '600' },
  switchPillAction: { color: ORANGE, fontWeight: '800' },
})
