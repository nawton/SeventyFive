import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import { scheduleDailyReminders, cancelDailyReminders, areRemindersActive } from '@/services/notifications'
import Constants from 'expo-constants'
import { supabase } from '@/lib/supabase'

const IS_EXPO_GO = Constants.appOwnership === 'expo'
import { getActiveChallenge, calculateCurrentDay } from '@/services/challenge'
import { getProfile } from '@/services/profile'
import { deleteRepeatingSessions } from '@/services/workoutSchedule'
import { generateScheduleFromWizard } from '@/services/scheduleGenerator'
import { ScheduleWizard } from '@/components/ScheduleWizard'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { GlassView } from 'expo-glass-effect'
import { LIQUID_GLASS } from '@/lib/glass'
import { ORANGE, RED, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

// Glaset måste animeras direkt på den nativa vyn för att linsen ska följa med
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView)
import { getUnitSystem, setUnitSystem, type UnitSystem } from '@/lib/units'
import { getTabBarShrinkEnabled, setTabBarShrinkEnabled } from '@/lib/tabBar'

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  )
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
  rightElement,
  danger,
  last,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  value?: string
  onPress?: () => void
  rightElement?: React.ReactNode
  danger?: boolean
  last?: boolean
}) {
  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress && !rightElement}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={danger ? RED : TEXT_SECONDARY} />
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        {rightElement}
        {onPress && !rightElement && (
          <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
        )}
      </View>
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [email, setEmail]           = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl]   = useState<string | null>(null)
  const [levelName, setLevelName]   = useState('')
  const [currentDay, setCurrentDay] = useState(1)
  const [startDate, setStartDate]   = useState('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [loading, setLoading]       = useState(true)
  const [userId, setUserId]         = useState<string | null>(null)
  const [wizardVisible, setWizardVisible] = useState(false)
  const [unit, setUnit]             = useState<UnitSystem>('metric')
  const [segW, setSegW]             = useState(0)
  const [navShrink, setNavShrink]   = useState(false)

  // Animerad tumme i enhetsväljaren — fjädrar mellan lägena
  const segPos = useSharedValue(0)
  useEffect(() => {
    segPos.value = withSpring(unit === 'imperial' ? 1 : 0, { damping: 17, stiffness: 240, mass: 0.8 })
  }, [unit])
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: segPos.value * (segW / 2) }],
  }))

  function chooseUnit(u: UnitSystem) {
    if (u === unit) return
    Haptics.selectionAsync()
    setUnit(u)
    setUnitSystem(u).catch(() => {})
  }

  async function loadSettings() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const userEmail = session.user.email ?? ''
      setEmail(userEmail)
      setUserId(session.user.id)

      const profile = await getProfile(session.user.id)
      setDisplayName(profile?.name ?? userEmail.split('@')[0] ?? '')
      setAvatarUrl(profile?.avatar_url ?? null)

      setUnit(await getUnitSystem())
      setNavShrink(await getTabBarShrinkEnabled())

      const challenge = await getActiveChallenge(session.user.id)
      if (challenge) {
        setCurrentDay(calculateCurrentDay(challenge.start_date))
        setLevelName(challenge.challenge_levels?.display_name ?? '')
        setStartDate(formatDate(challenge.start_date))
      }

      // expo-notifications fungerar inte i Expo Go (SDK 53+)
      if (!IS_EXPO_GO) {
        try {
          setNotificationsEnabled(await areRemindersActive())
        } catch { /* ignore in unsupported envs */ }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSettings() }, [])

  // Ladda om profil när man kommer tillbaka från edit-profile
  useFocusEffect(useCallback(() => {
    if (!loading) loadSettings()
  }, [loading]))

  async function handleNotificationToggle(value: boolean) {
    if (IS_EXPO_GO) {
      Alert.alert('Kräver development build', 'Push-notiser fungerar inte i Expo Go. Bygg appen med expo-dev-client för att aktivera notiser.')
      return
    }
    try {
      if (value) {
        const { status } = await Notifications.requestPermissionsAsync()
        if (status !== 'granted') {
          setNotificationsEnabled(false)
          Alert.alert('Notiser blockerade', 'Gå till Inställningar → SeventyFive och aktivera notiser manuellt.')
          return
        }
        await scheduleDailyReminders()
        setNotificationsEnabled(true)
      } else {
        await cancelDailyReminders()
        setNotificationsEnabled(false)
      }
    } catch {
      Alert.alert('Något gick fel', 'Kunde inte ändra notisinställningen.')
    }
  }

  async function handleLogout() {
    Alert.alert(
      'Logga ut',
      'Är du säker på att du vill logga ut? Din data sparas.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Logga ut',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut()
            router.replace('/(auth)/welcome')
          },
        },
      ]
    )
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Radera konto',
      'All din data — utmaningar, träningspass, foton och profil — raderas permanent. Det går inte att ångra.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Radera mitt konto',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ]
    )
  }

  async function confirmDeleteAccount() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (uid) {
        // Radera storage-filer best-effort
        await Promise.allSettled([
          supabase.storage.from('progress-photos').list(uid).then(({ data }) =>
            data?.length
              ? supabase.storage.from('progress-photos').remove(data.map(f => `${uid}/${f.name}`))
              : null
          ),
          supabase.storage.from('avatars').list(uid).then(({ data }) =>
            data?.length
              ? supabase.storage.from('avatars').remove(data.map(f => `${uid}/${f.name}`))
              : null
          ),
        ])
      }
      const { error } = await supabase.rpc('delete_user_account')
      if (error) throw error
      await supabase.auth.signOut()
      router.replace('/(auth)/welcome')
    } catch (e: any) {
      Alert.alert('Kunde inte radera kontot', e.message ?? 'Kontrollera anslutningen och försök igen.')
    }
  }

  function handleWizardFinish(result: Parameters<typeof generateScheduleFromWizard>[1]) {
    setWizardVisible(false)
    if (!userId) return
    Alert.alert(
      'Ersätt ditt schema?',
      'Vill du ersätta dina nuvarande upprepande pass med det nya schemat, eller behålla båda?',
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Behåll båda', onPress: () => applyNewSchedule(result, false) },
        { text: 'Ersätt', style: 'destructive', onPress: () => applyNewSchedule(result, true) },
      ]
    )
  }

  async function applyNewSchedule(result: Parameters<typeof generateScheduleFromWizard>[1], replace: boolean) {
    if (!userId) return
    try {
      if (replace) await deleteRepeatingSessions(userId)
      const count = await generateScheduleFromWizard(userId, result)
      Alert.alert('Schema uppdaterat', `${count} pass har lagts in i ditt veckoschema.`)
    } catch (e: any) {
      Alert.alert('Kunde inte skapa schemat', e.message)
    }
  }

  function handleResetSchedule() {
    if (!userId) return
    Alert.alert(
      'Nollställ träningsschema',
      'Alla upprepande pass tas bort och du kan börja om från början med schemaguiden. Loggade pass och historik påverkas inte.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Nollställ',
          style: 'destructive',
          onPress: async () => {
            try {
              const count = await deleteRepeatingSessions(userId)
              // Visa "Skapa ditt schema"-bannern på schemasidan igen
              await AsyncStorage.removeItem('wizardBannerDismissed').catch(() => {})
              Alert.alert(
                'Schema nollställt',
                `${count} pass togs bort. Vill du skapa ett nytt schema direkt?`,
                [
                  { text: 'Inte nu', style: 'cancel' },
                  { text: 'Skapa nytt schema', onPress: () => setWizardVisible(true) },
                ]
              )
            } catch {
              Alert.alert('Kunde inte nollställa', 'Kontrollera din anslutning och försök igen.')
            }
          },
        },
      ]
    )
  }

  const initials = (displayName || email.split('@')[0] || '?')[0].toUpperCase()

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ORANGE} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.title}>Inställningar</Text>
        </View>

        {/* Profile */}
        <Section title="Profil">
          <TouchableOpacity
            style={styles.profileRow}
            onPress={() => router.push('/(app)/edit-profile')}
            activeOpacity={0.7}
          >
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarPlaceholder}>
                {avatarUrl?.startsWith('http') ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarPhoto} />
                ) : avatarUrl ? (
                  <Text style={styles.avatarEmoji}>{avatarUrl}</Text>
                ) : (
                  <Text style={styles.avatarText}>{initials}</Text>
                )}
              </View>
              <View style={styles.avatarEditDot}>
                <Ionicons name="pencil" size={9} color="#000" />
              </View>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName || 'Lägg till namn'}</Text>
              <Text style={styles.profileEmail}>{email}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={TEXT_SECONDARY} />
          </TouchableOpacity>
        </Section>

        {/* Challenge */}
        {levelName ? (
          <Section title="Aktiv utmaning">
            <SettingRow icon="trophy-outline"  label="Nivå"       value={levelName} />
            <SettingRow icon="calendar-outline" label="Startdatum" value={startDate} />
            <SettingRow icon="flag-outline"     label="Dag"        value={`${currentDay} av 75`} last />
          </Section>
        ) : null}

        {/* Schema */}
        <Section title="Schema">
          <SettingRow
            icon="time-outline"
            label="Ditt dagsschema"
            onPress={() => router.push('/(auth)/schedule?from=settings' as any)}
          />
          <SettingRow
            icon="create-outline"
            label="Ändra träningsschema"
            onPress={() => setWizardVisible(true)}
          />
          <SettingRow
            icon="refresh-outline"
            label="Nollställ träningsschema"
            onPress={handleResetSchedule}
            last
          />
        </Section>

        {/* Träning */}
        <Section title="Träning">
          <View style={styles.unitBlock}>
            <View style={styles.rowLeft}>
              <Ionicons name="speedometer-outline" size={20} color={TEXT_SECONDARY} />
              <Text style={styles.rowLabel}>Enheter</Text>
            </View>
            <View
              style={styles.segTrack}
              onLayout={e => setSegW(e.nativeEvent.layout.width - 6)}
            >
              {segW > 0 && (LIQUID_GLASS ? (
                // Liquid glass-tumme med orange ton som glider mellan lägena
                <AnimatedGlassView
                  glassEffectStyle="regular"
                  tintColor={ORANGE}
                  style={[styles.segThumb, styles.segThumbGlass, { width: segW / 2 }, thumbStyle]}
                />
              ) : (
                <Animated.View style={[styles.segThumb, { width: segW / 2 }, thumbStyle]} />
              ))}
              {([
                { key: 'metric',   label: 'Kilometer' },
                { key: 'imperial', label: 'Miles' },
              ] as const).map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={styles.segBtn}
                  onPress={() => chooseUnit(key)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.segText,
                    unit === key && (LIQUID_GLASS ? styles.segTextActiveGlass : styles.segTextActive),
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.unitHint}>
              Distans och tempo visas i {unit === 'metric' ? 'kilometer' : 'miles'} i hela appen
            </Text>
          </View>
        </Section>

        {/* Anpassning */}
        <Section title="Anpassning">
          <SettingRow
            icon="resize-outline"
            label="Minimera navbaren vid scroll"
            last
            rightElement={
              <Switch
                value={navShrink}
                onValueChange={v => { setNavShrink(v); setTabBarShrinkEnabled(v) }}
                trackColor={{ false: BORDER, true: ORANGE }}
                thumbColor="#fff"
              />
            }
          />
        </Section>

        {/* Notifications */}
        <Section title="Notiser">
          <SettingRow
            icon="notifications-outline"
            label="Push-notiser"
            value={IS_EXPO_GO ? 'Kräver dev build' : undefined}
            last
            rightElement={
              IS_EXPO_GO ? undefined : (
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleNotificationToggle}
                  trackColor={{ false: BORDER, true: ORANGE }}
                  thumbColor="#fff"
                />
              )
            }
            onPress={IS_EXPO_GO ? handleNotificationToggle.bind(null, false) : undefined}
          />
        </Section>

        {/* App */}
        <Section title="App">
          <SettingRow icon="information-circle-outline" label="Version" value="1.0.0" />
          <SettingRow icon="lock-closed-outline" label="Integritetspolicy" onPress={() => {}} last />
        </Section>

        {/* Konto */}
        <Section title="Konto">
          <SettingRow
            icon="log-out-outline"
            label="Logga ut"
            onPress={handleLogout}
            danger
          />
          <SettingRow
            icon="trash-outline"
            label="Radera konto"
            onPress={handleDeleteAccount}
            danger
            last
          />
        </Section>

      </ScrollView>

      <ScheduleWizard
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        onFinish={handleWizardFinish}
      />
    </SafeAreaView>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('sv-SE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: '700',
  },
  section: { gap: 8 },
  sectionTitle: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },

  // Profile card
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarText: {
    color: '#000',
    fontSize: 22,
    fontWeight: '700',
  },
  avatarEmoji: {
    fontSize: 26,
  },
  avatarEditDot: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: CARD,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: '600',
  },
  profileEmail: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },

  // Setting row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    color: TEXT_PRIMARY,
    fontSize: 15,
  },
  rowLabelDanger: { color: RED },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },

  // Enhetsväljare (km/miles) — segmenterad kontroll med glidande tumme
  unitBlock: {
    padding: 16,
    gap: 12,
  },
  segTrack: {
    flexDirection: 'row',
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 3,
  },
  segThumb: {
    position: 'absolute',
    left: 3,
    top: 3,
    bottom: 3,
    borderRadius: 11,
    backgroundColor: ORANGE,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  segBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '600',
  },
  segTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  segThumbGlass: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
    shadowOpacity: 0,
  },
  segTextActiveGlass: {
    color: '#fff',
    fontWeight: '700',
  },
  unitHint: {
    color: TEXT_SECONDARY,
    fontSize: 12,
  },
})
