import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'

import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/image'
import { getProfile } from '@/services/profile'
import { getActiveChallenge, calculateCurrentDay } from '@/services/challenge'
import { getCardioWorkouts, type CardioWorkout } from '@/services/cardioWorkouts'
import { getStrengthWorkouts } from '@/services/strengthWorkouts'
import { getFollowCounts, subscribeToFollows, type FollowCounts } from '@/services/follows'
import { strengthToPosts } from '@/components/FeedWorkoutCard'
import { AthleteOverview } from '@/components/AthleteOverview'
import { getUnitSystem, type UnitSystem } from '@/lib/units'
import {
  getOrCreateTodayLog,
  getOrCreateTaskCompletions,
  setTaskCompleted,
  markDayPending,
} from '@/services/dailyLog'
import {
  getProgressPhotos,
  addProgressPhoto,
  deleteProgressPhoto,
  type ProgressPhotoItem,
} from '@/services/progressPhotos'
import { PhotoComposer } from '@/components/PhotoComposer'
import { PhotoViewer } from '@/components/PhotoViewer'
import { PhotoCompare } from '@/components/PhotoCompare'
import { ORANGE, GREEN, BG, CARD, BORDER, RED, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT_SEMI } from '@/lib/theme'
import { TAB_CONTENT_PAD } from '@/lib/glass'
import { GlassCircleButton } from '@/components/GlassButton'
import { useTabBarShrinkOnScroll } from '@/lib/tabBar'
import type { UserChallengeWithLevel } from '@/types/database'

// ─── Screen ───────────────────────────────────────────────────────────────────

// Rutnätet: 3 kolumner med tajta mellanrum (Instagram-känsla) — bildtext
// och datum bor i fullskärmsvisaren som öppnas vid tryck
const GRID_COLS = 3
const GRID_GAP = 3

