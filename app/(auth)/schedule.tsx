import { useEffect, useState } from 'react'
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
import { saveSchedule, getSchedule } from '@/services/schedule'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeState {
  hours: number
  minutes: number
}

interface ScheduleTemplate {
  id: string
  name: string
  tagline: string
  wakeLabel: string
  wakeTime: TimeState
  breakfast: TimeState
  lunch: TimeState
  dinner: TimeState
  workout1: TimeState
  workout2: TimeState
}

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES: ScheduleTemplate[] = [
  {
    id: '5am',
    name: 'The 5 AM Club',
    tagline: 'Äg morgonen innan världen vaknar.',
    wakeLabel: 'Vaknar 05:00',
    wakeTime:  { hours: 5,  minutes: 0  },
    breakfast: { hours: 7,  minutes: 0  },
    lunch:     { hours: 12, minutes: 0  },
    dinner:    { hours: 18, minutes: 0  },
    workout1:  { hours: 5,  minutes: 30 },
    workout2:  { hours: 17, minutes: 0  },
  },
  {
    id: 'warrior',
    name: 'Morgonkrigaren',
    tagline: 'Klart för dagen innan alla andra vaknat.',
    wakeLabel: 'Vaknar 06:00',
    wakeTime:  { hours: 6,  minutes: 0  },
    breakfast: { hours: 7,  minutes: 0  },
    lunch:     { hours: 12, minutes: 0  },
    dinner:    { hours: 18, minutes: 30 },
    workout1:  { hours: 6,  minutes: 30 },
    workout2:  { hours: 17, minutes: 30 },
  },
  {
    id: 'balanced',
    name: 'Balansen',
    tagline: 'Jobb, träning och återhämtning i harmoni.',
    wakeLabel: 'Vaknar 07:00',
    wakeTime:  { hours: 7,  minutes: 0  },
    breakfast: { hours: 7,  minutes: 30 },
    lunch:     { hours: 12, minutes: 30 },
    dinner:    { hours: 18, minutes: 30 },
    workout1:  { hours: 12, minutes: 0  },
    workout2:  { hours: 18, minutes: 0  },
  },
  {
    id: 'evening',
    name: 'Kvällspasset',
    tagline: 'För dig som äger kvällarna.',
    wakeLabel: 'Vaknar 07:30',
    wakeTime:  { hours: 7,  minutes: 30 },
    breakfast: { hours: 8,  minutes: 0  },
    lunch:     { hours: 13, minutes: 0  },
    dinner:    { hours: 19, minutes: 0  },
    workout1:  { hours: 17, minutes: 0  },
    workout2:  { hours: 19, minutes: 30 },
  },
  {
    id: 'custom',
    name: 'Anpassat',
    tagline: 'Bygg ditt eget schema från grunden.',
    wakeLabel: 'Välj tider',
    wakeTime:  { hours: 6,  minutes: 0  },
    breakfast: { hours: 7,  minutes: 0  },
    lunch:     { hours: 12, minutes: 0  },
    dinner:    { hours: 18, minutes: 0  },
    workout1:  { hours: 6,  minutes: 30 },
    workout2:  { hours: 17, minutes: 0  },
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return String(n).padStart(2, '0')
}

function toTimeString(t: TimeState): string {
  return `${fmt(t.hours)}:${fmt(t.minutes)}`
}

function parseTime(str: string): TimeState {
  const [h, m] = str.split(':').map(Number)
  return { hours: h || 0, minutes: m || 0 }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: ScheduleTemplate
  selected: boolean
  onSelect: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.templateCard, selected && styles.templateCardSelected]}
      onPress={onSelect}
      activeOpacity={0.75}
    >
      {selected && <View style={styles.templateAccent} />}
      <Text style={[styles.templateName, selected && styles.templateNameSelected]}>
        {template.name}
      </Text>
      <Text style={styles.templateTagline} numberOfLines={2}>
        {template.tagline}
      </Text>
      <View style={styles.templateFooter}>
        <Ionicons name="sunny-outline" size={12} color={selected ? ORANGE : TEXT_SECONDARY} />
        <Text style={[styles.templateWake, selected && styles.templateWakeSelected]}>
          {template.wakeLabel}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

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
        <Ionicons name="chevron-up" size={16} color={ORANGE} />
      </TouchableOpacity>
      <Text style={styles.digitValue}>{fmt(value)}</Text>
      <TouchableOpacity onPress={onDec} style={styles.digitBtn} activeOpacity={0.6}>
        <Ionicons name="chevron-down" size={16} color={ORANGE} />
      </TouchableOpacity>
    </View>
  )
}

