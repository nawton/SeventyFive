import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, Switch, ScrollView, StyleSheet, Alert, useColorScheme,
} from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router } from 'expo-router'
import { Ionicons } from '@/components/Icon'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { scheduleDailyReminders, cancelDailyReminders, areRemindersActive } from '@/services/notifications'
import { registerPushToken } from '@/services/pushTokens'
import { getActiveChallenge, calculateCurrentDay, levelDisplayName, changeLevel } from '@/services/challenge'
import { deleteRepeatingSessions } from '@/services/workoutSchedule'
import { generateScheduleFromWizard } from '@/services/scheduleGenerator'
import { ScheduleWizard } from '@/components/ScheduleWizard'
import { GlassCircleButton } from '@/components/GlassButton'
import { RED, BG, CARD, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT, useCardChrome } from '@/lib/theme'
import type { UserChallengeWithLevel } from '@/types/database'
import { getLanguage, setLanguage, useT, dateLocale, type AppLanguage } from '@/lib/i18n'
import { useBodyGender, setBodyGender } from '@/lib/bodyGender'

const IS_EXPO_GO = Constants.appOwnership === 'expo'

// =============================================================================
// ALLMÄNT — de generella inställningarna, nås från Profilinställningar.
// Schema, anpassning, notiser, appinfo och Radera konto. Hela gamla
// Inställningar-sidan är utflyttad hit och till Profilinställningar;
// ikonerna hålls neutralt grå — inga orange accenter här.
// =============================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  // Mörk ram / ljus skugga — strängar per schema (dynamiska border-färger
  // fryser fel på iOS när fönstertraits växlar)
  const chrome = useCardChrome()
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[styles.sectionCard, chrome]}>{children}</View>
    </View>
  )
}

