import { StyleSheet, Text, View } from 'react-native'
import { colors, font, radius } from './theme'

interface StatBadgeProps {
  value: string | number
  label: string
  icon: string
  accent?: boolean
}

export function StatBadge({ value, label, icon, accent }: StatBadgeProps) {
  return (
    <View style={[styles.container, accent && styles.containerAccent]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.value, accent && styles.valueAccent]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
  },
  containerAccent: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  icon: {
    fontSize: 16,
    marginBottom: 2,
  },
  value: {
    color: colors.text,
    fontSize: font.lg,
    fontWeight: '700',
  },
  valueAccent: {
    color: colors.accent,
  },
  label: {
    color: colors.textMuted,
    fontSize: font.xs,
    fontWeight: '500',
  },
})
