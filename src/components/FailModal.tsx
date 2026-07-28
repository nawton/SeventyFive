import { useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated'
import { Ionicons } from '@/components/Icon'
import { RED, TEXT_SECONDARY, useThemeStrings } from '@/lib/theme'
import { AppTextInput } from '@/components/AppTextInput'
import { useT } from '@/lib/i18n'

// =============================================================================
// RAPPORTERA MISSAD DAG — dragbar bottom sheet. Ärlighet med krav: dagen
// kan bara rapporteras när både ursäkten OCH planen för imorgon är ifyllda.
// Ingen låtsascoach — sparningen stänger arket och omstartsfrågan tar vid.
// =============================================================================

const SLIDE = 640
const SPRING = { damping: 20, stiffness: 220, mass: 0.8 } as const

interface Props {
  visible: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}

export function FailModal({ visible, onClose, onConfirm }: Props) {
  const t = useT()
  const T = useThemeStrings()
  const insets = useSafeAreaInsets()
  const [excuse, setExcuse] = useState('')
  const [plan, setPlan] = useState('')
  const [loading, setLoading] = useState(false)

  const ty = useSharedValue(SLIDE)
  useEffect(() => {
    if (visible) {
      setExcuse('')
      setPlan('')
      ty.value = SLIDE
      ty.value = withSpring(0, SPRING)
    }
  }, [visible])

  // Planen är kravet — utan en plan för imorgon går dagen inte att rapportera
  const canSubmit = excuse.trim().length > 0 && plan.trim().length > 0

  const drag = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .onUpdate(e => {
      ty.value = e.translationY > 0 ? e.translationY : e.translationY * 0.15
    })
    .onEnd(e => {
      if (e.translationY > 100 || e.velocityY > 600) {
        ty.value = withTiming(SLIDE, { duration: 200 }, finished => {
          if (finished) runOnJS(onClose)()
        })
      } else {
        ty.value = withSpring(0, SPRING)
      }
    })

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }))

  async function handleSubmit() {
    if (!canSubmit || loading) return
    setLoading(true)
    try {
      await onConfirm(`${excuse.trim()} · Plan: ${plan.trim()}`)
      onClose()
    } catch {
      // sparningen misslyckades — arket ligger kvar så användaren kan försöka igen
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={s.root}>
        <Pressable style={s.backdrop} onPress={onClose} testID="failBackdrop" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View style={[
            s.sheet,
            { backgroundColor: T.BG, borderColor: T.BORDER, paddingBottom: 20 + insets.bottom },
            sheetStyle,
          ]}>
            {/* Draghandtaget och rubriken äger nedsvepet — inte textfälten */}
            <GestureDetector gesture={drag}>
              <View style={s.dragArea}>
                <View style={s.handle} />
                <View style={s.iconCircle}>
                  <Ionicons name="flag-outline" size={24} color={RED} />
                </View>
                <Text style={[s.title, { color: T.TEXT_PRIMARY }]}>{t('Rapportera dagen som missad')}</Text>
                <Text style={s.sub}>
                  {t('Var ärlig mot dig själv. Dagen kan bara rapporteras med en plan för hur imorgon blir bättre.')}
                </Text>
              </View>
            </GestureDetector>

            <Text style={s.fieldLabel}>{t('VAD HÄNDE?')}</Text>
            <AppTextInput
              style={[s.input, { color: T.TEXT_PRIMARY }]}
              placeholder={t('Jag missade för att …')}
              placeholderTextColor="rgba(128,128,128,0.6)"
              value={excuse}
              onChangeText={setExcuse}
              multiline
              textAlignVertical="top"
              testID="failExcuse"
            />

            <Text style={s.fieldLabel}>{t('DIN PLAN FÖR IMORGON')}</Text>
            <AppTextInput
              style={[s.input, { color: T.TEXT_PRIMARY }]}
              placeholder={t('Imorgon gör jag istället …')}
              placeholderTextColor="rgba(128,128,128,0.6)"
              value={plan}
              onChangeText={setPlan}
              multiline
              textAlignVertical="top"
              testID="failPlan"
            />

            <TouchableOpacity
              style={[s.submitButton, (!canSubmit || loading) && s.disabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || loading}
              activeOpacity={0.8}
              testID="failSubmit"
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitButtonText}>{t('Rapportera missad dag')}</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelButton} onPress={onClose} activeOpacity={0.7}>
              <Text style={s.cancelText}>{t('Avbryt')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },

  sheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1,
    paddingHorizontal: 22, paddingTop: 10,
  },
  dragArea: { alignItems: 'center', paddingBottom: 6 },
  handle: {
    width: 44, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.45)', marginBottom: 16,
  },
  iconCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,59,74,0.14)',
    borderWidth: 1.5, borderColor: 'rgba(255,59,74,0.35)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  sub: {
    color: TEXT_SECONDARY, fontSize: 13.5, textAlign: 'center',
    lineHeight: 20, marginTop: 6, maxWidth: 300,
  },

  fieldLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.2, marginTop: 14, marginBottom: 7,
  },
  input: {
    backgroundColor: 'rgba(128,128,128,0.10)',
    borderWidth: 1, borderColor: 'rgba(128,128,128,0.18)',
    borderRadius: 14, padding: 14, fontSize: 15, minHeight: 72,
  },

  submitButton: {
    backgroundColor: RED, borderRadius: 999,
    paddingVertical: 15, alignItems: 'center', marginTop: 18,
  },
  disabled: { opacity: 0.35 },
  submitButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cancelButton: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600' },
})
