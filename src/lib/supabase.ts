// =============================================================================
// SUPABASE KLIENT — SEVENTYFIVE BY NAWTON
// =============================================================================
// Vi använder expo-secure-store för att lagra auth-tokens säkert på enheten.
// AsyncStorage krypterar inte data — SecureStore använder Keychain (iOS)
// och Keystore (Android) som är operativsystemets säkra lagring.
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

// SecureStore-nycklar måste vara korta och innehålla bara alfanumeriska tecken.
// Supabase-klienten hanterar sessionens tokens via denna adapter.
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase URL och Anon Key saknas. Kontrollera din .env.local-fil.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Lagrar tokens säkert på enheten istället för i AsyncStorage
    storage: ExpoSecureStoreAdapter,
    // Uppdaterar tokens automatiskt i bakgrunden
    autoRefreshToken: true,
    // Håller användaren inloggad mellan sessioner
    persistSession: true,
    // Stäng av URL-detektering (används inte i native-appar)
    detectSessionInUrl: false,
  },
})
