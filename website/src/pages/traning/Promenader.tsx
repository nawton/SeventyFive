import { Link } from 'react-router-dom'
import { Reveal } from '../../components/Reveal'
import { PageHero, Phone, Split, SectionText, P, PhotoSlot } from '../../components/Sections'
import { IconCheck, IconArrow } from '../../components/icons'
import shotWalk from '../../assets/screens/IMG_8749.PNG'

const CHECKS = [
  'GPS-spårade promenader med rutt på kartan',
  'Räknas som pass på Normal-nivån',
  'Perfekt återhämtning dagen efter ett tungt pass',
  'Syns i flödet och gruppens topplista som allt annat',
]

export default function Promenader() {
  return (
    <main style={{ flex: 1 }}>
      <PageHero
        kicker="Träning · Promenader"
        title="Vardagsrörelsen som räknas"
        lead="Underskattat verktyg i utmaningen. Spåra promenaderna med GPS och låt dem göra jobbet de dagar kroppen behöver vila."
        orange
      />

      <section style={{ padding: 'clamp(10px, 2vw, 30px) 0' }}>
        <div className="container">
          <Reveal>
            {/* Bilden väljs manuellt senare */}
            <PhotoSlot ratio="21 / 9" label="bred bild, person som promenerar på stig i skog eller vid vatten" radius={36} />
          </Reveal>
        </div>
      </section>

      <Split>
        <SectionText kicker="Promenaden" title="Blodflödet gör jobbet">
          <P>
            Dagen efter ett tungt gympass är en rask promenad ofta det bästa
            passet du kan göra. Appen spårar rutten och tempot, och promenaden
            räknas in i dagens uppgifter precis som allt annat.
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
            <Phone src={shotWalk} alt="Promenad längs Norr Mälarstrand med rutt på kartan" />
          </div>
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
