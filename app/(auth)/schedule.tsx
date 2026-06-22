import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { saveSchedule } from '@/services/schedule'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeState {
  hours: number
  minutes: number
}

function fmt(n: number): string {
  return String(n).padStart(2, '0')
}

function toTimeString(t: TimeState): string {
  return `${fmt(t.hours)}:${fmt(t.minutes)}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TimeDigit({
  value,
  onInc,
  onDec,
}: {
  value: number
  onInc: () => void
  onDec: () => void
}) {
  return (
    <View style={styles.digit}>
      <TouchableOpacity onPress={onInc} style={styles.digitBtn} activeOpacity={0.6}>
        <Ionicons name="chevron-up" size={18} color={ORANGE} />
      </TouchableOpacity>
      <Text style={styles.digitValue}>{fmt(value)}</Text>
      <TouchableOpacity onPress={onDec} style={styles.digitBtn} activeOpacity={0.6}>
        <Ionicons name="chevron-down" size={18} color={ORANGE} />
      </TouchableOpacity>
    </View>
  )
}

function TimePicker({
  label,
  time,
  icon,
  onChange,
}: {
  label: string
  time: TimeState
  icon: React.ComponentProps<typeof Ionicons>['name']
  onChange: (t: TimeState) => void
}) {
  function incHours()   { onChange({ ...time, hours:   (time.hours + 1) % 24 }) }
  function decHours()   { onChange({ ...time, hours:   (time.hours - 1 + 24) % 24 }) }
  function incMinutes() { onChange({ ...time, minutes: (time.minutes + 15) % 60 }) }
  function decMinutes() { onChange({ ...time, minutes: (time.minutes - 15 + 60) % 60 }) }

  return (
    <View style={styles.pickerRow}>
      <View style={styles.pickerLeft}>
        <View style={styles.pickerIcon}>
          <Ionicons name={icon} size={18} color={ORANGE} />
        </View>
        <Text style={styles.pickerLabel}>{label}</Text>
      </View>
      <View style={styles.pickerRight}>
        <TimeDigit value={time.hours} onInc={incHours} onDec={decHours} />
        <Text style={styles.colon}>:</Text>
        <TimeDigit value={time.minutes} onInc={incMinutes} onDec={decMinutes} />
      </View>
    </View>
  )
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const [loading, setLoading] = useState(false)

  const [wakeTime,    setWakeTime]    = useState<TimeState>({ hours: 6,  minutes: 0  })
  const [breakfast,   setBreakfast]   = useState<TimeState>({ hours: 7,  minutes: 0  })
  const [lunch,       setLunch]       = useState<TimeState>({ hours: 12, minutes: 0  })
  const [dinner,      setDinner]      = useState<TimeState>({ hours: 18, minutes: 0  })
  const [workout1,    setWorkout1]    = useState<TimeState>({ hours: 6,  minutes: 30 })
  const [workout2,    setWorkout2]    = useState<TimeState>({ hours: 17, minutes: 0  })

  async function handleSave() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.replace('/(auth)/login'); return }

      await saveSchedule({
        userId:    session.user.id,
        wakeTime:  toTimeString(wakeTime),
        mealTimes: [
          { label: 'Frukost', time: toTimeString(breakfast) },
          { label: 'Lunch',   time: toTimeString(lunch) },
          { label: 'Middag',  time: toTimeString(dinner) },
        ],
        workoutTimes: [
          { label: 'Pass 1', time: toTimeString(workout1) },
          { label: 'Pass 2', time: toTimeString(workout2) },
        ],
      })

      router.replace('/(app)/dashboard')
    } catch (e: any) {
      Alert.alert('Något gick fel', e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSkip() {
    router.replace('/(app)/dashboard')
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.label}>STEG 5 AV 5</Text>
          <Text style={styles.title}>Bygg din dag</Text>
          <Text style={styles.subtitle}>
            Sätt dina tider för smarta påminnelser. Du kan alltid ändra detta senare.
          </Text>
        </View>

        {/* Wake time */}
        <SectionCard title="VÄCKNINGSTID">
          <TimePicker
            label="Jag vaknar"
            icon="sunny-outline"
            time={wakeTime}
            onChange={setWakeTime}
          />
        </SectionCard>

        {/* Meals */}
        <SectionCard title="MÅLTIDER">
          <TimePicker
            label="Frukost"
            icon="cafe-outline"
            time={breakfast}
            onChange={setBreakfast}
          />
          <View style={styles.divider} />
          <TimePicker
            label="Lunch"
            icon="restaurant-outline"
            time={lunch}
            onChange={setLunch}
          />
          <View style={styles.divider} />
          <TimePicker
            label="Middag"
            icon="moon-outline"
            time={dinner}
            onChange={setDinner}
          />
        </SectionCard>

        {/* Workouts */}
        <SectionCard title="TRÄNINGSPASS">
          <TimePicker
            label="Pass 1"
            icon="barbell-outline"
            time={workout1}
            onChange={setWorkout1}
          />
          <View style={styles.divider} />
          <TimePicker
            label="Pass 2"
            icon="barbell-outline"
            time={workout2}
            onChange={setWorkout2}
          />
        </SectionCard>

        {/* Actions */}
        <TouchableOpacity
          style={[styles.saveButton, loading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.saveButtonText}>Spara schema</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Hoppa över — ställ in senare</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
    gap: 24,
  },

  // Header
  header: {
    gap: 8,
    paddingBottom: 4,
  },
  label: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 36,
  },
  subtitle: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    lineHeight: 20,
  },

  // Section
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: 16,
  },

  // Time picker row
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pickerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ORANGE + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerLabel: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '500',
  },
  pickerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Digit
  digit: {
    alignItems: 'center',
    gap: 2,
  },
  digitBtn: {
    padding: 4,
  },
  digitValue: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: '700',
    width: 32,
    textAlign: 'center',
  },
  colon: {
    color: TEXT_SECONDARY,
    fontSize: 22,
    fontWeight: '700',
    marginHorizontal: 2,
    paddingBottom: 4,
  },

  // Buttons
  saveButton: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  skipText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
})
