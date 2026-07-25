const GROUPS: Array<{ title: string; items: Array<{ icon: string; title: string; body: string }> }> = [
  {
    title: 'Utmaningen',
    items: [
      { icon: '🔥', title: '75 dagar', body: 'Dagliga uppgifter: träning, vatten, kost, läsning och framstegsfoto. Missar du en dag börjar du om från dag 1.' },
      { icon: '📸', title: 'Framstegsfoton', body: 'Ett foto om dagen. Alltid privata, jämför dag 1 mot dag 75 när du är i mål.' },
      { icon: '📏', title: 'Egna regler', body: 'Lägg till dina egna dagliga regler utöver grundreglerna, kalla duschar, inga sötsaker, vad som helst.' },
      { icon: '⚡', title: 'Streak', body: 'Dagarna i rad räknas, milstolpar bockas av och lågan hålls vid liv.' },
    ],
  },
  {
    title: 'Träning',
    items: [
      { icon: '🏃', title: 'Löpning med GPS', body: 'Rutt, distans, tempo och splits. Röstcoach i öronen och rekord som bockas av automatiskt.' },
      { icon: '🗺', title: 'Kartor på dina villkor', body: 'Dölj rutterna helt eller bara området närmast hemmet, du väljer vad andra ser.' },
      { icon: '🏋️', title: 'Gymlogg', body: 'Övningar, set, reps och vikt. Volymstatistik och muskelfördelning som visar vad du försummar.' },
      { icon: '📊', title: 'Statistik', body: 'Utmaningsringen, kalendern, distansgrafer och tempoutveckling, allt samlat under Framsteg.' },
    ],
  },
  {
    title: 'Tillsammans',
    items: [
      { icon: '👥', title: 'Grupper', body: 'Skapa en grupp, bjud in med QR-kod, dela inlägg och bilder och tävla i veckans topplista.' },
      { icon: '❤️', title: 'Flödet', body: 'Följ vänner, gilla och kommentera varandras pass. Privat konto när du vill vara ifred.' },
      { icon: '💬', title: 'Meddelanden', body: 'Skriv direkt till vänner och gruppmedlemmar, med bilder och reaktioner.' },
      { icon: '🔒', title: 'Integritet', body: 'Du styr synligheten: privat konto, kartsynlighet, blockering och anmälningar.' },
    ],
  },
]

export default function Features() {
  return (
    <main className="doc" style={{ maxWidth: 1100 }}>
      <h1>Funktioner</h1>
      <p className="updated">Allt du behöver för 75 dagar, och för allt som kommer efter.</p>
      {GROUPS.map(group => (
        <section key={group.title}>
          <h2>{group.title}</h2>
          <div className="features" style={{ paddingBottom: 24 }}>
            {group.items.map(f => (
              <div className="feature" key={f.title}>
                <div className="icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
