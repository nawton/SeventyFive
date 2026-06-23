import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, font, radius } from './theme'

const DAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

interface WeekStripProps {
  currentDay: number   // dag 1–75
  startDate: Date
}

export function WeekStrip({ currentDay, startDate }: WeekStripProps) {
  // Bygger 7 dagar centrerade kring idag
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today)
    date.setDate(today.getDate() - 3 + i)
    const dayNum = Math.round((date.getTime() - startDate.getTime()) / 86400000) + 1
    return {
      label: DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1],
      date: date.getDate(),
      dayNum,
      isToday: i === 3,
      isPast: i < 3,
      isFuture: i > 3,
    }
  })

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {days.map((day, i) => (
        <View key={i} style={styles.dayWrapper}>
          {/* Prick som visar om dagen är klar */}
          <View style={[
            styles.dot,
            day.isPast && styles.dotDone,
            day.isToday && styles.dotToday,
          ]} />

          <View style={[
            styles.dayCard,
            day.isToday && styles.dayCardToday,
          ]}>
            <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>
              {day.label}
            </Text>
            <Text style={[styles.dayDate, day.isToday && styles.dayDateToday]}>
              {day.date}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
    gap: 8,
    alignItems: 'flex-start',
  },
  dayWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  dotDone: {
    backgroundColor: colors.accent,
  },
  dotToday: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  dayCard: {
    width: 48,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  dayCardToday: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  dayLabel: {
    color: colors.textMuted,
    fontSize: font.xs,
    fontWeight: '500',
  },
  dayLabelToday: {
    color: colors.accent,
  },
  dayDate: {
    color: colors.text,
    fontSize: font.md,
    fontWeight: '700',
  },
  dayDateToday: {
    color: colors.accent,
  },
})
