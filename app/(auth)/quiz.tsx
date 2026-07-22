import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router, useLocalSearchParams } from 'expo-router'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  id: string
  question: string
  options: Option[]
}

interface Option {
  value: string
  label: string
}

export interface QuizAnswers {
  why: string
  goal: string
  pressure: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const QUESTIONS: Question[] = [
  {
    id: 'why',
    question: 'Vad är ditt varför?',
    options: [
      { value: 'prove', label: 'Bevisa något för mig själv' },
      { value: 'body', label: 'Förändra min kropp' },
      { value: 'habits', label: 'Bryta dåliga vanor' },
      { value: 'mental', label: 'Bygga mental styrka' },
    ],
  },
  {
    id: 'goal',
    question: 'Vad är ditt huvudmål?',
    options: [
      { value: 'weight', label: 'Gå ner i vikt' },
      { value: 'muscle', label: 'Bygga muskler' },
      { value: 'energy', label: 'Få mer energi och fokus' },
      { value: 'routines', label: 'Skapa bättre rutiner' },
    ],
  },
  {
    id: 'pressure',
    question: 'Hur hårt vill du ha det?',
    options: [
      { value: 'normal', label: 'Lagom, jag tar det steg för steg' },
      { value: 'hard', label: 'Hårt, jag vill utmanas ordentligt' },
      { value: 'extreme', label: 'Extremt, jag vill testa min gräns' },
    ],
  },
]

import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function QuizScreen() {
  const { startDay } = useLocalSearchParams<{ startDay?: string }>()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({})

  const current = QUESTIONS[step]
  const selected = answers[current.id as keyof QuizAnswers]
  const isLast = step === QUESTIONS.length - 1

  function selectOption(value: string) {
    setAnswers((prev) => ({ ...prev, [current.id]: value }))
  }

  function handleNext() {
    if (!selected) return
    if (isLast) {
      router.push({
        pathname: '/(auth)/recommendation',
        params: { ...(answers as Record<string, string>), ...(startDay ? { startDay } : {}) },
      })
    } else {
      setStep((s) => s + 1)
    }
  }

  function handleBack() {
    if (step === 0) router.back()
    else setStep((s) => s - 1)
  }

  return (
    <SafeScreen style={styles.screen}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.progressDots}>
          {QUESTIONS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i <= step && styles.dotActive]}
            />
          ))}
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Question */}
      <View style={styles.body}>
        <Text style={styles.stepLabel}>Steg {step + 1} av 5</Text>
        <Text style={styles.question}>{current.question}</Text>

        <View style={styles.options}>
          {current.options.map((option) => {
            const isSelected = selected === option.value
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => selectOption(option.value)}
                activeOpacity={0.7}
              >
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* Next button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, !selected && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!selected}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {isLast ? 'Se mitt resultat' : 'Nästa'}
          </Text>
        </TouchableOpacity>
      </View>

    </SafeScreen>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: TEXT_PRIMARY,
    fontSize: 22,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BORDER,
  },
  dotActive: {
    backgroundColor: ORANGE,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 24,
  },
  stepLabel: {
    color: ORANGE,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  question: {
    color: TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
  },
  options: {
    gap: 12,
    marginTop: 8,
  },
  option: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  optionSelected: {
    backgroundColor: ORANGE + '16',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: ORANGE,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ORANGE,
  },
  optionLabel: {
    color: TEXT_SECONDARY,
    fontSize: 16,
    flex: 1,
  },
  optionLabelSelected: {
    color: TEXT_PRIMARY,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  nextButton: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.3,
  },
  nextButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
})
