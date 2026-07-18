import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Gesture, GestureDetector, ScrollView as GHScrollView, type GestureType } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { getCardioWorkouts, type CardioWorkout } from '@/services/workouts'
import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT } from '@/lib/theme'
import { parseLocalDate } from '@/lib/date'
import {
  getUnitSystem, setUnitSystem, toDisplayDistance, fromDisplayDistance,
  distanceUnitLabel, paceForUnit, type UnitSystem,
} from '@/lib/units'
import { getCardioStatsTheme, setCardioStatsTheme, getVoiceCues, setVoiceCues, getCardioGoal, setCardioGoal, type CardioStatsTheme } from '@/lib/prefs'

const CARDIO_BLUE = '#4AC7FF'
const SCREEN_W    = Dimensions.get('window').width
const GOAL_PAGE_W = SCREEN_W - 40   // scrollens padding är 20 per sida
const GOAL_GAP    = 12
const GOAL_SNAP   = GOAL_PAGE_W + GOAL_GAP

/** Egen slider: track + blå fyllnad + tumme, snäpper till steg med haptiskt tick */
function GoalSlider({ value, max, step, onChange, gestureRef }: {
  value: number
  max: number
  step: number
  onChange: (v: number) => void
  /** Registreras i pagerns waitFor så slidern vinner över sidsvepet */
  gestureRef?: React.MutableRefObject<GestureType | undefined>
}) {
  const [trackW, setTrackW] = useState(0)
  const last = useRef(value)
  useEffect(() => { last.current = value }, [value])

  function setFromX(x: number) {
    if (trackW <= 0) return
    const raw = (x / trackW) * max
    const v = Math.min(max, Math.max(0, Math.round(raw / step) * step))
    const rounded = Math.round(v * 10) / 10
    if (rounded !== last.current) {
      last.current = rounded
      Haptics.selectionAsync()
      onChange(rounded)
    }
  }

  let pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(e => { runOnJS(setFromX)(e.x) })
    .onUpdate(e => { runOnJS(setFromX)(e.x) })
  if (gestureRef) pan = pan.withRef(gestureRef)

  const pct = max > 0 ? Math.min(1, value / max) : 0

  return (
    <GestureDetector gesture={pan}>
      <View style={sl.hit} onLayout={e => setTrackW(e.nativeEvent.layout.width)}>
        <View style={sl.track}>
          <View style={[sl.fill, { width: `${pct * 100}%` as never }]} />
        </View>
        <View style={[sl.thumb, { left: Math.max(0, Math.min(trackW - 22, pct * trackW - 11)) }]} />
      </View>
    </GestureDetector>
  )
}

const sl = StyleSheet.create({
  hit:   { alignSelf: 'stretch', height: 34, justifyContent: 'center', marginHorizontal: 16 },
  track: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  fill:  { height: '100%', backgroundColor: CARDIO_BLUE, borderRadius: 3 },
  thumb: {
    position: 'absolute', width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 2, borderColor: CARDIO_BLUE,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: 4, elevation: 4,
  },
})

