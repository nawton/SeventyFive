import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
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
import { supabase } from '@/lib/supabase'
import { getProfile, updateProfile } from '@/services/profile'
import { ORANGE, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

// ─── Emoji-alternativ ────────────────────────────────────────────────────────

const AVATARS = [
  '💪', '🏋️', '🏃', '🧘', '🔥', '⚡',
  '🎯', '🏆', '👑', '🦁', '🐺', '🦅',
  '🌊', '⚔️', '🛡️', '🚀', '💎', '🌟',
  '🥊', '🏊', '🚴', '🧗', '🤸', '🎽',
]

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [avatar, setAvatar]       = useState<string | null>(null)
  const [userId, setUserId]       = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
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
        // avatar_url används för emoji tills vi lägger till riktiga bilder
        if (profile?.avatar_url) setAvatar(profile.avatar_url)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) { Alert.alert('Ange ett namn'); return }
    if (!userId) return

    setSaving(true)
    try {
      await updateProfile(userId, { name: trimmed, avatar_url: avatar ?? '' })
      router.back()
    } catch (e: any) {
      Alert.alert('Något gick fel', e.message)
    } finally {
      setSaving(false)
    }
  }

  // Visa vald emoji eller initial bokstav
  const initials = (name.trim() || email.split('@')[0] || '?')[0].toUpperCase()

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={styles.title}>Redigera profil</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Förhandsgranskning av vald avatar */}
          <View style={styles.previewSection}>
            <View style={styles.avatarPreview}>
              {avatar ? (
                <Text style={styles.avatarEmoji}>{avatar}</Text>
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
            </View>
            <Text style={styles.previewHint}>Välj en emoji nedan</Text>
          </View>

          {/* Emoji-väljare */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>VÄLJ AVATAR</Text>
            <View style={styles.emojiGrid}>
              {AVATARS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiBtn,
                    avatar === emoji && styles.emojiBtnSelected,
                  ]}
                  onPress={() => setAvatar(emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Namn */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>VISNINGSNAMN</Text>
            <View style={styles.inputWrapper}>
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

          {/* E-post (låst) */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>E-POST</Text>
            <View style={[styles.inputWrapper, styles.inputDisabled]}>
              <TextInput
                style={[styles.input, { color: TEXT_SECONDARY }]}
                value={email}
                editable={false}
              />
              <Ionicons name="lock-closed-outline" size={16} color={TEXT_SECONDARY} />
            </View>
          </View>

          {/* Spara */}
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
  screen: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 48, gap: 24 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: { padding: 8 },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  // Avatar preview
  previewSection: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
  },
  avatarPreview: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: ORANGE + '20',
    borderWidth: 2,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 48,
  },
  avatarInitials: {
    color: ORANGE,
    fontSize: 40,
    fontWeight: '700',
  },
  previewHint: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },

  // Sections
  section: { paddingHorizontal: 20, gap: 10 },
  sectionLabel: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingHorizontal: 4,
  },

  // Emoji grid
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emojiBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: CARD,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnSelected: {
    borderColor: ORANGE,
    backgroundColor: ORANGE + '18',
  },
  emoji: { fontSize: 28 },

  // Input
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
  },
  inputDisabled: { opacity: 0.5 },
  input: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 16,
    paddingVertical: 14,
  },

  // Save
  saveBtn: {
    marginHorizontal: 20,
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
})
