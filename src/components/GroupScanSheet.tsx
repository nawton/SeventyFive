import { useRef, useState } from 'react'
import { Modal, View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import * as Haptics from 'expo-haptics'
import { SafeScreen } from '@/components/SafeScreen'
import { GlassCircleButton } from '@/components/GlassButton'
import { Ionicons } from '@/components/Icon'
import { parseGroupQr } from '@/lib/groupQr'
import { getGroup, type Group } from '@/services/groups'
import { BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, useThemeStrings } from '@/lib/theme'

// =============================================================================
// SKANNA GRUPPENS QR-KOD. Kameramodulen laddas mjukt: saknas den i den
// installerade appversionen (kräver ny byggnation) visas ett ärligt
// besked i stället för en krasch.
// =============================================================================

let CameraView: React.ComponentType<Record<string, unknown>> | null = null
let useCameraPermissions: (() => [{ granted: boolean } | null, () => Promise<unknown>]) | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cam = require('expo-camera')
  CameraView = cam.CameraView
  useCameraPermissions = cam.useCameraPermissions
} catch { /* modulen finns inte i den här byggnationen */ }

export function GroupScanSheet({ visible, onClose, onFound }: {
  visible: boolean
  onClose: () => void
  onFound: (group: Group) => void
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {CameraView && useCameraPermissions
        ? <ScannerInner onClose={onClose} onFound={onFound} />
        : (
          <SafeScreen style={s.screen}>
            <Header onClose={onClose} />
            <View style={s.center}>
              <Ionicons name="camera-outline" size={44} color={TEXT_PRIMARY} />
              <Text style={s.fallbackTitle}>Kameran är inte tillgänglig</Text>
              <Text style={s.fallbackBody}>
                Den här appversionen saknar kameramodulen, installera den senaste
                byggnationen för att skanna QR-koder.
              </Text>
            </View>
          </SafeScreen>
        )}
    </Modal>
  )
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <View style={s.header}>
      <Text style={s.headerTitle}>Skanna QR-kod</Text>
      <GlassCircleButton icon="close" size={40} iconColor={TEXT_PRIMARY}
        onPress={onClose} fallbackStyle={s.iconFallback} />
    </View>
  )
}

function ScannerInner({ onClose, onFound }: {
  onClose: () => void
  onFound: (group: Group) => void
}) {
  const T = useThemeStrings()
  const light = T.TEXT_PRIMARY !== '#FFFFFF'
  const [permission, requestPermission] = useCameraPermissions!()
  const busy = useRef(false)
  const [checking, setChecking] = useState(false)

  async function handleScan(data: string) {
    if (busy.current) return
    const groupId = parseGroupQr(data)
    if (!groupId) return
    busy.current = true
    setChecking(true)
    Haptics.selectionAsync()
    const group = await getGroup(groupId).catch(() => null)
    setChecking(false)
    if (group) {
      onFound(group)
    } else {
      Alert.alert('Ingen grupp hittades', 'Koden pekar inte på någon grupp som finns kvar.', [
        { text: 'OK', onPress: () => { busy.current = false } },
      ])
    }
  }

  if (!permission?.granted) {
    return (
      <SafeScreen style={s.screen}>
        <Header onClose={onClose} />
        <View style={s.center}>
          <Ionicons name="camera-outline" size={44} color={TEXT_PRIMARY} />
          <Text style={s.fallbackTitle}>Kameran behöver åtkomst</Text>
          <Text style={s.fallbackBody}>
            Ge appen tillgång till kameran för att skanna en grupps QR-kod.
          </Text>
          <TouchableOpacity style={[s.permBtn, { backgroundColor: T.ACCENT }]}
            onPress={() => requestPermission()} activeOpacity={0.85} testID="scanPermission">
            <Text style={[s.permBtnText, { color: light ? '#FFFFFF' : '#000000' }]}>Ge kameraåtkomst</Text>
          </TouchableOpacity>
        </View>
      </SafeScreen>
    )
  }

  const Camera = CameraView!
  return (
    <View style={s.cameraWrap}>
      <Camera
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }: { data: string }) => { handleScan(String(data)) }}
      />
      {/* Sikte + rubrik ovanpå kameran — alltid ljus text mot kamerabilden */}
      <SafeScreen style={s.overlay}>
        <View style={s.header}>
          <Text style={[s.headerTitle, { color: '#FFFFFF' }]}>Skanna QR-kod</Text>
          <GlassCircleButton icon="close" size={40} iconColor="#FFFFFF"
            onPress={onClose} fallbackStyle={s.iconFallbackDark} />
        </View>
        <View style={s.frameArea}>
          <View style={s.frame} />
          <Text style={s.hint}>
            {checking ? 'Hämtar gruppen …' : 'Rikta kameran mot en grupps QR-kod'}
          </Text>
        </View>
      </SafeScreen>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  iconFallback: { backgroundColor: CARD },
  iconFallbackDark: { backgroundColor: 'rgba(0,0,0,0.45)' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  fallbackTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700', marginTop: 6 },
  fallbackBody: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  permBtn: { borderRadius: 999, paddingHorizontal: 24, paddingVertical: 13, marginTop: 12 },
  permBtnText: { fontSize: 15, fontWeight: '700' },

  frameArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  frame: {
    width: 230, height: 230, borderRadius: 24,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)',
  },
  hint: {
    color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 7, overflow: 'hidden',
  },
})