function TimePicker({
  label,
  icon,
  time,
  onChange,
}: {
  label: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  time: TimeState
  onChange: (t: TimeState) => void
}) {
  return (
    <View style={styles.pickerRow}>
      <View style={styles.pickerLeft}>
        <View style={styles.pickerIcon}>
          <Ionicons name={icon} size={17} color={ORANGE} />
        </View>
        <Text style={styles.pickerLabel}>{label}</Text>
      </View>
      <View style={styles.pickerRight}>
        <TimeDigit
          value={time.hours}
          onInc={() => onChange({ ...time, hours: (time.hours + 1) % 24 })}
          onDec={() => onChange({ ...time, hours: (time.hours - 1 + 24) % 24 })}
        />
        <Text style={styles.colon}>:</Text>
        <TimeDigit
          value={time.minutes}
          onInc={() => onChange({ ...time, minutes: (time.minutes + 15) % 60 })}
          onDec={() => onChange({ ...time, minutes: (time.minutes - 15 + 60) % 60 })}
        />
      </View>
    </View>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

// Nås numera bara från Inställningar — onboardingen använder setup-schedule
// (tiderna här kopplas till notiser när dev-builden är på plats)
export default function ScheduleScreen() {
  const defaultTpl = TEMPLATES[1] // Morgonkrigaren
  const [selectedTemplate, setSelectedTemplate] = useState<string>(defaultTpl.id)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [wakeTime,  setWakeTime]  = useState<TimeState>(defaultTpl.wakeTime)
  const [breakfast, setBreakfast] = useState<TimeState>(defaultTpl.breakfast)
  const [lunch,     setLunch]     = useState<TimeState>(defaultTpl.lunch)
  const [dinner,    setDinner]    = useState<TimeState>(defaultTpl.dinner)
  const [workout1,  setWorkout1]  = useState<TimeState>(defaultTpl.workout1)
  const [workout2,  setWorkout2]  = useState<TimeState>(defaultTpl.workout2)

  useEffect(() => {
    async function loadExisting() {
      setLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        const existing = await getSchedule(session.user.id)
        if (!existing) return

        // Ladda sparad mall — faller tillbaka på 'custom' om ingen finns
        const savedTemplate = (existing as any).template_id ?? 'custom'
        setSelectedTemplate(TEMPLATES.some(t => t.id === savedTemplate) ? savedTemplate : 'custom')

        if (existing.wake_time) setWakeTime(parseTime(existing.wake_time))
        const meals = existing.meal_times as { label: string; time: string }[] | null
        if (meals?.[0]) setBreakfast(parseTime(meals[0].time))
        if (meals?.[1]) setLunch(parseTime(meals[1].time))
        if (meals?.[2]) setDinner(parseTime(meals[2].time))
        const workouts = existing.workout_times as { label: string; time: string }[] | null
        if (workouts?.[0]) setWorkout1(parseTime(workouts[0].time))
        if (workouts?.[1]) setWorkout2(parseTime(workouts[1].time))
      } finally {
        setLoading(false)
      }
    }
    loadExisting()
  }, [])

  function applyTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id)
    if (!t) return
    setSelectedTemplate(id)
    setWakeTime(t.wakeTime)
    setBreakfast(t.breakfast)
    setLunch(t.lunch)
    setDinner(t.dinner)
    setWorkout1(t.workout1)
    setWorkout2(t.workout2)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.replace('/(auth)/login'); return }

      await saveSchedule({
        userId:      session.user.id,
        templateId:  selectedTemplate,
        wakeTime:    toTimeString(wakeTime),
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
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.stepLabel}>DITT SCHEMA</Text>
          <Text style={styles.title}>Bygg din dag</Text>
          <Text style={styles.subtitle}>
            Välj en mall eller anpassa ditt eget schema. Du kan ändra när som helst.
          </Text>
        </View>

        {/* Template picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>VÄLJ MALL</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.templateRow}
          >
            {TEMPLATES.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                selected={selectedTemplate === t.id}
                onSelect={() => applyTemplate(t.id)}
              />
            ))}
          </ScrollView>
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
          <TimePicker label="Frukost" icon="cafe-outline"       time={breakfast} onChange={setBreakfast} />
          <View style={styles.divider} />
          <TimePicker label="Lunch"   icon="restaurant-outline" time={lunch}     onChange={setLunch} />
          <View style={styles.divider} />
          <TimePicker label="Middag"  icon="moon-outline"       time={dinner}    onChange={setDinner} />
        </SectionCard>

        {/* Workouts */}
        <SectionCard title="TRÄNINGSPASS">
          <TimePicker label="Pass 1" icon="barbell-outline" time={workout1} onChange={setWorkout1} />
          <View style={styles.divider} />
          <TimePicker label="Pass 2" icon="barbell-outline" time={workout2} onChange={setWorkout2} />
        </SectionCard>

        {/* Actions */}
        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.saveButtonText}>Spara schema</Text>
          }
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
    paddingTop: 16,
    paddingBottom: 48,
    gap: 24,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    gap: 8,
  },
  stepLabel: {
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

  // Sections
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingHorizontal: 24,
  },
  sectionCard: {
    marginHorizontal: 20,
    backgroundColor: CARD,
    borderRadius: 16,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginHorizontal: 16,
  },

  // Template cards
  templateRow: {
    paddingHorizontal: 20,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  templateCard: {
    width: 148,
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    overflow: 'hidden',
  },
  templateCardSelected: {
    backgroundColor: ORANGE + '16',
  },
  templateAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: ORANGE,
  },
  templateName: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  templateNameSelected: {
    color: ORANGE,
  },
  templateTagline: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 17,
  },
  templateFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  templateWake: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '600',
  },
  templateWakeSelected: {
    color: ORANGE,
  },

  // Time picker
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pickerIcon: {
    width: 34,
    height: 34,
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
    gap: 2,
  },
  digit: {
    alignItems: 'center',
    gap: 0,
  },
  digitBtn: {
    padding: 4,
  },
  digitValue: {
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: '700',
    width: 30,
    textAlign: 'center',
  },
  colon: {
    color: TEXT_SECONDARY,
    fontSize: 20,
    fontWeight: '700',
    marginHorizontal: 2,
    paddingBottom: 2,
  },

  // Buttons
  saveButton: {
    marginHorizontal: 20,
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
})