function SettingRow({ icon, label, sub, value, onPress, rightElement, danger, last }: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  /** Kort förklaring under etiketten — vad raden faktiskt gör */
  sub?: string
  value?: string
  onPress?: () => void
  rightElement?: React.ReactNode
  danger?: boolean
  last?: boolean
}) {
  // Radavdelare som schemasträng: mycket ljus i ljust läge (BORDER var
  // för stark där), vanlig i mörkt — och kan inte frysa vid temabyte
  const divider = useColorScheme() === 'light' ? 'rgba(0,0,0,0.05)' : '#2C2C2E'
  return (
    <TouchableOpacity
      style={[styles.row, !last && [styles.rowBorder, { borderBottomColor: divider }]]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress && !rightElement}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={danger ? RED : TEXT_SECONDARY} />
        <View style={styles.rowTextWrap}>
          <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
          {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
        </View>
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

export default function GeneralScreen() {
  const t = useT()
  const [levelName, setLevelName]   = useState('')
  const [currentDay, setCurrentDay] = useState(1)
  const [startDate, setStartDate]   = useState('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [userId, setUserId]         = useState<string | null>(null)
  const [challenge, setChallenge]   = useState<UserChallengeWithLevel | null>(null)
  const [language, setLanguageState] = useState<AppLanguage>(getLanguage())
  const bodyGender = useBodyGender()
  const [wizardVisible, setWizardVisible] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      setUserId(session.user.id)
      const challenge = await getActiveChallenge(session.user.id).catch(() => null)
      if (challenge) {
        setChallenge(challenge)
        setCurrentDay(calculateCurrentDay(challenge.start_date))
        setLevelName(levelDisplayName(challenge))
        setStartDate(formatDate(challenge.start_date))
      }
      // expo-notifications fungerar inte i Expo Go (SDK 53+)
      if (!IS_EXPO_GO) {
        try {
          setNotificationsEnabled(await areRemindersActive())
        } catch { /* ignore in unsupported envs */ }
      }
    }
    load()
  }, [])

  async function handleNotificationToggle(value: boolean) {
    if (IS_EXPO_GO) {
      Alert.alert(t('Kräver development build'), t('Push-notiser fungerar inte i Expo Go. Bygg appen med expo-dev-client för att aktivera notiser.'))
      return
    }
    try {
      if (value) {
        const { status } = await Notifications.requestPermissionsAsync()
        if (status !== 'granted') {
          setNotificationsEnabled(false)
          Alert.alert(t('Notiser blockerade'), t('Gå till Inställningar → SeventyFive och aktivera notiser manuellt.'))
          return
        }
        await scheduleDailyReminders()
        setNotificationsEnabled(true)
        // Nyss beviljad rättighet → registrera enhetens pushtoken direkt
        registerPushToken()
      } else {
        await cancelDailyReminders()
        setNotificationsEnabled(false)
      }
    } catch {
      Alert.alert(t('Något gick fel'), t('Kunde inte ändra notisinställningen.'))
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      t('Radera konto'),
      t('All din data (utmaningar, träningspass, foton och profil) raderas permanent. Det går inte att ångra.'),
      [
        { text: t('Avbryt'), style: 'cancel' },
        { text: t('Radera mitt konto'), style: 'destructive', onPress: confirmDeleteAccount },
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
      Alert.alert(t('Kunde inte radera kontot'), e.message ?? t('Kontrollera anslutningen och försök igen.'))
    }
  }

  function handleWizardFinish(result: Parameters<typeof generateScheduleFromWizard>[1]) {
    setWizardVisible(false)
    if (!userId) return
    Alert.alert(
      t('Ersätt ditt schema?'),
      t('Vill du ersätta dina nuvarande upprepande pass med det nya schemat, eller behålla båda?'),
      [
        { text: t('Avbryt'), style: 'cancel' },
        { text: t('Behåll båda'), onPress: () => applyNewSchedule(result, false) },
        { text: t('Ersätt'), style: 'destructive', onPress: () => applyNewSchedule(result, true) },
      ]
    )
  }

  async function applyNewSchedule(result: Parameters<typeof generateScheduleFromWizard>[1], replace: boolean) {
    if (!userId) return
    try {
      if (replace) await deleteRepeatingSessions(userId)
      const count = await generateScheduleFromWizard(userId, result)
      Alert.alert(t('Schema uppdaterat'), t('{count} pass har lagts in i ditt veckoschema.', { count }))
    } catch (e: any) {
      Alert.alert(t('Kunde inte skapa schemat'), e.message)
    }
  }

  // Nivåbyte: tillåts EN gång per utmaning. Allt man gjort behålls,
  // de nya reglerna seedas från nästa dags uppgifter.
  function handleChangeLevel() {
    if (!challenge) return
    if (challenge.level_changed_at) {
      Alert.alert(t('Nivån är redan ändrad'), t('Nivån kan bara ändras en gång per utmaning.'))
      return
    }
    const currentSlug = challenge.challenge_levels?.slug
    const options = (['normal', 'hard', 'extreme'] as const)
      .filter(slug => slug !== currentSlug)
      .map(slug => ({
        text: slug.charAt(0).toUpperCase() + slug.slice(1),
        onPress: () => confirmChangeLevel(slug),
      }))
    Alert.alert(
      t('Byt nivå'),
      t('Du kan bara byta nivå en gång under utmaningen. Allt du gjort hittills behålls, de nya reglerna gäller från och med imorgon.'),
      [{ text: t('Avbryt'), style: 'cancel' as const }, ...options],
    )
  }

  function confirmChangeLevel(slug: 'normal' | 'hard' | 'extreme') {
    const name = slug.charAt(0).toUpperCase() + slug.slice(1)
    Alert.alert(
      t('Byta till {name}?', { name }),
      t('Det här går inte att ångra, nivån kan inte bytas igen under den här utmaningen.'),
      [
        { text: t('Avbryt'), style: 'cancel' },
        {
          text: t('Byt till {name}', { name }),
          style: 'destructive',
          onPress: async () => {
            if (!challenge) return
            try {
              await changeLevel(challenge, slug)
              const updated = await getActiveChallenge(challenge.user_id).catch(() => null)
              if (updated) {
                setChallenge(updated)
                setLevelName(levelDisplayName(updated))
              }
              Alert.alert(t('Nivå ändrad'), t('Du kör nu {name}. De nya reglerna dyker upp med morgondagens uppgifter.', { name }))
            } catch (e: any) {
              Alert.alert(t('Kunde inte byta nivå'), e.message ?? t('Försök igen.'))
            }
          },
        },
      ],
    )
  }

  function handleBodyGenderPress() {
    Alert.alert(t('Kroppsmodell'), t('Välj vilken figur muskelvyerna visar.'), [
      { text: t('Avbryt'), style: 'cancel' },
      { text: t('Man'), onPress: () => setBodyGender('male') },
      { text: t('Kvinna'), onPress: () => setBodyGender('female') },
    ])
  }

  function handleLanguagePress() {
    Alert.alert(t('Språk'), t('Välj appens språk.'), [
      { text: t('Avbryt'), style: 'cancel' },
      { text: t('Svenska'), onPress: () => { setLanguage('sv'); setLanguageState('sv') } },
      { text: 'English', onPress: () => { setLanguage('en'); setLanguageState('en') } },
    ])
  }

  function handleResetSchedule() {
    if (!userId) return
    Alert.alert(
      t('Nollställ träningsschema'),
      t('Alla upprepande pass tas bort och du kan börja om från början med schemaguiden. Loggade pass och historik påverkas inte.'),
      [
        { text: t('Avbryt'), style: 'cancel' },
        {
          text: t('Nollställ'),
          style: 'destructive',
          onPress: async () => {
            try {
              const count = await deleteRepeatingSessions(userId)
              // Visa schemaintrot på schemasidan igen, även om det tystats
              await AsyncStorage.removeItem('scheduleIntroNeverShow').catch(() => {})
              Alert.alert(
                t('Schema nollställt'),
                t('{count} pass togs bort. Vill du skapa ett nytt schema direkt?', { count }),
                [
                  { text: t('Inte nu'), style: 'cancel' },
                  { text: t('Skapa nytt schema'), onPress: () => setWizardVisible(true) },
                ]
              )
            } catch {
              Alert.alert(t('Kunde inte nollställa'), t('Kontrollera din anslutning och försök igen.'))
            }
          },
        },
      ]
    )
  }

  return (
    <SafeScreen style={styles.screen}>
      <View style={styles.header}>
        <GlassCircleButton
          icon="chevron-back"
          size={40}
          iconColor={TEXT_PRIMARY}
          onPress={() => router.back()}
          fallbackStyle={styles.iconBtnFallback}
        />
        <Text style={styles.title}>{t('Allmänt')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {levelName ? (
          <Section title={t('Aktiv utmaning')}>
            <SettingRow icon="trophy-outline"   label={t('Nivå')}       value={levelName} />
            <SettingRow icon="calendar-outline" label={t('Startdatum')} value={startDate} />
            <SettingRow icon="flag-outline"     label={t('Dag')}        value={t('{n} av 75', { n: currentDay })} />
            <SettingRow
              icon="swap-vertical-outline"
              label={t('Byt nivå')}
              sub={challenge?.level_changed_at
                ? t('Nivån har redan ändrats en gång')
                : t('Kan bara göras en gång per utmaning')}
              onPress={challenge?.level_changed_at ? undefined : handleChangeLevel}
              last
            />
          </Section>
        ) : null}

        <Section title={t('Träningsschema')}>
          <SettingRow
            icon="calendar-outline"
            label={t('Hantera veckoschemat')}
            sub={t('Se, ändra och ta bort veckans pass')}
            onPress={() => router.push('/(app)/manage-sessions' as never)}
          />
          <SettingRow
            icon="color-wand-outline"
            label={t('Skapa nytt schema')}
            sub={t('Schemaguiden bygger veckan åt dig')}
            onPress={() => setWizardVisible(true)}
          />
          <SettingRow
            icon="refresh-outline"
            label={t('Nollställ schemat')}
            sub={t('Tar bort alla upprepande pass, historiken sparas')}
            onPress={handleResetSchedule}
            last
          />
        </Section>

        <Section title={t('Dagsrutin')}>
          <SettingRow
            icon="time-outline"
            label={t('Dagliga tider')}
            sub={t('Vakentid, måltider och träningstider')}
            onPress={() => router.push('/(auth)/schedule?from=settings' as any)}
            last
          />
        </Section>

        <Section title={t('Anpassning')}>
          <SettingRow
            icon="language-outline"
            label={t('Språk')}
            sub={t('Gäller hela appen direkt')}
            value={language === 'sv' ? t('Svenska') : 'English'}
            onPress={handleLanguagePress}
          />
          <SettingRow
            icon="body-outline"
            label={t('Kroppsmodell')}
            sub={t('Figuren i muskelvyerna')}
            value={bodyGender === 'female' ? t('Kvinna') : t('Man')}
            onPress={handleBodyGenderPress}
            last
          />
        </Section>

        <Section title={t('Integritet')}>
          <SettingRow
            icon="shield-checkmark-outline"
            label={t('Integritetsinställningar')}
            onPress={() => router.push('/(app)/privacy' as any)}
            last
          />
        </Section>

        <Section title={t('Notiser')}>
          <SettingRow
            icon="notifications-outline"
            label={t('Push-notiser')}
            value={IS_EXPO_GO ? t('Kräver dev build') : undefined}
            last
            rightElement={
              IS_EXPO_GO ? undefined : (
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleNotificationToggle}
                  trackColor={{ false: BORDER, true: ACCENT }}
                  thumbColor="#fff"
                />
              )
            }
            onPress={IS_EXPO_GO ? handleNotificationToggle.bind(null, false) : undefined}
          />
        </Section>

        <Section title={t('App')}>
          <SettingRow icon="information-circle-outline" label={t('Version')} value="1.0.0" />
          <SettingRow icon="lock-closed-outline" label={t('Integritetspolicy')}
            onPress={() => router.push('/(app)/privacy-policy' as never)} last />
        </Section>

        <Section title={t('Konto')}>
          <SettingRow
            icon="trash-outline"
            label={t('Radera konto')}
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
    </SafeScreen>
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(dateLocale(), {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

const styles = StyleSheet.create({

  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  iconBtnFallback: { backgroundColor: CARD },
  title: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 24 },

  section: { gap: 8 },
  sectionTitle: {
    color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600',
    letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: CARD, borderRadius: 16,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
  },
  rowBorder: { borderBottomWidth: 1 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 },
  rowTextWrap: { flex: 1 },
  rowLabel: { color: TEXT_PRIMARY, fontSize: 15 },
  rowSub: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2, lineHeight: 16 },
  rowLabelDanger: { color: RED },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowValue: { color: TEXT_SECONDARY, fontSize: 14 },
})
