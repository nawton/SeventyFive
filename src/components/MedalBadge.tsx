import { View, Image, Text, StyleSheet, type ImageSourcePropType , useColorScheme } from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import { Ionicons } from '@/components/Icon'

// =============================================================================
// MEDALJ-BADGE
// Mjuk, rundad hexagon i fem valörer (brons → diamant) med gradienter, inre
// panel och glow — samma känsla som nivåmedaljer i t.ex. Runna. Ikonen (eller
// en text-etikett) präglas i mitten. Låsta medaljer renderas i mörk metall.
// =============================================================================

export type MedalTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

const TIERS: Record<MedalTier, { rimFrom: string; rimTo: string; panelFrom: string; panelTo: string; icon: string; glow: string }> = {
  bronze:   { rimFrom: '#E9B788', rimTo: '#96683B', panelFrom: '#C68F55', panelTo: '#7A5026', icon: 'rgba(52,30,10,0.75)',  glow: '#C68F55' },
  silver:   { rimFrom: '#F2F5FA', rimTo: '#9AA3B2', panelFrom: '#C9D0DB', panelTo: '#7E8795', icon: 'rgba(40,46,58,0.75)',  glow: '#B9C2CF' },
  gold:     { rimFrom: '#F7E6A5', rimTo: '#C29325', panelFrom: '#E3C255', panelTo: '#A87E1C', icon: 'rgba(74,52,8,0.75)',   glow: '#E3C255' },
  platinum: { rimFrom: '#F2FBFF', rimTo: '#9DBECE', panelFrom: '#CFE6EF', panelTo: '#87ABBC', icon: 'rgba(35,66,79,0.75)',  glow: '#BFE0EC' },
  diamond:  { rimFrom: '#EAFBFF', rimTo: '#6FC9E2', panelFrom: '#AEE7F5', panelTo: '#59B4D1', icon: 'rgba(20,70,88,0.78)',  glow: '#8FDCF0' },
}

const LOCKED = { rimFrom: '#3A3A41', rimTo: '#222226', panelFrom: '#2C2C31', panelTo: '#1B1B1F', icon: 'rgba(255,255,255,0.16)', glow: 'transparent' }
// Ljust läge: mörka låsta hexar blir svarta plumpar på vit botten
const LOCKED_LIGHT = { rimFrom: '#E8E9EE', rimTo: '#C9CBD4', panelFrom: '#DCDEE5', panelTo: '#C2C5CF', icon: 'rgba(0,0,0,0.22)', glow: 'transparent' }

/** Path för en spetsig hexagon med rundade hörn, centrerad i size×size. */
function roundedHexPath(size: number, inset: number, corner: number): string {
  const c = size / 2
  const r = size / 2 - inset
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90)
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) }
  })
  let d = ''
  for (let i = 0; i < 6; i++) {
    const prev = pts[(i + 5) % 6]
    const curr = pts[i]
    const next = pts[(i + 1) % 6]
    const inV  = { x: curr.x - prev.x, y: curr.y - prev.y }
    const outV = { x: next.x - curr.x, y: next.y - curr.y }
    const inLen  = Math.hypot(inV.x, inV.y)
    const outLen = Math.hypot(outV.x, outV.y)
    const start = { x: curr.x - (inV.x / inLen) * corner,  y: curr.y - (inV.y / inLen) * corner }
    const end   = { x: curr.x + (outV.x / outLen) * corner, y: curr.y + (outV.y / outLen) * corner }
    d += i === 0 ? `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} ` : `L ${start.x.toFixed(2)} ${start.y.toFixed(2)} `
    d += `Q ${curr.x.toFixed(2)} ${curr.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)} `
  }
  return d + 'Z'
}

export function MedalBadge({
  tier,
  icon,
  label,
  unlocked,
  size = 56,
  imageSource,
}: {
  tier: MedalTier
  icon?: React.ComponentProps<typeof Ionicons>['name']
  /** Text istället för ikon — t.ex. "75" på nivåmedaljen */
  label?: string
  unlocked: boolean
  size?: number
  /** Egen medaljbild (PNG) — ersätter SVG-hexagonen när den finns */
  imageSource?: ImageSourcePropType
}) {
  const light = useColorScheme() === 'light'
  const c = unlocked ? TIERS[tier] : (light ? LOCKED_LIGHT : LOCKED)
  const gid = `medal-${tier}-${unlocked ? 'on' : 'off'}-${size}`
  const corner = size * 0.12

  if (imageSource) {
    return (
      <Image
        source={imageSource}
        style={{ width: size, height: size, opacity: unlocked ? 1 : (light ? 0.85 : 0.3) }}
        resizeMode="contain"
      />
    )
  }

  return (
    <View
      style={[
        { width: size, height: size },
        unlocked && {
          shadowColor: c.glow,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.45,
          shadowRadius: size * 0.16,
          elevation: 6,
        },
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={`${gid}-rim`} x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor={c.rimFrom} />
            <Stop offset="1" stopColor={c.rimTo} />
          </LinearGradient>
          <LinearGradient id={`${gid}-panel`} x1="0.3" y1="0" x2="0.7" y2="1">
            <Stop offset="0" stopColor={c.panelFrom} />
            <Stop offset="1" stopColor={c.panelTo} />
          </LinearGradient>
          <LinearGradient id={`${gid}-shine`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={unlocked ? 0.35 : 0.05} />
            <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Ram, inre panel och mjuk glans uppifrån */}
        <Path d={roundedHexPath(size, 0, corner)}            fill={`url(#${gid}-rim)`} />
        <Path d={roundedHexPath(size, size * 0.09, corner * 0.8)} fill={`url(#${gid}-panel)`} />
        <Path d={roundedHexPath(size, size * 0.09, corner * 0.8)} fill={`url(#${gid}-shine)`} />
      </Svg>

      <View style={s.center}>
        {label ? (
          <Text style={{ color: c.icon, fontSize: size * 0.3, fontWeight: '900', letterSpacing: -0.5 }}>
            {label}
          </Text>
        ) : icon ? (
          <Ionicons name={icon} size={size * 0.38} color={c.icon} />
        ) : null}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