export default function ProfileScreen() {
  const onScrollShrink = useTabBarShrinkOnScroll()
  const { width: screenW } = useWindowDimensions()
  const cellSize = Math.floor((screenW - 40 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS)
  const [userId, setUserId]         = useState<string | null>(null)
  const [name, setName]             = useState('')
  const [avatarUrl, setAvatarUrl]   = useState<string | null>(null)
  const [challenge, setChallenge]   = useState<UserChallengeWithLevel | null>(null)
  const [currentDay, setCurrentDay] = useState(1)
  const [photos, setPhotos]         = useState<ProgressPhotoItem[]>([])
  // Atletvyn: samma data som atletsidan visar (cardio, gymdagar, följen)
  const [workouts, setWorkouts]     = useState<CardioWorkout[]>([])
  const [gymCount, setGymCount]     = useState(0)
  const [counts, setCounts]         = useState<FollowCounts>({ followers: 0, following: 0 })
  const [unit, setUnit]             = useState<UnitSystem>('metric')
  const [loading, setLoading]       = useState(true)
  const [composerUri, setComposerUri] = useState<string | null>(null)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [refreshing, setRefreshing]   = useState(false)
  const refreshingRef = useRef(false)
  const pullArmedRef  = useRef(true)

  // Egen pull-to-refresh utan native-snurra: dra ner förbi tröskeln → hämta om,
  // snurran visas under Lägg till dagens foto istället för högst upp
  function onListScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    onScrollShrink(e)
    const y = e.nativeEvent.contentOffset.y
    if (y >= 0) pullArmedRef.current = true
    if (y < -70 && pullArmedRef.current && !refreshingRef.current) {
      pullArmedRef.current = false
      refreshingRef.current = true
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setRefreshing(true)
      const started = Date.now()
      load().catch(() => {}).finally(() => {
        // Låt snurran synas en stund även om hämtningen går blixtsnabbt
        const wait = Math.max(0, 1000 - (Date.now() - started))
        setTimeout(() => {
          setRefreshing(false)
          refreshingRef.current = false
        }, wait)
      })
    }
  }

  useFocusEffect(useCallback(() => {
    let unsubscribe: (() => void) | null = null
    load()
    // Följer någon dig medan fliken är öppen tickar räknaren upp direkt
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      const uid = session.user.id
      unsubscribe = subscribeToFollows(uid, () => {
        getFollowCounts(uid).then(setCounts).catch(() => {})
      })
    })
    return () => { unsubscribe?.() }
  }, []))

  // Guidat flöde från engångsmålen: landa i fotoflödet, öppna sedan fotovalet
  const { action } = useLocalSearchParams<{ action?: string }>()
  const handledActionRef = useRef<string | null>(null)
  useEffect(() => {
    if (loading || action !== 'addPhoto' || handledActionRef.current === action) return
    handledActionRef.current = action
    const timer = setTimeout(() => {
      handleAddPhoto()
      // Rensas efter öppning — setParams triggar annars cleanupen som dödar timern
      router.setParams({ action: undefined })
    }, 600)
    return () => clearTimeout(timer)
  }, [action, loading])

  async function load() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const uid = session.user.id
      setUserId(uid)

      getUnitSystem().then(setUnit).catch(() => {})

      // allSettled — ett fel i en del (t.ex. foto-hämtningen innan
      // caption-migrationen körts) får inte blanka profil och knappar
      const [profile, active, photoItems, cardio, strength, followCounts] = await Promise.allSettled([
        getProfile(uid),
        getActiveChallenge(uid),
        getProgressPhotos(uid),
        getCardioWorkouts(uid, 200),
        getStrengthWorkouts(uid, 500),
        getFollowCounts(uid),
      ])

      if (profile.status === 'fulfilled') {
        setName(profile.value?.name || session.user.email?.split('@')[0] || '')
        setAvatarUrl(profile.value?.avatar_url ?? null)
      } else {
        setName(session.user.email?.split('@')[0] || '')
      }

      if (active.status === 'fulfilled') {
        setChallenge(active.value)
        if (active.value) setCurrentDay(calculateCurrentDay(active.value.start_date))
      }

      if (photoItems.status === 'fulfilled') {
        setPhotos(photoItems.value)
      } else {
        console.warn('[profile] kunde inte hämta foton:', photoItems.reason?.message)
      }

      if (cardio.status === 'fulfilled') setWorkouts(cardio.value)
      if (strength.status === 'fulfilled') {
        // Gymdagar räknas som pass i aktivitetsknappen — samma gruppering
        // som flödet använder
        setGymCount(strengthToPosts(strength.value, '', null).length)
      }
      if (followCounts.status === 'fulfilled') setCounts(followCounts.value)

    } finally {
      setLoading(false)
    }
  }

  // ── Lägg till foto ──────────────────────────────────────────────────────────

  function handleAddPhoto() {
    Alert.alert('Nytt framstegsfoto', undefined, [
      { text: 'Ta foto', onPress: () => pickImage('camera') },
      { text: 'Välj från biblioteket', onPress: () => pickImage('library') },
      { text: 'Avbryt', style: 'cancel' },
    ])
  }

  async function pickImage(source: 'camera' | 'library') {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Åtkomst nekad', 'Tillåt kameraåtkomst i Inställningar.')
        return
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 })
      if (!result.canceled && result.assets[0]) {
        const a = result.assets[0]
        setComposerUri(await compressImage(a.uri, a.width))
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Åtkomst nekad', 'Tillåt åtkomst till fotobiblioteket i Inställningar.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      })
      if (!result.canceled && result.assets[0]) {
        const a = result.assets[0]
        setComposerUri(await compressImage(a.uri, a.width))
      }
    }
  }

  async function handleSavePhoto(caption: string) {
    if (!userId || !challenge || !composerUri) return
    try {
      await addProgressPhoto({
        userId,
        challengeId: challenge.id,
        dayNumber: currentDay,
        uri: composerUri,
        caption: caption.trim() || null,
      })
      setComposerUri(null)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      await markPhotoTaskDone()
      setPhotos(await getProgressPhotos(userId))
    } catch (e: any) {
      Alert.alert('Något gick fel', e.message)
    }
  }

  /** Bockar i dagens fotouppgift på dashboarden när ett foto laddats upp. */
  async function markPhotoTaskDone() {
    if (!userId || !challenge) return
    try {
      const log = await getOrCreateTodayLog(challenge.id, userId, currentDay)
      const tasks = await getOrCreateTaskCompletions(log.id, challenge.level_id, userId, challenge.id)
      const photoTask = tasks.find(t => t.type === 'photo' && !t.completed)
      if (photoTask) await setTaskCompleted(photoTask.completionId, true)
    } catch {
      // fotot är sparat — task-markeringen är bäst-effort
    }
  }

  /** Bockar UR fotouppgiften om dagens sista foto togs bort — inga foton, ingen klar uppgift. */
  async function syncPhotoTaskAfterDelete(remaining: ProgressPhotoItem[]) {
    if (!userId || !challenge) return
    if (remaining.some(p => p.dayNumber === currentDay)) return
    try {
      const log = await getOrCreateTodayLog(challenge.id, userId, currentDay)
      const tasks = await getOrCreateTaskCompletions(log.id, challenge.level_id, userId, challenge.id)
      const photoTask = tasks.find(t => t.type === 'photo' && t.completed)
      if (photoTask) {
        await setTaskCompleted(photoTask.completionId, false)
        // Var dagen markerad klar bygger den på fotot — backa till pending
        if (log.status === 'completed') await markDayPending(log.id)
      }
    } catch {
      // bäst-effort — dashboarden hämtar om vid nästa fokus
    }
  }

  // Raderingen bor i fullskärmsvisaren — den bekräftar själv innan anropet
  async function performDeletePhoto(photo: ProgressPhotoItem) {
    try {
      await deleteProgressPhoto(photo.id, photo.path)
      const remaining = photos.filter(p => p.id !== photo.id)
      setPhotos(remaining)
      await syncPhotoTaskAfterDelete(remaining)
    } catch (e: any) {
      Alert.alert('Något gick fel', e.message)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const hasTodayPhoto = photos.some(p => p.dayNumber === currentDay)

  function renderHeader() {
    return (
      <View style={s.headerWrap}>
        {/* Samma atletvy som communityns profilsidor — toppen leder till
            Redigera profil */}
        <AthleteOverview
          isOwn
          name={name}
          avatarUrl={avatarUrl}
          workouts={workouts}
          gymCount={gymCount}
          counts={counts}
          unit={unit}
          following={false}
          onToggleFollow={() => {}}
          onOpenActivities={() => router.push('/(app)/activities' as never)}
          onPressHero={() => router.push('/(app)/edit-profile')}
        />

        {/* Lägg till foto — grönt kvittoläge när dagens redan är taget */}
        {challenge && (hasTodayPhoto ? (
          <TouchableOpacity style={s.addButtonDone} onPress={handleAddPhoto} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle" size={18} color={GREEN} />
            <Text style={s.addButtonDoneText}>Dagens foto taget · lägg till fler</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.addButton} onPress={handleAddPhoto} activeOpacity={0.85}>
            <Ionicons name="camera" size={18} color="#000" />
            <Text style={s.addButtonText}>Lägg till dagens foto</Text>
          </TouchableOpacity>
        ))}

        <View style={s.sectionHeadRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.sectionHead}>Framstegsfoton</Text>
            {photos.length > 0 && (
              <Text style={s.sectionSub}>
                {photos.length} {photos.length === 1 ? 'foto' : 'foton'} · {new Set(photos.map(p => p.dayNumber)).size} av {currentDay} dagar
              </Text>
            )}
          </View>
          {photos.length >= 2 && (
            <TouchableOpacity style={s.compareChip} activeOpacity={0.8} onPress={() => setCompareOpen(true)}>
              <Ionicons name="git-compare-outline" size={15} color={ORANGE} />
              <Text style={s.compareChipText}>Jämför</Text>
            </TouchableOpacity>
          )}
        </View>

        {photos.length === 0 && (
          <View style={s.emptyCard}>
            <Ionicons name="images-outline" size={28} color={TEXT_SECONDARY} />
            <Text style={s.emptyTitle}>Inga foton än</Text>
            <Text style={s.emptyText}>
              Ta ett foto varje dag och skriv några rader. Om 75 dagar har du hela resan samlad här.
            </Text>
          </View>
        )}
      </View>
    )
  }

  // Rutnätscell: bild + dag-badge; pratbubbla i hörnet markerar bildtext.
  // Datum och text visas i fullskärmsvisaren.
  function renderPhoto({ item, index }: { item: ProgressPhotoItem; index: number }) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setViewerIndex(index)}
        style={{ width: cellSize, height: cellSize }}
      >
        {item.url ? (
          <Image source={{ uri: item.url }} style={s.gridImage} resizeMode="cover" />
        ) : (
          <View style={[s.gridImage, s.gridImageMissing]}>
            <Ionicons name="image-outline" size={22} color={TEXT_SECONDARY} />
          </View>
        )}
        <View style={s.gridBadge}>
          <Text style={s.gridBadgeText}>Dag {item.dayNumber}</Text>
        </View>
        {!!item.caption && (
          <View style={s.gridCaptionDot}>
            <Ionicons name="chatbox-ellipses" size={10} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {/* Fast topp: titel + kugghjul står stilla, allt under uppdateras */}
      <View style={s.fixedTop}>
        <View style={s.topRow}>
          <Text style={s.title}>Profil</Text>
          <GlassCircleButton
            icon="settings-outline"
            size={40}
            iconColor={TEXT_PRIMARY}
            onPress={() => router.push('/(app)/settings')}
            fallbackStyle={s.gearButton}
          />
        </View>
        {refreshing && <ActivityIndicator color={ORANGE} style={s.refreshSpinner} />}
      </View>

      <FlatList
        // key tvingar omontering — RN vägrar byta numColumns på en levande
        // lista (annars kan hot reload fastna på gamla layouten)
        key={`photo-grid-${GRID_COLS}`}
        data={photos}
        keyExtractor={p => p.id}
        renderItem={renderPhoto}
        numColumns={GRID_COLS}
        columnWrapperStyle={{ gap: GRID_GAP }}
        ListHeaderComponent={renderHeader()}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onListScroll}
        scrollEventThrottle={16}
      />

      <PhotoCompare
        visible={compareOpen}
        photos={photos}
        onClose={() => setCompareOpen(false)}
      />

      <PhotoViewer
        photos={photos}
        initialIndex={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onDelete={performDeletePhoto}
      />

      <PhotoComposer
        visible={composerUri !== null}
        imageUri={composerUri}
        dayNumber={currentDay}
        onCancel={() => setComposerUri(null)}
        onSave={handleSavePhoto}
      />
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  scroll:   { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 40 + TAB_CONTENT_PAD, gap: GRID_GAP },
  fixedTop: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },

  headerWrap: { gap: 16, marginBottom: 13 },   // 13 + rutnätets 3 ≈ sektionsluft
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: TEXT_PRIMARY, fontSize: 28, fontWeight: '700' },
  refreshSpinner: { marginTop: 12, marginBottom: 2 },
  gearButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD,
    alignItems: 'center', justifyContent: 'center',
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 14,
  },
  addButtonText: { color: '#000', fontSize: 15, fontWeight: '700' },
  addButtonDone: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: GREEN + '16', borderRadius: 14, paddingVertical: 14,
  },
  addButtonDoneText: { color: GREEN, fontSize: 15, fontWeight: '700' },

  sectionHead: {
    color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', letterSpacing: -0.4,
  },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  compareChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ORANGE + '18', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  compareChipText: { color: ORANGE, fontSize: 13, fontWeight: '700' },
  sectionSub: {
    color: TEXT_SECONDARY, fontSize: 12, fontFamily: NUM_FONT_SEMI, marginTop: 3,
  },

  // Empty state
  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  emptyText:  { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', lineHeight: 19 },

  // Fotorutnätet
  gridImage: {
    width: '100%', height: '100%', borderRadius: 10,
    backgroundColor: CARD,
  },
  gridImageMissing: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  gridBadge: {
    position: 'absolute', bottom: 5, left: 5,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 7,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  gridBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  gridCaptionDot: {
    position: 'absolute', top: 5, right: 5,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
})
