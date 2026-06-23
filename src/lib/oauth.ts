import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from './supabase'

export async function signInWithGoogle(): Promise<boolean> {
  const redirectTo = Linking.createURL('auth-callback')

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  })

  if (error || !data.url) return false

  return new Promise((resolve) => {
    // Lyssnar på deep link när appen öppnas igen efter OAuth
    const sub = Linking.addEventListener('url', async ({ url }) => {
      sub.remove()
      try {
        const code = new URL(url).searchParams.get('code')
        if (!code) { resolve(false); return }
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
        resolve(!sessionError)
      } catch {
        resolve(false)
      }
    })

    // Öppnar SFSafariViewController — iOS skickar exp://-redirecten till Expo Go
    WebBrowser.openBrowserAsync(data.url).then(() => {
      sub.remove()
      resolve(false)
    })
  })
}
