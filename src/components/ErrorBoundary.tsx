import { Component, type ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Fångar oväntade renderingsfel så appen visar en återhämtningsskärm
 * istället för att krascha till hemskärmen. "Försök igen" nollställer
 * boundaryn och låter trädet montera om.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <View style={s.screen}>
        <View style={s.iconCircle}>
          <Ionicons name="alert-circle-outline" size={40} color={ORANGE} />
        </View>
        <Text style={s.title}>Något gick fel</Text>
        <Text style={s.body}>
          Ett oväntat fel inträffade. Din data är sparad — försök igen.
        </Text>
        <TouchableOpacity
          style={s.retryBtn}
          onPress={() => this.setState({ error: null })}
          activeOpacity={0.85}
        >
          <Text style={s.retryText}>Försök igen</Text>
        </TouchableOpacity>
      </View>
    )
  }
}

const s = StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: BG,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 12,
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  title: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800' },
  body:  { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    backgroundColor: ORANGE, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14, marginTop: 8,
  },
  retryText: { color: '#000', fontSize: 15, fontWeight: '700' },
})
