import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { BG } from '@/lib/theme'

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
    <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#FFA817" size="large" />
    </View>
  )
}
