import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import { LinearGradient } from 'expo-linear-gradient'
import Body from 'react-native-body-highlighter'
import { OnboardingStep, ONB } from '@/components/OnboardingStep'
import { useT } from '@/lib/i18n'
import { setBodyGender, type BodyGender } from '@/lib/bodyGender'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  id: string
  question: string
  options: Option[]
}

interface Option {
  value: string
  label: string
  icon: React.ComponentProps<typeof Ionicons>['name']
}

export interface QuizAnswers {
  why: string
  goal: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────
// Nivån väljs på nästa sida (Välj din nivå) — därför ingen "hur hårt"-fråga
// här, det vore samma val två gånger.

const QUESTIONS: Question[] = [
  {
    id: 'why',
    question: 'Vad är ditt varför?',
    options: [
      { value: 'prove', label: 'Bevisa något för mig själv', icon: 'flag-outline' },
      { value: 'body', label: 'Förändra min kropp', icon: 'body-outline' },
      { value: 'habits', label: 'Bryta dåliga vanor', icon: 'repeat-outline' },
      { value: 'mental', label: 'Bygga mental styrka', icon: 'flash-outline' },
    ],
  },
  {
    id: 'goal',
    question: 'Vad är ditt huvudmål?',
    options: [
      { value: 'weight', label: 'Gå ner i vikt', icon: 'trending-down-outline' },
      { value: 'muscle', label: 'Bygga muskler', icon: 'barbell-outline' },
      { value: 'energy', label: 'Få mer energi och fokus', icon: 'sunny-outline' },
      { value: 'routines', label: 'Skapa bättre rutiner', icon: 'calendar-outline' },
    ],
  },
]

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function QuizScreen() {
  const t = useT()
  const { startDay } = useLocalSearchParams<{ startDay?: string }>()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({})
  // Steg 3: vilken figur muskelvyerna ska visa, sparas som eget val direkt
  const [bodyChoice, setBodyChoice] = useState<BodyGender | null>(null)

  const isBodyStep = step === QUESTIONS.length
  const current = isBodyStep ? null : QUESTIONS[step]
  const selected = current ? answers[current.id as keyof QuizAnswers] : undefined
  const canNext = isBodyStep ? bodyChoice !== null : !!selected

  function handleNext() {
    if (!canNext) return
    if (isBodyStep) {
      setBodyGender(bodyChoice!)
      router.push({
        pathname: '/(auth)/recommendation',
        params: { ...(answers as Record<string, string>), ...(startDay ? { startDay } : {}) },
      })
    } else {
      setStep((s) => s + 1)
    }
  }

  return (
    <OnboardingStep
      step={step + 1}
      title={isBodyStep ? t('Vem ska visas i muskelvyerna?') : t(current!.question)}
      subtitle={isBodyStep
        ? t('Statistiken markerar musklerna du tränat på en figur. Välj den som känns som du.')
        : t('Ditt svar hjälper oss att forma din utmaning.')}
      // Steg 1 kan inte backa — kontot är redan skapat, välkomstsidan är passerad
      onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
      footer={
        <TouchableOpacity onPress={handleNext} disabled={!canNext} activeOpacity={0.85}>
          <LinearGradient
            colors={[ONB.ORANGE, ONB.ORANGE_DEEP]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[s.nextButton, !canNext && { opacity: 0.35 }]}
          >
            <Text style={s.nextButtonText}>{isBodyStep ? t('Välj nivå') : t('Nästa')}</Text>
            <Ionicons name="arrow-forward" size={17} color={ONB.NAVY} />
          </LinearGradient>
        </TouchableOpacity>
      }
    >
      {isBodyStep && (
        <>
          <View style={s.bodyRow}>
            {(['male', 'female'] as const).map(g => {
              const isSelected = bodyChoice === g
              return (
                <TouchableOpacity
                  key={g}
                  style={[s.bodyCard, isSelected && s.optionSelected]}
                  onPress={() => setBodyChoice(g)}
                  activeOpacity={0.85}
                  testID={`bodyChoice-${g}`}
                >
                  <View style={s.bodyFigure} pointerEvents="none">
                    <Body
                      data={[
                        { slug: 'chest', intensity: 1 as const },
                        { slug: 'abs', intensity: 1 as const },
                        { slug: 'quadriceps', intensity: 1 as const },
                        { slug: 'deltoids', intensity: 1 as const },
                      ]}
                      side="front"
                      gender={g}
                      scale={0.33}
                      colors={[ONB.ORANGE]}
                      defaultFill="#4A4E5C"
                    />
                  </View>
                  <Text style={[s.optionLabel, s.bodyLabel, isSelected && s.optionLabelSelected]}>
                    {g === 'male' ? t('Man') : t('Kvinna')}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          <Text style={s.bodyHint}>
            {t('Påverkar bara figuren i vyerna, aldrig din statistik. Du kan byta när som helst under Allmänt.')}
          </Text>
        </>
      )}
      {!isBodyStep && current!.options.map((option) => {
        const isSelected = selected === option.value
        return (
          <TouchableOpacity
            key={option.value}
            style={[s.option, isSelected && s.optionSelected]}
            onPress={() => setAnswers((prev) => ({ ...prev, [current!.id]: option.value }))}
            activeOpacity={0.8}
          >
            <View style={[s.optionIcon, isSelected && { backgroundColor: 'rgba(255,168,23,0.16)' }]}>
              <Ionicons name={option.icon} size={20} color={isSelected ? ONB.ORANGE : ONB.MUTED} />
            </View>
            <Text style={[s.optionLabel, isSelected && s.optionLabelSelected]}>
              {t(option.label)}
            </Text>
            <View style={[s.radio, isSelected && s.radioSelected]}>
              {isSelected && <Ionicons name="checkmark" size={13} color={ONB.NAVY} />}
            </View>
          </TouchableOpacity>
        )
      })}
    </OnboardingStep>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: ONB.CARD,
    borderWidth: 1.5,
    borderColor: ONB.EDGE,
    borderRadius: 18,
    padding: 16,
  },
  optionSelected: {
    borderColor: ONB.ORANGE,
    backgroundColor: 'rgba(255,168,23,0.08)',
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    color: ONB.MUTED,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  optionLabelSelected: {
    color: ONB.OFFWHITE,
    fontWeight: '700',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: ONB.ORANGE,
    backgroundColor: ONB.ORANGE,
  },
  bodyRow: { flexDirection: 'row', gap: 14 },
  bodyCard: {
    flex: 1, alignItems: 'center', gap: 8,
    backgroundColor: ONB.CARD, borderWidth: 1.5, borderColor: ONB.EDGE,
    borderRadius: 18, paddingVertical: 16,
  },
  bodyFigure: { height: 205, alignItems: 'center', overflow: 'hidden' },
  bodyLabel: { flex: 0, textAlign: 'center' },
  bodyHint: {
    color: ONB.MUTED, fontSize: 13, lineHeight: 19, textAlign: 'center',
    paddingHorizontal: 8, marginTop: 2,
  },
  nextButton: {
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: ONB.ORANGE,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  nextButtonText: {
    color: ONB.NAVY,
    fontSize: 16,
    fontWeight: '800',
  },
})
