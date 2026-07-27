import { Link } from 'react-router-dom'
import { Reveal } from '../../components/Reveal'
import { PageHero, Phone, Split, SectionText, P, PhotoSlot } from '../../components/Sections'
import { IconCheck, IconArrow } from '../../components/icons'
import shotGym from '../../assets/screens/IMG_8735.PNG'
import shotMuscles from '../../assets/screens/IMG_8737.PNG'

const CHECKS = [
  'Övningsbibliotek sorterat per muskelgrupp',
  'Set, reps och vikt loggas medan du kör',
  'Senaste vikterna föreslås automatiskt vid nästa pass',
  'Volymstatistik per vecka och muskelfördelning',
  'Schemalagda pass som följer din vecka',
]

export default function Styrka() {
  return (
    <main style={{ flex: 1 }}>
      <PageHero
        kicker="Träning · Styrketräning"
        title="Bygg passet, lyft, logga"
        lead="Välj övningar ur biblioteket, fyll i set och vikt medan du kör och se volymen växa vecka för vecka."
        orange
      />

      <section style={{ padding: 'clamp(10px, 2vw, 30px) 0' }}>
        <div className="container">
          <Reveal>
            {/* Bilden väljs manuellt senare */}
            <PhotoSlot ratio="21 / 9" label="bred bild, någon som lyfter skivstång i gymmiljö, mörk och fokuserad ton" radius={36} />
          </Reveal>
        </div>
      </section>

      <Split>
        <SectionText kicker="Passet" title="Allt på plats när du står vid stången">
          <P>
            Dagens pass visar övningarna i ordning med set, reps och vad du
            lyfte senast, så du slipper bläddra i anteckningar mellan seten.
          </P>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
            {CHECKS.map(c => (
              <span key={c} className="checkLine">
                <span style={{ color: 'var(--orange)' }}><IconCheck size={17} strokeWidth={2.5} /></span>{c}
              </span>
            ))}
          </div>
        </SectionText>
        <Reveal delay={120}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Phone src={shotGym} alt="Dagens gympass med övningar och senaste vikter" />
          </div>
        </Reveal>
      </Split>

      <Split card>
        <Reveal>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Phone src={shotMuscles} alt="Tränade muskler visualiserade på kroppskarta" />
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="kicker" style={{ marginBottom: 12 }}>Muskelkartan</div>
          <h2 className="secTitleSm">Se vad du tränat, och vad du glömt</h2>
          <P>
            Kroppskartan färgas in utifrån dina avbockade övningar. Har benen
            varit svarta i två veckor säger bilden det ingen träningskompis
            vågar.
          </P>
          <P last>
            Muskelfördelningen visar samma sak som siffror: set per muskelgrupp,
            vecka mot vecka.
          </P>
        </Reveal>
      </Split>

      <section style={{ padding: 'clamp(20px, 3vw, 40px) 0 0' }}>
        <div className="container" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <Link to="/app" className="btnBlue" style={{ fontSize: 16, padding: '14px 28px' }}>
            Starta din challenge<IconArrow size={17} strokeWidth={2.2} />
          </Link>
          <Link to="/traning" style={{ fontWeight: 600, fontSize: 15 }}>Alla träningsformer</Link>
        </div>
      </section>
    </main>
  )
}
