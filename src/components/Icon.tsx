import { Ionicons as ExpoIonicons, MaterialCommunityIcons } from '@expo/vector-icons'

// =============================================================================
// Drop-in-ersättare för Ionicons: löpning ritas som en springande gubbe
// (MCI "run") istället för Ionicons hjärtpuls ("fitness"). Genom att byta
// på komponentnivå följer även alla datadrivna ikonnamn med — scheman,
// flöden, statistik och rekord använder samma gubbe överallt.
// =============================================================================

type IoniconsProps = React.ComponentProps<typeof ExpoIonicons>

export function Ionicons({ name, size, color, style, ...rest }: IoniconsProps) {
  if (name === 'fitness' || name === 'fitness-outline') {
    return <MaterialCommunityIcons name="run" size={size} color={color} style={style} />
  }
  return <ExpoIonicons name={name} size={size} color={color} style={style} {...rest} />
}
