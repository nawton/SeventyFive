import Svg, { Circle, Line, Path, Rect } from 'react-native-svg'
import type { ExerciseEquipment } from '@/services/exercises'

// =============================================================================
// UTRUSTNINGSIKONER — egna minimalistiska linjeikoner i samma streckstil
// som Ionicons outline. Ritade för hand, temafärgas av anroparen via color
// (rå strängfärg — används inne i modaler där dynamiska färger fryser).
// =============================================================================

const SW = 1.7

export function EquipmentIcon({ equipment, size = 20, color }: {
  equipment: ExerciseEquipment | 'all'
  size?: number
  /** Rå hexfärg från useThemeStrings — aldrig en dynamisk konstant */
  color: string
}) {
  const p = { stroke: color, strokeWidth: SW, strokeLinecap: 'round' as const, fill: 'none' as const }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {equipment === 'all' && (
        <>
          <Rect x={4} y={4} width={6.5} height={6.5} rx={1.8} {...p} />
          <Rect x={13.5} y={4} width={6.5} height={6.5} rx={1.8} {...p} />
          <Rect x={4} y={13.5} width={6.5} height={6.5} rx={1.8} {...p} />
          <Rect x={13.5} y={13.5} width={6.5} height={6.5} rx={1.8} {...p} />
        </>
      )}
      {equipment === 'none' && (
        <>
          <Circle cx={12} cy={5.5} r={2.5} {...p} />
          <Path d="M12 8v6" {...p} />
          <Path d="M6.5 11.5 L12 9.5 L17.5 11.5" {...p} />
          <Path d="M12 14 L8.5 20 M12 14 L15.5 20" {...p} />
        </>
      )}
      {equipment === 'barbell' && (
        <>
          <Line x1={2.5} y1={12} x2={4.5} y2={12} {...p} />
          <Line x1={5.5} y1={6.5} x2={5.5} y2={17.5} {...p} />
          <Line x1={8} y1={9} x2={8} y2={15} {...p} />
          <Line x1={8} y1={12} x2={16} y2={12} {...p} />
          <Line x1={16} y1={9} x2={16} y2={15} {...p} />
          <Line x1={18.5} y1={6.5} x2={18.5} y2={17.5} {...p} />
          <Line x1={19.5} y1={12} x2={21.5} y2={12} {...p} />
        </>
      )}
      {equipment === 'dumbbell' && (
        <>
          <Rect x={5} y={8} width={3} height={8} rx={1.2} {...p} />
          <Rect x={16} y={8} width={3} height={8} rx={1.2} {...p} />
          <Line x1={8} y1={12} x2={16} y2={12} {...p} />
          <Line x1={2.8} y1={12} x2={5} y2={12} {...p} />
          <Line x1={19} y1={12} x2={21.2} y2={12} {...p} />
        </>
      )}
      {equipment === 'kettlebell' && (
        <>
          <Circle cx={12} cy={14.2} r={5.6} {...p} />
          <Path d="M8.8 9.8 C7.6 5.4 9.6 3.6 12 3.6 C14.4 3.6 16.4 5.4 15.2 9.8" {...p} />
        </>
      )}
      {equipment === 'machine' && (
        <>
          <Path d="M5.5 20.5 V4.5 H18.5 V20.5" {...p} />
          <Circle cx={12} cy={7.5} r={1.8} {...p} />
          <Line x1={12} y1={9.3} x2={12} y2={13.8} {...p} />
          <Line x1={9.5} y1={14.6} x2={14.5} y2={14.6} {...p} />
          <Line x1={3.5} y1={20.5} x2={20.5} y2={20.5} {...p} />
        </>
      )}
      {equipment === 'cable' && (
        <>
          <Circle cx={12} cy={5} r={2.1} {...p} />
          <Line x1={12} y1={7.1} x2={12} y2={13.8} {...p} />
          <Path d="M12 13.8 L9.3 17.6 M12 13.8 L14.7 17.6" {...p} />
          <Line x1={9.3} y1={17.6} x2={14.7} y2={17.6} {...p} />
        </>
      )}
      {equipment === 'plate' && (
        <>
          <Circle cx={12} cy={12} r={7.2} {...p} />
          <Circle cx={12} cy={12} r={2.2} {...p} />
        </>
      )}
      {equipment === 'band' && (
        <>
          <Line x1={3.5} y1={9} x2={3.5} y2={15} {...p} />
          <Line x1={20.5} y1={9} x2={20.5} y2={15} {...p} />
          <Path d="M4.5 10.5 C8.5 7.5 15.5 13.5 19.5 10.5" {...p} />
          <Path d="M4.5 14.5 C8.5 11.5 15.5 17.5 19.5 14.5" {...p} />
        </>
      )}
      {equipment === 'suspension' && (
        <>
          <Line x1={12} y1={2.5} x2={12} y2={4.5} {...p} />
          <Line x1={12} y1={4.5} x2={7.2} y2={15} {...p} />
          <Line x1={12} y1={4.5} x2={16.8} y2={15} {...p} />
          <Line x1={4.8} y1={16.8} x2={9.4} y2={16.8} {...p} />
          <Line x1={14.6} y1={16.8} x2={19.2} y2={16.8} {...p} />
        </>
      )}
      {equipment === 'other' && (
        <>
          <Circle cx={5.5} cy={12} r={1.4} fill={color} stroke="none" />
          <Circle cx={12} cy={12} r={1.4} fill={color} stroke="none" />
          <Circle cx={18.5} cy={12} r={1.4} fill={color} stroke="none" />
        </>
      )}
    </Svg>
  )
}
