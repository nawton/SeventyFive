import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet, View, ViewStyle } from 'react-native'

interface GlassCardProps {
  children: React.ReactNode
  style?: ViewStyle
  // Hur stark blur-effekten är (10–80 rekommenderas)
  intensity?: number
  // 'light' för ljus bakgrund, 'dark' för mörk
  tint?: 'light' | 'dark' | 'default'
}

export function GlassCard({
  children,
  style,
  intensity = 40,
  tint = 'light',
}: GlassCardProps) {
  return (
    // Yttersta lagret — håller border-radius och skugga
    <View style={[styles.wrapper, style]}>

      {/* Suddig bakgrund — det som gör glaseffekten */}
      <BlurView
        intensity={intensity}
        tint={tint}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />

      {/* Gradient-overlay för djup och genomskinlighet */}
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.22)',
          'rgba(255,255,255,0.06)',
          'rgba(255,255,255,0.10)',
        ]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Spekulär highlight — det ljusa strecket längs överkanten */}
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.55)',
          'rgba(255,255,255,0.0)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.highlight}
      />

      {/* Gradient-border — imiterar ljusreflektionen runt kanten */}
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.60)',
          'rgba(255,255,255,0.10)',
          'rgba(255,255,255,0.30)',
          'rgba(255,255,255,0.05)',
        ]}
        locations={[0, 0.3, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.border}
      >
        <View style={styles.borderInner} />
      </LinearGradient>

      {/* Innehållet */}
      <View style={styles.content}>
        {children}
      </View>

    </View>
  )
}

const RADIUS = 24

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: RADIUS,
    overflow: 'hidden',
    // Skugga som ger känslan av att kortet svävar
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS,
    padding: 1.2,
  },
  borderInner: {
    flex: 1,
    borderRadius: RADIUS - 1.2,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 20,
  },
})
