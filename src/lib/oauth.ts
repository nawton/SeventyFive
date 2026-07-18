import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { getProfile, updateProfile } from '@/services/profile'

// Stänger ev. kvarhängande auth-session när appen öppnas igen via deep link
WebBrowser.maybeCompleteAuthSession()

export async function signInWithGoogle(): Promise<boolean> {
  // Expo Go: exp://<host>:8081/--/auth-callback · Dev build: seventyfive://auth-callback
  // OBS: URL:en måste vara tillåten under Supabase → Auth → URL Configuration.
  // Supabase vägrar dessutom LAN-IP-adresser som redirect (skickar till Site URL
  // i stället) — i Expo Go kräver Google-inloggning därför `expo start --tunnel`
  const redirectTo = Linking.createURL('auth-callback')

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  })
  if (error || !data.url) return false

  // openAuthSessionAsync stänger webbläsaren själv vid redirect och ger oss
  // callback-URL:en direkt — ingen deep link-lyssnare som kan tappa racet
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
  if (result.type !== 'success' || !result.url) return false

  try {
    const code = new URL(result.url).searchParams.get('code')
    if (!code) return false
    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
    if (sessionError) return false
    await ensureProfileName(sessionData.session?.user)
    return true
  } catch {
    return false
  }
}

// Google skickar med fullständigt namn i metadatan — fyll i profilen om den är
// tom, så hälsningen visar "Anton" i stället för e-postprefixet
async function ensureProfileName(user: User | null | undefined) {
  if (!user) return
  const meta = user.user_metadata ?? {}
  const name = (meta.full_name ?? meta.name ?? '').trim()
  if (!name) return
  try {
    const profile = await getProfile(user.id)
    if (!profile?.name) await updateProfile(user.id, { name })
  } catch {
    // Namnet är trevligt att ha men får aldrig stoppa inloggningen
  }
}
