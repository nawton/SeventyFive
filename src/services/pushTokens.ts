import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { supabase } from '@/lib/supabase'

const IS_EXPO_GO = Constants.appOwnership === 'expo'

// =============================================================================
// PUSH-TOKENS — registrerar enhetens Expo-pushtoken så databastriggrarna
// kan skicka notiser om vänförfrågningar, gillanden och kommentarer.
// Bäst-effort: kräver dev build (inte Expo Go) och beviljad notisrättighet;
// annars gör anropet ingenting. Prompten ägs av notisinställningen i
// Allmänt — här registrerar vi bara om rättigheten redan finns.
// =============================================================================

export async function registerPushToken(): Promise<void> {
  if (IS_EXPO_GO) return
  try {
    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') return

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    )
    if (!token) return

    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return

    await supabase.from('push_tokens').upsert({
      user_id: uid,
      token,
      updated_at: new Date().toISOString(),
    })
  } catch {
    // pushtoken är trevligt men aldrig kritiskt
  }
}
