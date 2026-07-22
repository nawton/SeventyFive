import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { GlassCircleButton } from '@/components/GlassButton'
import { BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

// =============================================================================
// NOTISER — notiscentret, nås från klockan på profilfliken. Här samlas
// gillanden, nya följare, kommentarer och påminnelser när delnings-
// backenden och notissystemet finns. Tills dess ett ärligt tomläge.
// =============================================================================

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <GlassCircleButton
          icon="chevron-back"
          size={40}
          iconColor={TEXT_PRIMARY}
          onPress={() => router.back()}
          fallbackStyle={s.iconBtnFallback}
        />
        <Text style={s.title}>Notiser</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.empty}>
        <Ionicons name="notifications-outline" size={44} color={TEXT_SECONDARY} />
        <Text style={s.emptyTitle}>Inga notiser ännu</Text>
        <Text style={s.emptyBody}>
          Här samlas gillanden, nya följare och påminnelser framöver.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  iconBtnFallback: { backgroundColor: CARD },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  empty: { alignItems: 'center', gap: 8, paddingTop: 90, paddingHorizontal: 40 },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginTop: 6 },
  emptyBody: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
})
