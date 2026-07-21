import 'react-native-url-polyfill/auto'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useFonts, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/lib/auth'

export default function RootLayout() {
  // Rundad siffer-font (SF Rounded-känsla) — appen renderar med systemfont tills den laddats
  useFonts({ Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold })
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
      <ErrorBoundary>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="edit-name" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="records" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="change-password" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="cardio-session" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="run-workout" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="cardio-summary" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        </Stack>
      </ErrorBoundary>
      </AuthProvider>
    </GestureHandlerRootView>
  )
}
