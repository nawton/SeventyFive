import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from './supabase'

// Stänger ev. kvarhängande auth-session när appen öppnas igen via deep link
WebBrowser.maybeCompleteAuthSession()

export async function signInWithGoogle(): Promise<boolean> {
  // Expo Go: exp://<LAN-IP>:8081/--/auth-callback · Dev build: seventyfive://auth-callback
  // OBS: URL:en måste vara tillåten under Supabase → Auth → URL Configuration,
  // annars skickas Safari till Site URL (ofta localhost) och "kan inte ansluta"
  const redirectTo = Linking.createURL('auth-callback')
  // Felsökning: den här adressen MÅSTE finnas i Supabase → Auth → URL Configuration
  console.log('[oauth] redirectTo:', redirectTo)

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
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
    return !sessionError
  } catch {
    return false
  }
}
