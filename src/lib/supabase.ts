// =============================================================================
// SUPABASE KLIENT — SEVENTYFIVE BY NAWTON
// =============================================================================
// Vi använder expo-secure-store för att lagra auth-tokens säkert på enheten.
// AsyncStorage krypterar inte data — SecureStore använder Keychain (iOS)
// och Keystore (Android) som är operativsystemets säkra lagring.
// =============================================================================
//
// VIKTIGT: @supabase/supabase-js importeras via require() (inte ES import) så
// att vi kan fånga React Natives inbyggda fetch INNAN cross-fetch/whatwg-fetch
// laddas och skriver över global.fetch med sin XHR-polyfill.
// ES import-satser hissas (hoistas) av Babel — require() körs in-place.
// =============================================================================

import * as SecureStore from 'expo-secure-store'
import type { SupabaseClient, createClient as CreateClient } from '@supabase/supabase-js'

// Fångar inbyggd fetch INNAN require('@supabase/supabase-js') laddar cross-fetch
const nativeFetch = global.fetch.bind(global)

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createClient } = require('@supabase/supabase-js') as {
  createClient: typeof CreateClient
}

// SecureStore-nycklar måste vara korta och innehålla bara alfanumeriska tecken.
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

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: nativeFetch,
  },
})
