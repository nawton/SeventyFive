const FAQ = [
  {
    q: 'Jag missade en dag, kan jag ångra det?',
    a: 'Nej, det är hela poängen med utmaningen. Dag 1 väntar på dig igen.',
  },
  {
    q: 'Vem ser mina framstegsfoton?',
    a: 'Bara du. Framstegsfoton visas aldrig för andra användare, oavsett inställningar.',
  },
  {
    q: 'Hur döljer jag mina löprutter?',
    a: 'Profil → Integritet → Kartsynlighet. Du kan dölja kartor helt eller bara området närmast hemmet.',
  },
  {
    q: 'Hur raderar jag mitt konto?',
    a: 'Profil → Allmänt → Radera konto. Allt tas bort permanent.',
  },
]

export default function Support() {
  return (
    <main className="doc">
      <h1>Support</h1>
      <p className="updated">Vi svarar så snabbt vi kan, oftast inom ett dygn.</p>

      <h2>Kontakt</h2>
      <p>
        Mejla oss på <a href="mailto:support@nawton.net">support@nawton.net</a>{' '}
        med frågor, buggar eller idéer. Beskriv gärna vad du gjorde när
        problemet uppstod och bifoga en skärmbild om du kan.
      </p>

      <h2>Vanliga frågor</h2>
      {FAQ.map(item => (
        <p key={item.q}>
          <strong>{item.q}</strong><br />
          {item.a}
        </p>
      ))}

      <h2>Anmäla innehåll</h2>
      <p>
        Olämpligt innehåll anmäler du direkt i appen via ⋯-menyn på inlägget,
        profilen eller gruppen. Anmälningar granskas skyndsamt.
      </p>
    </main>
  )
}
