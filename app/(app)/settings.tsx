import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { getActiveChallenge, calculateCurrentDay } from '@/services/challenge'
import { ORANGE, RED, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

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
  const [email, setEmail] = useState('')
  const [levelName, setLevelName] = useState('')
  const [currentDay, setCurrentDay] = useState(1)
  const [startDate, setStartDate] = useState('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      setEmail(session.user.email ?? '')

      const challenge = await getActiveChallenge(session.user.id)
      if (challenge) {
        setCurrentDay(calculateCurrentDay(challenge.start_date))
        setLevelName(challenge.challenge_levels?.display_name ?? '')
        setStartDate(formatDate(challenge.start_date))
      }
    } finally {
      setLoading(false)
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

  const userName = email.split('@')[0] ?? 'Nawton'

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
        <Text style={styles.title}>Inställningar</Text>

        {/* Profile */}
        <Section title="Profil">
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userName[0]?.toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{userName}</Text>
              <Text style={styles.profileEmail}>{email}</Text>
            </View>
          </View>
        </Section>

        {/* Challenge */}
        {levelName ? (
          <Section title="Aktiv utmaning">
            <SettingRow
              icon="trophy-outline"
              label="Nivå"
              value={levelName}
            />
            <SettingRow
              icon="calendar-outline"
              label="Startdatum"
              value={startDate}
            />
            <SettingRow
              icon="flag-outline"
              label="Dag"
              value={`${currentDay} av 75`}
              last
            />
          </Section>
        ) : null}

        {/* Notifications */}
        <Section title="Notiser">
          <SettingRow
            icon="notifications-outline"
            label="Push-notiser"
            last
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: BORDER, true: ORANGE }}
                thumbColor="#fff"
              />
            }
          />
        </Section>

        {/* App */}
        <Section title="App">
          <SettingRow
            icon="information-circle-outline"
            label="Version"
            value="1.0.0"
          />
          <SettingRow
            icon="lock-closed-outline"
            label="Integritetspolicy"
            onPress={() => {}}
            last
          />
        </Section>

        {/* Logout */}
        <Section title="Konto">
          <SettingRow
            icon="log-out-outline"
            label="Logga ut"
            onPress={handleLogout}
            danger
            last
          />
        </Section>

      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  centered: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 24,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: '700',
  },
  section: {
    gap: 8,
  },
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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#000',
    fontSize: 22,
    fontWeight: '700',
  },
  profileInfo: {
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
  rowLabelDanger: {
    color: RED,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
})
