import { Stack } from 'expo-router'

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Efter registreringen finns ingen väg tillbaka till inloggningen:
          svep-tillbaka-gesten stängs av på quizet och schemasteget.
          Nivåvalet får behålla gesten — där är tillbaka till quizet rätt. */}
      <Stack.Screen name="quiz" options={{ gestureEnabled: false }} />
      <Stack.Screen name="setup-schedule" options={{ gestureEnabled: false }} />
    </Stack>
  )
}
