import * as Notifications from 'expo-notifications'
import { SchedulableTriggerInputTypes } from 'expo-notifications'

// =============================================================================
// DAGLIGA PÅMINNELSER
// Lokala notiser — kräver development build (fungerar inte i Expo Go SDK 53+).
// Två fasta tider: morgonpepp och streak-vakt på kvällen.
// =============================================================================

const MORNING = { hour: 9,  minute: 0 }
const EVENING = { hour: 20, minute: 30 }

/** Schemalägger de dagliga påminnelserna (rensar gamla först). */
export async function scheduleDailyReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Ny dag i utmaningen 💪',
      body: 'Kolla in dagens uppgifter och planera in ditt pass.',
    },
    trigger: { type: SchedulableTriggerInputTypes.DAILY, ...MORNING },
  })

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Tappa inte din streak 🔥',
      body: 'Har du bockat av allt idag? Det är inte försent än.',
    },
    trigger: { type: SchedulableTriggerInputTypes.DAILY, ...EVENING },
  })
}

/** Stänger av alla schemalagda påminnelser. */
export async function cancelDailyReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()
}

/** True om påminnelser både är tillåtna och schemalagda. */
export async function areRemindersActive(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync()
  if (status !== 'granted') return false
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  return scheduled.length > 0
}
