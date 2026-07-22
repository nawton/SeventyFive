import { View, StyleSheet, type ViewProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// =============================================================================
// Ersätter SafeAreaView (safe-area-context): den nativa vyn applicerar inte
// topp-inset pålitligt på nya arkitekturen (Fabric) — bl.a. i Modals och
// direkt efter navigering — så bakåtpilar hamnade under klockan/Dynamic
// Island. Insets via useSafeAreaInsets kommer från providerns mätning i
// roten och fungerar överallt, precis som Expos docs rekommenderar.
// Padding är additiv ovanpå ev. egen padding i style, som originalet.
// =============================================================================

type Edge = 'top' | 'bottom' | 'left' | 'right'

interface SafeScreenProps extends ViewProps {
  edges?: readonly Edge[]
}

export function SafeScreen({ edges, style, children, ...rest }: SafeScreenProps) {
  const insets = useSafeAreaInsets()
  const on = (e: Edge) => !edges || edges.includes(e)
  const flat = StyleSheet.flatten(style) ?? {}
  const base = (key: 'Top' | 'Bottom' | 'Left' | 'Right') => {
    const axis = key === 'Top' || key === 'Bottom' ? 'paddingVertical' : 'paddingHorizontal'
    const v = flat[`padding${key}`] ?? flat[axis] ?? flat.padding ?? 0
    return typeof v === 'number' ? v : 0
  }
  return (
    <View
      {...rest}
      style={[
        style,
        {
          paddingTop: base('Top') + (on('top') ? insets.top : 0),
          paddingBottom: base('Bottom') + (on('bottom') ? insets.bottom : 0),
          paddingLeft: base('Left') + (on('left') ? insets.left : 0),
          paddingRight: base('Right') + (on('right') ? insets.right : 0),
        },
      ]}
    >
      {children}
    </View>
  )
}
