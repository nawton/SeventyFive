import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Modal, Dimensions, TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Body from 'react-native-body-highlighter'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT } from '@/lib/theme'
import { RUN_SESSION_INFO, plannedRunTypes, type RunExperience } from '@/services/scheduleGenerator'
import type { Slug } from '@/lib/muscles'

const SCREEN_W = Dimensions.get('window').width
const BODY_SCALE = 0.46

// ─── Data ────────────────────────────────────────────────────────────────────

const GROUP_SLUGS: Record<string, Slug[]> = {
  chest:     ['chest'],
  back:      ['upper-back', 'lower-back', 'trapezius'],
  legs:      ['quadriceps', 'hamstring', 'gluteal', 'calves'],
  shoulders: ['deltoids'],
  arms:      ['biceps', 'triceps'],
  core:      ['abs', 'obliques'],
}

const ALL_SLUGS: Slug[] = Object.values(GROUP_SLUGS).flat()

const MUSCLE_GROUPS = [
  { key: 'chest',     label: 'Bröst',   color: '#FF6B6B' },
  { key: 'back',      label: 'Rygg',    color: '#4ECDC4' },
  { key: 'legs',      label: 'Ben',     color: '#45B7D1' },
  { key: 'shoulders', label: 'Axlar',   color: '#F7DC6F' },
  { key: 'arms',      label: 'Armar',   color: '#A29BFE' },
  { key: 'core',      label: 'Mage',    color: '#FD79A8' },
]

const RUN_OPTIONS = [
  { key: '5k',       label: '5K',          sub: 'Perfekt startpunkt',      icon: 'walk-outline'     },
  { key: '10k',      label: '10K',          sub: 'Nästa nivå',              icon: 'fitness-outline'  },
  { key: 'half',     label: 'Halvmarathon', sub: '21.1 km',                icon: 'flag-outline'     },
  { key: 'marathon', label: 'Marathon',     sub: '42.2 km, den ultimata', icon: 'trophy-outline'   },
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

type Goal        = 'running' | 'muscle' | null
type RunDistance = '5k' | '10k' | 'half' | 'marathon' | null
type MusclePlan  = 'everything' | 'focus' | null
type Limitation  = 'knee' | 'back' | 'shoulder'
type Step        = 'goal' | 'running-distance' | 'running-profile' | 'muscle-plan' | 'muscle-focus' | 'days' | 'limitations' | 'summary'

export type WizardResult = {
  goal:        Goal
  runDistance: RunDistance
  musclePlan:  MusclePlan
  focusGroups: string[]
  /** Valda träningsdagar, 1=Mån … 7=Sön */
  weekdays:    number[]
  limitations: Limitation[]
  /** Löperfarenhet — styr startnivå och ökningstakt i löpplanen */
  runExperience: RunExperience | null
  /** 5 km-testtid i sekunder — ger tempozoner i passen; null = inte angiven */
  fiveKTimeSec:  number | null
}

const EXPERIENCE_OPTIONS: Array<{ key: RunExperience; label: string; sub: string; icon: string }> = [
  { key: 'beginner',     label: 'Nybörjare',    sub: 'Ny till löpning eller springer sporadiskt',      icon: 'leaf-outline' },
  { key: 'intermediate', label: 'Van motionär', sub: 'Springer regelbundet, 1–2 pass i veckan',        icon: 'walk-outline' },
  { key: 'advanced',     label: 'Erfaren',      sub: 'Tränar strukturerad löpning flera gånger i veckan', icon: 'rocket-outline' },
]

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Måndag'  },
  { value: 2, label: 'Tisdag'  },
  { value: 3, label: 'Onsdag'  },
  { value: 4, label: 'Torsdag' },
  { value: 5, label: 'Fredag'  },
  { value: 6, label: 'Lördag'  },
  { value: 7, label: 'Söndag'  },
] as const

const LIMITATION_OPTIONS: Array<{ key: Limitation; label: string; icon: string }> = [
  { key: 'knee',     label: 'Knäproblem',   icon: 'walk-outline' },
  { key: 'back',     label: 'Ryggproblem',  icon: 'body-outline' },
  { key: 'shoulder', label: 'Axelproblem',  icon: 'barbell-outline' },
]