const TYPE_META: Record<string, { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  running:  { label: 'Löpning',    icon: 'fitness-outline' },
  cycling:  { label: 'Cykling',    icon: 'bicycle-outline' },
  walking:  { label: 'Promenad',   icon: 'walk-outline' },
  interval: { label: 'Intervaller', icon: 'flash-outline' },
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function CardioSessionScreen() {
  const params = useLocalSearchParams<{
    sessionId?: string
    name?: string
    cardioType?: string
    notes?: string
    date?: string
  }>()
  const type = params.cardioType ?? 'running'
  const meta = TYPE_META[type] ?? TYPE_META.running

  const [goalKm, setGoalKm]   = useState(0)   // lagras alltid i km
  const [goalMin, setGoalMin] = useState(0)
  const [last, setLast]       = useState<CardioWorkout | null>(null)
  const [unit, setUnit]       = useState<UnitSystem>('metric')
  const [statsTheme, setStatsTheme] = useState<CardioStatsTheme>('dark')
  const [voiceOn, setVoiceOn] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Egen inmatning: vilken siffra som redigeras + fältets text
  const [editTarget, setEditTarget] = useState<'dist' | 'time' | null>(null)
  const [editValue, setEditValue]   = useState('')

  useEffect(() => {
    getUnitSystem().then(setUnit)
    getCardioStatsTheme().then(setStatsTheme)
    getVoiceCues().then(setVoiceOn)
    // Förifyll med senaste målet för den här passtypen
    getCardioGoal(type).then(g => {
      if (!g) return
      if (g.km > 0) setGoalKm(g.km)
      if (g.min > 0) setGoalMin(g.min)
    })
  }, [type])

  const unitLabel = distanceUnitLabel(unit)
  const goalDist  = toDisplayDistance(goalKm, unit)   // visningsvärde i vald enhet

  function openEdit(target: 'dist' | 'time') {
    Haptics.selectionAsync()
    setEditValue(target === 'dist'
      ? (goalDist > 0 ? goalDist.toFixed(1).replace('.', ',') : '')
      : (goalMin > 0 ? String(goalMin) : ''))
    setEditTarget(target)
  }

  function saveEdit() {
    const num = parseFloat(editValue.replace(',', '.'))
    if (editTarget === 'dist') {
      setGoalKm(Number.isFinite(num) && num > 0 ? fromDisplayDistance(num, unit) : 0)
    } else if (editTarget === 'time') {
      setGoalMin(Number.isFinite(num) && num > 0 ? Math.round(num) : 0)
    }
    setEditTarget(null)
  }

  async function chooseUnit(u: UnitSystem) {
    Haptics.selectionAsync()
    setUnit(u)
    await setUnitSystem(u)
  }

  async function chooseStatsTheme(t: CardioStatsTheme) {
    Haptics.selectionAsync()
    setStatsTheme(t)
    await setCardioStatsTheme(t)
  }

  async function chooseVoice(on: boolean) {
    Haptics.selectionAsync()
    setVoiceOn(on)
    await setVoiceCues(on)
  }

  useEffect(() => {
    async function loadLast() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const workouts = await getCardioWorkouts(session.user.id, 100).catch(() => [])
      setLast(workouts.find(w => w.data.type === type) ?? null)
    }
    loadLast()
  }, [type])

  const dateLabel = params.date
    ? parseLocalDate(params.date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

  // Förval i visningsenheten
  const DIST_PRESETS = unit === 'imperial' ? [2, 3, 5] : [3, 5, 10]
  const MIN_PRESETS  = [20, 30, 60]
  const SLIDER_MAX   = unit === 'imperial' ? 10 : 15

  const [goalPage, setGoalPage] = useState(0)
  const kmSliderRef  = useRef<GestureType | undefined>(undefined)
  const minSliderRef = useRef<GestureType | undefined>(undefined)

  function handleStart() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    // Spara målet som förval för nästa pass av samma typ
    setCardioGoal(type, { km: goalKm, min: goalMin }).catch(() => {})
    router.replace({
      pathname: '/cardio',
      params: {
        name: type,
        ...(params.sessionId ? { sessionId: params.sessionId, sessionDate: params.date } : {}),
        ...(goalKm > 0 ? { goalKm: goalKm.toFixed(2) } : {}),
        ...(goalMin > 0 ? { goalMin: String(goalMin) } : {}),
      },
    })
  }

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Topp: tillbaka + datum ── */}
        <View style={s.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
          </TouchableOpacity>
          {dateLabel && <Text style={s.dateLabel}>{dateLabel}</Text>}
          <TouchableOpacity onPress={() => setSettingsOpen(true)} style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="settings-outline" size={20} color={TEXT_PRIMARY} />
          </TouchableOpacity>
        </View>

        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Ionicons name={meta.icon} size={34} color={CARDIO_BLUE} />
          </View>
          <Text style={s.heroTitle}>{params.name ?? meta.label}</Text>
          <View style={s.heroMetaRow}>
            <View style={s.typePill}>
              <Text style={s.typePillText}>{meta.label.toUpperCase()}</Text>
            </View>
            {!!params.notes && <Text style={s.heroNotes}>{params.notes}</Text>}
          </View>
        </View>

        {/* ── Mål för passet: en tile i taget, svep mellan distans och tid ── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>MÅL FÖR PASSET</Text>
          <Text style={s.sectionOptional}>Valfritt</Text>
        </View>
        <GHScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          waitFor={[kmSliderRef, minSliderRef]}
          snapToInterval={GOAL_SNAP}
          snapToAlignment="start"
          decelerationRate="fast"
          onMomentumScrollEnd={e => setGoalPage(Math.round(e.nativeEvent.contentOffset.x / GOAL_SNAP))}
          style={{ marginHorizontal: -20 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: GOAL_GAP }}
        >
          <View style={[s.goalTile, { width: GOAL_PAGE_W }, goalKm > 0 && s.goalTileActive]}>
            <Text style={s.goalTileLabel}>DISTANS</Text>
            <TouchableOpacity onPress={() => openEdit('dist')} activeOpacity={0.7}>
              <Text style={[s.goalTileValue, goalKm > 0 && { color: CARDIO_BLUE }]}>
                {goalDist > 0 ? goalDist.toFixed(1).replace('.', ',') : '—'}
              </Text>
              <Text style={s.goalTileUnit}>{unitLabel}</Text>
            </TouchableOpacity>
            <View style={s.presetRow}>
              {DIST_PRESETS.map(d => {
                const active = Math.abs(goalDist - d) < 0.05
                return (
                  <TouchableOpacity
                    key={d}
                    style={[s.presetChip, active && s.presetChipActive]}
                    onPress={() => {
                      Haptics.selectionAsync()
                      setGoalKm(active ? 0 : fromDisplayDistance(d, unit))
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.presetText, active && s.presetTextActive]}>{d}</Text>
                  </TouchableOpacity>
                )
              })}
              <TouchableOpacity
                style={[s.presetChip, s.customChip]}
                onPress={() => openEdit('dist')}
                activeOpacity={0.75}
              >
                <Ionicons name="pencil" size={11} color={CARDIO_BLUE} />
                <Text style={[s.presetText, { color: CARDIO_BLUE }]}>Egen</Text>
              </TouchableOpacity>
            </View>
            <GoalSlider
              value={goalDist}
              max={SLIDER_MAX}
              step={0.5}
              onChange={v => setGoalKm(fromDisplayDistance(v, unit))}
              gestureRef={kmSliderRef}
            />
          </View>

          <View style={[s.goalTile, { width: GOAL_PAGE_W }, goalMin > 0 && s.goalTileActive]}>
            <Text style={s.goalTileLabel}>TID</Text>
            <TouchableOpacity onPress={() => openEdit('time')} activeOpacity={0.7}>
              <Text style={[s.goalTileValue, goalMin > 0 && { color: CARDIO_BLUE }]}>
                {goalMin > 0 ? goalMin : '—'}
              </Text>
              <Text style={s.goalTileUnit}>min</Text>
            </TouchableOpacity>
            <View style={s.presetRow}>
              {MIN_PRESETS.map(min => (
                <TouchableOpacity
                  key={min}
                  style={[s.presetChip, goalMin === min && s.presetChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setGoalMin(goalMin === min ? 0 : min) }}
                  activeOpacity={0.75}
                >
                  <Text style={[s.presetText, goalMin === min && s.presetTextActive]}>{min}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[s.presetChip, s.customChip]}
                onPress={() => openEdit('time')}
                activeOpacity={0.75}
              >
                <Ionicons name="pencil" size={11} color={CARDIO_BLUE} />
                <Text style={[s.presetText, { color: CARDIO_BLUE }]}>Egen</Text>
              </TouchableOpacity>
            </View>
            <GoalSlider value={goalMin} max={90} step={5} onChange={setGoalMin} gestureRef={minSliderRef} />
          </View>
        </GHScrollView>

        {/* Sidprickar */}
        <View style={s.goalDots}>
          {[0, 1].map(i => (
            <View key={i} style={[s.goalDot, goalPage === i && s.goalDotActive]} />
          ))}
        </View>

        {/* ── Senast ── */}
        <Text style={s.sectionTitle}>SENAST DU {meta.label === 'Cykling' ? 'CYKLADE' : meta.label === 'Promenad' ? 'PROMENERADE' : 'SPRANG'}</Text>
        <View style={s.card}>
          {last ? (
            <View style={s.lastRow}>
              <View style={s.lastStat}>
                <Text style={s.lastValue}>{toDisplayDistance(last.data.distance_km, unit).toFixed(2)}</Text>
                <Text style={s.lastLabel}>{unitLabel}</Text>
              </View>
              <View style={s.lastDivider} />
              <View style={s.lastStat}>
                <Text style={s.lastValue}>{fmtTime(last.data.duration_seconds)}</Text>
                <Text style={s.lastLabel}>tid</Text>
              </View>
              <View style={s.lastDivider} />
              <View style={s.lastStat}>
                <Text style={s.lastValue}>
                  {last.data.distance_km > 0.1
                    ? fmtTime(Math.round(paceForUnit(last.data.duration_seconds / last.data.distance_km, unit)))
                    : '--:--'}
                </Text>
                <Text style={s.lastLabel}>/{unitLabel}</Text>
              </View>
            </View>
          ) : (
            <Text style={s.lastEmpty}>Inget tidigare pass av den här typen — dags att sätta ribban!</Text>
          )}
        </View>

        {/* ── Poäng-hint ── */}
        <View style={s.pointsRow}>
          <Ionicons name="star-outline" size={14} color={CARDIO_BLUE} />
          <Text style={s.pointsText}>GPS-spårat pass ger 30 p · max 1 per dag</Text>
        </View>

      </ScrollView>

      {/* ── Egen inmatning av distans/tid ── */}
      <Modal visible={editTarget !== null} transparent animationType="fade" onRequestClose={() => setEditTarget(null)}>
        <KeyboardAvoidingView style={s.editBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditTarget(null)} />
          <View style={s.editCard}>
            <Text style={s.editTitle}>{editTarget === 'dist' ? `Distans (${unitLabel})` : 'Tid (min)'}</Text>
            <TextInput
              style={s.editInput}
              value={editValue}
              onChangeText={setEditValue}
              placeholder={editTarget === 'dist' ? `t.ex. 7,5` : 't.ex. 45'}
              placeholderTextColor={TEXT_SECONDARY}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={saveEdit}
              autoFocus
            />
            <View style={s.editBtnRow}>
              <TouchableOpacity
                style={s.editClearBtn}
                onPress={() => { setEditValue(''); Haptics.selectionAsync() }}
                activeOpacity={0.75}
              >
                <Text style={s.editClearText}>Rensa</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.editSaveBtn} onPress={saveEdit} activeOpacity={0.85}>
                <Text style={s.editSaveText}>Spara</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Inställningar ── */}
      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={s.editBackdrop} onPress={() => setSettingsOpen(false)}>
          <Pressable style={s.editCard} onPress={() => {}}>
            <Text style={s.editTitle}>Inställningar</Text>

            <Text style={s.settingLabel}>ENHET</Text>
            <View style={s.unitRow}>
              {([['metric', 'Kilometer'], ['imperial', 'Miles']] as const).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.unitBtn, unit === key && s.unitBtnActive]}
                  onPress={() => chooseUnit(key)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.unitBtnText, unit === key && s.unitBtnTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.settingLabel}>STATISTIKPANEL UNDER PASSET</Text>
            <View style={s.unitRow}>
              {([['dark', 'Mörk'], ['light', 'Ljus']] as const).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.unitBtn, { flexDirection: 'row', justifyContent: 'center', gap: 6 }, statsTheme === key && s.unitBtnActive]}
                  onPress={() => chooseStatsTheme(key)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={key === 'dark' ? 'moon-outline' : 'sunny-outline'}
                    size={15}
                    color={statsTheme === key ? CARDIO_BLUE : TEXT_SECONDARY}
                  />
                  <Text style={[s.unitBtnText, statsTheme === key && s.unitBtnTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.settingLabel}>RÖSTGUIDNING</Text>
            <View style={s.unitRow}>
              {([[true, 'På'], [false, 'Av']] as const).map(([key, label]) => (
                <TouchableOpacity
                  key={label}
                  style={[s.unitBtn, { flexDirection: 'row', justifyContent: 'center', gap: 6 }, voiceOn === key && s.unitBtnActive]}
                  onPress={() => chooseVoice(key)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={key ? 'volume-high-outline' : 'volume-mute-outline'}
                    size={15}
                    color={voiceOn === key ? CARDIO_BLUE : TEXT_SECONDARY}
                  />
                  <Text style={[s.unitBtnText, voiceOn === key && s.unitBtnTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.editSaveBtn, { flex: 0, alignSelf: 'stretch' }]}
              onPress={() => { Haptics.selectionAsync(); setSettingsOpen(false) }}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark" size={17} color="#fff" />
              <Text style={s.editSaveText}>Spara</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Starta — fastnålad ── */}
      <View style={s.startWrap} pointerEvents="box-none">
        <TouchableOpacity style={s.startBtn} onPress={handleStart} activeOpacity={0.9}>
          <Ionicons name="play" size={18} color="#fff" />
          <Text style={s.startBtnText}>Starta {meta.label.toLowerCase()}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  scroll: { padding: 20, paddingTop: 8, paddingBottom: 120, gap: 10 },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  dateLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },

  hero: { alignItems: 'center', gap: 10, paddingVertical: 14 },
  heroIcon: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: CARDIO_BLUE + '1C',
    borderWidth: 1.5, borderColor: CARDIO_BLUE + '50',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle:   { color: TEXT_PRIMARY, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typePill: {
    backgroundColor: CARDIO_BLUE + '1C', borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  typePillText: { color: CARDIO_BLUE, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heroNotes:    { color: TEXT_SECONDARY, fontSize: 14 },

  sectionTitle: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginTop: 8,
  },
  sectionRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  sectionOptional: {
    color: 'rgba(255,255,255,0.35)', fontSize: 11, fontStyle: 'italic',
  },
  card: {
    backgroundColor: CARD, borderRadius: 18,
    borderWidth: 1, borderColor: BORDER,
    padding: 16, gap: 12,
  },

  goalTile: {
    alignItems: 'center', gap: 8,
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1.5, borderColor: BORDER,
    paddingVertical: 18,
  },
  goalTileActive: { borderColor: CARDIO_BLUE + '70', backgroundColor: CARDIO_BLUE + '0C' },
  goalTileLabel:  { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  goalTileValue:  { color: TEXT_SECONDARY, fontSize: 38, fontFamily: NUM_FONT, textAlign: 'center', lineHeight: 42 },
  goalTileUnit:   { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', marginTop: -2 },
  presetRow: { flexDirection: 'row', gap: 6 },
  presetChip: {
    minWidth: 34, alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 14,
    borderWidth: 1.5, borderColor: BORDER,
  },
  presetChipActive: { borderColor: CARDIO_BLUE, backgroundColor: CARDIO_BLUE + '1C' },
  presetText:       { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '700' },
  presetTextActive: { color: CARDIO_BLUE },

  // Inmatnings- och inställningsmodal
  editBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  editCard: {
    width: '100%', maxWidth: 320,
    backgroundColor: CARD, borderRadius: 22,
    borderWidth: 1, borderColor: BORDER,
    padding: 22, gap: 14,
  },
  editTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  editInput: {
    backgroundColor: BG, borderRadius: 14,
    borderWidth: 1, borderColor: CARDIO_BLUE + '55',
    color: TEXT_PRIMARY, fontSize: 26, fontFamily: NUM_FONT, textAlign: 'center',
    paddingVertical: 14,
  },
  editBtnRow:   { flexDirection: 'row', gap: 10 },
  editClearBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 13,
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
  },
  editClearText: { color: TEXT_SECONDARY, fontSize: 15, fontWeight: '600' },
  editSaveBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6,
    alignItems: 'center', paddingVertical: 13,
    borderRadius: 14, backgroundColor: CARDIO_BLUE,
  },
  customChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderColor: CARDIO_BLUE + '55', borderStyle: 'dashed',
  },
  editSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  settingLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  unitRow: { flexDirection: 'row', gap: 8 },
  unitBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderRadius: 14, borderWidth: 1.5, borderColor: BORDER,
  },
  unitBtnActive:     { borderColor: CARDIO_BLUE, backgroundColor: CARDIO_BLUE + '18' },
  unitBtnText:       { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600' },
  unitBtnTextActive: { color: CARDIO_BLUE, fontWeight: '700' },

  goalDots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 2 },
  goalDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  goalDotActive: { backgroundColor: CARDIO_BLUE, width: 16 },


  lastRow:     { flexDirection: 'row', alignItems: 'center' },
  lastStat:    { flex: 1, alignItems: 'center', gap: 2 },
  lastValue:   { color: TEXT_PRIMARY, fontSize: 20, fontFamily: NUM_FONT },
  lastLabel:   { color: TEXT_SECONDARY, fontSize: 11 },
  lastDivider: { width: 1, height: 30, backgroundColor: BORDER },
  lastEmpty:   { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 19, textAlign: 'center' },

  pointsRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 2 },
  pointsText: { color: TEXT_SECONDARY, fontSize: 12 },

  startWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 24,
    paddingHorizontal: 20,
  },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: CARDIO_BLUE, borderRadius: 28, paddingVertical: 16,
    shadowColor: CARDIO_BLUE, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
