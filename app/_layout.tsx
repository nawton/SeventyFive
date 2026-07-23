import 'react-native-url-polyfill/auto'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito'
import * as Sentry from '@sentry/react-native'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/lib/auth'
import { applyStoredTheme } from '@/lib/themeMode'

// Kraschrapportering — slås på först när EXPO_PUBLIC_SENTRY_DSN finns i
// miljön (kräver också en byggnation med den nativa modulen). Utan DSN
// är detta en no-op så utveckling och tester påverkas inte.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN
if (SENTRY_DSN) {
  Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0.2 })
}

// Mörkt är standard oavsett systemläge — sätts före första renderingen så
// systemljusa användare aldrig ser en ljus blink; ev. sparat ljust val
// appliceras strax efter
applyStoredTheme()

export default function RootLayout() {
  // Rundad siffer-font (SF Rounded-känsla) — appen renderar med systemfont tills den laddats
  useFonts({ Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold })
  return (
    // Explicit SafeAreaProvider — skärmarnas SafeAreaView/useSafeAreaInsets
    // ska aldrig bero på att expo-router råkar tillhandahålla en
    <SafeAreaProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
      <ErrorBoundary>
        {/* auto: vita ikoner i mörkt läge, svarta i ljust */}
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="records" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="change-password" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="cardio-session" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="run-workout" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="cardio-summary" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        </Stack>
      </ErrorBoundary>
      </AuthProvider>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  )
}