const STEP_PROGRESS: Record<Step, number> = {
  'goal':              0,
  'running-distance':  0.25,
  'running-profile':   0.4,
  'muscle-plan':       0.3,
  'muscle-focus':      0.45,
  'days':              0.6,
  'limitations':       0.8,
  'summary':           1,
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ScheduleWizard({
  visible,
  onClose,
  onFinish,
}: {
  visible:  boolean
  onClose:  () => void
  onFinish: (result: WizardResult) => void
}) {
  const insets = useSafeAreaInsets()

  const [step, setStep]               = useState<Step>('goal')
  const [goal, setGoal]               = useState<Goal>(null)
  const [runDistance, setRunDistance] = useState<RunDistance>(null)
  const [runExperience, setRunExperience] = useState<RunExperience | null>(null)
  const [fiveKMin, setFiveKMin]       = useState('')
  const [fiveKSec, setFiveKSec]       = useState('')
  const [musclePlan, setMusclePlan]   = useState<MusclePlan>(null)
  const [focusGroups, setFocusGroups] = useState<string[]>([])
  const [weekdays, setWeekdays]       = useState<number[]>([])
  const [limitations, setLimitations] = useState<Limitation[]>([])

  function reset() {
    setStep('goal'); setGoal(null); setRunDistance(null)
    setRunExperience(null); setFiveKMin(''); setFiveKSec('')
    setMusclePlan(null); setFocusGroups([])
    setWeekdays([]); setLimitations([])
  }

  function toggleWeekday(day: number) {
    setWeekdays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)
    )
  }

  function handleClose() { reset(); onClose() }

  function goBack() {
    if (step === 'goal')              { handleClose(); return }
    if (step === 'running-distance')  { setStep('goal'); return }
    if (step === 'running-profile')   { setStep('running-distance'); return }
    if (step === 'muscle-plan')       { setStep('goal'); return }
    if (step === 'muscle-focus')      { setStep('muscle-plan'); return }
    if (step === 'days') {
      if (goal === 'running')             setStep('running-profile')
      else if (musclePlan === 'focus')    setStep('muscle-focus')
      else                                setStep('muscle-plan')
      return
    }
    if (step === 'limitations')       { setStep('days'); return }
    if (step === 'summary')           { setStep('limitations') }
  }

  function toggleLimitation(key: Limitation) {
    setLimitations(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  function toggleFocusGroup(key: string) {
    setFocusGroups(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : prev.length < 2 ? [...prev, key] : prev
    )
  }

  const focusSlugs = focusGroups.flatMap(g => GROUP_SLUGS[g] ?? [])
  const progress   = STEP_PROGRESS[step]

  const bodyData = (slugs: Slug[]) => slugs.map(sl => ({ slug: sl, intensity: 1 as const }))

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[s.screen, { paddingTop: insets.top }]}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={goBack} style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons
              name={step === 'goal' ? 'close' : 'chevron-back'}
              size={step === 'goal' ? 22 : 26}
              color={TEXT_PRIMARY}
            />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Skapa ditt schema</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Progress bar */}
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── STEP: MÅL ──────────────────────────────────────────────── */}
          {step === 'goal' && (
            <>
              <Text style={s.stepTitle}>Vad är ditt mål?</Text>
              <Text style={s.stepSub}>Välj det mål som passar dig bäst just nu.</Text>

              <TouchableOpacity
                style={[s.bigCard, goal === 'running' && s.bigCardActive]}
                onPress={() => setGoal('running')}
                activeOpacity={0.8}
              >
                <View style={[s.bigCardIcon, { backgroundColor: 'rgba(255,149,0,0.15)' }]}>
                  <Ionicons name="walk" size={34} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.bigCardTitle, goal === 'running' && { color: ORANGE }]}>
                    Springa ett avstånd
                  </Text>
                  <Text style={s.bigCardSub}>Träna mot ett specifikt löpmål</Text>
                </View>
                {goal === 'running' && <Ionicons name="checkmark-circle" size={24} color={ORANGE} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.bigCard, goal === 'muscle' && s.bigCardActive]}
                onPress={() => setGoal('muscle')}
                activeOpacity={0.8}
              >
                <View style={[s.bigCardIcon, { backgroundColor: 'rgba(162,155,254,0.15)' }]}>
                  <Ionicons name="barbell" size={34} color="#A29BFE" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.bigCardTitle, goal === 'muscle' && { color: ORANGE }]}>
                    Bygga muskler
                  </Text>
                  <Text style={s.bigCardSub}>Styrketräning anpassat efter dig</Text>
                </View>
                {goal === 'muscle' && <Ionicons name="checkmark-circle" size={24} color={ORANGE} />}
              </TouchableOpacity>

              <NextButton disabled={!goal} onPress={() => {
                if (!goal) return
                setStep(goal === 'running' ? 'running-distance' : 'muscle-plan')
              }} />
            </>
          )}

          {/* ── STEP: LÖPAVSTÅND ─────────────────────────────────────── */}
          {step === 'running-distance' && (
            <>
              <Text style={s.stepTitle}>Vilket avstånd siktar du på?</Text>
              <Text style={s.stepSub}>Vi anpassar programmet efter ditt mål.</Text>

              {RUN_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.optCard, runDistance === opt.key && s.optCardActive]}
                  onPress={() => setRunDistance(opt.key)}
                  activeOpacity={0.8}
                >
                  <View style={[s.optIcon, runDistance === opt.key && s.optIconActive]}>
                    <Ionicons
                      name={opt.icon as React.ComponentProps<typeof Ionicons>['name']}
                      size={26}
                      color={runDistance === opt.key ? ORANGE : TEXT_SECONDARY}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.optTitle, runDistance === opt.key && { color: ORANGE }]}>{opt.label}</Text>
                    <Text style={s.optSub}>{opt.sub}</Text>
                  </View>
                  {runDistance === opt.key && <Ionicons name="checkmark-circle" size={22} color={ORANGE} />}
                </TouchableOpacity>
              ))}

              <NextButton disabled={!runDistance} onPress={() => runDistance && setStep('running-profile')} />
            </>
          )}

          {/* ── STEP: LÖPARPROFIL — erfarenhet + 5 km-test ───────────── */}
          {step === 'running-profile' && (
            <>
              <Text style={s.stepTitle}>Din löparprofil</Text>
              <Text style={s.stepSub}>
                Startnivå och ökningstakt anpassas efter din erfarenhet.
              </Text>

              {EXPERIENCE_OPTIONS.map(opt => {
                const selected = runExperience === opt.key
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[s.optCard, selected && s.optCardActive]}
                    onPress={() => setRunExperience(opt.key)}
                    activeOpacity={0.8}
                  >
                    <View style={[s.optIcon, selected && s.optIconActive]}>
                      <Ionicons
                        name={opt.icon as React.ComponentProps<typeof Ionicons>['name']}
                        size={24}
                        color={selected ? ORANGE : TEXT_SECONDARY}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.optTitle, selected && { color: ORANGE }]}>{opt.label}</Text>
                      <Text style={s.optSub}>{opt.sub}</Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={22} color={ORANGE} />}
                  </TouchableOpacity>
                )
              })}

              {/* 5 km-test — frivilligt; ger tempozoner i passen. Totaltiden
                  valideras så ett angivet tempo (5:25) inte tolkas som tid */}
              {(() => {
                const total = (parseInt(fiveKMin, 10) || 0) * 60 + Math.min(59, parseInt(fiveKSec, 10) || 0)
                const implausible = total > 0 && (total < 12 * 60 || total > 90 * 60)
                return (
                  <>
                    <View style={s.testCard}>
                      <View style={s.testTitleRow}>
                        <Ionicons name="stopwatch-outline" size={17} color={ORANGE} />
                        <Text style={s.testTitle}>Hur snabbt springer du 5 km idag?</Text>
                      </View>
                      <View style={s.testRow}>
                        <View style={s.testCol}>
                          <TextInput
                            style={s.testInput}
                            value={fiveKMin}
                            onChangeText={v => setFiveKMin(v.replace(/[^0-9]/g, '').slice(0, 2))}
                            keyboardType="number-pad"
                            returnKeyType="done"
                            placeholder="28"
                            placeholderTextColor="rgba(255,255,255,0.22)"
                          />
                          <Text style={s.testUnit}>MIN</Text>
                        </View>
                        <Text style={s.testColon}>:</Text>
                        <View style={s.testCol}>
                          <TextInput
                            style={s.testInput}
                            value={fiveKSec}
                            onChangeText={v => setFiveKSec(v.replace(/[^0-9]/g, '').slice(0, 2))}
                            keyboardType="number-pad"
                            returnKeyType="done"
                            placeholder="30"
                            placeholderTextColor="rgba(255,255,255,0.22)"
                          />
                          <Text style={s.testUnit}>SEK</Text>
                        </View>
                      </View>
                      <Text style={implausible ? s.testWarn : s.testHint}>
                        {implausible
                          ? 'Det där ser ut som ett tempo, inte en totaltid — ange hela tiden för 5 km, t.ex. 28:30.'
                          : 'Frivilligt — med en tid får varje pass ett tempoförslag i min/km. Lämna tomt om du inte vet.'}
                      </Text>
                    </View>

                    <NextButton
                      disabled={!runExperience || implausible}
                      onPress={() => runExperience && !implausible && setStep('days')}
                    />
                  </>
                )
              })()}
            </>
          )}

          {/* ── STEP: MUSKELPLAN ─────────────────────────────────────── */}
          {step === 'muscle-plan' && (
            <>
              <Text style={s.stepTitle}>Hur vill du träna?</Text>
              <Text style={s.stepSub}>Välj ett upplägg som passar dina mål.</Text>

              {/* Body SVG — front + back side by side */}
              <View style={s.bodyRow}>
                <Body
                  data={bodyData(ALL_SLUGS)}
                  side="front" gender="male"
                  scale={BODY_SCALE}
                  colors={['#F5A623']}
                  defaultFill="#3A3A3C"
                />
                <Body
                  data={bodyData(ALL_SLUGS)}
                  side="back" gender="male"
                  scale={BODY_SCALE}
                  colors={['#F5A623']}
                  defaultFill="#3A3A3C"
                />
              </View>

              {/* Plan cards */}
              <TouchableOpacity
                style={[s.planCard, musclePlan === 'everything' && s.planCardActive]}
                onPress={() => setMusclePlan('everything')}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.planRecommended}>Rekommenderat</Text>
                  <Text style={[s.planTitle, musclePlan === 'everything' && { color: ORANGE }]}>
                    Träna allt
                  </Text>
                  <Text style={s.planSub}>Balanserat program för hela kroppen</Text>
                </View>
                {musclePlan === 'everything' && <Ionicons name="checkmark-circle" size={24} color={ORANGE} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.planCard, musclePlan === 'focus' && s.planCardActive]}
                onPress={() => setMusclePlan('focus')}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.planTitle, musclePlan === 'focus' && { color: ORANGE }]}>
                    Fokusera
                  </Text>
                  <Text style={s.planSub}>Välj 1–2 muskelgrupper att prioritera</Text>
                </View>
                {musclePlan === 'focus' && <Ionicons name="checkmark-circle" size={24} color={ORANGE} />}
              </TouchableOpacity>

              <NextButton disabled={!musclePlan} onPress={() => {
                if (!musclePlan) return
                setStep(musclePlan === 'focus' ? 'muscle-focus' : 'days')
              }} />
            </>
          )}

          {/* ── STEP: VÄLJ MUSKELFOKUS ───────────────────────────────── */}
          {step === 'muscle-focus' && (
            <>
              <Text style={s.stepTitle}>Välj fokusområden</Text>
              <Text style={s.stepSub}>
                Välj upp till 2 muskelgrupper att prioritera.
              </Text>

              {/* Dynamic body SVG */}
              <View style={s.bodyRow}>
                <Body
                  data={bodyData(focusSlugs.length > 0 ? focusSlugs : [])}
                  side="front" gender="male"
                  scale={BODY_SCALE}
                  colors={[ORANGE]}
                  defaultFill="#3A3A3C"
                />
                <Body
                  data={bodyData(focusSlugs.length > 0 ? focusSlugs : [])}
                  side="back" gender="male"
                  scale={BODY_SCALE}
                  colors={[ORANGE]}
                  defaultFill="#3A3A3C"
                />
              </View>

              {/* Muscle group selection chips */}
              <View style={s.muscleGrid}>
                {MUSCLE_GROUPS.map(mg => {
                  const selected = focusGroups.includes(mg.key)
                  const maxed    = !selected && focusGroups.length >= 2
                  return (
                    <TouchableOpacity
                      key={mg.key}
                      style={[
                        s.muscleChip,
                        selected && { backgroundColor: mg.color + '26' },
                        maxed && { opacity: 0.4 },
                      ]}
                      onPress={() => !maxed && toggleFocusGroup(mg.key)}
                      activeOpacity={0.75}
                    >
                      <View style={[s.muscleDot, { backgroundColor: mg.color }]} />
                      <Text style={[s.muscleChipText, selected && { color: mg.color }]}>
                        {mg.label}
                      </Text>
                      {selected && <Ionicons name="checkmark" size={14} color={mg.color} />}
                    </TouchableOpacity>
                  )
                })}
              </View>

              <NextButton disabled={focusGroups.length === 0} onPress={() => focusGroups.length > 0 && setStep('days')} />
            </>
          )}

          {/* ── STEP: VÄLJ TRÄNINGSDAGAR ─────────────────────────────── */}
          {step === 'days' && (
            <>
              <Text style={s.stepTitle}>Vilka dagar vill du träna?</Text>
              <Text style={s.stepSub}>
                Välj de dagar som passar din vecka — passen läggs på dagarna du bockar i.
              </Text>

              {WEEKDAY_OPTIONS.map(opt => {
                const selected = weekdays.includes(opt.value)
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.dayRow, selected && s.dayRowActive]}
                    onPress={() => toggleWeekday(opt.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.dayRowLabel, selected && { color: ORANGE }]}>{opt.label}</Text>
                    <View style={[s.dayCheck, selected && s.dayCheckActive]}>
                      {selected && <Ionicons name="checkmark" size={13} color="#000" />}
                    </View>
                  </TouchableOpacity>
                )
              })}

              <Text style={s.daysHint}>
                {weekdays.length === 0
                  ? 'Välj minst en dag'
                  : `${weekdays.length} pass per vecka`}
              </Text>

              <NextButton disabled={weekdays.length === 0} onPress={() => weekdays.length > 0 && setStep('limitations')} />
            </>
          )}

          {/* ── STEP: BESVÄR/SKADOR ──────────────────────────────────── */}
          {step === 'limitations' && (
            <>
              <Text style={s.stepTitle}>Har du några besvär?</Text>
              <Text style={s.stepSub}>
                Vi byter ut övningar som belastar känsliga områden. Hoppa över om inget stämmer.
              </Text>

              {LIMITATION_OPTIONS.map(opt => {
                const selected = limitations.includes(opt.key)
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[s.optCard, selected && s.optCardActive]}
                    onPress={() => toggleLimitation(opt.key)}
                    activeOpacity={0.8}
                  >
                    <View style={[s.optIcon, selected && s.optIconActive]}>
                      <Ionicons
                        name={opt.icon as React.ComponentProps<typeof Ionicons>['name']}
                        size={24}
                        color={selected ? ORANGE : TEXT_SECONDARY}
                      />
                    </View>
                    <Text style={[s.optTitle, { flex: 1 }, selected && { color: ORANGE }]}>{opt.label}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={22} color={ORANGE} />}
                  </TouchableOpacity>
                )
              })}

              <TouchableOpacity
                style={[s.optCard, limitations.length === 0 && s.optCardActive]}
                onPress={() => setLimitations([])}
                activeOpacity={0.8}
              >
                <View style={[s.optIcon, limitations.length === 0 && s.optIconActive]}>
                  <Ionicons name="checkmark-done-outline" size={24} color={limitations.length === 0 ? ORANGE : TEXT_SECONDARY} />
                </View>
                <Text style={[s.optTitle, { flex: 1 }, limitations.length === 0 && { color: ORANGE }]}>
                  Inga besvär
                </Text>
                {limitations.length === 0 && <Ionicons name="checkmark-circle" size={22} color={ORANGE} />}
              </TouchableOpacity>

              <NextButton disabled={false} onPress={() => setStep('summary')} />
            </>
          )}

          {/* ── STEP: SAMMANFATTNING ─────────────────────────────────── */}
          {step === 'summary' && (
            <>
              <View style={s.summaryCheckmark}>
                <View style={s.summaryIconCircle}>
                  <Ionicons name="checkmark" size={48} color="#000" />
                </View>
              </View>

              <Text style={s.summaryTitle}>Ditt schema är klart!</Text>
              <Text style={s.summarySub}>
                {goal === 'running'
                  ? `Vi skapar ett löpprogram anpassat för ${RUN_OPTIONS.find(o => o.key === runDistance)?.label ?? ''}.`
                  : musclePlan === 'everything'
                  ? 'Vi skapar ett balanserat styrkeprogram som tränar hela kroppen.'
                  : `Vi skapar ett program med fokus på ${focusGroups
                      .map(k => MUSCLE_GROUPS.find(m => m.key === k)?.label ?? '')
                      .join(' och ')}.`}
              </Text>

              {/* Preview row */}
              <View style={s.summaryCards}>
                <View style={s.summaryCard}>
                  <Ionicons name="calendar-outline" size={24} color={ORANGE} />
                  <Text style={s.summaryCardTitle}>Veckoschema</Text>
                  <Text style={s.summaryCardSub}>{Math.max(weekdays.length, 1)} pass per vecka</Text>
                </View>
                <View style={s.summaryCard}>
                  <Ionicons name="bar-chart-outline" size={24} color={ORANGE} />
                  <Text style={s.summaryCardTitle}>Progression</Text>
                  <Text style={s.summaryCardSub}>Passen växer vecka för vecka i 16 veckor</Text>
                </View>
              </View>

              {/* Passtyperna som ingår — så temporun inte är grekiska */}
              {goal === 'running' && (
                <View style={s.typeList}>
                  <Text style={s.typeListTitle}>Det här ingår i din plan</Text>
                  {[...new Set(plannedRunTypes(runDistance ?? '5k', Math.max(weekdays.length, 1)))].map(name => (
                    <View key={name} style={s.typeRow}>
                      <View style={s.typeDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.typeName}>{name}</Text>
                        <Text style={s.typeDesc}>{RUN_SESSION_INFO[name] ?? ''}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={s.nextBtn}
                onPress={() => {
                  const min = parseInt(fiveKMin, 10) || 0
                  const sec = Math.min(59, parseInt(fiveKSec, 10) || 0)
                  const total = min * 60 + sec
                  const result: WizardResult = {
                    goal, runDistance, musclePlan, focusGroups,
                    weekdays: weekdays.length > 0 ? weekdays : [1, 3, 5],
                    limitations,
                    runExperience,
                    // Bara rimliga totaltider — annars inga tempoförslag alls
                    fiveKTimeSec: total >= 12 * 60 && total <= 90 * 60 ? total : null,
                  }
                  reset()
                  onFinish(result)
                }}
                activeOpacity={0.85}
              >
                <Text style={s.nextBtnText}>Starta träning</Text>
                <Ionicons name="arrow-forward" size={18} color="#000" />
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </View>
    </Modal>
  )
}

// ─── Next button helper ───────────────────────────────────────────────────────

function NextButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[s.nextBtn, disabled && s.nextBtnDisabled]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      <Text style={s.nextBtnText}>Fortsätt</Text>
      <Ionicons name="arrow-forward" size={18} color="#000" />
    </TouchableOpacity>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
  },
  iconBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },

  progressTrack: {
    height: 3, backgroundColor: CARD,
    marginHorizontal: 16, borderRadius: 2, marginBottom: 4,
  },
  progressFill: { height: 3, backgroundColor: ORANGE, borderRadius: 2 },

  content: { paddingHorizontal: 20, paddingTop: 28, gap: 14 },

  stepTitle: { color: TEXT_PRIMARY, fontSize: 30, fontWeight: '800', lineHeight: 36 },
  stepSub:   { color: TEXT_SECONDARY, fontSize: 15, marginBottom: 4 },

  // Big goal cards — ram i vila, orange ram + tonad bakgrund när valt
  bigCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: CARD, borderRadius: 20, padding: 20,
    borderWidth: 1.5, borderColor: BORDER,
  },
  bigCardActive: { backgroundColor: ORANGE + '16', borderColor: ORANGE },
  bigCardIcon:   { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bigCardTitle:  { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', marginBottom: 3 },
  bigCardSub:    { color: TEXT_SECONDARY, fontSize: 13 },

  // Option cards (run distance, erfarenhet, besvär)
  optCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: CARD, borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: BORDER,
  },
  optCardActive: { backgroundColor: ORANGE + '16', borderColor: ORANGE },
  optIcon:       { width: 52, height: 52, borderRadius: 14, backgroundColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  optIconActive: { backgroundColor: 'rgba(255,149,0,0.15)' },
  optTitle:      { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  optSub:        { color: TEXT_SECONDARY, fontSize: 13 },

  // 5 km-testet — samma kortspråk som resten av appen, siffror i Nunito
  testCard: {
    backgroundColor: CARD, borderRadius: 16, padding: 16, gap: 14,
    borderWidth: 1, borderColor: BORDER, marginTop: 6,
  },
  testTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  testTitle:    { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600', flex: 1 },
  testRow:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 12 },
  testCol:      { alignItems: 'center', gap: 6 },
  testInput: {
    width: 84, paddingVertical: 10,
    backgroundColor: BG, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    color: TEXT_PRIMARY, fontSize: 24, fontFamily: NUM_FONT,
    textAlign: 'center', fontVariant: ['tabular-nums'],
  },
  testUnit:  { color: TEXT_SECONDARY, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  testColon: { color: TEXT_SECONDARY, fontSize: 24, fontFamily: NUM_FONT, marginTop: 8 },
  testHint:  { color: TEXT_SECONDARY, fontSize: 12, lineHeight: 17 },
  testWarn:  { color: '#FF6B6B', fontSize: 12, lineHeight: 17, fontWeight: '600' },

  // Veckodagsval
  dayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: CARD, borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 14,
    borderWidth: 1.5, borderColor: BORDER,
  },
  dayRowActive:  { backgroundColor: ORANGE + '16', borderColor: ORANGE },
  dayRowLabel:   { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  dayCheck: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  dayCheckActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  daysHint: { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center' },

  // Body SVG row
  bodyRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 4 },

  // Plan cards (muscle plan)
  planCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: CARD, borderRadius: 18, padding: 20,
    borderWidth: 1.5, borderColor: BORDER,
  },
  planCardActive:  { backgroundColor: ORANGE + '16', borderColor: ORANGE },
  planRecommended: { color: ORANGE, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 3 },
  planTitle:       { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700', marginBottom: 2 },
  planSub:         { color: TEXT_SECONDARY, fontSize: 13 },

  // Muscle chips
  muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  muscleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingVertical: 11,
    backgroundColor: CARD, borderRadius: 30,
    borderWidth: 1.5, borderColor: BORDER,
  },
  muscleDot:     { width: 9, height: 9, borderRadius: 5 },
  muscleChipText:{ color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },

  // Summary
  summaryCheckmark: { alignItems: 'center', marginVertical: 12 },
  summaryIconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center',
  },
  summaryTitle: { color: TEXT_PRIMARY, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  summarySub: {
    color: TEXT_SECONDARY, fontSize: 15, textAlign: 'center',
    lineHeight: 22, marginTop: 4,
  },
  summaryCards: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1, backgroundColor: CARD, borderRadius: 16,
    padding: 18, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: BORDER,
  },
  summaryCardTitle: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
  summaryCardSub:   { color: TEXT_SECONDARY, fontSize: 12, textAlign: 'center' },

  // Passtypsförklaringar (löpmål)
  typeList: {
    backgroundColor: CARD, borderRadius: 16, padding: 18, gap: 14,
    borderWidth: 1, borderColor: BORDER,
  },
  typeListTitle: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  typeRow:  { flexDirection: 'row', gap: 10 },
  typeDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: ORANGE, marginTop: 5 },
  typeName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
  typeDesc: { color: TEXT_SECONDARY, fontSize: 12, lineHeight: 17, marginTop: 1 },

  // CTA button
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 18,
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 12,
  },
  nextBtnDisabled: { opacity: 0.35 },
  nextBtnText:     { color: '#000', fontSize: 17, fontWeight: '800' },
})
