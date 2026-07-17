import { View, Image, StyleSheet, type ImageSourcePropType } from 'react-native'
import Svg, { Polygon, Defs, LinearGradient, Stop } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'

// =============================================================================
// MEDALJ-BADGE
// Metallisk hexagon i fyra valörer (brons → platina) ritad med SVG-gradienter,
// med övningens ikon präglad i mitten. Låsta medaljer renderas i mörk metall.
// =============================================================================

export type MedalTier = 'bronze' | 'silver' | 'gold' | 'platinum'

const TIERS: Record<MedalTier, { from: string; to: string; edge: string; icon: string }> = {
  bronze:   { from: '#E8A96C', to: '#8C5A2B', edge: '#6E4520', icon: '#3E2710' },
  silver:   { from: '#EDF1F7', to: '#98A1B0', edge: '#707988', icon: '#3E4653' },
  gold:     { from: '#FFE082', to: '#D69A1E', edge: '#A87413', icon: '#5C3D05' },
  platinum: { from: '#EAF9FF', to: '#9FC4D4', edge: '#7BA2B2', icon: '#2F5561' },
}

const LOCKED = { from: '#2E2E33', to: '#1A1A1D', edge: '#3A3A40', icon: '#4A4A50' }

/** Hörnpunkter för en spetsig hexagon (spets uppåt) centrerad i size×size. */
function hexPoints(size: number, inset: number): string {
  const c = size / 2
  const r = size / 2 - inset
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90)
    pts.push(`${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}

export function MedalBadge({
  tier,
  icon,
  unlocked,
  size = 56,
  imageSource,
}: {
  tier: MedalTier
  icon: React.ComponentProps<typeof Ionicons>['name']
  unlocked: boolean
  size?: number
  /** Egen medaljbild (PNG) — ersätter SVG-hexagonen när den finns */
  imageSource?: ImageSourcePropType
}) {
  const c = unlocked ? TIERS[tier] : LOCKED
  const gradId = `medal-${tier}-${unlocked ? 'on' : 'off'}`

  if (imageSource) {
    return (
      <Image
        source={imageSource}
        style={{ width: size, height: size, opacity: unlocked ? 1 : 0.3 }}
        resizeMode="contain"
      />
    )
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0"   stopColor={c.from} />
            <Stop offset="1"   stopColor={c.to} />
          </LinearGradient>
          <LinearGradient id={`${gradId}-shine`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={unlocked ? 0.45 : 0.08} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Kant, metallyta och glans uppifrån */}
        <Polygon points={hexPoints(size, 0)}   fill={c.edge} />
        <Polygon points={hexPoints(size, 2.5)} fill={`url(#${gradId})`} />
        <Polygon points={hexPoints(size, 5)}   fill={`url(#${gradId}-shine)`} />
      </Svg>

      <View style={s.iconWrap}>
        <Ionicons name={icon} size={size * 0.4} color={c.icon} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  iconWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
