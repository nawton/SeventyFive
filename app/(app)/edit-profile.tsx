import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { getProfile, updateProfile, uploadAvatar } from '@/services/profile'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

// ─── Emoji options ────────────────────────────────────────────────────────────

const AVATAR_SECTIONS = [
  {
    label: 'Träning & Sport',
    items: ['💪', '🏋️', '🏃', '🧘', '🥊', '🏊', '🚴', '🧗', '🤸', '⛹️', '🏇', '🤼', '🥋', '🎽', '🏄', '🤾'],
  },
  {
    label: 'Motivation',
    items: ['🔥', '⚡', '🎯', '🏆', '👑', '💎', '🌟', '🚀', '⚔️', '🛡️', '🦁', '🐺', '🦅', '🐉', '💯', '✊'],
  },
  {
    label: 'Natur & Energi',
    items: ['🌊', '🏔️', '🌪️', '❄️', '☀️', '🌙', '⭐', '🌈', '🍃', '🌿', '🌸', '🎋'],
  },
  {
    label: 'Livsstil',
    items: ['🥗', '🥩', '💧', '📖', '🎵', '🧠', '❤️', '🙏', '👊', '🤛', '🕹️', '🎮'],
  },
]

type AvatarTab = 'emoji' | 'photo'

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [userId, setUserId]     = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  // Avatar state
  const [activeTab, setActiveTab] = useState<AvatarTab>('emoji')
  const [emoji, setEmoji]         = useState<string | null>(null)
  const [photoUri, setPhotoUri]   = useState<string | null>(null) // local or existing URL

  const nameRef = useRef<TextInput>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        setUserId(session.user.id)
        setEmail(session.user.email ?? '')
        const profile = await getProfile(session.user.id)
        if (profile?.name) setName(profile.name)
        if (profile?.avatar_url) {
          if (profile.avatar_url.startsWith('http')) {
            setPhotoUri(profile.avatar_url)
            setActiveTab('photo')
          } else {
            setEmoji(profile.avatar_url)
            setActiveTab('emoji')
          }
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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
      setPhotoUri(result.assets[0].uri)
    }
  }

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) { Alert.alert('Ange ett namn'); return }
    if (!userId) return

    setSaving(true)
    try {
      let avatarUrl = ''

      if (activeTab === 'photo' && photoUri) {
        if (photoUri.startsWith('http')) {
          // Unchanged existing photo
          avatarUrl = photoUri
        } else {
          // New local photo — upload first
          avatarUrl = await uploadAvatar(userId, photoUri)
        }
      } else if (activeTab === 'emoji' && emoji) {
        avatarUrl = emoji
      }
      // '' → use initials (default)

      await updateProfile(userId, { name: trimmed, avatar_url: avatarUrl })
      router.back()
    } catch (e: any) {
      Alert.alert('Något gick fel', e.message)
    } finally {
      setSaving(false)
    }
  }

  const initials  = (name.trim() || email.split('@')[0] || '?')[0].toUpperCase()
  const isDefault = activeTab === 'emoji' && !emoji

  // What to show in the big preview circle
  function PreviewAvatar() {
    if (activeTab === 'photo' && photoUri) {
      return <Image source={{ uri: photoUri }} style={styles.previewPhoto} />
    }
    if (activeTab === 'emoji' && emoji) {
      return <Text style={styles.avatarEmoji}>{emoji}</Text>
    }
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={styles.title}>Redigera profil</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Avatar preview */}
          <View style={styles.previewSection}>
            <View style={styles.avatarPreview}>
              <PreviewAvatar />
            </View>
            <Text style={styles.previewName}>{name || 'Ditt namn'}</Text>
            <Text style={styles.previewEmail}>{email}</Text>
          </View>

          {/* Emoji / Foto tabs */}
          <View style={styles.tabs}>
            {(['emoji', 'photo'] as AvatarTab[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={tab === 'emoji' ? 'happy-outline' : 'image-outline'}
                  size={17}
                  color={activeTab === tab ? '#000' : TEXT_SECONDARY}
                />
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'emoji' ? 'Emoji' : 'Foto'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Emoji tab ── */}
          {activeTab === 'emoji' && (
            <View style={styles.pickerSection}>
              {/* Reset to initial */}
              <TouchableOpacity
                style={[styles.resetBtn, isDefault && styles.resetBtnActive]}
                onPress={() => setEmoji(null)}
                activeOpacity={0.7}
              >
                <View style={[styles.resetCircle, isDefault && styles.resetCircleActive]}>
                  <Text style={[styles.resetLetter, isDefault && { color: ORANGE }]}>{initials}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.resetLabel, isDefault && { color: ORANGE }]}>Standard (bokstav)</Text>
                  <Text style={styles.resetSub}>Visar första bokstaven i ditt namn</Text>
                </View>
                {isDefault && <Ionicons name="checkmark-circle" size={20} color={ORANGE} />}
              </TouchableOpacity>

              {/* Emoji sections */}
              {AVATAR_SECTIONS.map(section => (
                <View key={section.label} style={styles.emojiSection}>
                  <Text style={styles.sectionLabel}>{section.label}</Text>
                  <View style={styles.emojiGrid}>
                    {section.items.map(e => (
                      <TouchableOpacity
                        key={e}
                        style={[styles.emojiBtn, emoji === e && styles.emojiBtnActive]}
                        onPress={() => setEmoji(e)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.emoji}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Foto tab ── */}
          {activeTab === 'photo' && (
            <View style={styles.photoSection}>
              {photoUri ? (
                <>
                  <Image source={{ uri: photoUri }} style={styles.photoPreviewLarge} />
                  <TouchableOpacity style={styles.changePhotoBtn} onPress={pickPhoto} activeOpacity={0.8}>
                    <Ionicons name="image-outline" size={18} color={ORANGE} />
                    <Text style={styles.changePhotoBtnText}>Byt bild</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setPhotoUri(null)} activeOpacity={0.7}>
                    <Text style={styles.removePhotoText}>Ta bort foto</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.pickPhotoBtn} onPress={pickPhoto} activeOpacity={0.8}>
                  <View style={styles.pickPhotoIcon}>
                    <Ionicons name="image-outline" size={36} color={TEXT_SECONDARY} />
                  </View>
                  <Text style={styles.pickPhotoBtnText}>Välj bild från bibliotek</Text>
                  <Text style={styles.pickPhotoSub}>Bilderna beskärs automatiskt till cirkel</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Name */}
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>VISNINGSNAMN</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color={TEXT_SECONDARY} />
              <TextInput
                ref={nameRef}
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ditt namn"
                placeholderTextColor={TEXT_SECONDARY}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Email (locked) */}
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>E-POST</Text>
            <View style={[styles.inputWrapper, { opacity: 0.5 }]}>
              <Ionicons name="mail-outline" size={18} color={TEXT_SECONDARY} />
              <TextInput
                style={[styles.input, { color: TEXT_SECONDARY }]}
                value={email}
                editable={false}
              />
              <Ionicons name="lock-closed-outline" size={15} color={TEXT_SECONDARY} />
            </View>
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.saveBtnText}>Spara ändringar</Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  scroll:   { paddingBottom: 48, gap: 24 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  // Preview
  previewSection: { alignItems: 'center', gap: 8, paddingTop: 4 },
  avatarPreview: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: ORANGE + '22',
    borderWidth: 2.5, borderColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  previewPhoto:    { width: 100, height: 100, borderRadius: 50 },
  avatarEmoji:     { fontSize: 52 },
  avatarInitials:  { color: ORANGE, fontSize: 44, fontWeight: '700' },
  previewName:     { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '700', marginTop: 4 },
  previewEmail:    { color: TEXT_SECONDARY, fontSize: 13 },

  // Tabs
  tabs: {
    flexDirection: 'row', marginHorizontal: 20,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER, padding: 4, gap: 4,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  tabActive:     { backgroundColor: ORANGE },
  tabText:       { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#000', fontWeight: '700' },

  // Emoji picker
  pickerSection: { paddingHorizontal: 20, gap: 16 },
  sectionLabel:  { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },

  resetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1.5, borderColor: BORDER, padding: 14,
  },
  resetBtnActive:     { borderColor: ORANGE, backgroundColor: ORANGE + '10' },
  resetCircle: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  resetCircleActive: { backgroundColor: ORANGE + '25' },
  resetLetter:  { color: TEXT_SECONDARY, fontSize: 20, fontWeight: '700' },
  resetLabel:   { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  resetSub:     { color: TEXT_SECONDARY, fontSize: 12 },

  emojiSection: { gap: 10 },
  emojiGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emojiBtn: {
    width: 54, height: 54, borderRadius: 14,
    backgroundColor: CARD, borderWidth: 1.5, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiBtnActive: { borderColor: ORANGE, backgroundColor: ORANGE + '18' },
  emoji:          { fontSize: 26 },

  // Photo tab
  photoSection: {
    paddingHorizontal: 20, alignItems: 'center', gap: 16,
  },
  pickPhotoBtn: {
    width: '100%', paddingVertical: 40,
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1.5, borderColor: BORDER, borderStyle: 'dashed',
    alignItems: 'center', gap: 10,
  },
  pickPhotoIcon:    { opacity: 0.5 },
  pickPhotoBtnText: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  pickPhotoSub:     { color: TEXT_SECONDARY, fontSize: 13 },
  photoPreviewLarge: {
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 3, borderColor: ORANGE,
  },
  changePhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  changePhotoBtnText: { color: ORANGE, fontSize: 15, fontWeight: '600' },
  removePhotoText:    { color: TEXT_SECONDARY, fontSize: 14, textDecorationLine: 'underline' },

  // Fields
  fieldSection: { paddingHorizontal: 20, gap: 8 },
  fieldLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, paddingHorizontal: 4,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14,
  },
  input: { flex: 1, color: TEXT_PRIMARY, fontSize: 16, paddingVertical: 14 },

  // Save
  saveBtn: {
    marginHorizontal: 20, backgroundColor: ORANGE,
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12,
  },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
})
