import { useState } from 'react'
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

import { BG, CARD, BORDER, RED, ORANGE, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

// Hårdkodade motivationsvar — ersätts med OpenAI av Anton
const AI_RESPONSES = [
  'Din ursäkt är verklig. Din potential är större. Imorgon börjar du om — starkare.',
  'Nawton-mentaliteten handlar inte om perfektion. Den handlar om att resa sig. Gör det imorgon.',
  'Du visste att det inte skulle vara enkelt. Det är precis därför det är värt det. En dag i taget.',
  'Kom ihåg varför du startade. Den känslan är starkare än varje ursäkt. Tillbaka på spåret imorgon.',
]

function getAiResponse(): string {
  return AI_RESPONSES[Math.floor(Math.random() * AI_RESPONSES.length)]
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}

// ─── Component ────────────────────────────────────────────────────────────────

type Step = 'input' | 'response'

export function FailModal({ visible, onClose, onConfirm }: Props) {
  const [step, setStep] = useState<Step>('input')
  const [reason, setReason] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!reason.trim()) return
    setLoading(true)
    try {
      await onConfirm(reason.trim())
      setAiResponse(getAiResponse())
      setStep('response')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setStep('input')
    setReason('')
    setAiResponse('')
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {step === 'input' ? (
          <View style={styles.container}>
            <View style={styles.handle} />

            <Text style={styles.emoji}>😤</Text>
            <Text style={styles.title}>Vad är din ursäkt?</Text>
            <Text style={styles.subtitle}>
              Skriv ned vad som hindrade dig idag. Var ärlig mot dig själv.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Jag missade för att..."
              placeholderTextColor="#444"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />

            <TouchableOpacity
              style={[styles.submitButton, (!reason.trim() || loading) && styles.disabled]}
              onPress={handleSubmit}
              disabled={!reason.trim() || loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitButtonText}>Skicka till coachen</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelText}>Avbryt</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.container}>
            <View style={styles.handle} />

            <Text style={styles.emoji}>💪</Text>
            <Text style={styles.title}>Din coach svarar</Text>

            <View style={styles.responseCard}>
              <Text style={styles.responseText}>{aiResponse}</Text>
            </View>

            <Text style={styles.yourReason}>Din ursäkt: "{reason}"</Text>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <Text style={styles.closeButtonText}>Tillbaka till utmaningen</Text>
            </TouchableOpacity>
          </View>
        )}
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
  input: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    color: TEXT_PRIMARY,
    fontSize: 16,
    borderWidth: 1,
    borderColor: BORDER,
    minHeight: 120,
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: RED,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: TEXT_PRIMARY,
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
  responseCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: ORANGE + '40',
    marginTop: 8,
  },
  responseText: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    lineHeight: 26,
    fontStyle: 'italic',
  },
  yourReason: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  closeButton: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  closeButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
})
