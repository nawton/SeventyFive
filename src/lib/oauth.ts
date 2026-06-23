import { makeRedirectUri } from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from './supabase'

WebBrowser.maybeCompleteAuthSession()

const redirectTo = makeRedirectUri({ scheme: 'seventyfive', path: 'auth-callback' })

export async function signInWithGoogle(): Promise<boolean> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  })

  if (error || !data.url) return false

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
  if (result.type !== 'success') return false

  const code = new URL(result.url).searchParams.get('code')
  if (!code) return false

  const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
  return !sessionError
}
