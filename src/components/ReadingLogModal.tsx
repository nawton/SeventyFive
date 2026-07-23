import { useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated'

import { BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT, ACCENT_CONTRAST, CARD_BORDER } from '@/lib/theme'
import { AppTextInput } from '@/components/AppTextInput'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  /** Nivåns sidmål, t.ex. 10/20/30 — förifyller sidfältet */
  targetPages: number | null
  onClose: () => void
  onSave: (book: string, pages: number) => Promise<void>
}

// ─── Component ────────────────────────────────────────────────────────────────
// Bottenark med appens dragfysik: dra i handtags-/rubrikområdet, fjädrar
// tillbaka under tröskeln och stängs förbi den. Fälten sköter tangentbordet.

export function ReadingLogModal({ visible, targetPages, onClose, onSave }: Props) {
  const [book, setBook] = useState('')
  const [pages, setPages] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) {
      setBook('')
      setPages(targetPages ? String(targetPages) : '')
      sheetY.value = 0
    }
  }, [visible, targetPages])

  const sheetY = useSharedValue(0)
  const pan = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .onUpdate(e => { sheetY.value = Math.max(0, e.translationY) })
    .onEnd(e => {
      if (e.translationY > 110 || e.velocityY > 800) runOnJS(onClose)()
      else sheetY.value = withSpring(0, { damping: 20, stiffness: 260 })
    })
  const sheetAnim = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }))

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
      transparent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.backdrop}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* Färgerna på inre vyn — dynamiska färger på animerade noder kraschar */}
          <Animated.View style={sheetAnim}>
            <View style={styles.sheet}>
              <GestureDetector gesture={pan}>
                <View>
                  <View style={styles.handle} />
                  <Text style={styles.emoji}>📖</Text>
                  <Text style={styles.title}>Logga läsning</Text>
                  <Text style={styles.subtitle}>
                    {targetPages
                      ? `Minst ${targetPages} sidor i en riktig bok, inte poddar eller artiklar.`
                      : 'Vad läste du idag?'}
                  </Text>
                </View>
              </GestureDetector>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>BOK</Text>
                <AppTextInput
                  style={styles.input}
                  placeholder="Boktitel (valfritt)"
                  value={book}
                  onChangeText={setBook}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>SIDOR</Text>
                <AppTextInput
                  style={styles.input}
                  placeholder={targetPages ? String(targetPages) : '10'}
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
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
      </GestureHandlerRootView>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 16,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.45)',
    alignSelf: 'center',
    marginBottom: 10,
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
    marginTop: 6,
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
    borderColor: CARD_BORDER,
  },
  saveButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: ACCENT_CONTRAST,
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
