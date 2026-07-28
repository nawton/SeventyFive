import { memo, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import Body from 'react-native-body-highlighter'
import { bestSideForMuscles, type Slug } from '@/lib/muscles'

// =============================================================================
// MUSKELMINIATYR — inzoomad kroppssiluett panorerad så vald muskel ligger
// mitt i cirkeln (vader nere, axlar uppe). Delas av övningsväljarens
// delmuskelfilter och Skapa egen övning-listorna.
// =============================================================================

/** Var på kroppen muskeln sitter, som andel av höjden uppifrån */
const MUSCLE_CENTER: Partial<Record<Slug, number>> = {
  trapezius: 0.16, deltoids: 0.20, chest: 0.24, 'upper-back': 0.25,
  biceps: 0.29, triceps: 0.29, abs: 0.34, obliques: 0.34,
  'lower-back': 0.36, forearm: 0.38, gluteal: 0.46, adductors: 0.52,
  quadriceps: 0.55, hamstring: 0.58, tibialis: 0.74, calves: 0.75,
}

export const MuscleThumb = memo(function MuscleThumb({ slug, size = 52, color, tintAlpha = '14', side }: {
  slug: Slug
  size?: number
  /** Accentfärgen som hex — temaväxlad av anroparen (orange mörkt, blå ljust) */
  color: string
  tintAlpha?: string
  /** Tvinga vy: bakre delta ska visas bakifrån trots att framsidan är standard */
  side?: 'front' | 'back'
}) {
  const [bodyH, setBodyH] = useState(0)
  const frac = MUSCLE_CENTER[slug] ?? 0.35
  return (
    // pointerEvents none: SVG-kroppens paths har egna tryckhanterare som
    // annars sväljer trycket innan det når knappen som omger miniatyren
    <View
      pointerEvents="none"
      style={[
        s.thumb,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}${tintAlpha}` },
      ]}
    >
      <View
        onLayout={e => setBodyH(e.nativeEvent.layout.height)}
        style={{ transform: [{ translateY: bodyH ? (0.5 - frac) * bodyH : 0 }] }}
      >
        <Body
          data={[{ slug, intensity: 1 as const }]}
          side={side ?? bestSideForMuscles([slug])}
          gender="male"
          scale={0.45}
          colors={[color]}
          defaultFill="#3A3A3C"
        />
      </View>
    </View>
  )
})

const s = StyleSheet.create({
  thumb: {
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
})
