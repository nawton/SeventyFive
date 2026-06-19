import { useState } from 'react'
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
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'

type Mode = 'login' | 'register'

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    const trimmedEmail = email.trim()
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
        router.replace('/(app)/dashboard')
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      })
      if (error) Alert.alert('Registrering misslyckades', error.message)
      else router.replace('/(auth)/quiz')
    }

    setLoading(false)
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
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#555"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Lösenord"
            placeholderTextColor="#555"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
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

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
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

const ORANGE = '#FF8F00'

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#111111',
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
})
