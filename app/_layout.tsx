import 'react-native-url-polyfill/auto'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="edit-name" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="records" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="change-password" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="cardio-session" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="cardio-summary" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        </Stack>
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}
