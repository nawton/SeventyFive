import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BG, TEXT_SECONDARY } from '@/lib/theme'

// Placeholder — aktivitetsflödet byggs i Fas 2 (se ROADMAP)
export default function ActivityScreen() {
  return (
    <View style={s.screen}>
      <Ionicons name="body" size={36} color={TEXT_SECONDARY} />
      <Text style={s.text}>Aktivitetsflödet kommer snart</Text>
    </View>
  )
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  text: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
})
