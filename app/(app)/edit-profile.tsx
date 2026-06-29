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

// ─── Avatar options ───────────────────────────────────────────────────────────

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
    items: ['🥗', '🥩', '💧', '📖', '🎵', '🧠', '❤️', '🙏', '👊', '🤛', '💪🏽', '🕹️'],
  },
]

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [avatar, setAvatar]   = useState<string | null>(null)
  const [userId, setUserId]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
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

  const initials = (name.trim() || email.split('@')[0] || '?')[0].toUpperCase()
  const isDefault = !avatar

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
              {avatar ? (
                <Text style={styles.avatarEmoji}>{avatar}</Text>
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
            </View>
            <Text style={styles.previewName}>{name || 'Ditt namn'}</Text>
            <Text style={styles.previewEmail}>{email}</Text>
          </View>

          {/* Avatar picker */}
          <View style={styles.pickerSection}>
            <Text style={styles.sectionLabel}>VÄLJ AVATAR</Text>

            {/* Reset-to-initial option */}
            <TouchableOpacity
              style={[styles.resetBtn, isDefault && styles.resetBtnActive]}
              onPress={() => setAvatar(null)}
              activeOpacity={0.7}
            >
              <View style={[styles.resetInitialCircle, isDefault && styles.resetInitialCircleActive]}>
                <Text style={[styles.resetInitialText, isDefault && styles.resetInitialTextActive]}>
                  {initials}
                </Text>
              </View>
              <View style={styles.resetInfo}>
                <Text style={[styles.resetLabel, isDefault && { color: ORANGE }]}>
                  Standard (bokstav)
                </Text>
                <Text style={styles.resetSub}>Visar första bokstaven i ditt namn</Text>
              </View>
              {isDefault && <Ionicons name="checkmark-circle" size={20} color={ORANGE} />}
            </TouchableOpacity>

            {/* Emoji sections */}
            {AVATAR_SECTIONS.map(section => (
              <View key={section.label} style={styles.emojiSection}>
                <Text style={styles.emojiSectionLabel}>{section.label}</Text>
                <View style={styles.emojiGrid}>
                  {section.items.map(emoji => (
                    <TouchableOpacity
                      key={emoji}
                      style={[styles.emojiBtn, avatar === emoji && styles.emojiBtnSelected]}
                      onPress={() => setAvatar(emoji)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.emoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* Name */}
          <View style={styles.fieldSection}>
            <Text style={styles.sectionLabel}>VISNINGSNAMN</Text>
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
            <Text style={styles.sectionLabel}>E-POST</Text>
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
  scroll:   { paddingBottom: 48, gap: 28 },

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
  previewSection: { alignItems: 'center', gap: 8, paddingTop: 8 },
  avatarPreview: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: ORANGE + '22',
    borderWidth: 2.5, borderColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji:    { fontSize: 52 },
  avatarInitials: { color: ORANGE, fontSize: 44, fontWeight: '700' },
  previewName:    { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '700', marginTop: 4 },
  previewEmail:   { color: TEXT_SECONDARY, fontSize: 13 },

  // Section labels
  sectionLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, paddingHorizontal: 4,
  },

  // Avatar picker section
  pickerSection: { paddingHorizontal: 20, gap: 14 },

  // Reset-to-default row
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1.5, borderColor: BORDER,
    padding: 14,
  },
  resetBtnActive: { borderColor: ORANGE, backgroundColor: ORANGE + '10' },
  resetInitialCircle: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  resetInitialCircleActive: { backgroundColor: ORANGE + '25' },
  resetInitialText:         { color: TEXT_SECONDARY, fontSize: 20, fontWeight: '700' },
  resetInitialTextActive:   { color: ORANGE },
  resetInfo:  { flex: 1, gap: 2 },
  resetLabel: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  resetSub:   { color: TEXT_SECONDARY, fontSize: 12 },

  // Emoji sections
  emojiSection: { gap: 10 },
  emojiSectionLabel: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600', paddingHorizontal: 4 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emojiBtn: {
    width: 54, height: 54, borderRadius: 14,
    backgroundColor: CARD, borderWidth: 1.5, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiBtnSelected: { borderColor: ORANGE, backgroundColor: ORANGE + '18' },
  emoji: { fontSize: 26 },

  // Fields
  fieldSection: { paddingHorizontal: 20, gap: 10 },
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
