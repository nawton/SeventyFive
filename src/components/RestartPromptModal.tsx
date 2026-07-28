import { useState } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'

import { BG, CARD, BORDER, RED, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT, accentAlpha } from '@/lib/theme'
import { StreakFlame } from '@/components/StreakFlame'
import { useT } from '@/lib/i18n'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  /** 'missed' = dagar upptäcktes vid app-öppning, 'today' = dagen rapporterades nyss */
  variant: 'missed' | 'today'
  missedDays: number[]
  /** Normal får fortsätta ändå — på Hard och Extreme är omstarten regeln */
  allowContinue?: boolean
  onRestart: () => Promise<void>
  onContinue: () => Promise<void>
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RestartPromptModal({ visible, variant, missedDays, allowContinue = true, onRestart, onContinue }: Props) {
  const t = useT()
  const [busy, setBusy] = useState<'restart' | 'continue' | null>(null)

  function title(): string {
    if (variant === 'today') return t('Dagen är missad')
    if (missedDays.length === 1) return t('Du missade dag {n}', { n: missedDays[0] })
    return t('Du missade {n} dagar', { n: missedDays.length })
  }

  function subtitle(): string {
    if (variant === 'today') {
      return t('Utmaningen bygger på att varje dag räknas. Vad gör du nu?')
    }
    return t('Ingen dag loggades som klar. Utmaningen bygger på att varje dag räknas. Vad gör du nu?')
  }

  async function handle(action: 'restart' | 'continue') {
    setBusy(action)
    try {
      await (action === 'restart' ? onRestart() : onContinue())
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      // pageSheet kan svepas ner på iOS — den tvingade varianten (Hard och
      // Extreme) måste vara fullskärm så omstarten inte går att vifta bort
      presentationStyle={allowContinue ? 'pageSheet' : 'fullScreen'}
      onRequestClose={() => { if (allowContinue) handle('continue') }}
    >
      <View style={styles.screen}>
        <View style={styles.container}>
          <View style={styles.handle} />

          <View style={{ alignSelf: 'center' }}>
            <StreakFlame size={44} />
          </View>
          <Text style={styles.title}>{title()}</Text>
          <Text style={styles.subtitle}>{subtitle()}</Text>

          <View style={styles.card}>
            <Text style={styles.cardText}>
              {allowContinue
                ? t('Att starta om är inte att förlora, det är att ta utmaningen på allvar. Att fortsätta är okej, men dagen räknas som missad i din statistik.')
                : t('På din nivå är regeln enkel: en missad dag betyder omstart från dag 1. Allt du loggat, dina pass och rekord finns kvar, det är bara dagräkningen som börjar om.')}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.restartButton, busy !== null && styles.disabled]}
            onPress={() => handle('restart')}
            disabled={busy !== null}
            activeOpacity={0.8}
          >
            {busy === 'restart'
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.restartButtonText}>{t('Starta om från dag 1')}</Text>
            }
          </TouchableOpacity>

          {allowContinue && (
            <TouchableOpacity
              style={[styles.continueButton, busy !== null && styles.disabled]}
              onPress={() => handle('continue')}
              disabled={busy !== null}
              activeOpacity={0.8}
            >
              {busy === 'continue'
                ? <ActivityIndicator color={ACCENT} />
                : <Text style={styles.continueButtonText}>{t('Fortsätt ändå')}</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>
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
  card: {
    backgroundColor: accentAlpha('12'),
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
  },
  cardText: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    lineHeight: 23,
  },
  restartButton: {
    backgroundColor: RED,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  restartButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '700',
  },
  continueButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  continueButtonText: {
    color: TEXT_SECONDARY,
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.4,
  },
})
