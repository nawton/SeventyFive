const SECTIONS: Array<{ title: string; paragraphs: string[] }> = [
  {
    title: 'Vem ansvarar för dina uppgifter',
    paragraphs: [
      'SeventyFive drivs av Nawton. Har du frågor om den här policyn eller om dina uppgifter kan du kontakta oss på support@nawton.net.',
    ],
  },
  {
    title: 'Vilka uppgifter vi samlar in',
    paragraphs: [
      'Konto: e-postadress, namn och lösenord. Inloggningen hanteras av vår databasleverantör Supabase, vi ser aldrig ditt lösenord i klartext.',
      'Profil: profilbild samt frivilliga uppgifter som kön, vikt och längd. Vikt och längd används enbart för att beräkna kaloriförbrukning.',
      'Tränings- och hälsodata: dina loggade pass med distans, tid, tempo, kalorier och GPS-rutter, dina dagliga uppgifter i utmaningen (träning, vatten, kost, läsning) och dina framstegsfoton.',
      'Socialt innehåll: följrelationer, grupper du är med i, inlägg, kommentarer, gillanden, direktmeddelanden, blockeringar och anmälningar du skickar.',
      'Tekniskt: en pushnotis-token per enhet (om du tillåter notiser) och anonymiserade kraschrapporter så vi kan laga buggar.',
    ],
  },
  {
    title: 'Hur uppgifterna används',
    paragraphs: [
      'Enbart för att leverera appens funktioner: spara din träning, driva utmaningen, visa det du valt att dela för dina vänner och grupper, och skicka notiser du bett om. Vi säljer aldrig dina uppgifter och visar ingen reklam.',
    ],
  },
  {
    title: 'Vad andra användare ser',
    paragraphs: [
      'Du styr synligheten själv. Med privat konto ser bara godkända följare din statistik. Kartsynligheten låter dig dölja rutter helt eller dölja start och slut nära hemmet. Går du med i en grupp visas dina pass i just den gruppens flöde.',
      'Dina framstegsfoton är alltid privata och visas aldrig för någon annan. Bilder du själv lägger i inlägg och meddelanden lagras med ogissbara länkar och visas för mottagarna.',
    ],
  },
  {
    title: 'Platsdata',
    paragraphs: [
      'GPS används bara under pass du själv startar, för att rita din rutt och räkna distans. Rutten sparas som en del av passet och omfattas av dina synlighetsinställningar.',
    ],
  },
  {
    title: 'Tjänsteleverantörer',
    paragraphs: [
      'Supabase lagrar databasen, filerna och kontona. Expo och Apple levererar pushnotiser. Betalningar för premium hanteras av Stripe, dina kortuppgifter når aldrig oss. Kraschrapportering sker via Sentry. Leverantörerna behandlar bara uppgifterna för vår räkning.',
    ],
  },
  {
    title: 'Lagring och radering',
    paragraphs: [
      'Uppgifterna sparas så länge du har ett konto. Raderar du kontot (Allmänt, Radera konto i appen) tas dina uppgifter bort permanent. Grupper du skapat överlåts till gruppens äldsta medlem, eller raderas om gruppen är tom.',
    ],
  },
  {
    title: 'Dina rättigheter',
    paragraphs: [
      'Enligt GDPR har du rätt att få tillgång till, rätta och radera dina uppgifter, samt att invända mot behandling. Kontakta oss så hjälper vi dig. Du kan också klaga hos Integritetsskyddsmyndigheten (IMY).',
    ],
  },
  {
    title: 'Ålder',
    paragraphs: [
      'Appen riktar sig inte till barn under 13 år, och vi samlar inte medvetet in uppgifter om barn.',
    ],
  },
  {
    title: 'Ändringar',
    paragraphs: [
      'Om policyn ändras uppdaterar vi den här sidan och datumet högst upp. Vid större ändringar informerar vi i appen.',
    ],
  },
]

export default function Privacy() {
  return (
    <main className="doc">
      <h1>Integritetspolicy</h1>
      <p className="updated">Senast uppdaterad: 25 juli 2026</p>
      {SECTIONS.map(section => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((text, i) => <p key={i}>{text}</p>)}
        </section>
      ))}
    </main>
  )
}
