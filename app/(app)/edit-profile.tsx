import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
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

export default function EditProfileScreen() {
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userId, setUserId]       = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
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
        if (profile?.avatar_url) setAvatarUrl(profile.avatar_url)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Tillstånd krävs', 'Ge appen tillgång till ditt fotobibliotek i Inställningar.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })

    if (result.canceled || !result.assets[0]) return

    setUploading(true)
    try {
      const url = await uploadAvatar(userId!, result.assets[0].uri)
      setAvatarUrl(url)
      await updateProfile(userId!, { avatar_url: url })
    } catch (e: any) {
      Alert.alert('Uppladdning misslyckades', e.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) { Alert.alert('Ange ett namn'); return }
    if (!userId) return

    setSaving(true)
    try {
      await updateProfile(userId, { name: trimmed })
      router.back()
    } catch (e: any) {
      Alert.alert('Något gick fel', e.message)
    } finally {
      setSaving(false)
    }
  }

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

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={handlePickImage}
              activeOpacity={0.8}
              disabled={uploading}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                {uploading
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Ionicons name="camera" size={14} color="#000" />
                }
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Tryck för att byta profilbild</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>VISNINGSNAMN</Text>
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

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>E-POST</Text>
              <View style={[styles.inputWrapper, styles.inputDisabled]}>
                <TextInput
                  style={[styles.input, styles.inputTextDisabled]}
                  value={email}
                  editable={false}
                />
                <Ionicons name="lock-closed-outline" size={16} color={TEXT_SECONDARY} style={styles.inputIcon} />
              </View>
              <Text style={styles.fieldHint}>E-postadressen kan inte ändras här.</Text>
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
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  centered: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: 48,
    gap: 28,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    padding: 8,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: '700',
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    gap: 10,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#000',
    fontSize: 40,
    fontWeight: '700',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: BG,
  },
  avatarHint: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },

  // Form
  form: {
    paddingHorizontal: 20,
    gap: 20,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingHorizontal: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  input: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 16,
    paddingVertical: 14,
  },
  inputTextDisabled: {
    color: TEXT_SECONDARY,
  },
  inputIcon: {
    marginLeft: 8,
  },
  fieldHint: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    paddingHorizontal: 4,
  },

  // Save button
  saveBtn: {
    marginHorizontal: 20,
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
})
