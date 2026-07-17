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
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

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
    router.setParams({ action: undefined })
    const timer = setTimeout(() => setModalVisible(true), 600)
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
      setPhotoUri(await compressImage(a.uri, a.width, 512))
      setEmoji(null)
      setModalVisible(false)
    }
  }

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    try {
      let avatarUrl = ''
      if (photoUri) {
        avatarUrl = photoUri.startsWith('http') ? photoUri : await uploadAvatar(userId, photoUri)
      } else if (emoji) {
        avatarUrl = emoji
      }
      await updateProfile(userId, { avatar_url: avatarUrl })
      router.back()
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

      {/* ── Fixed header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.title}>Redigera profil</Text>
        <TouchableOpacity style={styles.checkBtn} onPress={handleSave} disabled={saving} activeOpacity={0.7}>
          {saving
            ? <ActivityIndicator color={ORANGE} size="small" />
            : <Ionicons name="checkmark" size={22} color={ORANGE} />}
        </TouchableOpacity>
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
          </View>

          {/* ── Konto-rader ── */}
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>KONTO</Text>
            <View style={styles.rowsCard}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => router.push('/edit-name')}
                activeOpacity={0.7}
              >
                <View style={styles.rowIconBox}>
                  <Ionicons name="person-outline" size={17} color={ORANGE} />
                </View>
                <Text style={styles.rowLabel}>Visningsnamn</Text>
                <Text style={styles.rowValue} numberOfLines={1}>{name || 'Lägg till'}</Text>
                <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
              </TouchableOpacity>

              <View style={styles.rowDivider} />

              <View style={[styles.row, { opacity: 0.55 }]}>
                <View style={[styles.rowIconBox, { backgroundColor: BORDER }]}>
                  <Ionicons name="mail-outline" size={17} color={TEXT_SECONDARY} />
                </View>
                <Text style={styles.rowLabel}>E-post</Text>
                <Text style={styles.rowValue} numberOfLines={1}>{email}</Text>
                <Ionicons name="lock-closed-outline" size={14} color={TEXT_SECONDARY} />
              </View>
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
                onPress={() => { setPhotoUri(null); setEmoji(null); setModalVisible(false) }}
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
                        onPress={() => { setEmoji(e); setPhotoUri(null); setModalVisible(false) }}
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
  scroll:   { paddingBottom: 48, gap: 28 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
    backgroundColor: BG,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  checkBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: ORANGE + '60',
  },
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

  // Fields
  fieldSection: { paddingHorizontal: 20, gap: 8 },
  fieldLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, paddingHorizontal: 4,
  },

  // Navigerbara rader
  rowsCard: {
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  rowDivider: { height: 1, backgroundColor: BORDER, marginLeft: 60 },
  rowIconBox: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: ORANGE + '18',
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
    borderWidth: 1.5, borderColor: BORDER,
    paddingVertical: 16,
  },
  quickBtnActive: { borderColor: ORANGE, backgroundColor: ORANGE + '10' },
  quickIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  quickIconActive: { backgroundColor: ORANGE + '20' },
  quickInitial: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '700' },
  quickLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },

  sheetDivider: { height: 1, backgroundColor: BORDER },
  emojiHeader: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
  },

  // Emoji
  emojiSection: { gap: 8, marginBottom: 12 },
  sectionLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },
  emojiGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emojiBtn: {
    width: 50, height: 50, borderRadius: 13,
    backgroundColor: BG, borderWidth: 1.5, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiBtnActive: { borderColor: ORANGE, backgroundColor: ORANGE + '18' },
  emojiText: { fontSize: 24 },

  // Cancel
  cancelBtn: {
    backgroundColor: BG, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  cancelText: { color: TEXT_SECONDARY, fontSize: 15, fontWeight: '600' },
})
