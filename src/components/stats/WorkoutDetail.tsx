import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ORANGE, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { toDisplayDistance, distanceUnitLabel, paceForUnit, type UnitSystem } from '@/lib/units'
import type { CardioWorkout } from '@/services/workouts'

const EXERCISE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  running:  'fitness-outline',
  cycling:  'bicycle-outline',
  interval: 'flash-outline',
  walking:  'walk-outline',
}

function fmtTime(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtPace(secsPerKm: number): string {
  const m = Math.floor(secsPerKm / 60)
  const s = Math.floor(secsPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Kompakt rad för en cardio-träning i listor. Detaljvyn hanteras numera av
 *  CardioSummaryView (kart-/statsdesignen som delas med schemat). */
export function WorkoutRow({ workout, last, onPress, unit = 'metric' }: {
  workout: CardioWorkout; last: boolean; onPress: () => void; unit?: UnitSystem
}) {
  const d     = workout.data
  const label = distanceUnitLabel(unit)
  const pace  = d.distance_km > 0.1
    ? fmtPace(paceForUnit(d.duration_seconds / d.distance_km, unit)) + ` /${label}` : null
  const date = new Date(workout.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })

  return (
    <TouchableOpacity
      style={[s.workoutRow, !last && s.workoutRowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={s.rowIcon}>
        <Ionicons name={EXERCISE_ICONS[d.type] ?? 'fitness-outline'} size={18} color={ORANGE} />
      </View>
      <View style={s.rowBody}>
        <View style={s.rowTop}>
          <Text style={s.rowName}>{workout.name}</Text>
          <Text style={s.rowDate}>{date}</Text>
        </View>
        <View style={s.rowMeta}>
          <Text style={s.rowStat}>{toDisplayDistance(d.distance_km, unit).toFixed(2)} {label}</Text>
          <Text style={s.rowDot}>·</Text>
          <Text style={s.rowStat}>{fmtTime(d.duration_seconds)}</Text>
          {pace && (
            <>
              <Text style={s.rowDot}>·</Text>
              <Text style={[s.rowStat, { color: ORANGE }]}>{pace}</Text>
            </>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" style={{ alignSelf: 'center' }} />
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  workoutRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  workoutRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  rowIcon:  { width: 38, height: 38, borderRadius: 10, backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowBody:  { flex: 1, gap: 4 },
  rowTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName:  { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  rowDate:  { color: TEXT_SECONDARY, fontSize: 12 },
  rowMeta:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowStat:  { color: TEXT_SECONDARY, fontSize: 13 },
  rowDot:   { color: 'rgba(255,255,255,0.15)', fontSize: 13 },
})
