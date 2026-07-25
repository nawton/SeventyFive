const FEATURES = [
  {
    icon: '🔥',
    title: 'Utmaningen',
    body: 'Dagens uppgifter, streak och 75-dagarsringen. Regler som inte går att fuska med.',
  },
  {
    icon: '🏃',
    title: 'Löpning & gym',
    body: 'GPS-spårade rundor med röstcoach, personliga löpplaner och full gymlogg med statistik.',
  },
  {
    icon: '👥',
    title: 'Grupper',
    body: 'Skapa en grupp, bjud in med QR-kod, peppa varandra i flödet och tävla i veckans topplista.',
  },
  {
    icon: '💬',
    title: 'Vänner',
    body: 'Följ varandra, gilla och kommentera pass, skicka meddelanden. Du bestämmer vad som syns.',
  },
]

export default function Home() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">75 HARD, PÅ SVENSKA</p>
        <h1>75 dagar.<br />Inga ursäkter.</h1>
        <p className="lead">
          Två pass om dagen, vatten, kost, läsning och ett framstegsfoto.
          Missar du en dag börjar du om. SeventyFive håller räkningen,
          och dina vänner håller dig ärlig.
        </p>
        <div className="badge">Snart på App Store</div>
      </section>

      <section className="features">
        {FEATURES.map(f => (
          <div className="feature" key={f.title}>
            <div className="icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
