import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { getCardioWorkoutByDate, getCardioWorkoutById, deleteCardioWorkout, type CardioWorkout } from '@/services/workouts'
import { getProfile } from '@/services/profile'
import { BG, TEXT_SECONDARY } from '@/lib/theme'
import { parseLocalDate } from '@/lib/date'
import { getUnitSystem, type UnitSystem } from '@/lib/units'
import { CardioSummaryView } from '@/components/CardioSummaryView'

const TYPE_LABELS: Record<string, string> = {
  running: 'Löpning', cycling: 'Cykling', walking: 'Promenad', interval: 'Intervaller',
}

export default function CardioSummaryScreen() {
  const params = useLocalSearchParams<{ name?: string; cardioType?: string; date?: string; workoutId?: string }>()
  const type = params.cardioType ?? 'running'

  const [unit, setUnit] = useState<UnitSystem>('metric')
  const [workout, setWorkout] = useState<CardioWorkout | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { getUnitSystem().then(setUnit) }, [])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setLoading(false); return }
      getProfile(session.user.id).then(p => setAvatarUrl(p?.avatar_url ?? null)).catch(() => {})
      // Exakt id om vi har det (loggade pass); annars typ + dag (schemapass)
      const w = params.workoutId
        ? await getCardioWorkoutById(session.user.id, params.workoutId).catch(() => null)
        : params.date
          ? await getCardioWorkoutByDate(session.user.id, type, params.date).catch(() => null)
          : null
      setWorkout(w)
      setLoading(false)
    }
    load()
  }, [type, params.date, params.workoutId])

  const dateLabel = params.date
    ? parseLocalDate(params.date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

  if (loading) {
    return <View style={st.center}><ActivityIndicator color="#4AA8E0" /></View>
  }
  if (!workout) {
    return (
      <View style={st.center}>
        <Ionicons name="cloud-offline-outline" size={40} color={TEXT_SECONDARY} />
        <Text style={st.empty}>Kunde inte hitta det sparade passet.</Text>
      </View>
    )
  }

  return (
    <CardioSummaryView
      workout={workout}
      title={params.name ?? TYPE_LABELS[type] ?? 'Pass'}
      dateLabel={dateLabel}
      avatarUrl={avatarUrl}
      unit={unit}
      onClose={() => router.back()}
      onDelete={() => {
        Alert.alert('Radera träning', 'Det här går inte att ångra.', [
          { text: 'Avbryt', style: 'cancel' },
          {
            text: 'Radera', style: 'destructive',
            onPress: async () => {
              await deleteCardioWorkout(workout.id).catch(() => {})
              router.back()
            },
          },
        ])
      }}
    />
  )
}

const st = StyleSheet.create({
  center: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  empty:  { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center' },
})
