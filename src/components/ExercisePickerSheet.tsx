import { memo, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList,
  TextInput, ScrollView, Modal, KeyboardAvoidingView, Platform, Keyboard, useColorScheme,
} from 'react-native'
import { Ionicons } from '@/components/Icon'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Pressable } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated'
import Body from 'react-native-body-highlighter'
import { useT } from '@/lib/i18n'
import { EN } from '@/lib/i18n/en'
import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT, accentAlpha, useThemeStrings } from '@/lib/theme'
import { useBodyGender } from '@/lib/bodyGender'
import { CATEGORY_LABELS, EQUIPMENT_LABELS, type Exercise, type ExerciseEquipment } from '@/services/exercises'
import { stillUrlForImagePath } from '@/lib/exerciseInfo/images'
import { MuscleThumb } from '@/components/MuscleThumb'
import { CreateExerciseSheet } from '@/components/CreateExerciseSheet'
import { ExerciseInfoSheet } from '@/components/ExerciseInfoSheet'
import { EXERCISE_INFO } from '@/lib/exerciseInfo'
import { getExerciseMuscleGroup, getMusclesForName, SLUG_LABELS, type Slug } from '@/lib/muscles'
import type { ExerciseCategory } from '@/types/database'
import { AppTextInput } from '@/components/AppTextInput'
import { GlassCircleButton } from '@/components/GlassButton'

type Page = 'landing' | 'gym' | 'cardio' | 'exercises'

// Vanliga övningar som visas överst — kuraterade per muskel plus en
// generell topplista. Namnen är bibliotekets kanoniska svenska namn;
// de som inte finns i datan filtreras tyst bort.
const POPULAR: Record<string, string[]> = {
  all: ['Bänkpress', 'Knäböj', 'Marklyft', 'Latsdrag framifrån', 'Militärpress',
        'Bicepscurl', 'Tricepsstötning kabel', 'Benpress', 'Sidolyft', 'Kabelrodd sittande'],
  chest: ['Bänkpress', 'Hantelpress liggande', 'Lutande bänkpress', 'Lutande hantelpress',
          'Kabelkorsning', 'Flyes med hantlar', 'Push-ups', 'Dips', 'Kabelflyes', 'Pec deck'],
  'upper-back': ['Latsdrag framifrån', 'Pull-ups', 'Rodd med skivstång', 'Kabelrodd sittande',
                 'Enarms hantelrodd', 'T-bar rodd', 'Chin-ups', 'Latsdrag smalt grepp',
                 'Stående kabelrodd', 'Face pulls'],
  'lower-back': ['Marklyft', 'Rumänsk marklyft', 'Hyperextensions', 'Good mornings',
                 'Rack pull', 'Sumo marklyft', 'Genomdrag med kabel', 'Kettlebell swing'],
  trapezius: ['Shrugs med skivstång', 'Shrugs med hantlar', 'Upright row', 'Face pulls',
              'Marklyft', 'Rack pull', 'Frivändning', 'Farmers walk'],
  deltoids: ['Militärpress', 'Hantelpress axlar', 'Sidolyft', 'Frontlyft', 'Bakre deltalyft',
             'Arnold press', 'Axellyft med kabel', 'Omvänd flyes', 'Push press', 'Upright row'],
  biceps: ['Bicepscurl', 'Hammercurl', 'Kabelbiceps', 'Preacher curl', 'Koncentrationscurl',
           'Chin-ups', 'Enarms kabelcurl', 'Kabelcurl med rep'],
  triceps: ['Tricepsstötning kabel', 'Tricepsstötning med rep', 'Smalbänkpress', 'Dips',
            'Skull crushers', 'Kabeltriceps över huvud', 'Triceps kickback', 'Tricepspress smal'],
  forearm: ['Handledscurl', 'Hammercurl', 'Farmers walk', 'Bicepscurl'],
  abs: ['Plankan', 'Situps', 'Crunches', 'Hängande benlyft', 'Kabelcrunch', 'Russian twist',
        'Mountain climbers', 'Benlyft liggande', 'Ab wheel', 'Sidoplanka'],
  obliques: ['Russian twist', 'Sidoplanka', 'Kabelvridning', 'Pallof press', 'Hängande benlyft'],
  quadriceps: ['Knäböj', 'Benpress', 'Utfall', 'Benextension', 'Front squat', 'Bulgariska utfall',
               'Hack squat', 'Goblet squat', 'Steg-ups', 'Box squat'],
  hamstring: ['Rumänsk marklyft', 'Bencurl liggande', 'Sittande bencurl', 'Marklyft',
              'Good mornings', 'Nordic curl', 'Genomdrag med kabel', 'Kettlebell swing'],
  gluteal: ['Hip thrust', 'Knäböj', 'Utfall', 'Rumänsk marklyft', 'Bulgariska utfall',
            'Glute kickback i kabel', 'Genomdrag med kabel', 'Sumo marklyft', 'Steg-ups'],
  adductors: ['Sumo marklyft'],
  calves: ['Vadpress stående', 'Sittande vadpress'],
  tibialis: [],
}

