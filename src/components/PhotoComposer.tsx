import { useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT, CARD_BORDER } from '@/lib/theme'
import { AppTextInput } from '@/components/AppTextInput'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  imageUri: string | null
  dayNumber: number
  onCancel: () => void
  onSave: (caption: string) => Promise<void>
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PhotoComposer({ visible, imageUri, dayNumber, onCancel, onSave }: Props) {
  const [caption, setCaption] = useState('')
  const [saving, setSaving] = useState(false)

  // Nollställ texten när en ny bild öppnas
  useEffect(() => {
    if (visible) setCaption('')
  }, [visible])

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(caption)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} disabled={saving} hitSlop={12}>
            <Text style={styles.cancelText}>Avbryt</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dag {dayNumber}</Text>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.disabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={styles.saveButtonText}>Spara</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
          )}

          <View style={styles.captionCard}>
            <View style={styles.captionHeader}>
              <Ionicons name="create-outline" size={16} color={TEXT_SECONDARY} />
              <Text style={styles.captionLabel}>Om dagen</Text>
            </View>
            <AppTextInput
              style={styles.input}
              placeholder="Hur kändes dagen eller passet? Skriv några rader..."
              placeholderTextColor="#444"
              value={caption}
              onChangeText={setCaption}
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '700',
  },
  cancelText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 68,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  scroll: {
    padding: 20,
    gap: 16,
  },
  preview: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 16,
    backgroundColor: CARD,
  },
  captionCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 14,
    gap: 10,
  },
  captionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  captionLabel: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 90,
    padding: 0,
  },
})
