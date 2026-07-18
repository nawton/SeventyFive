import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { ORANGE, GREEN, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import type { WorkoutSession } from '@/services/workoutSchedule'
import { completeExercise, updateSessionExercise } from '@/services/workoutSchedule'
import type { Exercise } from '@/services/exercises'
import { saveStrengthWorkout, getStrengthWorkouts, type StrengthSet } from '@/services/workouts'
import { getPersonalRecords, findNewPR } from '@/services/personalRecords'
import { getRestSeconds, setRestSeconds } from '@/lib/prefs'

type LogSet = { reps: string; weight: string; done: boolean }

const REST_OPTIONS = [60, 90, 120, 180]

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

  useEffect(() => {
    if (!visible || !session) return
    setLogs(() => {
      const out: Record<string, LogSet[]> = {}
      for (const ex of session.exercises) {
        const n = Math.max(1, ex.sets ?? 3)
        out[ex.id] = Array.from({ length: n }, () => ({ reps: '', weight: '', done: false }))
      }
      return out
    })
    setElapsed(0)
    startTs.current = Date.now()
  }, [visible, session?.id])

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
    if (!visible) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTs.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [visible])

  // ── Vilotimer (samma mönster som övningsloggen) ──
  const [restLeft, setRestLeft]       = useState<number | null>(null)
  const [restTotal, setRestTotal]     = useState(90)
  const [restDefault, setRestDefault] = useState(90)
  const restInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const restEnd      = useRef(0)
  const restLastSec  = useRef(-1)

  useEffect(() => { getRestSeconds().then(setRestDefault) }, [])
  useEffect(() => () => { if (restInterval.current) clearInterval(restInterval.current) }, [])

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
  function cycleRestDefault() {
    Haptics.selectionAsync()
    const i = REST_OPTIONS.indexOf(restDefault)
    const next = REST_OPTIONS[(i + 1) % REST_OPTIONS.length] ?? 90
    setRestDefault(next)
    setRestSeconds(next).catch(() => {})
  }

  // ── Set-hantering ──
  function updateLog(exId: string, i: number, field: 'reps' | 'weight', value: string) {
    setLogs(prev => ({
      ...prev,
      [exId]: (prev[exId] ?? []).map((r, j) => j === i ? { ...r, [field]: value } : r),
    }))
  }
  function toggleDone(exId: string, i: number) {
    const wasDone = logs[exId]?.[i]?.done
    setLogs(prev => ({
      ...prev,
      [exId]: (prev[exId] ?? []).map((r, j) => j === i ? { ...r, done: !r.done } : r),
    }))
    if (!wasDone) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      startRest(restDefault)
    }
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

  // ── Statistik i toppraden ──
  const allRows   = Object.values(logs).flat()
  const doneRows  = allRows.filter(r => r.done)
  const volumeKg  = doneRows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0) * (parseInt(r.reps) || 0), 0)

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
      Alert.alert('Inga set ifyllda', 'Vill du markera passet som klart utan att logga set?', [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Markera klart', onPress: () => { onComplete(); onClose() } },
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
      onComplete()
      onSaved?.()
      onClose()
      if (prs.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setTimeout(() => Alert.alert('🏆 Nytt personligt rekord!', prs.join('\n')), 400)
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
          <TouchableOpacity style={s.restPill} onPress={cycleRestDefault} activeOpacity={0.75}>
            <Ionicons name="timer-outline" size={13} color={TEXT_SECONDARY} />
            <Text style={s.restPillText}>{fmtClock(restDefault)}</Text>
          </TouchableOpacity>
          {isCompleted ? (
            <TouchableOpacity onPress={onUncomplete} style={s.doneBadge} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle" size={14} color={GREEN} />
              <Text style={s.doneBadgeText}>Klar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={finish} style={[s.finishBtn, saving && { opacity: 0.6 }]} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={s.finishText}>Slutför</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Statistikrad: tid · volym · set ── */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statLabel}>Tid</Text>
            <Text style={[s.statValue, { color: ORANGE }]}>{fmtClock(elapsed)}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>Volym</Text>
            <Text style={s.statValue}>{Math.round(volumeKg)} kg</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>Set</Text>
            <Text style={s.statValue}>{doneRows.length}</Text>
          </View>
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
                  <Text style={s.exName}>{ex.exercise_name}</Text>

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
                        <TouchableOpacity
                          style={{ width: 36 }}
                          onLongPress={() => removeSet(ex.id, i)}
                          delayLongPress={350}
                          activeOpacity={0.6}
                        >
                          <Text style={s.setNum}>{i + 1}</Text>
                        </TouchableOpacity>
                        <TextInput
                          style={s.input}
                          value={r.reps}
                          onChangeText={v => updateLog(ex.id, i, 'reps', v.replace(/[^0-9]/g, ''))}
                          keyboardType="number-pad"
                          returnKeyType="done"
                          placeholder={p && p.reps > 0 ? String(p.reps) : (ex.reps ?? '0')}
                          placeholderTextColor="rgba(255,255,255,0.22)"
                          selectTextOnFocus
                        />
                        <TextInput
                          style={s.input}
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

                  <TouchableOpacity style={s.addSetBtn} onPress={() => addSet(ex.id)} activeOpacity={0.75}>
                    <Ionicons name="add" size={16} color={TEXT_PRIMARY} />
                    <Text style={s.addSetText}>Lägg till set</Text>
                  </TouchableOpacity>
                </View>
              )
            })}
            {exercises.length === 0 && <Text style={s.empty}>Inga övningar i passet</Text>}
            <Text style={s.hint}>Håll in setnumret för att ta bort ett set</Text>
          </ScrollView>
        </KeyboardAvoidingView>

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
  restPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 6,
    borderRadius: 12, borderWidth: 1, borderColor: BORDER,
  },
  restPillText: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
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
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
    gap: 28,
  },
  stat: { gap: 2 },
  statLabel: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '500' },
  statValue: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },

  exBlock: { paddingTop: 18, paddingHorizontal: 16 },
  exName: { color: ORANGE, fontSize: 17, fontWeight: '800', marginBottom: 10 },

  tableHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 6 },
  th: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  setRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 5, borderRadius: 10, marginHorizontal: -6, paddingHorizontal: 6,
  },
  setRowDone: { backgroundColor: GREEN + '14' },
  setNum: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700', width: 36 },
  input: {
    flex: 1, height: 38,
    backgroundColor: CARD, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER,
    color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700',
    textAlign: 'center', fontVariant: ['tabular-nums'],
  },
  check: {
    width: 40, height: 34, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: GREEN },

  addSetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: CARD, borderRadius: 12,
    paddingVertical: 10, marginTop: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  addSetText: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },

  empty: { color: TEXT_SECONDARY, textAlign: 'center', marginTop: 48, fontSize: 15 },
  hint: { color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'center', marginTop: 18 },

  restBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: ORANGE + '50',
  },
  restBarTime: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 46 },
  restBarTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' },
  restBarFill: { height: '100%', borderRadius: 3, backgroundColor: ORANGE },
  restBarBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  restBarBtnText: { color: ORANGE, fontSize: 14, fontWeight: '700' },
})
