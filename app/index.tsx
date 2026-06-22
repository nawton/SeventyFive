import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { getActiveChallenge } from '@/services/challenge'

export default function Index() {
  useEffect(() => {
    async function route() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/(auth)/welcome'); return }

      const challenge = await getActiveChallenge(session.user.id)
      if (challenge) router.replace('/(app)/dashboard')
      else router.replace('/(auth)/quiz')
    }
    route()
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#FF8F00" size="large" />
    </View>
  )
}
