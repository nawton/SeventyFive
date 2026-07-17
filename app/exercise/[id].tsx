import { router, useLocalSearchParams } from 'expo-router'
import { ExerciseLogSheet } from '@/components/ExerciseLogSheet'

export default function ExerciseDetailScreen() {
  const params = useLocalSearchParams<{
    id: string
    name: string
    description?: string
    category: string
    difficulty: string
    initialSets?: string
    initialReps?: string
    sessionExId?: string
    sessionDate?: string
    loggedWorkoutId?: string
    loggedWorkoutDate?: string
  }>()

  return (
    <ExerciseLogSheet
      id={params.id}
      name={params.name}
      description={params.description}
      category={params.category}
      difficulty={params.difficulty}
      initialSets={params.initialSets}
      initialReps={params.initialReps}
      sessionExId={params.sessionExId}
      sessionDate={params.sessionDate}
      loggedWorkoutId={params.loggedWorkoutId}
      loggedWorkoutDate={params.loggedWorkoutDate}
      onClose={() => router.back()}
    />
  )
}