const EQUIP_SLIDE = 520
const EQUIP_SPRING = { damping: 20, stiffness: 220, mass: 0.8 } as const

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

// Muskelfiltret: en rad per tränbar muskel, samma lista som Skapa övning
const FILTER_SLUGS: Slug[] = [
  'chest', 'upper-back', 'lower-back', 'trapezius', 'deltoids',
  'biceps', 'triceps', 'forearm', 'abs', 'obliques',
  'quadriceps', 'hamstring', 'gluteal', 'adductors', 'calves', 'tibialis',
]

function cardioExIcon(ex: Exercise): IoniconName {
  const n = ex.name.toLowerCase()
  if (n.includes('cykel') || n.includes('cycl') || n.includes('bike')) return 'bicycle-outline'
  if (n.includes('simm') || n.includes('swim'))                         return 'water-outline'
  if (n.includes('yoga') || n.includes('stretching'))                   return 'leaf-outline'
  if (n.includes('rodd') || n.includes('row'))                          return 'git-compare-outline'
  if (ex.category === 'hiit')                                           return 'flash-outline'
  if (ex.category === 'mobility')                                       return 'accessibility-outline'
  return 'walk-outline'
}

export function ExercisePickerSheet({
  visible,
  exercises,
  onSelect,
  onClose,
  gymOnly = false,
  multiSelect = false,
  onConfirmMulti,
}: {
  visible:   boolean
  exercises: Exercise[]
  onSelect:  (ex: Exercise, sets: number | null, reps: string | null) => void
  onClose:   () => void
  /** Gym-pass innehåller bara gym-övningar — hoppa förbi landing och cardio */
  gymOnly?:  boolean
  /** Bocka i hur många övningar som helst (utan set/reps-frågan) och spara med Klar */
  multiSelect?: boolean
  onConfirmMulti?: (exs: Exercise[]) => void
}) {
  const t = useT()
  const T = useThemeStrings()
  // Ljust läge har blå accent — aldrig orange kanter där. Allt i den här
  // modalen måste använda råa strängfärger: iOS fryser dynamiska färger
  // i borders/bakgrunder inne i modaler, annars läcker mörklägesorange in
  const tint = (alpha: string) => `${T.ACCENT}${alpha}`
  const onAccent = useColorScheme() === 'light' ? '#FFFFFF' : '#000000'
  const insets = useSafeAreaInsets()
  // Gym-pass landar direkt i listan med ALLA övningar — muskelfiltret
  // (gamla gruppsidan) öppnas via knappen högst upp
  const startPage: Page = gymOnly ? 'exercises' : 'landing'
  const [page, setPage]                   = useState<Page>(startPage)
  const [muscleFilter, setMuscleFilter]   = useState<'all' | Slug>('all')
  // Utrustningsfiltret: kombineras fritt med muskelfiltret
  const [equipFilter, setEquipFilter]     = useState<'all' | ExerciseEquipment>('all')
  const [equipOpen, setEquipOpen]         = useState(false)
  const equipTy = useSharedValue(EQUIP_SLIDE)

  function openEquip() {
    setEquipOpen(true)
    equipTy.value = EQUIP_SLIDE
    equipTy.value = withSpring(0, EQUIP_SPRING)
  }

  function closeEquip() {
    equipTy.value = withTiming(EQUIP_SLIDE, { duration: 200 }, finished => {
      if (finished) runOnJS(setEquipOpen)(false)
    })
  }

  const equipDrag = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .onUpdate(e => {
      equipTy.value = e.translationY > 0 ? e.translationY : e.translationY * 0.15
    })
    .onEnd(e => {
      if (e.translationY > 100 || e.velocityY > 600) {
        equipTy.value = withTiming(EQUIP_SLIDE, { duration: 200 }, finished => {
          if (finished) runOnJS(setEquipOpen)(false)
        })
      } else {
        equipTy.value = withSpring(0, EQUIP_SPRING)
      }
    })

  const equipSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: equipTy.value }],
  }))
  const [search, setSearch]               = useState('')
  const [pendingEx, setPendingEx]         = useState<Exercise | null>(null)
  // Egna övningar skapade i den här sessionen — läggs ovanpå prop-listan
  // så de syns direkt utan att skalet behöver ladda om
  const [createdExes, setCreatedExes]     = useState<Exercise[]>([])
  const [createOpen, setCreateOpen]       = useState(false)
  // Infobladet: tryck på GIF:en eller långtryck på raden
  const [infoEx, setInfoEx]               = useState<Exercise | null>(null)
  const [multiSel, setMultiSel]           = useState<Exercise[]>([])
  const [sets, setSets]                   = useState('3')
  const [reps, setReps]                   = useState('10')

  useEffect(() => {
    if (!visible) {
      setPage(startPage)
      setMuscleFilter('all')
      setEquipFilter('all')
      setEquipOpen(false)
      setSearch('')
      setPendingEx(null)
      setMultiSel([])
    }
  }, [visible, startPage])

  const unique       = [...new Map([...exercises, ...createdExes].map(e => [e.name.toLowerCase(), e])).values()]
  const strengthExes = unique.filter(e => e.category === 'strength')
  const otherExes    = unique.filter(e => e.category !== 'strength')

  function handleClose() {
    setPage(startPage)
    setMuscleFilter('all')
    setSearch('')
    setPendingEx(null)
    onClose()
  }

  function handleBack() {
    // Muskelfiltret backar alltid till listan
    if (page === 'gym') setPage('exercises')
    else if (page === 'exercises' && !gymOnly) { setPage('landing'); setMuscleFilter('all'); setSearch('') }
    else if (page === 'exercises') handleClose()
    else if (page === 'cardio') setPage('landing')
  }

  function openInfo(ex: Exercise) {
    if (!EXERCISE_INFO[ex.name] && !ex.image_path && !ex.primary_muscle && !ex.instructions?.length) return
    Haptics.selectionAsync()
    setInfoEx(ex)
  }

  function handleTap(ex: Exercise) {
    if (multiSelect) {
      Haptics.selectionAsync()
      setMultiSel(prev => prev.some(e => e.id === ex.id)
        ? prev.filter(e => e.id !== ex.id)
        : [...prev, ex])
      return
    }
    if (ex.category === 'cardio') {
      onSelect(ex, null, null)
    } else {
      setSets('3')
      setReps('10')
      setPendingEx(ex)
    }
  }

  function confirmMulti() {
    if (multiSel.length === 0) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onConfirmMulti?.(multiSel)
    setMultiSel([])
  }

  function handleConfirm() {
    if (!pendingEx) return
    const s = sets.trim() ? parseInt(sets) : null
    const r = reps.trim() || null
    const ex = pendingEx
    setPendingEx(null)
    onSelect(ex, s, r)
  }

  const groupExercises = muscleFilter === 'all'
    ? strengthExes
    : strengthExes.filter(e => getMusclesForName(e.name).includes(muscleFilter))
  const equipExercises = equipFilter === 'all'
    ? groupExercises
    : groupExercises.filter(e => e.equipment === equipFilter)
  const filteredExercises = search.trim()
    // Sökningen matchar både det lagrade svenska namnet och den visade
    // engelska översättningen, så "bench" hittar Bänkpress på engelska
    ? equipExercises.filter(e => {
        const q = search.toLowerCase()
        // Engelska namnet är alltid sökbart, även i svenskt läge
        return e.name.toLowerCase().includes(q) ||
          (EN[e.name]?.toLowerCase().includes(q) ?? false) ||
          t(e.name).toLowerCase().includes(q)
      })
    : equipExercises

  // Vanliga överst (utan sökning): kuraterade träffar först, resten under
  type ListItem = { kind: 'header'; title: string } | { kind: 'ex'; ex: Exercise }
  const listData: ListItem[] = (() => {
    if (search.trim()) return filteredExercises.map(ex => ({ kind: 'ex' as const, ex }))
    const wanted = POPULAR[muscleFilter] ?? []
    const byName = new Map(filteredExercises.map(e => [e.name, e]))
    const popular = wanted.map(n => byName.get(n)).filter((e): e is Exercise => !!e)
    if (popular.length === 0) return filteredExercises.map(ex => ({ kind: 'ex' as const, ex }))
    const popIds = new Set(popular.map(e => e.id))
    const rest = filteredExercises.filter(e => !popIds.has(e.id))
    return [
      { kind: 'header' as const, title: 'VANLIGA' },
      ...popular.map(ex => ({ kind: 'ex' as const, ex })),
      { kind: 'header' as const, title: 'ALLA ÖVNINGAR' },
      ...rest.map(ex => ({ kind: 'ex' as const, ex })),
    ]
  })()

  const equipOptions = (Object.keys(EQUIPMENT_LABELS) as ExerciseEquipment[])
    .filter(k => strengthExes.some(e => e.equipment === k))

  // I gym-only-läget är listan roten → visa stäng-ikon, inte bakåtpil
  const showBack      = page !== 'landing' && !(gymOnly && page === 'exercises')
  const headerTitle   = page === 'gym' ? t('Filtrera på muskel')
    : page === 'cardio'    ? t('Cardio')
    : page === 'exercises' ? t('Lägg till övning')
    : t('Lägg till övning')

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[s.screen, { paddingTop: insets.top }]}>

        {/* Header */}
        <View style={s.header}>
          {/* Samma mönster som Logga pass: X i liquid glass stänger,
              chevron backar på understegen, ingen Stäng-knapp */}
          <GlassCircleButton
            icon={showBack ? 'chevron-back' : 'close'}
            size={40}
            iconColor={TEXT_PRIMARY}
            onPress={showBack ? handleBack : handleClose}
            fallbackStyle={s.iconBtnFallback}
          />
          <Text style={s.title}>{headerTitle}</Text>
          {page === 'exercises' ? (
            <GlassCircleButton
              icon="add"
              size={40}
              iconColor={TEXT_PRIMARY}
              onPress={() => setCreateOpen(true)}
              fallbackStyle={s.iconBtnFallback}
              testID="createExercise"
            />
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* ── LANDING ─────────────────────────────────────────────── */}
        {page === 'landing' && (
          <View style={s.landingContainer}>
            <Text style={s.landingSub}>{t('Välj typ av övning')}</Text>
            <View style={s.landingCards}>
              <TouchableOpacity style={s.landingCard} onPress={() => { setMuscleFilter('all'); setPage('exercises') }} activeOpacity={0.8}>
                <View style={[s.landingIcon, { backgroundColor: 'rgba(255,149,0,0.18)' }]}>
                  <Ionicons name="barbell" size={44} color={ACCENT} />
                </View>
                <Text style={s.landingCardTitle}>{t('Gym')}</Text>
                <Text style={s.landingCardSub}>{t('Styrketräning')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.landingCard} onPress={() => setPage('cardio')} activeOpacity={0.8}>
                <View style={[s.landingIcon, { backgroundColor: 'rgba(52,199,89,0.18)' }]}>
                  <Ionicons name="heart" size={44} color="#34C759" />
                </View>
                <Text style={s.landingCardTitle}>{t('Cardio')}</Text>
                <Text style={s.landingCardSub}>{t('Kondition & rörlighet')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Muskelfiltret: en rad per muskel, som i Skapa övning ── */}
        {page === 'gym' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
            <TouchableOpacity
              style={s.muscleRow}
              onPress={() => { Haptics.selectionAsync(); setMuscleFilter('all'); setPage('exercises') }}
              activeOpacity={0.7}
              testID="filterAll"
            >
              <View style={[s.muscleAllIcon, { backgroundColor: tint('14') }]}>
                <Ionicons name="body-outline" size={24} color={T.ACCENT} />
              </View>
              <Text style={s.muscleLabel}>{t('Alla muskler')}</Text>
              {muscleFilter === 'all' && <Ionicons name="checkmark" size={20} color={T.ACCENT} />}
            </TouchableOpacity>
            {FILTER_SLUGS.map(slug => (
              <TouchableOpacity
                key={slug}
                style={s.muscleRow}
                onPress={() => { Haptics.selectionAsync(); setMuscleFilter(slug); setPage('exercises') }}
                activeOpacity={0.7}
                testID={`muscle-${slug}`}
              >
                <MuscleThumb slug={slug} size={52} color={T.ACCENT} />
                <Text style={s.muscleLabel}>{t(SLUG_LABELS[slug])}</Text>
                {muscleFilter === slug && <Ionicons name="checkmark" size={20} color={T.ACCENT} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── CARDIO — flat list grouped by category ───────────────── */}
        {page === 'cardio' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
            {(['cardio', 'hiit', 'mobility'] as ExerciseCategory[]).map(cat => {
              const catExes = otherExes.filter(e => e.category === cat)
              if (catExes.length === 0) return null
              return (
                <View key={cat}>
                  <Text style={s.sectionHeader}>{t(CATEGORY_LABELS[cat]).toUpperCase()}</Text>
                  {catExes.map(ex => (
                    <TouchableOpacity key={ex.id} style={s.row} onPress={() => handleTap(ex)} activeOpacity={0.7}>
                      <View style={s.cardioIconBox}>
                        <Ionicons name={cardioExIcon(ex)} size={22} color="#34C759" />
                      </View>
                      <Text style={[s.rowName, { flex: 1 }]}>{t(ex.name)}</Text>
                      <View style={[s.addBtn, { backgroundColor: tint('18') }]}>
                        <Ionicons name="add" size={20} color={T.ACCENT} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            })}
          </ScrollView>
        )}

        {/* ── EXERCISES — hela biblioteket, filtrerat via muskelknappen ── */}
        {page === 'exercises' && (
          <>
            <View style={s.filterRow}>
              <TouchableOpacity
                style={[s.filterBtn, muscleFilter !== 'all' && { borderColor: T.ACCENT, backgroundColor: tint('10') }]}
                onPress={() => { Haptics.selectionAsync(); setPage('gym') }}
                activeOpacity={0.75}
                testID="muscleFilter"
              >
                <Ionicons name="body-outline" size={17} color={muscleFilter !== 'all' ? T.ACCENT : TEXT_SECONDARY} />
                <Text style={[s.filterBtnText, muscleFilter !== 'all' && { color: T.ACCENT, fontWeight: '700' }]}>
                  {muscleFilter === 'all' ? t('Alla muskler') : t(SLUG_LABELS[muscleFilter])}
                </Text>
                <Ionicons name="chevron-down" size={15} color={muscleFilter !== 'all' ? T.ACCENT : TEXT_SECONDARY} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.filterBtn, equipFilter !== 'all' && { borderColor: T.ACCENT, backgroundColor: tint('10') }]}
                onPress={() => { Haptics.selectionAsync(); openEquip() }}
                activeOpacity={0.75}
                testID="equipFilter"
              >
                <Ionicons name="barbell-outline" size={17} color={equipFilter !== 'all' ? T.ACCENT : T.TEXT_SECONDARY} />
                <Text style={[s.filterBtnText, equipFilter !== 'all' && { color: T.ACCENT, fontWeight: '700' }]}>
                  {equipFilter === 'all' ? t('Utrustning') : t(EQUIPMENT_LABELS[equipFilter])}
                </Text>
                <Ionicons name="chevron-down" size={15} color={equipFilter !== 'all' ? T.ACCENT : TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>
            <View style={s.searchBar}>
              <Ionicons name="search-outline" size={17} color={TEXT_SECONDARY} />
              <AppTextInput
                style={s.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={t('Sök övning…')}
                placeholderTextColor={TEXT_SECONDARY}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>

            <FlatList
              style={{ flex: 1 }}
              data={listData}
              keyExtractor={item => item.kind === 'header' ? `h-${item.title}` : item.ex.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={14}
              windowSize={7}
              renderItem={({ item }) => {
                if (item.kind === 'header') {
                  return <Text style={s.sectionHeader}>{t(item.title)}</Text>
                }
                const ex = item.ex
                const on = multiSelect && multiSel.some(e => e.id === ex.id)
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[s.row, on && { backgroundColor: tint('0D') }]}
                    onPress={() => handleTap(ex)}
                    onLongPress={() => openInfo(ex)}
                    activeOpacity={0.7}
                  >
                    {ex.image_path ? (
                      <TouchableOpacity onPress={() => openInfo(ex)} activeOpacity={0.7} testID={`exerciseImage-${ex.id}`}>
                        <Image
                          source={{ uri: stillUrlForImagePath(ex.image_path) ?? undefined }}
                          style={[s.exImg, on && { borderWidth: 2, borderColor: T.ACCENT }]}
                        />
                      </TouchableOpacity>
                    ) : (
                      <View style={[s.exIconBox, on && { backgroundColor: tint('22'), borderColor: T.ACCENT }]}>
                        <Ionicons name="barbell-outline" size={22} color={on ? T.ACCENT : T.TEXT_SECONDARY} />
                      </View>
                    )}
                    <Text style={[s.rowName, { flex: 1 }, on && { color: T.ACCENT }]}>{t(ex.name)}</Text>
                    {multiSelect ? (
                      <View style={[s.checkBox, on && { backgroundColor: T.ACCENT, borderColor: T.ACCENT }]}>
                        {on && <Ionicons name="checkmark" size={16} color={onAccent} />}
                      </View>
                    ) : (
                      <View style={[s.addBtn, { backgroundColor: tint('18') }]}>
                        <Ionicons name="add" size={20} color={T.ACCENT} />
                      </View>
                    )}
                  </TouchableOpacity>
                )
              }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', gap: 10 }}>
                  <Text style={s.emptyText}>{t('Inga övningar hittades')}</Text>
                  <TouchableOpacity style={[s.emptyCreateBtn, { backgroundColor: T.ACCENT }]} onPress={() => setCreateOpen(true)} activeOpacity={0.8} testID="createFromEmpty">
                    <Ionicons name="add" size={16} color={onAccent} />
                    <Text style={[s.emptyCreateText, { color: onAccent }]}>{t('Skapa "{name}"', { name: search.trim() })}</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          </>
        )}

        {/* ── Klar-knapp i multiväljarläget ────────────────────────── */}
        {multiSelect && multiSel.length > 0 && (page === 'gym' || page === 'exercises') && (
          <View style={[s.multiFooter, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity style={[s.multiBtn, { backgroundColor: T.ACCENT }]} onPress={confirmMulti} activeOpacity={0.85}>
              <Ionicons name="checkmark" size={20} color={onAccent} />
              <Text style={[s.multiBtnText, { color: onAccent }]}>
                {t('Klar · {n} {unit}', { n: multiSel.length, unit: multiSel.length === 1 ? t('övning') : t('övningar') })}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── SETS / REPS PROMPT ───────────────────────────────────── */}
        {pendingEx !== null && (
          <KeyboardAvoidingView
            style={s.promptOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => { Keyboard.dismiss(); setPendingEx(null) }}
              activeOpacity={1}
            />
            <View style={[s.promptSheet, { paddingBottom: insets.bottom + 20 }]}>
              <View style={s.promptHandle} />
              <Text style={s.promptTitle} numberOfLines={1}>{pendingEx.name}</Text>
              <Text style={s.promptSub}>{t('Ange set och reps för passet')}</Text>
              <View style={s.promptFields}>
                <View style={s.promptField}>
                  <Text style={s.promptLabel}>{t('SET')}</Text>
                  <AppTextInput
                    style={s.promptInput}
                    value={sets}
                    onChangeText={setSets}
                    keyboardType="number-pad"
                    placeholder="3"
                    placeholderTextColor={TEXT_SECONDARY}
                    selectTextOnFocus
                  />
                </View>
                <View style={s.promptDivider} />
                <View style={s.promptField}>
                  <Text style={s.promptLabel}>{t('REPS')}</Text>
                  <AppTextInput
                    style={s.promptInput}
                    value={reps}
                    onChangeText={setReps}
                    keyboardType="number-pad"
                    placeholder="10"
                    placeholderTextColor={TEXT_SECONDARY}
                    selectTextOnFocus
                  />
                </View>
              </View>
              <TouchableOpacity style={[s.confirmBtn, { backgroundColor: T.ACCENT, shadowColor: T.ACCENT }]} onPress={handleConfirm} activeOpacity={0.85}>
                <Text style={[s.confirmBtnText, { color: onAccent }]}>{t('Lägg till i pass')}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}

      </View>

      {infoEx !== null && (
        <ExerciseInfoSheet exercise={infoEx} onClose={() => setInfoEx(null)} />
      )}

      {equipOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={closeEquip}>
          <GestureHandlerRootView style={s.equipRoot}>
            <Pressable style={s.equipBackdrop} onPress={closeEquip} testID="equipBackdrop" />
            <GestureDetector gesture={equipDrag}>
              <Animated.View style={[
                s.equipSheet,
                { backgroundColor: T.BG, borderColor: 'rgba(128,128,128,0.20)', paddingBottom: insets.bottom + 12 },
                equipSheetStyle,
              ]}>
                <View style={s.equipHandle} />
                <Text style={s.equipTitle}>{t('Filtrera på utrustning')}</Text>
                {(['all', ...equipOptions] as const).map(key => {
                  const on = equipFilter === key
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[s.equipRow, on && { backgroundColor: tint('12') }]}
                      onPress={() => { Haptics.selectionAsync(); setEquipFilter(key as 'all' | ExerciseEquipment); closeEquip() }}
                      activeOpacity={0.75}
                      testID={`equip-${key}`}
                    >
                      <Text style={[s.equipRowText, on && { color: T.ACCENT, fontWeight: '700' }]}>
                        {key === 'all' ? t('All utrustning') : t(EQUIPMENT_LABELS[key as ExerciseEquipment])}
                      </Text>
                      {on && <Ionicons name="checkmark" size={18} color={T.ACCENT} />}
                    </TouchableOpacity>
                  )
                })}
              </Animated.View>
            </GestureDetector>
          </GestureHandlerRootView>
        </Modal>
      )}

      <CreateExerciseSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={ex => {
          // Direkt in i listan, filtrerat på den nya övningens primära muskel
          setCreatedExes(prev => [...prev, ex])
          setMuscleFilter(ex.primary_muscle ?? 'all')
          setSearch('')
          setPage('exercises')
        }}
      />
    </Modal>
  )
}

const s = StyleSheet.create({
  checkBox: {
    width: 28, height: 28, borderRadius: 9, borderWidth: 1.5,
    borderColor: 'rgba(128,128,128,0.30)',
    alignItems: 'center', justifyContent: 'center',
  },
  groupSelBadge: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  groupSelBadgeText: { fontSize: 12, fontWeight: '800' },
  multiFooter: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: BG, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.16)',
  },
  multiBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 16, paddingVertical: 16,
  },
  multiBtnText: { fontSize: 16, fontWeight: '800' },

  screen: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.16)',
  },
  iconBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:        { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700' },
  iconBtnFallback: { backgroundColor: CARD },

  // Landing
  landingContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  landingSub:       { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', marginBottom: 28 },
  landingCards:     { flexDirection: 'row', gap: 16 },
  landingCard: {
    flex: 1, backgroundColor: CARD, borderRadius: 20,
    paddingVertical: 32, paddingHorizontal: 16, alignItems: 'center', gap: 12,
  },
  landingIcon:      { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  landingCardTitle: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800' },
  landingCardSub:   { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center' },

  // Muskelfiltret
  muscleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.12)',
  },
  muscleAllIcon: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  muscleLabel: { flex: 1, color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },

  // Section header
  sectionHeader: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },

  // Exercise rows
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  cardioIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(52,199,89,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  exIconBox: {
    width: 68, height: 68, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.18)',
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  // Illustrationerna är svarta linjer på vitt — plattan är vit även i mörkt
  // läge, och samma hårlinjeram som ikonplattan så alla kort ser likadana ut
  // contain: illustrationerna har olika proportioner, cover beskär dem
  // till oigenkännliga utsnitt. Hela gubben ska synas i plattan.
  exImg: {
    width: 68, height: 68, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.18)',
    backgroundColor: '#FFFFFF', resizeMode: 'contain',
  },
  rowName: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { color: TEXT_SECONDARY, textAlign: 'center', marginTop: 48, fontSize: 15 },

  // Search bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginVertical: 10,
    paddingHorizontal: 14, height: 46,
    backgroundColor: CARD, borderRadius: 14,
  },
  searchInput: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, padding: 0 },

  // Sets/reps prompt
  promptOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
  },
  promptSheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 24, paddingBottom: 36, gap: 4,
  },
  promptHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginBottom: 16,
  },
  promptTitle:  { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800' },
  promptSub:    { color: TEXT_SECONDARY, fontSize: 14, marginBottom: 20 },
  promptFields: {
    flexDirection: 'row',
    backgroundColor: CARD, borderRadius: 16,
    overflow: 'hidden', marginBottom: 16,
  },
  promptField:   { flex: 1, alignItems: 'center', paddingVertical: 20, gap: 8 },
  promptDivider: { width: 1, backgroundColor: BORDER },
  promptLabel:   { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  promptInput: {
    color: TEXT_PRIMARY, fontSize: 32, fontWeight: '700',
    textAlign: 'center', minWidth: 80, padding: 0,
  },
  confirmBtn: {
    backgroundColor: ACCENT, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10,
  },
  confirmBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },

  filterRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 10, marginBottom: 8 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 11,
    backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(128,128,128,0.13)',
  },
  filterBtnText: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },

  equipRoot: { flex: 1, justifyContent: 'flex-end' },
  equipBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  equipSheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1,
    paddingHorizontal: 16, paddingTop: 10,
  },
  equipHandle: {
    width: 44, height: 5, borderRadius: 3, alignSelf: 'center',
    backgroundColor: 'rgba(128,128,128,0.45)', marginBottom: 12,
  },
  equipTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '800', paddingHorizontal: 4, paddingBottom: 8 },
  equipRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12,
  },
  equipRowText: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },


  // Skapa egen övning
  createRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: accentAlpha('10'),
    borderWidth: 1, borderColor: accentAlpha('35'),
    borderRadius: 16, padding: 14,
    marginHorizontal: 20, marginBottom: 14,
  },
  createIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: accentAlpha('22'),
    alignItems: 'center', justifyContent: 'center',
  },
  createTitle: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },
  createSub:   { color: TEXT_SECONDARY, fontSize: 12, marginTop: 1 },
  emptyCreateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ACCENT, borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  emptyCreateText: { color: '#000', fontSize: 14, fontWeight: '700' },
})
