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
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    // Tvinga React Natives inbyggda fetch — förhindrar att whatwg-fetch polyfill används
    fetch: fetch.bind(globalThis),
  },
})
