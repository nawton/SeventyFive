import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, KeyboardAvoidingView, Keyboard,
  Platform, Pressable, ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS,
} from 'react-native-reanimated'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import { TASK_COLORS } from '@/components/TaskGridCard'

const ORANGE      = '#FF9F0A'
const CARD_BG     = '#131315'
const CARD_BORDER = '#1E1E21'
const CUSTOM      = TASK_COLORS.custom

type IconName = React.ComponentProps<typeof Ionicons>['name']

const ICON_OPTIONS: Array<{ icon: IconName; label: string }> = [
  { icon: 'checkmark-circle-outline', label: 'Klar'       },
  { icon: 'sunny-outline',            label: 'Morgon'     },
  { icon: 'moon-outline',             label: 'Kväll'      },
  { icon: 'bed-outline',              label: 'Sömn'       },
  { icon: 'water-outline',            label: 'Vatten'     },
  { icon: 'nutrition-outline',        label: 'Kost'       },
  { icon: 'book-outline',             label: 'Läsning'    },
  { icon: 'pencil-outline',           label: 'Journaling' },
  { icon: 'heart-outline',            label: 'Meditation' },
  { icon: 'walk-outline',             label: 'Promenad'   },
  { icon: 'bicycle-outline',          label: 'Cykling'    },
  { icon: 'snow-outline',             label: 'Kall dusch' },
  { icon: 'phone-portrait-outline',   label: 'Ingen skärm'},
  { icon: 'musical-notes-outline',    label: 'Musik'      },
  { icon: 'flash-outline',            label: 'Energi'     },
  { icon: 'barbell-outline',          label: 'Träning'    },
]

/**
 * Bottom sheet för att skapa en egen regel. Fjädrar in, följer fingret vid
 * drag i handtaget och glider ut vid stängning — samma mönster som
 * SessionEditor. Hela skapa-logiken ägs av föräldern via onCreate.
 */
export function AddRuleSheet({ visible, onClose, onCreate }: {
  visible: boolean
  onClose: () => void
  onCreate: (name: string, icon: string) => Promise<void>
}) {
  const insets = useSafeAreaInsets()
  const [name, setName]     = useState('')
  const [icon, setIcon]     = useState<IconName>('checkmark-circle-outline')
  const [saving, setSaving] = useState(false)

  const sheetTY  = useSharedValue(700)
  const backdrop = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      setName('')
      setIcon('checkmark-circle-outline')
      sheetTY.value  = 700
      backdrop.value = 0
      sheetTY.value  = withSpring(0, { damping: 26, stiffness: 260, mass: 1 })
      backdrop.value = withTiming(1, { duration: 260 })
    }
  }, [visible])

  function closeNow() {
    Keyboard.dismiss()
    onClose()
  }

  // Keyboard.dismiss får inte refereras direkt i en worklet — då försöker
  // Reanimated serialisera hela Keyboard-modulen till UI-tråden (krasch)
  function hideKeyboard() {
    Keyboard.dismiss()
  }

  function dismiss() {
    Keyboard.dismiss()
    sheetTY.value  = withTiming(800, { duration: 300 }, () => runOnJS(onClose)())
    backdrop.value = withTiming(0, { duration: 250 })
  }

  const handleGesture = Gesture.Pan()
    .activeOffsetY(8)
    .onStart(() => { runOnJS(hideKeyboard)() })
    .onUpdate(e => {
      if (e.translationY > 0) {
        sheetTY.value  = e.translationY
        backdrop.value = Math.max(0, 1 - e.translationY / 320)
      }
    })
    .onEnd(e => {
      if (e.translationY > 100 || e.velocityY > 600) {
        sheetTY.value  = withTiming(800, { duration: 280 }, () => runOnJS(closeNow)())
        backdrop.value = withTiming(0, { duration: 230 })
      } else {
        sheetTY.value  = withSpring(0, { damping: 26, stiffness: 260, mass: 1 })
        backdrop.value = withTiming(1, { duration: 200 })
      }
    })

  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: sheetTY.value }] }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }))

  async function handleSave() {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await onCreate(name.trim(), icon)
      dismiss()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={dismiss}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        </Animated.View>
        <KeyboardAvoidingView
          style={[s.overlay, { paddingTop: insets.top + 8 }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <Animated.View style={[s.sheet, sheetStyle]}>
            <GestureDetector gesture={handleGesture}>
              <View style={s.handleWrap}>
                <View style={s.handle} />
              </View>
            </GestureDetector>
            <View style={s.header}>
              <Text style={s.title}>Ny regel</Text>
              <TouchableOpacity onPress={dismiss} style={s.closeBtn}>
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>NAMN</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="t.ex. Kall dusch varje morgon"
              placeholderTextColor="#4A4A50"
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <Text style={[s.fieldLabel, { marginTop: 18 }]}>IKON</Text>
            <ScrollView
              style={s.iconScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={s.iconGrid}>
                {ICON_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.icon}
                    style={[s.iconBtn, icon === opt.icon && s.iconBtnActive]}
                    onPress={() => {
                      Haptics.selectionAsync()
                      setIcon(opt.icon)
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={opt.icon} size={20} color={icon === opt.icon ? CUSTOM : '#4A4A50'} />
                    <Text style={[s.iconLabel, icon === opt.icon && s.iconLabelActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[s.saveBtn, !name.trim() && s.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!name.trim() || saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={s.saveBtnText}>Spara regel</Text>
              }
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: CARD_BG, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 44, paddingTop: 12,
    // Krymp hellre än att tryckas upp bakom Dynamic Island när tangentbordet öppnas
    flexShrink: 1,
  },
  handleWrap: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 6, marginTop: -6 },
  handle: {
    width: 40, height: 4, backgroundColor: CARD_BORDER, borderRadius: 2,
    alignSelf: 'center', marginBottom: 18,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22,
  },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#1E1E21', alignItems: 'center', justifyContent: 'center',
  },
  fieldLabel: {
    color: '#3A3A40', fontSize: 10, fontWeight: '700', letterSpacing: 1.4, marginBottom: 8,
  },
  input: {
    backgroundColor: '#0F0F11', borderRadius: 14,
    borderWidth: 1, borderColor: CARD_BORDER,
    color: '#FFFFFF', fontSize: 16,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  iconScroll: { flexGrow: 0, flexShrink: 1 },
  iconGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconBtn: {
    flexDirection: 'column', alignItems: 'center', gap: 4,
    backgroundColor: '#0F0F11', borderRadius: 12,
    borderWidth: 1, borderColor: CARD_BORDER,
    paddingHorizontal: 10, paddingVertical: 10, minWidth: 60,
  },
  // Tintad markering i regelfärgen — samma stil som ikonboxarna på korten
  iconBtnActive:   { backgroundColor: CUSTOM + '1C', borderColor: CUSTOM },
  iconLabel:       { color: '#4A4A50', fontSize: 10, fontWeight: '500' },
  iconLabelActive: { color: CUSTOM, fontWeight: '700' },
  saveBtn: {
    backgroundColor: ORANGE, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginTop: 24,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
})
