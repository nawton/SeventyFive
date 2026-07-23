import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { router } from 'expo-router'
import { GlassCircleButton } from '@/components/GlassButton'
import { BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

// =============================================================================
// INTEGRITETSPOLICY, nås från Allmänt. Texten beskriver vad appen faktiskt
// gör, inget annat: uppdatera den när datahanteringen ändras. Samma text
// ska publiceras på en publik URL inför App Store-inlämningen.
// =============================================================================

const UPDATED = '23 juli 2026'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={s.p}>{children}</Text>
}

export default function PrivacyPolicyScreen() {
  return (
    <SafeScreen style={s.screen}>
      <View style={s.header}>
        <GlassCircleButton icon="chevron-back" size={40} iconColor={TEXT_PRIMARY}
          onPress={() => router.back()} fallbackStyle={s.iconFallback} />
        <Text style={s.headerTitle}>Integritetspolicy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.updated}>Senast uppdaterad: {UPDATED}</Text>

        <Section title="Vem ansvarar för dina uppgifter">
          <P>
            SeventyFive drivs av Nawton. Har du frågor om den här policyn eller
            om dina uppgifter kan du kontakta oss på anton.wretenberg04@outlook.com.
          </P>
        </Section>

        <Section title="Vilka uppgifter vi samlar in">
          <P>
            Konto: e-postadress, namn och lösenord. Inloggningen hanteras av
            vår databasleverantör Supabase, vi ser aldrig ditt lösenord i klartext.
          </P>
          <P>
            Profil: profilbild samt frivilliga uppgifter som kön, vikt och längd.
            Vikt och längd används enbart för att beräkna kaloriförbrukning.
          </P>
          <P>
            Tränings- och hälsodata: dina loggade pass med distans, tid, tempo,
            kalorier och GPS-rutter, dina dagliga uppgifter i utmaningen
            (träning, vatten, kost, läsning) och dina framstegsfoton.
          </P>
          <P>
            Socialt innehåll: följrelationer, grupper du är med i, inlägg,
            kommentarer, gillanden, direktmeddelanden, blockeringar och
            anmälningar du skickar.
          </P>
          <P>
            Tekniskt: en pushnotis-token per enhet (om du tillåter notiser)
            och anonymiserade kraschrapporter så vi kan laga buggar.
          </P>
        </Section>

        <Section title="Hur uppgifterna används">
          <P>
            Enbart för att leverera appens funktioner: spara din träning, driva
            utmaningen, visa det du valt att dela för dina vänner och grupper,
            och skicka notiser du bett om. Vi säljer aldrig dina uppgifter och
            visar ingen reklam.
          </P>
        </Section>

        <Section title="Vad andra användare ser">
          <P>
            Du styr synligheten själv. Med privat konto ser bara godkända
            följare din statistik. Kartsynligheten låter dig dölja rutter helt
            eller dölja start och slut nära hemmet. Går du med i en grupp visas
            dina pass i just den gruppens flöde.
          </P>
          <P>
            Dina framstegsfoton är alltid privata och visas aldrig för någon
            annan. Bilder du själv lägger i inlägg och meddelanden lagras med
            ogissbara länkar och visas för mottagarna.
          </P>
        </Section>

        <Section title="Platsdata">
          <P>
            GPS används bara under pass du själv startar, för att rita din rutt
            och räkna distans. Rutten sparas som en del av passet och omfattas
            av dina synlighetsinställningar.
          </P>
        </Section>

        <Section title="Tjänsteleverantörer">
          <P>
            Supabase lagrar databasen, filerna och kontona. Expo och Apple
            levererar pushnotiser. Betalningar för premium hanteras av Stripe,
            dina kortuppgifter når aldrig oss. Kraschrapportering sker via
            Sentry. Leverantörerna behandlar bara uppgifterna för vår räkning.
          </P>
        </Section>

        <Section title="Lagring och radering">
          <P>
            Uppgifterna sparas så länge du har ett konto. Raderar du kontot
            (Allmänt, Radera konto) tas dina uppgifter bort permanent. Grupper
            du skapat överlåts till gruppens äldsta medlem, eller raderas om
            gruppen är tom.
          </P>
        </Section>

        <Section title="Dina rättigheter">
          <P>
            Enligt GDPR har du rätt att få tillgång till, rätta och radera dina
            uppgifter, samt att invända mot behandling. Kontakta oss så hjälper
            vi dig. Du kan också klaga hos Integritetsskyddsmyndigheten (IMY).
          </P>
        </Section>

        <Section title="Ålder">
          <P>
            Appen riktar sig inte till barn under 13 år, och vi samlar inte
            medvetet in uppgifter om barn.
          </P>
        </Section>

        <Section title="Ändringar">
          <P>
            Om policyn ändras uppdaterar vi den här sidan och datumet högst upp.
            Vid större ändringar informerar vi i appen.
          </P>
        </Section>
      </ScrollView>
    </SafeScreen>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  iconFallback: { backgroundColor: CARD },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },
  updated: { color: TEXT_SECONDARY, fontSize: 13, marginBottom: 6 },
  section: { marginTop: 20 },
  sectionTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '800', marginBottom: 8 },
  p: { color: TEXT_PRIMARY, fontSize: 15, lineHeight: 23, marginBottom: 10, opacity: 0.92 },
})
