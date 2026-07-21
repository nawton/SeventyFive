import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { BG, ORANGE } from '@/lib/theme'

// Placeholder — aktivitetsflödet byggs i Fas 2.
// Redirectar alltid till dashboard så direktlänken inte visar en tom skärm.
export default function ActivityScreen() {
  useEffect(() => { router.replace('/(app)/dashboard') }, [])
  return (
    <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={ORANGE} />
    </View>
  )
}
