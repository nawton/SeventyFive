import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { ORANGE, GREEN, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import type { WorkoutSession, SessionExercise } from '@/services/workoutSchedule'
import type { Exercise } from '@/services/exercises'
import { ExerciseLogSheet } from '@/components/ExerciseLogSheet'

export function SessionFullscreen({
  visible, session, checked, isCompleted, exercisesList, date,
  onToggle, onComplete, onUncomplete, onClose, onExerciseSaved,
}: {
  visible: boolean
  session: WorkoutSession | null
  checked: Record<string, boolean>
  isCompleted: boolean
  exercisesList: Exercise[]
  date: string
  onToggle: (exId: string) => void
  onComplete: () => void
  onUncomplete: () => void
  onClose: () => void
  onExerciseSaved?: () => void
}) {
  const exercises = session?.exercises ?? []
  // Övningsloggen visas som ett lager INUTI passvyn (inte som ny sida)
  const [selectedEx, setSelectedEx] = useState<SessionExercise | null>(null)
  const selectedInfo = selectedEx ? exercisesList.find(e => e.name === selectedEx.exercise_name) : undefined
  const done  = exercises.filter(e => isCompleted || checked[e.id]).length
  const total = exercises.length
  const pct   = total > 0 ? done / total : 0

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.screen}>
        <SafeAreaView edges={['top']}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} style={s.iconBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-down" size={26} color={TEXT_PRIMARY} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            {isCompleted ? (
              <TouchableOpacity onPress={onUncomplete} style={s.doneBadge} activeOpacity={0.8}>
                <Ionicons name="checkmark-circle" size={15} color={GREEN} />
                <Text style={s.doneBadgeText}>Klar</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={s.titleWrap}>
            <View style={s.titleIcon}>
              <Ionicons name="barbell" size={22} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={2}>{session?.name}</Text>
              <Text style={s.sub}>{total} övningar · {done} klara</Text>
            </View>
          </View>

          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${pct * 100}%` as never }]} />
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {exercises.map((ex, i) => {
            const on = isCompleted || checked[ex.id]
            return (
              <TouchableOpacity
                key={ex.id}
                style={[s.exCard, on && s.exCardDone]}
                onPress={() => setSelectedEx(ex)}
                activeOpacity={0.8}
              >
                <View style={s.exIndex}><Text style={s.exIndexText}>{i + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.exName, on && { color: TEXT_SECONDARY, textDecorationLine: 'line-through' }]} numberOfLines={1}>
                    {ex.exercise_name}
                  </Text>
                  <Text style={s.exMeta}>
                    {ex.sets != null ? `${ex.sets} set` : ''}{ex.sets != null && ex.reps ? ' · ' : ''}{ex.reps ? `${ex.reps} reps` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => onToggle(ex.id)}
                  disabled={isCompleted}
                  style={[s.check, on && s.checkOn]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {on && <Ionicons name="checkmark" size={17} color="#000" />}
                </TouchableOpacity>
              </TouchableOpacity>
            )
          })}
          {total === 0 && <Text style={s.empty}>Inga övningar i passet</Text>}
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={s.footer}>
          {isCompleted ? (
            <TouchableOpacity style={[s.cta, s.ctaDone]} onPress={onUncomplete} activeOpacity={0.85}>
              <Ionicons name="refresh" size={19} color={TEXT_PRIMARY} />
              <Text style={[s.ctaText, { color: TEXT_PRIMARY }]}>Ångra klart</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.cta} onPress={onComplete} activeOpacity={0.85}>
              <Ionicons name="checkmark" size={20} color="#000" />
              <Text style={s.ctaText}>Markera pass klart</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>

        {/* Övningslogg som lager ovanpå passvyn */}
        {selectedEx && selectedInfo && (
          <ExerciseLogSheet
            id={selectedInfo.id}
            name={selectedInfo.name}
            description={selectedInfo.description ?? ''}
            category={selectedInfo.category}
            difficulty={selectedInfo.difficulty}
            initialSets={selectedEx.sets != null ? String(selectedEx.sets) : ''}
            initialReps={selectedEx.reps ?? ''}
            sessionExId={selectedEx.id}
            sessionDate={date}
            onSaved={() => {
              if (selectedEx && !isCompleted && !checked[selectedEx.id]) onToggle(selectedEx.id)
              onExerciseSaved?.()
            }}
            onClose={() => setSelectedEx(null)}
          />
        )}
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingTop: 6, paddingBottom: 2,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  doneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: GREEN + '1E', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 6,
    marginRight: 8,
  },
  doneBadgeText: { color: GREEN, fontSize: 13, fontWeight: '700' },

  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14 },
  titleIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center' },
  title: { color: TEXT_PRIMARY, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  sub: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '500', marginTop: 3 },

  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 20, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: ORANGE, borderRadius: 2 },

  scroll: { padding: 16, gap: 10 },
  exCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 14,
  },
  exCardDone: { borderColor: GREEN + '40', backgroundColor: '#0A2416' },
  exIndex: { width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  exIndexText: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '700' },
  exName: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  exMeta: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
  check: {
    width: 30, height: 30, borderRadius: 9, borderWidth: 1.5, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: GREEN, borderColor: GREEN },
  empty: { color: TEXT_SECONDARY, textAlign: 'center', marginTop: 48, fontSize: 15 },

  footer: { paddingHorizontal: 16, paddingTop: 10 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 16,
  },
  ctaDone: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER },
  ctaText: { color: '#000', fontSize: 16, fontWeight: '800' },
})
