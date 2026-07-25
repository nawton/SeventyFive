const ACTIVITIES = [
  {
    icon: '🏃',
    title: 'Löpning',
    body: 'GPS-spårade rundor med distans, tempo, splits och rutt på kartan. Röstcoachen ger dig kilometertider i öronen, och intervallpass guidas segment för segment. Personliga rekord, snabbaste 5 km, längsta rundan, bockas av automatiskt.',
  },
  {
    icon: '🚴',
    title: 'Cykling',
    body: 'Samma GPS-spårning som löpningen: rutt, distans, tid och kalorier. Perfekt som volymträning eller aktiv återhämtning mellan de tuffa passen.',
  },
  {
    icon: '🚶',
    title: 'Promenad',
    body: 'Underskattat verktyg i utmaningen. Spåra promenaderna med GPS och låt dem räknas, dagen efter ett tungt pass gör blodflödet jobbet.',
  },
  {
    icon: '🏋️',
    title: 'Gym',
    body: 'Logga övningar med set, reps och vikt ur övningsbiblioteket, sorterat per muskelgrupp. Volymstatistik, muskelfördelning och schemalagda pass som följer din vecka.',
  },
]

export default function Activities() {
  return (
    <main className="doc">
      <h1>Aktiviteter</h1>
      <p className="updated">Fyra sätt att träna, ett ställe att logga dem.</p>
      {ACTIVITIES.map(a => (
        <section key={a.title}>
          <h2>{a.icon} {a.title}</h2>
          <p>{a.body}</p>
        </section>
      ))}
      <section>
        <h2>Räknas allt i utmaningen?</h2>
        <p>
          Ja. Träningsuppgiften i 75-utmaningen kräver minst ett riktigt loggat
          pass per dag, oavsett om det är en löprunda, cykeltur, promenad eller
          ett gympass.
        </p>
      </section>
    </main>
  )
}
