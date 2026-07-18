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
import { router, useLocalSearchParams } from 'expo-router'
import { signInWithGoogle } from '@/lib/oauth'
import { supabase } from '@/lib/supabase'
import { updateProfile } from '@/services/profile'
import { ORANGE } from '@/lib/theme'

type Mode = 'login' | 'register'

export default function LoginScreen() {
  const { startDay } = useLocalSearchParams<{ startDay?: string }>()
  const [mode, setMode] = useState<Mode>('login')
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
        Alert.alert('Google-inloggning misslyckades', 'Försök igen.')
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  async function handleSubmit() {
    const trimmedEmail = email.trim()
    const trimmedName  = name.trim()

    if (mode === 'register' && !trimmedName) {
      Alert.alert('Fyll i ditt namn')
      return
    }
    if (!trimmedEmail || !password) {
      Alert.alert('Fyll i email och lösenord')
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
          ? 'Du behöver bekräfta din e-post. Kolla din inkorg.'
          : error.message.includes('Invalid login credentials')
          ? 'Fel e-post eller lösenord.'
          : error.message
        Alert.alert('Inloggning misslyckades', msg)
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
        Alert.alert('Registrering misslyckades', error.message)
      } else {
        if (data.user) {
          try { await updateProfile(data.user.id, { name: trimmedName }) } catch { /* non-blocking */ }
        }
        setName('')
        setPassword('')
        setMode('login')
        Alert.alert('Konto skapat!', 'Logga in med dina uppgifter för att fortsätta.')
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
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>

        <View style={styles.header}>
          <Text style={styles.logo}>NAWTON</Text>
          <Text style={styles.title}>SeventyFive</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'Logga in för att fortsätta' : 'Skapa ditt konto'}
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
                <Text style={styles.googleText}>Fortsätt med Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>eller</Text>
            <View style={styles.dividerLine} />
          </View>

          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder="Ditt namn"
              placeholderTextColor="#555"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          )}
          <TextInput
            ref={emailRef}
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#555"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder="Lösenord"
            placeholderTextColor="#555"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'login' ? 'Logga in' : 'Registrera'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {mode === 'login' && (
          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <Text style={styles.switchText}>Glömt lösenordet?</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.switchButton}
          onPress={switchMode}
        >
          <Text style={styles.switchText}>
            {mode === 'login'
              ? 'Inget konto? Registrera dig'
              : 'Har du ett konto? Logga in'}
          </Text>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    gap: 32,
  },
  header: {
    gap: 8,
  },
  logo: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 5,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '700',
  },
  subtitle: {
    color: '#666666',
    fontSize: 15,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 18,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  primaryButton: {
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  disabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  switchButton: {
    alignItems: 'center',
  },
  switchText: {
    color: '#555555',
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2C2C2E',
  },
  dividerText: {
    color: '#555555',
    fontSize: 13,
  },
})
