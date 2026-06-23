import { useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, Vibration,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { workoutPlanStore, type PlanExercise } from '@/stores/workoutPlan'
import { saveStrengthWorkout } from '@/services/workouts'
import { supabase } from '@/lib/supabase'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

const GREEN  = '#22C55E'
const RED    = '#EF4444'

type SetState = { reps: string; weight: string; done: boolean }
type ExState  = { exercise: PlanExercise; sets: SetState[] }

function pad(n: number) { return String(n).padStart(2, '0') }

export default function WorkoutSessionScreen() {
  const plan = workoutPlanStore.get()

  const [exList, setExList]         = useState<ExState[]>(() =>
    (plan?.exercises ?? []).map(ex => ({
      exercise: ex,
      sets: Array.from({ length: ex.sets }, () => ({
        reps: String(ex.reps),
        weight: ex.weight,
        done: false,
      })),
    }))
  )
  const [exIdx, setExIdx]           = useState(0)
  const [setIdx, setSetIdx]         = useState(0)
  const [restActive, setRestActive] = useState(false)
  const [restLeft, setRestLeft]     = useState(plan?.restSeconds ?? 90)
  const [saving, setSaving]         = useState(false)
  const [sessionDone, setSessionDone] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollRef = useRef<ScrollView>(null)

  const totalSets = exList.reduce((s, e) => s + e.sets.length, 0)
  const doneSets  = exList.reduce((s, e) => s + e.sets.filter(st => st.done).length, 0)
  const progress  = totalSets > 0 ? doneSets / totalSets : 0

  const currentEx  = exList[exIdx]
  const currentSet = currentEx?.sets[setIdx]

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  function startRest() {
    const secs = plan?.restSeconds ?? 90
    setRestLeft(secs)
    setRestActive(true)
    timerRef.current = setInterval(() => {
      setRestLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          setRestActive(false)
          Vibration.vibrate([0, 200, 100, 200])
          advance()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function skipRest() {
    if (timerRef.current) clearInterval(timerRef.current)
    setRestActive(false)
    advance()
  }

  function advance() {
    setExList(prev => {
      const next = prev.map((e, ei) => ({
        ...e,
        sets: e.sets.map((s, si) =>
          ei === exIdx && si === setIdx ? { ...s, done: true } : s
        ),
      }))

      // Find next undone set
      let nextSetIdx = setIdx + 1
      let nextExIdx  = exIdx

      if (nextSetIdx >= prev[exIdx].sets.length) {
        nextSetIdx = 0
        nextExIdx  = exIdx + 1
      }

      if (nextExIdx >= prev.length) {
        // All done
        setTimeout(() => setSessionDone(true), 100)
      } else {
        setExIdx(nextExIdx)
        setSetIdx(nextSetIdx)
        setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 50)
      }

      return next
    })
  }

  function markSetDone() {
    startRest()
  }

  function updateCurrent(field: 'reps' | 'weight', value: string) {
    setExList(prev => prev.map((e, ei) => ei !== exIdx ? e : {
      ...e,
      sets: e.sets.map((s, si) => si !== setIdx ? s : { ...s, [field]: value }),
    }))
  }

  function jumpTo(ei: number, si: number) {
    if (exList[ei].sets[si].done) return
    if (timerRef.current) clearInterval(timerRef.current)
    setRestActive(false)
    setExIdx(ei)
    setSetIdx(si)
  }

  async function finishAndSave() {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        for (const ex of exList) {
          const validSets = ex.sets
            .filter(s => s.done && parseInt(s.reps) > 0)
            .map(s => ({ reps: parseInt(s.reps) || 0, weight_kg: parseFloat(s.weight) || 0 }))
          if (validSets.length > 0) {
            await saveStrengthWorkout({
              userId: session.user.id,
              exerciseId: ex.exercise.id,
              exerciseName: ex.exercise.name,
              category: ex.exercise.category as 'strength' | 'mobility' | 'hiit',
              sets: validSets,
            })
          }
        }
      }
    } finally {
      setSaving(false)
      workoutPlanStore.set(null)
      router.back()
      router.back()
    }
  }

  function confirmExit() {
    Alert.alert('Avsluta pass?', 'Osparade set försvinner.', [
      { text: 'Fortsätt träna', style: 'cancel' },
      { text: 'Avsluta', style: 'destructive', onPress: () => { workoutPlanStore.set(null); router.back() } },
    ])
  }

  // ── Session done screen ──
  if (sessionDone) {
    const totalDone = exList.reduce((s, e) => s + e.sets.filter(st => st.done).length, 0)
    const totalReps = exList.reduce((s, e) =>
      s + e.sets.filter(st => st.done).reduce((r, st) => r + (parseInt(st.reps) || 0), 0), 0)
    return (
      <SafeAreaView style={styles.doneScreen} edges={['top', 'bottom']}>
        <View style={styles.doneCheck}>
          <Ionicons name="trophy" size={40} color="#000" />
        </View>
        <Text style={styles.doneTitle}>Pass klart! 💪</Text>
        <Text style={styles.doneSub}>{exList.length} övningar · {totalDone} set · {totalReps} reps</Text>

        <View style={styles.doneSummary}>
          {exList.map((ex, i) => {
            const done = ex.sets.filter(s => s.done).length
            return (
              <View key={i} style={[styles.doneSummaryRow, i < exList.length - 1 && styles.doneSummaryBorder]}>
                <View style={styles.doneCheckIcon}>
                  <Ionicons name={done === ex.sets.length ? 'checkmark' : 'remove'} size={14} color={done === ex.sets.length ? '#000' : TEXT_SECONDARY} />
                </View>
                <Text style={styles.doneSummaryName} numberOfLines={1}>{ex.exercise.name}</Text>
                <Text style={styles.doneSummaryMeta}>{done}/{ex.sets.length} set</Text>
              </View>
            )
          })}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={finishAndSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Ionicons name="save-outline" size={20} color="#000" />
          <Text style={styles.saveBtnText}>{saving ? 'Sparar…' : 'Spara & avsluta'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.discardBtn} onPress={() => { workoutPlanStore.set(null); router.back() }}>
          <Text style={styles.discardText}>Kasta träningen</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  if (!currentEx) return null

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.exitBtn} onPress={confirmExit} activeOpacity={0.8}>
          <Ionicons name="close" size={20} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerProgress}>Övning {exIdx + 1}/{exList.length}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
        <Text style={styles.headerSets}>{doneSets}/{totalSets}</Text>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Current exercise */}
        <View style={styles.currentCard}>
          <Text style={styles.currentExName}>{currentEx.exercise.name}</Text>
          <Text style={styles.currentSetInfo}>
            Set {setIdx + 1} av {currentEx.sets.length}
          </Text>

          {/* Reps + Weight inputs */}
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <TextInput
                style={styles.bigInput}
                value={currentSet?.reps ?? ''}
                onChangeText={v => updateCurrent('reps', v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor="rgba(255,255,255,0.2)"
              />
              <Text style={styles.inputLabel}>REPS</Text>
            </View>
            <View style={styles.inputSep} />
            <View style={styles.inputGroup}>
              <TextInput
                style={styles.bigInput}
                value={currentSet?.weight ?? ''}
                onChangeText={v => updateCurrent('weight', v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor="rgba(255,255,255,0.2)"
              />
              <Text style={styles.inputLabel}>KG</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.doneBtn} onPress={markSetDone} activeOpacity={0.85}>
            <Ionicons name="checkmark" size={22} color="#000" />
            <Text style={styles.doneBtnText}>Set klart</Text>
          </TouchableOpacity>
        </View>

        {/* All exercises overview */}
        <Text style={styles.overviewLabel}>Passöversikt</Text>
        {exList.map((ex, ei) => (
          <View key={ei} style={styles.overviewCard}>
            <View style={styles.overviewHeader}>
              <View style={[styles.overviewNum, { backgroundColor: ei === exIdx ? ORANGE + '22' : 'rgba(255,255,255,0.07)' }]}>
                <Text style={[styles.overviewNumText, { color: ei === exIdx ? ORANGE : TEXT_SECONDARY }]}>{ei + 1}</Text>
              </View>
              <Text style={[styles.overviewName, ei === exIdx && { color: ORANGE }]} numberOfLines={1}>
                {ex.exercise.name}
              </Text>
              <Text style={styles.overviewSetCount}>
                {ex.sets.filter(s => s.done).length}/{ex.sets.length} set
              </Text>
            </View>

            <View style={styles.setsRow}>
              {ex.sets.map((s, si) => {
                const isCurrent = ei === exIdx && si === setIdx
                const isDone    = s.done
                return (
                  <TouchableOpacity
                    key={si}
                    style={[
                      styles.setBubble,
                      isDone    && styles.setBubbleDone,
                      isCurrent && styles.setBubbleCurrent,
                    ]}
                    onPress={() => jumpTo(ei, si)}
                    activeOpacity={isDone ? 1 : 0.7}
                  >
                    {isDone
                      ? <Ionicons name="checkmark" size={14} color="#000" />
                      : <Text style={[styles.setBubbleText, isCurrent && styles.setBubbleTextCurrent]}>
                          {si + 1}
                        </Text>
                    }
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        ))}

      </ScrollView>

      {/* Rest timer overlay */}
      {restActive && (
        <View style={styles.restOverlay}>
          <View style={styles.restCard}>
            <Text style={styles.restLabel}>VILA</Text>
            <Text style={styles.restCountdown}>
              {pad(Math.floor(restLeft / 60))}:{pad(restLeft % 60)}
            </Text>
            <Text style={styles.restNext}>
              Näst: {setIdx + 1 < (currentEx?.sets.length ?? 0)
                ? `Set ${setIdx + 2} · ${currentEx.exercise.name}`
                : exIdx + 1 < exList.length
                  ? exList[exIdx + 1].exercise.name
                  : 'Sista set!'
              }
            </Text>
            <TouchableOpacity style={styles.skipBtn} onPress={skipRest} activeOpacity={0.8}>
              <Text style={styles.skipBtnText}>Hoppa över vila</Text>
              <Ionicons name="chevron-forward" size={16} color={ORANGE} />
            </TouchableOpacity>
          </View>
        </View>
      )}

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  exitBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, gap: 6 },
  headerProgress: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: GREEN, borderRadius: 2 },
  headerSets: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600', minWidth: 36, textAlign: 'right' },

  scroll: { padding: 20, gap: 16, paddingBottom: 32 },

  currentCard: {
    backgroundColor: CARD, borderRadius: 24,
    borderWidth: 1, borderColor: BORDER,
    padding: 24, gap: 20, alignItems: 'center',
  },
  currentExName: { color: TEXT_PRIMARY, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  currentSetInfo: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500' },

  inputRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  inputGroup: { flex: 1, alignItems: 'center', gap: 8 },
  bigInput: {
    width: 100, height: 72, backgroundColor: '#2C2C2E',
    borderRadius: 16, color: TEXT_PRIMARY,
    fontSize: 36, fontWeight: '800', textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  inputLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  inputSep: { width: 1, height: 60, backgroundColor: BORDER, marginHorizontal: 8 },

  doneBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: GREEN, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 40,
    shadowColor: GREEN, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10,
  },
  doneBtnText: { color: '#000', fontSize: 17, fontWeight: '800' },

  overviewLabel: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: -4 },

  overviewCard: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    padding: 14, gap: 12,
  },
  overviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  overviewNum: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  overviewNumText: { fontSize: 12, fontWeight: '700' },
  overviewName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600', flex: 1 },
  overviewSetCount: { color: TEXT_SECONDARY, fontSize: 12 },

  setsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  setBubble: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  setBubbleDone:    { backgroundColor: GREEN, borderColor: GREEN },
  setBubbleCurrent: { borderColor: ORANGE, borderWidth: 2 },
  setBubbleText:    { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  setBubbleTextCurrent: { color: ORANGE },

  // Rest overlay
  restOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  restCard: {
    backgroundColor: CARD, borderRadius: 28,
    borderWidth: 1, borderColor: BORDER,
    padding: 36, alignItems: 'center', gap: 12,
    width: '80%',
  },
  restLabel: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  restCountdown: {
    color: TEXT_PRIMARY, fontSize: 72, fontWeight: '800',
    fontVariant: ['tabular-nums'], letterSpacing: -2,
  },
  restNext: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center' },
  skipBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingVertical: 8 },
  skipBtnText: { color: ORANGE, fontSize: 15, fontWeight: '600' },

  // Done screen
  doneScreen: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  doneCheck: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 18,
  },
  doneTitle:   { color: TEXT_PRIMARY, fontSize: 32, fontWeight: '800' },
  doneSub:     { color: TEXT_SECONDARY, fontSize: 15, marginBottom: 8 },
  doneSummary: {
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER,
    width: '100%', marginBottom: 8,
  },
  doneSummaryRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  doneSummaryBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  doneCheckIcon: {
    width: 24, height: 24, borderRadius: 7,
    backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center',
  },
  doneSummaryName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600', flex: 1 },
  doneSummaryMeta: { color: TEXT_SECONDARY, fontSize: 13 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: ORANGE, borderRadius: 16,
    paddingVertical: 18, paddingHorizontal: 32, width: '100%', justifyContent: 'center',
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12,
  },
  saveBtnText:  { color: '#000', fontSize: 17, fontWeight: '800' },
  discardBtn:   { paddingVertical: 12 },
  discardText:  { color: '#555', fontSize: 14, fontWeight: '500' },
})
