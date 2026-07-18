import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { ORANGE, GREEN, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, NUM_FONT_SEMI } from '@/lib/theme'
import type { WorkoutSession } from '@/services/workoutSchedule'
import { completeExercise, updateSessionExercise, addSingleExerciseToSession, deleteSessionExercise } from '@/services/workoutSchedule'
import type { Exercise } from '@/services/exercises'
import { saveStrengthWorkout, getStrengthWorkouts, type StrengthSet } from '@/services/workouts'
import { getPersonalRecords, findNewPR } from '@/services/personalRecords'
import { ExercisePickerSheet } from '@/components/ExercisePickerSheet'
import { toLocalDateString } from '@/lib/date'
import {
  getRestSeconds, setRestSeconds,
  getExerciseRestSeconds, setExerciseRestSeconds,
  getOrInitPassStart, getPassStart, clearPassStart,
  setPassDuration, getPassDuration,
  setPassEffort, getPassEffort,
} from '@/lib/prefs'
import { EffortRating, effortColor, effortLabel } from '@/components/EffortRating'

type LogSet = { reps: string; weight: string; done: boolean }

function fmtClock(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function SessionFullscreen({
  visible, session, isCompleted, exercisesList, date, userId,
  onComplete, onUncomplete, onSaved, onClose,
}: {
  visible: boolean
  session: WorkoutSession | null
  isCompleted: boolean
  exercisesList: Exercise[]
  date: string
  userId: string | null
  onComplete: () => void
  onUncomplete: () => void
  onSaved?: () => void
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  const exercises = session?.exercises ?? []

  // ── Loggade set per övningsrad (key = session_exercises.id) ──
  const [logs, setLogs] = useState<Record<string, LogSet[]>>({})
  const [prevByName, setPrevByName] = useState<Record<string, StrengthSet[]>>({})
  const [saving, setSaving] = useState(false)

  // Logg-rader synkas mot passets övningar — behåller ifyllt när nya läggs till
  const exIdsKey = exercises.map(e => e.id).join(',')
  useEffect(() => {
    if (!visible || !session) return
    setLogs(prev => {
      const out: Record<string, LogSet[]> = {}
      for (const ex of session.exercises) {
        out[ex.id] = prev[ex.id] ?? Array.from(
          { length: Math.max(1, ex.sets ?? 3) },
          () => ({ reps: '', weight: '', done: false }),
        )
      }
      return out
    })
  }, [visible, exIdsKey])

  // Starttiden sparas per pass + dag så räknaren överlever att vyn stängs/öppnas.
  // Avklarade pass visar den sparade sluttiden statiskt — timern tickar inte.
  const [finalDur, setFinalDur] = useState<number | null>(null)
  const [passEffort, setPassEffortState] = useState<number | null>(null)
  // Passet startar först när man trycker Starta — då börjar timern ticka
  const [started, setStarted] = useState(false)
  useEffect(() => {
    if (!visible || !session) return
    if (isCompleted) {
      getPassDuration(`${session.id}:${date}`).then(setFinalDur)
      getPassEffort(`${session.id}:${date}`).then(setPassEffortState)
      return
    }
    setFinalDur(null)
    setPassEffortState(null)
    setStarted(false)
    setElapsed(0)
    // Redan startat (vyn stängdes och öppnades igen) → fortsätt ticka
    getPassStart(`${session.id}:${date}`).then(ts => {
      if (ts) {
        startTs.current = ts
        setElapsed(Math.max(0, Math.floor((Date.now() - ts) / 1000)))
        setStarted(true)
      }
    })
  }, [visible, session?.id, isCompleted])

  const isFuture = date > toLocalDateString()

  function startPass() {
    if (!session) return
    if (isFuture) {
      Alert.alert('Framtida pass', 'Du kan starta passet först på passdagen.')
      return
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    getOrInitPassStart(`${session.id}:${date}`).then(ts => {
      startTs.current = ts
      setElapsed(0)
      setStarted(true)
    })
  }

  // Förra passets set per övning — visas i FÖRRA-kolumnen och som placeholders
  useEffect(() => {
    if (!visible || !userId) return
    getStrengthWorkouts(userId, 150).then(ws => {
      const map: Record<string, StrengthSet[]> = {}
      for (const w of ws) {
        if (!map[w.data.exercise_name] && w.data.sets?.length > 0) map[w.data.exercise_name] = w.data.sets
      }
      setPrevByName(map)
    }).catch(() => {})
  }, [visible, userId])

  // ── Passtid — tickar medan skärmen är öppen ──
  const startTs = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!visible || isCompleted || !started) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTs.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [visible, isCompleted, started])

  // ── Vilotimer (samma mönster som övningsloggen) ──
  const [restLeft, setRestLeft]       = useState<number | null>(null)
  const [restTotal, setRestTotal]     = useState(90)
  const [restDefault, setRestDefault] = useState(90)
  const [exRestDefault, setExRestDefault] = useState(180)
  const restInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const restEnd      = useRef(0)
  const restLastSec  = useRef(-1)

  useEffect(() => {
    getRestSeconds().then(setRestDefault)
    getExerciseRestSeconds().then(setExRestDefault)
  }, [])
  useEffect(() => () => { if (restInterval.current) clearInterval(restInterval.current) }, [])
  // Stoppa vilan när passvyn stängs — komponenten avmonteras inte (bara döljs),
  // så timern skulle annars ticka och vibrera i bakgrunden
  useEffect(() => {
    if (visible) return
    if (restInterval.current) clearInterval(restInterval.current)
    restInterval.current = null
    setRestLeft(null)
  }, [visible])

  function startRest(secs: number) {
    setRestTotal(secs)
    restEnd.current = Date.now() + secs * 1000
    restLastSec.current = secs
    setRestLeft(secs)
    if (restInterval.current) clearInterval(restInterval.current)
    restInterval.current = setInterval(() => {
      const left = Math.max(0, Math.round((restEnd.current - Date.now()) / 1000))
      if (left !== restLastSec.current) {
        restLastSec.current = left
        setRestLeft(left)
        if (left > 0 && left <= 3) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }
      if (left <= 0 && restInterval.current) {
        clearInterval(restInterval.current)
        restInterval.current = null
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setTimeout(() => setRestLeft(null), 1200)
      }
    }, 200)
  }
  function extendRest(secs: number) {
    Haptics.selectionAsync()
    restEnd.current += secs * 1000
    setRestTotal(t => t + secs)
    setRestLeft(l => (l ?? 0) + secs)
  }
  function cancelRest() {
    if (restInterval.current) clearInterval(restInterval.current)
    restInterval.current = null
    setRestLeft(null)
  }

  // Inställning av vilotider (klockikonen i statsraden)
  const [restSheetOpen, setRestSheetOpen] = useState(false)
  function chooseRest(secs: number) {
    Haptics.selectionAsync()
    const clamped = Math.max(15, Math.min(600, secs))
    setRestDefault(clamped)
    setRestSeconds(clamped).catch(() => {})
  }
  function chooseExRest(secs: number) {
    Haptics.selectionAsync()
    const clamped = Math.max(15, Math.min(900, secs))
    setExRestDefault(clamped)
    setExerciseRestSeconds(clamped).catch(() => {})
  }

  // ── Set-hantering ──
  function updateLog(exId: string, i: number, field: 'reps' | 'weight', value: string) {
    setLogs(prev => ({
      ...prev,
      [exId]: (prev[exId] ?? []).map((r, j) => j === i ? { ...r, [field]: value } : r),
    }))
  }
  function toggleDone(exId: string, i: number) {
    const rows = logs[exId] ?? []
    const wasDone = rows[i]?.done
    const next = rows.map((r, j) => j === i ? { ...r, done: !r.done } : r)
    setLogs(prev => ({ ...prev, [exId]: next }))
    if (!wasDone) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      // Sista setet i övningen → längre vila (mellan övningar)
      const allDone = next.every(r => r.done)
      startRest(allDone ? exRestDefault : restDefault)
    }
  }

  // ── Lägg till övning i passet — via den vanliga övningsväljaren ──
  const [addExOpen, setAddExOpen] = useState(false)

  function removeExercise(exId: string, name: string) {
    Alert.alert('Ta bort övning', `Ta bort ${name} från passet?`, [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Ta bort', style: 'destructive',
        onPress: async () => {
          await deleteSessionExercise(exId).catch(() => {})
          onSaved?.()
        },
      },
    ])
  }
  function addSet(exId: string) {
    setLogs(prev => {
      const rows = prev[exId] ?? []
      const last = rows[rows.length - 1]
      return { ...prev, [exId]: [...rows, { reps: last?.reps ?? '', weight: last?.weight ?? '', done: false }] }
    })
  }
  function removeSet(exId: string, i: number) {
    setLogs(prev => {
      const rows = prev[exId] ?? []
      if (rows.length <= 1) return prev
      return { ...prev, [exId]: rows.filter((_, j) => j !== i) }
    })
  }


  // ── Betygsätt ansträngning — visas efter Slutför, innan vyn stängs ──
  const [effortOpen, setEffortOpen] = useState(false)
  const afterEffortRef = useRef<(() => void) | null>(null)

  function requestEffort(then: () => void) {
    afterEffortRef.current = then
    setEffortOpen(true)
  }

  function handleEffortDone(e: number | null) {
    setEffortOpen(false)
    if (e && session) {
      setPassEffort(`${session.id}:${date}`, e).catch(() => {})
      setPassEffortState(e)
    }
    const then = afterEffortRef.current
    afterEffortRef.current = null
    then?.()
  }

  // Bekräfta innan passet slutförs — Spara på redan avklarade pass går direkt
  function confirmFinish() {
    if (!session || saving) return
    if (isFuture) {
      Alert.alert('Framtida pass', 'Passet kan slutföras först på passdagen.')
      return
    }
    if (isCompleted) { finish(); return }
    const anySets = session.exercises.some(ex => (logs[ex.id] ?? []).some(r => (parseInt(r.reps) || 0) > 0))
    if (!anySets) { finish(); return }
    Alert.alert('Är du klar med passet?', 'Passet markeras som avklarat och dina set sparas.', [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Slutför', onPress: () => finish() },
    ])
  }

  // ── Slutför: spara allt, bocka övningar, markera passet klart ──
  async function finish() {
    if (!session || !userId || saving) return
    // Rader med reps räknas — även om man glömt bocka dem
    const toSave = session.exercises.map(ex => {
      const rows = logs[ex.id] ?? []
      const validSets = rows
        .map(r => ({ reps: parseInt(r.reps) || 0, weight_kg: parseFloat(r.weight) || 0 }))
        .filter(r => r.reps > 0)
      return { ex, validSets }
    })
    const anySets = toSave.some(t => t.validSets.length > 0)
    if (!anySets) {
      if (isCompleted) { onClose(); return }
      Alert.alert('Inga set ifyllda', 'Vill du markera passet som klart utan att logga set?', [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Markera klart', onPress: () => {
          setPassDuration(`${session.id}:${date}`, elapsed).catch(() => {})
          clearPassStart(`${session.id}:${date}`).catch(() => {})
          requestEffort(() => {
            onComplete()
            onClose()
          })
        } },
      ])
      return
    }

    setSaving(true)
    try {
      const records = await getPersonalRecords(userId).catch(() => [])
      const prs: string[] = []
      const isOneTime = (session.weekdays?.length ?? 0) === 0

      for (const { ex, validSets } of toSave) {
        if (validSets.length === 0) continue
        const exInfo = exercisesList.find(e => e.name === ex.exercise_name)
        await saveStrengthWorkout({
          userId,
          exerciseId: exInfo?.id ?? ex.id,
          exerciseName: ex.exercise_name,
          category: (exInfo?.category === 'mobility' || exInfo?.category === 'hiit') ? exInfo.category : 'strength',
          sets: validSets,
          workoutDate: date,
        }).catch(() => false)
        await completeExercise(ex.id, userId, date).catch(() => {})
        // Spegla till passets rad — bara för engångspass (mallar lämnas orörda)
        if (isOneTime) {
          const repsStr = validSets.every(r => r.reps === validSets[0].reps)
            ? String(validSets[0].reps)
            : validSets.map(r => r.reps).join('/')
          await updateSessionExercise(ex.id, validSets.length, repsStr).catch(() => {})
        }
        const pr = findNewPR(records.find(r => r.exerciseName === ex.exercise_name), validSets)
        if (pr) prs.push(`${ex.exercise_name}: ${pr.weightKg} kg × ${pr.reps}`)
      }

      cancelRest()
      if (!isCompleted) setPassDuration(`${session.id}:${date}`, elapsed).catch(() => {})
      clearPassStart(`${session.id}:${date}`).catch(() => {})
      onSaved?.()

      const wrapUp = () => {
        onClose()
        if (prs.length > 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          setTimeout(() => Alert.alert('🏆 Nytt personligt rekord!', prs.join('\n')), 400)
        }
      }
      if (!isCompleted) {
        // Nytt avklarat pass → betygsätt ansträngningen innan vi stänger
        requestEffort(() => {
          onComplete()
          wrapUp()
        })
      } else {
        wrapUp()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.screen}>
        {/* ── Header: stäng · titel · vila · Slutför ── */}
        <View style={[s.header, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity onPress={onClose} style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={26} color={TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>{session?.name}</Text>
          {isCompleted && (
            <TouchableOpacity onPress={onUncomplete} style={s.doneBadge} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle" size={14} color={GREEN} />
              <Text style={s.doneBadgeText}>Klar</Text>
            </TouchableOpacity>
          )}
          {/* Starta → Slutför → Spara (avklarade pass går att komplettera) */}
          {!isCompleted && !started ? (
            <TouchableOpacity onPress={startPass} style={[s.finishBtn, s.startBtn]} activeOpacity={0.85}>
              <Text style={s.finishText}>Starta</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={confirmFinish}
              style={[s.finishBtn, !isCompleted && s.stopBtn, saving && { opacity: 0.6 }]}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color={isCompleted ? '#000' : '#fff'} />
              ) : (
                <Text style={[s.finishText, !isCompleted && s.stopText]}>{isCompleted ? 'Spara' : 'Slutför'}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Statistikrad: tid + vilotidsinställning ── */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statLabel}>Tid</Text>
            <Text style={[s.statValue, { color: ORANGE }]}>
              {isCompleted ? (finalDur != null ? fmtClock(finalDur) : '–') : fmtClock(elapsed)}
            </Text>
          </View>
          {isCompleted && passEffort != null && (
            <View style={[s.stat, { marginLeft: 28 }]}>
              <Text style={s.statLabel}>Ansträngning</Text>
              <Text style={[s.statValue, { color: effortColor(passEffort) }]}>
                {passEffort} · {effortLabel(passEffort)}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {/* Vilotid — tryck för att ställa in tiderna mellan set/övningar */}
          <TouchableOpacity style={s.restClockBtn} onPress={() => setRestSheetOpen(true)} activeOpacity={0.75}>
            <Ionicons name="timer-outline" size={20} color={ORANGE} />
            <Text style={s.restClockText}>{fmtClock(restDefault)}</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {exercises.map(ex => {
              const rows = logs[ex.id] ?? []
              const prev = prevByName[ex.exercise_name]
              return (
                <View key={ex.id} style={s.exBlock}>
                  <View style={s.exNameRow}>
                    <Text style={s.exName}>{ex.exercise_name}</Text>
                    <TouchableOpacity
                      onPress={() => removeExercise(ex.id, ex.exercise_name)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={17} color="rgba(255,255,255,0.3)" />
                    </TouchableOpacity>
                  </View>

                  <View style={s.tableHead}>
                    <Text style={[s.th, { width: 36 }]}>SET</Text>
                    <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>REPS</Text>
                    <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>KG</Text>
                    <View style={{ width: 40 }} />
                  </View>

                  {rows.map((r, i) => {
                    const p = prev?.[i]
                    return (
                      <View key={i} style={[s.setRow, r.done && s.setRowDone]}>
                        <Text style={s.setNum}>{i + 1}</Text>
                        <TextInput
                          style={[s.input, r.done && s.inputDone]}
                          value={r.reps}
                          onChangeText={v => updateLog(ex.id, i, 'reps', v.replace(/[^0-9]/g, ''))}
                          keyboardType="number-pad"
                          returnKeyType="done"
                          placeholder={p && p.reps > 0 ? String(p.reps) : (ex.reps ?? '0')}
                          placeholderTextColor="rgba(255,255,255,0.22)"
                          selectTextOnFocus
                        />
                        <TextInput
                          style={[s.input, r.done && s.inputDone]}
                          value={r.weight}
                          onChangeText={v => updateLog(ex.id, i, 'weight', v.replace(/[^0-9.,]/g, '').replace(',', '.'))}
                          keyboardType="decimal-pad"
                          returnKeyType="done"
                          placeholder={p && p.weight_kg > 0 ? String(p.weight_kg) : '0'}
                          placeholderTextColor="rgba(255,255,255,0.22)"
                          selectTextOnFocus
                        />
                        <TouchableOpacity
                          style={[s.check, r.done && s.checkOn]}
                          onPress={() => toggleDone(ex.id, i)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="checkmark" size={17} color={r.done ? '#000' : TEXT_SECONDARY} />
                        </TouchableOpacity>
                      </View>
                    )
                  })}

                  <View style={s.setBtnRow}>
                    <TouchableOpacity style={s.addSetBtn} onPress={() => addSet(ex.id)} activeOpacity={0.75}>
                      <Ionicons name="add" size={16} color={TEXT_PRIMARY} />
                      <Text style={s.addSetText}>Lägg till set</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.addSetBtn, rows.length <= 1 && { opacity: 0.35 }]}
                      onPress={() => removeSet(ex.id, rows.length - 1)}
                      disabled={rows.length <= 1}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="remove" size={16} color={TEXT_PRIMARY} />
                      <Text style={s.addSetText}>Ta bort set</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })}
            {exercises.length === 0 && <Text style={s.empty}>Inga övningar i passet</Text>}

            {/* Lägg till övning i passet */}
            <TouchableOpacity style={s.addExBtn} onPress={() => setAddExOpen(true)} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={19} color={ORANGE} />
              <Text style={s.addExText}>Lägg till övning</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Lägg till övning — samma väljare som i schemat (muskelgrupper) ── */}
        <ExercisePickerSheet
          visible={addExOpen}
          exercises={exercisesList}
          gymOnly
          onClose={() => setAddExOpen(false)}
          onSelect={async (exInfo, sets, reps) => {
            if (!session) { setAddExOpen(false); return }
            setAddExOpen(false)
            Haptics.selectionAsync()
            await addSingleExerciseToSession(session.id, exInfo.name, exercises.length, sets, reps).catch(() => null)
            onSaved?.()   // laddar om — övningen dyker upp i tabellen
          }}
        />

        {/* ── Vilotidsinställning — lager över passvyn ── */}
        {restSheetOpen && (
          <View style={StyleSheet.absoluteFill}>
            <TouchableOpacity
              style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
              onPress={() => setRestSheetOpen(false)}
              activeOpacity={1}
            />
            <View style={[s.restSheet, { paddingBottom: insets.bottom + 20 }]}>
              <View style={s.restSheetHandle} />
              <Text style={s.restSheetTitle}>Vilotider</Text>
              <Text style={s.restSheetSub}>Startar automatiskt när du bockar av ett set</Text>

              <Text style={s.restSectionLabel}>MELLAN SET</Text>
              <View style={s.restStepRow}>
                <TouchableOpacity style={s.restStepBtn} onPress={() => chooseRest(restDefault - 15)} activeOpacity={0.75}>
                  <Ionicons name="remove" size={20} color={TEXT_PRIMARY} />
                </TouchableOpacity>
                <Text style={s.restStepValue}>{fmtClock(restDefault)}</Text>
                <TouchableOpacity style={s.restStepBtn} onPress={() => chooseRest(restDefault + 15)} activeOpacity={0.75}>
                  <Ionicons name="add" size={20} color={TEXT_PRIMARY} />
                </TouchableOpacity>
              </View>

              <Text style={s.restSectionLabel}>MELLAN ÖVNINGAR</Text>
              <Text style={s.restSectionHint}>Används när sista setet i en övning bockas av</Text>
              <View style={s.restStepRow}>
                <TouchableOpacity style={s.restStepBtn} onPress={() => chooseExRest(exRestDefault - 15)} activeOpacity={0.75}>
                  <Ionicons name="remove" size={20} color={TEXT_PRIMARY} />
                </TouchableOpacity>
                <Text style={s.restStepValue}>{fmtClock(exRestDefault)}</Text>
                <TouchableOpacity style={s.restStepBtn} onPress={() => chooseExRest(exRestDefault + 15)} activeOpacity={0.75}>
                  <Ionicons name="add" size={20} color={TEXT_PRIMARY} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={s.restSheetDone} onPress={() => setRestSheetOpen(false)} activeOpacity={0.85}>
                <Text style={s.restSheetDoneText}>Klar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Vilotimer — dyker upp när ett set bockas av ── */}
        {restLeft !== null && (
          <View style={[s.restBar, { marginBottom: insets.bottom + 10 }]}>
            <Text style={[s.restBarTime, restLeft === 0 && { color: GREEN }]}>
              {restLeft === 0 ? 'Klar!' : fmtClock(restLeft)}
            </Text>
            <View style={s.restBarTrack}>
              <View style={[s.restBarFill, { width: `${Math.min(100, (restLeft / restTotal) * 100)}%` as never }]} />
            </View>
            <TouchableOpacity onPress={() => extendRest(15)} style={s.restBarBtn} activeOpacity={0.75}>
              <Text style={s.restBarBtnText}>+15</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={cancelRest} style={s.restBarBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }} activeOpacity={0.75}>
              <Ionicons name="close" size={16} color={TEXT_SECONDARY} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Betygsätt ansträngning — lager över passvyn ── */}
        <EffortRating visible={effortOpen} onDone={handleEffortDone} />
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingBottom: 8,
  },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: TEXT_PRIMARY, fontSize: 18, fontWeight: '800' },
  startBtn: { backgroundColor: GREEN },
  stopBtn:  { backgroundColor: '#FF3B4A' },
  stopText: { color: '#fff' },
  finishBtn: {
    backgroundColor: ORANGE, borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 9,
    minWidth: 74, alignItems: 'center',
  },
  finishText: { color: '#000', fontSize: 14, fontWeight: '800' },
  doneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: GREEN + '1E', borderRadius: 12,
    paddingHorizontal: 11, paddingVertical: 7,
  },
  doneBadgeText: { color: GREEN, fontSize: 13, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
    gap: 28,
  },
  restClockBtn: {
    alignItems: 'center', gap: 2,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12,
  },
  restClockText: { color: TEXT_SECONDARY, fontSize: 11, fontFamily: NUM_FONT_SEMI, fontVariant: ['tabular-nums'] },
  stat: { gap: 2 },
  statLabel: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '500' },
  statValue: { color: TEXT_PRIMARY, fontSize: 17, fontFamily: NUM_FONT, fontVariant: ['tabular-nums'] },

  exBlock: { paddingTop: 18, paddingHorizontal: 16 },
  exNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  exName: { color: ORANGE, fontSize: 17, fontWeight: '800', flex: 1, marginRight: 10 },

  tableHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 6 },
  th: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  setRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 5, borderRadius: 10, marginHorizontal: -6, paddingHorizontal: 6,
  },
  setRowDone: { backgroundColor: GREEN + '14' },
  setNum: { color: TEXT_PRIMARY, fontSize: 15, fontFamily: NUM_FONT, width: 36 },
  input: {
    flex: 1, height: 38,
    backgroundColor: CARD, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER,
    color: TEXT_PRIMARY, fontSize: 15, fontFamily: NUM_FONT,
    textAlign: 'center', fontVariant: ['tabular-nums'],
  },
  inputDone: { backgroundColor: GREEN + '22', borderColor: GREEN + '55' },
  check: {
    width: 40, height: 34, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: GREEN },

  setBtnRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  addSetBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: CARD, borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  addSetText: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },

  empty: { color: TEXT_SECONDARY, textAlign: 'center', marginTop: 48, fontSize: 15 },

  addExBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 22,
    paddingVertical: 13, borderRadius: 14,
    borderWidth: 1.5, borderColor: ORANGE + '50', borderStyle: 'dashed',
  },
  addExText: { color: ORANGE, fontSize: 15, fontWeight: '700' },

  restSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: CARD,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10,
    gap: 14,
  },
  restSheetHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  restSheetTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  restSheetSub: { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', marginTop: -8 },
  restSectionLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, textAlign: 'center', marginTop: 4,
  },
  restSectionHint: { color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center', marginTop: -10 },
  restStepRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22,
  },
  restStepBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: BG, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  restStepValue: {
    color: TEXT_PRIMARY, fontSize: 26, fontFamily: NUM_FONT,
    fontVariant: ['tabular-nums'], minWidth: 76, textAlign: 'center',
  },
  restSheetDone: {
    backgroundColor: ORANGE, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  restSheetDoneText: { color: '#000', fontSize: 15, fontWeight: '800' },

  restBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: ORANGE + '50',
  },
  restBarTime: { color: TEXT_PRIMARY, fontSize: 18, fontFamily: NUM_FONT, fontVariant: ['tabular-nums'], minWidth: 46 },
  restBarTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' },
  restBarFill: { height: '100%', borderRadius: 3, backgroundColor: ORANGE },
  restBarBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  restBarBtnText: { color: ORANGE, fontSize: 14, fontWeight: '700' },
})
