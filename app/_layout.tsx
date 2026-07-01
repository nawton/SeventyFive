import 'react-native-url-polyfill/auto'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="exercise/[id]" options={{ presentation: 'transparentModal', animation: 'none' }} />
      </Stack>
    </GestureHandlerRootView>
  )
}
