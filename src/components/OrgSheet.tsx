import { useEffect, useState } from 'react'
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@/components/Icon'
import { GlassCircleButton } from '@/components/GlassButton'
import { AppTextInput } from '@/components/AppTextInput'
import { useT } from '@/lib/i18n'
import { BG, TEXT_PRIMARY, TEXT_SECONDARY, useThemeStrings } from '@/lib/theme'
import {
  createOrganization, joinOrganizationByCode, type Organization,
} from '@/services/organizations'

// =============================================================================
// FÖRENINGSARKET — två lägen i samma helskärmsmodal: gå med via koden
// tränaren delat ut, eller skapa en ny förening (skaparen blir admin och
// får koden att dela ut). Färger som råa strängar: dynamiska konstanter
// fryser till mörklägesfärger inne i modaler.
// =============================================================================

export function OrgSheet({ visible, mode, userId, onClose, onDone }: {
  visible: boolean
  mode: 'join' | 'create'
  userId: string | null
  onClose: () => void
  onDone: (org: Organization) => void
}) {
  const t = useT()
  const T = useThemeStrings()
  const insets = useSafeAreaInsets()
  const onAccent = T.TEXT_PRIMARY === '#FFFFFF' ? '#000000' : '#FFFFFF'
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!visible) return
    setCode(''); setName(''); setDesc(''); setBusy(false)
  }, [visible, mode])

  async function submit() {
    if (busy) return
    try {
      setBusy(true)
      if (mode === 'join') {
        const org = await joinOrganizationByCode(code)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onDone(org)
      } else {
        if (!userId || name.trim().length < 2) {
          Alert.alert(t('Ange ett namn'), t('Föreningen behöver ett namn på minst två tecken.'))
          return
        }
        const org = await createOrganization(userId, name, desc)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onDone(org)
      }
    } catch {
      Alert.alert(
        mode === 'join' ? t('Kunde inte gå med') : t('Kunde inte skapa'),
        mode === 'join'
          ? t('Kontrollera koden och försök igen.')
          : t('Något gick fel. Försök igen.'),
      )
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = mode === 'join' ? code.trim().length === 6 : name.trim().length >= 2

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.screen, { backgroundColor: T.BG, paddingTop: insets.top }]}>
        <View style={s.header}>
          <GlassCircleButton icon="close" size={40} iconColor={TEXT_PRIMARY}
            onPress={onClose} fallbackStyle={{ backgroundColor: 'rgba(128,128,128,0.14)' }} testID="orgSheetClose" />
          <Text style={s.title}>{mode === 'join' ? t('Gå med i förening') : t('Skapa förening')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.body}>
            {mode === 'join' ? (
              <>
                <View style={[s.heroIcon, { backgroundColor: `${T.ACCENT}16` }]}>
                  <Ionicons name="key-outline" size={30} color={T.ACCENT} />
                </View>
                <Text style={s.lead}>
                  {t('Skriv in föreningens kod, den delas ut av din tränare eller ledare.')}
                </Text>
                <AppTextInput
                  style={[s.codeInput, { borderColor: 'rgba(128,128,128,0.25)', color: T.TEXT_PRIMARY }]}
                  value={code}
                  onChangeText={v => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="ABC123"
                  placeholderTextColor={TEXT_SECONDARY}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                  testID="orgCodeInput"
                />
              </>
            ) : (
              <>
                <Text style={s.fieldLabel}>{t('FÖRENINGENS NAMN')}</Text>
                <AppTextInput
                  style={[s.input, { borderColor: 'rgba(128,128,128,0.25)', color: T.TEXT_PRIMARY }]}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('t.ex. Växjö Löparklubb')}
                  placeholderTextColor={TEXT_SECONDARY}
                  autoCorrect={false}
                  maxLength={80}
                  testID="orgNameInput"
                />
                <Text style={s.fieldLabel}>{t('BESKRIVNING (VALFRITT)')}</Text>
                <AppTextInput
                  style={[s.input, s.inputMulti, { borderColor: 'rgba(128,128,128,0.25)', color: T.TEXT_PRIMARY }]}
                  value={desc}
                  onChangeText={setDesc}
                  placeholder={t('Vad tränar ni, var och när?')}
                  placeholderTextColor={TEXT_SECONDARY}
                  multiline
                  maxLength={1000}
                  testID="orgDescInput"
                />
                <Text style={s.hint}>
                  {t('Du blir admin och får en kod att dela ut till medlemmarna.')}
                </Text>
              </>
            )}
          </View>

          <View style={[s.footer, { paddingBottom: insets.bottom + 14 }]}>
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: T.ACCENT }, (!canSubmit || busy) && { opacity: 0.5 }]}
              onPress={submit}
              disabled={!canSubmit || busy}
              activeOpacity={0.85}
              testID="orgSubmit"
            >
              {busy
                ? <ActivityIndicator color={onAccent} />
                : <Text style={[s.primaryBtnText, { color: onAccent }]}>
                    {mode === 'join' ? t('Gå med') : t('Skapa förening')}
                  </Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '800' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 22 },
  heroIcon: {
    alignSelf: 'center', width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  lead: { color: TEXT_SECONDARY, fontSize: 15, textAlign: 'center', lineHeight: 21, marginBottom: 22 },
  codeInput: {
    borderWidth: 1, borderRadius: 16, paddingVertical: 16,
    fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: 8,
  },
  fieldLabel: {
    color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 8, marginTop: 14,
  },
  input: {
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16,
  },
  inputMulti: { minHeight: 90, textAlignVertical: 'top' },
  hint: { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 19, marginTop: 16 },
  footer: { paddingHorizontal: 20 },
  primaryBtn: {
    borderRadius: 16, paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '800' },
})
