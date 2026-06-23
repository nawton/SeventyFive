import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function Index() {
  useEffect(() => {
    // getSession() läser från SecureStore — inget nätverksanrop
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/(app)/dashboard')
      else router.replace('/(auth)/welcome')
    }).catch(() => {
      router.replace('/(auth)/welcome')
    })
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#FF8F00" size="large" />
    </View>
  )
}
