import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { PageHero, Phone, Split, SectionText, P } from '../components/Sections'
import { IconArrow } from '../components/icons'
import shotHome from '../assets/screens/IMG_8705.PNG'
import shotLog from '../assets/screens/IMG_8720.PNG'
import shotDistance from '../assets/screens/IMG_8714.PNG'
import shotGymStats from '../assets/screens/IMG_8716.PNG'
import shotMedals from '../assets/screens/IMG_8717.PNG'

const MORE = [
  { title: 'Påminnelser', body: 'Smarta notiser när dagen håller på att rinna iväg.' },
  { title: 'Veckoschema', body: 'Planera veckans pass i förväg och flytta när livet kräver det.', link: { to: '/traning#schema', label: 'Se schemat' } },
  { title: 'Challenge-nivåer', body: 'Normal, Hard eller Extreme, samma resa, olika krav.', link: { to: '/challenges#nivaer', label: 'Jämför nivåer' } },
  { title: 'Grupper och topplistor', body: 'Gör resan tillsammans med familj och vänner.', link: { to: '/community', label: 'Till community' } },
]

export default function AppPage() {
  return (
    <main style={{ flex: 1 }}>
      <PageHero
        kicker="Appen"
        title="Allt du behöver för din 75-dagarsresa"
        lead="Planera din träning, följ dina vanor och se hur dina dagliga val skapar verklig utveckling."
      />

      <Split id="daglig">
        <SectionText kicker="Daglig översikt" title="Hela dagen på en skärm">
          <P>
            Öppna appen och se direkt vad som behöver genomföras: dagens
            uppgifter, träningen och hur långt du kommit. Checka av allt
            eftersom, och se dagens progress fyllas.
          </P>
          <P last>Inget letande, inga menyer. Bara det som gäller idag.</P>
        </SectionText>
        <Reveal delay={120}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Phone src={shotHome} alt="Hemskärmen med dagens uppgifter och progress" />
          </div>
        </Reveal>
      </Split>

      <Split id="logg" card>
        <Reveal>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Phone src={shotLog} alt="Logga träningspass med övningar och set" />
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="kicker" style={{ marginBottom: 12 }}>Träningslogg</div>
          <h2 className="secTitleSm">Logga passet medan du kör det</h2>
          <P>
            Styrketräning, löpning, cykling eller något helt eget. Välj
            övningar, fyll i set, reps och vikt, och spara passet med ett tryck.
          </P>
          <P last>Varje loggat pass räknas in i dagens uppgifter och byggs på i din historik.</P>
        </Reveal>
      </Split>

      <Split id="statistik">
        <SectionText kicker="Statistik och streaks" title="Siffrorna som håller dig igång">
          <P>
            Din streak, dina genomförda dagar, distans per vecka och
            aktivitetsfördelning, allt uppdateras automatiskt när du checkar av.
          </P>
          <P>
            Efter några veckor blir statistiken din starkaste motivation: du
            vill inte bryta kurvan.
          </P>
          <Link to="/progress" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8, fontWeight: 600, fontSize: 15.5 }}>
            Mer om progress<IconArrow size={16} strokeWidth={2.2} />
          </Link>
        </SectionText>
        <Reveal delay={120}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
            <Phone src={shotDistance} alt="Distansstatistik med veckograf" width="min(44%, 210px)" />
            <Phone src={shotGymStats} alt="Gympass-statistik med volym och historik" width="min(44%, 210px)" style={{ marginTop: 32 }} />
          </div>
        </Reveal>
      </Split>

      <Split id="progressbilder" card>
        <Reveal>
          {/* BILD: byts mot skärmbild av progressbildernas tidslinje */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 'min(62%, 260px)', aspectRatio: '9/19', background: 'linear-gradient(160deg, #E9ECF4, #DDE2EE)', border: '1.5px dashed rgba(59,91,219,0.35)', borderRadius: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <span style={{ fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: 12.5, color: '#6B7590', textAlign: 'center', lineHeight: 1.6 }}>
                Skärmbild på väg: tidslinjen för progressbilder
              </span>
            </div>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="kicker" style={{ marginBottom: 12 }}>Progressbilder</div>
          <h2 className="secTitleSm">Se skillnaden svart på vitt</h2>
          <P>
            Ta en bild om dagen och låt appen bygga en privat tidslinje av din
            resa. Bilderna är bara dina, inget delas utan att du väljer det.
          </P>
          <P last>Dag 1 mot dag 75 är beviset ingen graf kan ge dig.</P>
        </Reveal>
      </Split>

      <section id="medaljer" style={{ scrollMarginTop: 90, padding: 'clamp(30px, 4vw, 60px) 0' }}>
        <div className="container">
          <div className="navyCard" style={{ padding: 'clamp(28px, 4vw, 56px)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -140, right: -100, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,101,42,0.2), transparent 62%)', pointerEvents: 'none' }} />
            <div className="grid gridSplit" style={{ position: 'relative' }}>
              <Reveal>
                <div className="kicker kickerOrange" style={{ marginBottom: 12 }}>Medaljer och achievements</div>
                <h2 className="secTitleSm" style={{ color: '#FFFFFF' }}>26 milstolpar längs vägen</h2>
                <p style={{ color: '#C7CDE8', fontSize: 17, lineHeight: 1.7, marginBottom: 14 }}>
                  Första passet, sju dagar i rad, halvvägs, hela vägen. Varje
                  milstolpe låser upp en medalj som stannar på din profil.
                </p>
                <p style={{ color: '#C7CDE8', fontSize: 17, lineHeight: 1.7 }}>
                  Små belöningar som gör 75 dagar lättare att hålla ut.
                </p>
              </Reveal>
              <Reveal delay={120}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Phone src={shotMedals} alt="Medaljvy med 4 av 26 upplåsta" />
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <section id="fler" style={{ scrollMarginTop: 90, padding: 'clamp(40px, 5vw, 70px) 0 0' }}>
        <div className="container">
          <Reveal><h2 className="secTitleSm" style={{ marginBottom: 28 }}>Och lite till</h2></Reveal>
          <div className="grid gridAutoSm">
            {MORE.map((m, i) => (
              <Reveal key={m.title} delay={i * 60}>
                <div className="softCard" style={{ borderRadius: 24, padding: 24, height: '100%' }}>
                  <h3 style={{ fontWeight: 700, fontSize: 16.5, marginBottom: 8 }}>{m.title}</h3>
                  <p style={{ color: 'var(--ink3)', fontSize: 14.5, lineHeight: 1.6, marginBottom: m.link ? 10 : 0 }}>{m.body}</p>
                  {m.link && <Link to={m.link.to} style={{ fontWeight: 600, fontSize: 14 }}>{m.link.label}</Link>}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
