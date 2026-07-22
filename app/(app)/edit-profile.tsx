import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/image'
import { getProfile, updateProfile, uploadAvatar } from '@/services/profile'
import { unregisterPushTokens } from '@/services/pushTokens'
import { GlassCircleButton } from '@/components/GlassButton'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'
import { SubscriptionCard } from '@/components/SubscriptionCard'
import { RecordsCard } from '@/components/RecordsCard'
import { TAB_CONTENT_PAD } from '@/lib/glass'

const AVATAR_SECTIONS = [
  { label: 'Träning',    items: ['💪', '🏋️', '🏃', '🧘', '🥊', '🚴', '🤸', '🏊'] },
  { label: 'Motivation', items: ['🔥', '⚡', '🎯', '🏆', '👑', '🦁', '🦅', '🚀'] },
  { label: 'Livsstil',   items: ['🌊', '🏔️', '☀️', '🌙', '💧', '❤️', '🎵', '🧠'] },
]

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets()
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [userId, setUserId]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [emoji, setEmoji]     = useState<string | null>(null)
  const [photoUri, setPhotoUri] = useState<string | null>(null)

  async function load() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      setUserId(session.user.id)
      setEmail(session.user.email ?? '')
      const profile = await getProfile(session.user.id)
      setName(profile?.name ?? '')
      if (profile?.avatar_url) {
        if (profile.avatar_url.startsWith('http')) {
          setPhotoUri(profile.avatar_url)
        } else {
          setEmoji(profile.avatar_url)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Namnet redigeras på egen sida — hämta om när man kommer tillbaka
  useFocusEffect(useCallback(() => {
    if (userId) {
      getProfile(userId).then(p => setName(p?.name ?? '')).catch(() => {})
    }
  }, [userId]))

  // Guidat flöde från engångsmålen: landa på sidan, öppna sedan avatarväljaren
  const { action } = useLocalSearchParams<{ action?: string }>()
  const handledActionRef = useRef<string | null>(null)
  useEffect(() => {
    if (loading || action !== 'avatar' || handledActionRef.current === action) return
    handledActionRef.current = action
    const timer = setTimeout(() => {
      setModalVisible(true)
      // Rensas efter öppning — setParams triggar annars cleanupen som dödar timern
      router.setParams({ action: undefined })
    }, 600)
    return () => clearTimeout(timer)
  }, [action, loading])

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Åtkomst nekad', 'Tillåt åtkomst till fotobiblioteket i Inställningar.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    })
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0]
      // Avatarer visas max ~110 px — 512 px räcker gott även för retina
      const uri = await compressImage(a.uri, a.width, 512)
      setPhotoUri(uri)
      setEmoji(null)
      setModalVisible(false)
      persistAvatar(uri, null)
    }
  }

  // Avatarvalet sparas direkt när man väljer — ingen bock-knapp behövs
  async function persistAvatar(nextPhotoUri: string | null, nextEmoji: string | null) {
    if (!userId) return
    setSaving(true)
    try {
      let avatarUrl = ''
      if (nextPhotoUri) {
        avatarUrl = nextPhotoUri.startsWith('http') ? nextPhotoUri : await uploadAvatar(userId, nextPhotoUri)
      } else if (nextEmoji) {
        avatarUrl = nextEmoji
      }
      await updateProfile(userId, { avatar_url: avatarUrl })
    } catch (e: any) {
      Alert.alert('Något gick fel', e.message)
    } finally {
      setSaving(false)
    }
  }

  const initials = (name.trim() || email.split('@')[0] || '?')[0].toUpperCase()

  function AvatarContent() {
    if (photoUri) return <Image source={{ uri: photoUri }} style={styles.previewPhoto} />
    if (emoji)    return <Text style={styles.avatarEmoji}>{emoji}</Text>
    return <Text style={styles.avatarInitials}>{initials}</Text>
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>

      {/* ── Fixed header: glas-pil tillbaka; avataren sparas direkt vid val
          så ingen bock behövs — snurran syns kort medan uppladdningen går ── */}
      <View style={styles.header}>
        <GlassCircleButton
          icon="chevron-back"
          size={40}
          iconColor={TEXT_PRIMARY}
          onPress={() => router.back()}
          fallbackStyle={styles.iconBtnFallback}
        />
        <Text style={styles.title}>Profil</Text>
        <View style={styles.headerSpacer}>
          {saving && <ActivityIndicator color={ORANGE} size="small" />}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
          {/* ── Avatar with pencil ── */}
          <View style={styles.previewSection}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarCircle}>
                <AvatarContent />
              </View>
              <TouchableOpacity
                style={styles.pencilBtn}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="pencil" size={13} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.previewName}>{name || 'Ditt namn'}</Text>
            <Text style={styles.previewEmail}>{email}</Text>
            <TouchableOpacity
              style={styles.editPill}
              onPress={() => router.push('/account' as never)}
              activeOpacity={0.85}
            >
              <Text style={styles.editPillText}>REDIGERA PROFIL</Text>
            </TouchableOpacity>
          </View>

          {/* ── Abonnemang — premiumbannern leder till paywallen ── */}
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>ABONNEMANG</Text>
            <SubscriptionCard name={name} />
          </View>

          {/* ── Rekord & medaljer — Runna Levels-stil ── */}
          <View style={styles.fieldSection}>
            <RecordsCard />
          </View>

          {/* ── Min träning — genvägar till det man återkommer till ── */}
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>MIN TRÄNING</Text>
            <View style={styles.rowsCard}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => router.push('/manage-sessions' as never)}
                activeOpacity={0.7}
              >
                <View style={styles.rowIconBox}>
                  <Ionicons name="calendar-outline" size={17} color={TEXT_SECONDARY} />
                </View>
                <Text style={styles.rowLabel}>Veckoschema</Text>
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
              </TouchableOpacity>

              <View style={styles.rowDivider} />

              <TouchableOpacity
                style={styles.row}
                onPress={() => Alert.alert('Kommer snart', 'Hitta lopp nära dig och koppla dem direkt till din träningsplan.')}
                activeOpacity={0.7}
              >
                <View style={styles.rowIconBox}>
                  <Ionicons name="flag-outline" size={17} color={TEXT_SECONDARY} />
                </View>
                <Text style={styles.rowLabel}>Hitta ett lopp</Text>
                <Text style={styles.rowValue} numberOfLines={1}>Kommer snart</Text>
                <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Inställningar — några riktiga, resten växer fram ── */}
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>INSTÄLLNINGAR</Text>
            <View style={styles.rowsCard}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => router.push('/anpassning' as never)}
                activeOpacity={0.7}
              >
                <View style={styles.rowIconBox}>
                  <Ionicons name="options-outline" size={17} color={TEXT_SECONDARY} />
                </View>
                <Text style={styles.rowLabel}>Anpassning</Text>
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
              </TouchableOpacity>

              <View style={styles.rowDivider} />

              <TouchableOpacity
                style={styles.row}
                onPress={() => router.push('/general' as never)}
                activeOpacity={0.7}
                testID="generalRow"
              >
                <View style={styles.rowIconBox}>
                  <Ionicons name="settings-outline" size={17} color={TEXT_SECONDARY} />
                </View>
                <Text style={styles.rowLabel}>Allmänt</Text>
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
              </TouchableOpacity>

            </View>
          </View>

          {/* ── Logga ut — egen sektion längst ner, som konventionen bjuder ── */}
          <View style={styles.fieldSection}>
            <View style={styles.rowsCard}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  Alert.alert('Logga ut', 'Är du säker på att du vill logga ut? Din data sparas.', [
                    { text: 'Avbryt', style: 'cancel' },
                    {
                      text: 'Logga ut',
                      style: 'destructive',
                      onPress: async () => {
                        // Inga pushnotiser till en utloggad enhet
                        await unregisterPushTokens()
                        await supabase.auth.signOut()
                        router.replace('/(auth)/welcome' as never)
                      },
                    },
                  ])
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.rowIconBox, { backgroundColor: 'rgba(255,69,58,0.14)' }]}>
                  <Ionicons name="log-out-outline" size={17} color="#FF453A" />
                </View>
                <Text style={[styles.rowLabel, { color: '#FF453A' }]}>Logga ut</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>

      {/* ── Avatar picker bottom sheet ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Välj profilbild</Text>

            {/* Quick options */}
            <View style={styles.quickRow}>
              {/* Photo */}
              <TouchableOpacity style={styles.quickBtn} onPress={pickPhoto} activeOpacity={0.8}>
                <View style={styles.quickIcon}>
                  <Ionicons name="image-outline" size={24} color={TEXT_PRIMARY} />
                </View>
                <Text style={styles.quickLabel}>Foto</Text>
              </TouchableOpacity>

              {/* Initials */}
              <TouchableOpacity
                style={[styles.quickBtn, !photoUri && !emoji && styles.quickBtnActive]}
                onPress={() => { setPhotoUri(null); setEmoji(null); setModalVisible(false); persistAvatar(null, null) }}
                activeOpacity={0.8}
              >
                <View style={[styles.quickIcon, !photoUri && !emoji && styles.quickIconActive]}>
                  <Text style={[styles.quickInitial, !photoUri && !emoji && { color: ORANGE }]}>
                    {initials}
                  </Text>
                </View>
                <Text style={[styles.quickLabel, !photoUri && !emoji && { color: ORANGE }]}>
                  Bokstav
                </Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.sheetDivider} />
            <Text style={styles.emojiHeader}>EMOJI</Text>

            {/* Emoji grid */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 240 }}>
              {AVATAR_SECTIONS.map(section => (
                <View key={section.label} style={styles.emojiSection}>
                  <Text style={styles.sectionLabel}>{section.label}</Text>
                  <View style={styles.emojiGrid}>
                    {section.items.map(e => (
                      <TouchableOpacity
                        key={e}
                        style={[styles.emojiBtn, emoji === e && styles.emojiBtnActive]}
                        onPress={() => { setEmoji(e); setPhotoUri(null); setModalVisible(false); persistAvatar(null, e) }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.emojiText}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Cancel */}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Avbryt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  // TAB_CONTENT_PAD — flytande tabbaren får inte skymma sista sektionen
  scroll:   { paddingBottom: 24 + TAB_CONTENT_PAD, gap: 28 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: BG,
  },
  iconBtnFallback: { backgroundColor: CARD },
  headerSpacer: { width: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  // Avatar preview
  previewSection: { alignItems: 'center', gap: 8, paddingTop: 16 },
  avatarWrapper:  { position: 'relative' },
  avatarCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: ORANGE + '22',
    borderWidth: 2.5, borderColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  previewPhoto:   { width: 110, height: 110, borderRadius: 55 },
  avatarEmoji:    { fontSize: 56 },
  avatarInitials: { color: ORANGE, fontSize: 48, fontWeight: '700' },
  pencilBtn: {
    position: 'absolute', bottom: 2, right: 2,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: BG,
  },
  previewName:  { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '700', marginTop: 4 },
  previewEmail: { color: TEXT_SECONDARY, fontSize: 13 },
  editPill: {
    marginTop: 12, backgroundColor: '#E9EDF2',
    borderRadius: 24, paddingHorizontal: 26, paddingVertical: 11,
  },
  editPillText: { color: '#0B0B0D', fontSize: 13, fontWeight: '800', letterSpacing: 1 },

  // Fields
  fieldSection: { paddingHorizontal: 20, gap: 8 },
  fieldLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, paddingHorizontal: 4,
  },

  // Navigerbara rader
  rowsCard: {
    backgroundColor: CARD, borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)', marginLeft: 60 },
  // Neutralt grå — inga orange accenter bland raderna, enkelt och stilrent
  rowIconBox: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  rowValue: { flex: 1, color: TEXT_SECONDARY, fontSize: 14, textAlign: 'right' },

  // Modal / bottom sheet
  modalContainer: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 16,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: BORDER, alignSelf: 'center', marginBottom: 4,
  },
  sheetTitle: {
    color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700', textAlign: 'center',
  },

  // Quick option buttons (Foto / Bokstav)
  quickRow: { flexDirection: 'row', gap: 12 },
  quickBtn: {
    flex: 1, alignItems: 'center', gap: 8,
    backgroundColor: BG, borderRadius: 14,
    paddingVertical: 16,
  },
  quickBtnActive: { backgroundColor: ORANGE + '16' },
  quickIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  quickIconActive: { backgroundColor: ORANGE + '20' },
  quickInitial: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '700' },
  quickLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },

  sheetDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)' },
  emojiHeader: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
  },

  // Emoji
  emojiSection: { gap: 8, marginBottom: 12 },
  sectionLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },
  emojiGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emojiBtn: {
    width: 50, height: 50, borderRadius: 13,
    backgroundColor: BG,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiBtnActive: { backgroundColor: ORANGE + '22' },
  emojiText: { fontSize: 24 },

  // Cancel
  cancelBtn: {
    backgroundColor: BG, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  cancelText: { color: TEXT_SECONDARY, fontSize: 15, fontWeight: '600' },
})
