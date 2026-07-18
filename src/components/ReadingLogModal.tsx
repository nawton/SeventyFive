import { useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'

import { BG, CARD, BORDER, ORANGE, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  /** Nivåns sidmål, t.ex. 10/20/30 — förifyller sidfältet */
  targetPages: number | null
  onClose: () => void
  onSave: (book: string, pages: number) => Promise<void>
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReadingLogModal({ visible, targetPages, onClose, onSave }: Props) {
  const [book, setBook] = useState('')
  const [pages, setPages] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) {
      setBook('')
      setPages(targetPages ? String(targetPages) : '')
    }
  }, [visible, targetPages])

  const pagesNum = parseInt(pages, 10)
  const valid = !Number.isNaN(pagesNum) && pagesNum > 0

  async function handleSave() {
    if (!valid) return
    setSaving(true)
    try {
      await onSave(book.trim(), pagesNum)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <View style={styles.handle} />

          <Text style={styles.emoji}>📖</Text>
          <Text style={styles.title}>Logga läsning</Text>
          <Text style={styles.subtitle}>
            {targetPages
              ? `Minst ${targetPages} sidor i en riktig bok, inte poddar eller artiklar.`
              : 'Vad läste du idag?'}
          </Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>BOK</Text>
            <TextInput
              style={styles.input}
              placeholder="Boktitel (valfritt)"
              placeholderTextColor="#444"
              value={book}
              onChangeText={setBook}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>SIDOR</Text>
            <TextInput
              style={styles.input}
              placeholder={targetPages ? String(targetPages) : '10'}
              placeholderTextColor="#444"
              value={pages}
              onChangeText={setPages}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, (!valid || saving) && styles.disabled]}
            onPress={handleSave}
            disabled={!valid || saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.saveButtonText}>Markera som läst</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={saving}>
            <Text style={styles.cancelText}>Avbryt</Text>
          </TouchableOpacity>
        </View>
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
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 12,
    gap: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: 'center',
    marginBottom: 8,
  },
  emoji: {
    fontSize: 48,
    textAlign: 'center',
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    paddingHorizontal: 4,
  },
  input: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    color: TEXT_PRIMARY,
    fontSize: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  saveButton: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },
  disabled: {
    opacity: 0.4,
  },
})
