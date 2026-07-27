import { Link } from 'react-router-dom'
import { Reveal } from '../../components/Reveal'
import { PageHero, Phone, Split, SectionText, P, PhotoSlot } from '../../components/Sections'
import { IconCheck, IconArrow } from '../../components/icons'
import shotGps from '../../assets/screens/IMG_8736.PNG'
import shotTempo from '../../assets/screens/IMG_8743.PNG'

const CHECKS = [
  'Rutt, distans, tempo och kalorier i realtid',
  'Röstcoach med kilometertider i öronen',
  'Mål per pass: distans, tid eller fritt',
  'Splits per kilometer efter passet',
  'Personliga rekord bockas av automatiskt',
]

export default function Lopning() {
  return (
    <main style={{ flex: 1 }}>
      <PageHero
        kicker="Träning · Löpning"
        title="Spring, appen sköter räknandet"
        lead="GPS-spårning med karta, röstcoach och splits. Telefonen i fickan eller armbandet, fokus på vägen."
        orange
      />

      <section style={{ padding: 'clamp(10px, 2vw, 30px) 0' }}>
        <div className="container">
          <Reveal>
            {/* Bilden väljs manuellt senare */}
            <PhotoSlot ratio="21 / 9" label="bred bild, löpare på bergsväg eller stig i morgonljus" radius={36} />
          </Reveal>
        </div>
      </section>

      <Split>
        <SectionText kicker="Under passet" title="Karta, mål och röstguidning">
          <P>
            Ställ in aktivitet, mål och röstguidning innan du trycker Start.
            Under passet ser du rutten ritas live, och coachen läser upp
            kilometertiderna så du slipper titta på skärmen.
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
            <Phone src={shotGps} alt="Löpning med karta över Stockholm, mål och röstguidning" />
          </div>
        </Reveal>
      </Split>

      <Split card>
        <Reveal>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Phone src={shotTempo} alt="Tempoutveckling per vecka" />
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="kicker" style={{ marginBottom: 12 }}>Efter passet</div>
          <h2 className="secTitleSm">Formen syns i kurvan</h2>
          <P>
            Tempoutvecklingen visar snittempo vecka för vecka, så du ser formen
            komma även de veckor det känns tungt. Distansgraferna samlar dag,
            vecka och månad.
          </P>
          <P last>
            Vill du känna på spårningen innan du laddar ner? Testa demon med en
            riktig runda runt Djurgården.
          </P>
          <Link to="/gps-demo" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 14, fontWeight: 600, fontSize: 15.5 }}>
            Testa GPS-kartan live<IconArrow size={16} strokeWidth={2.2} />
          </Link>
        </Reveal>
      </Split>

      <section style={{ padding: 'clamp(10px, 2vw, 30px) 0 0' }}>
        <div className="container">
          <Reveal>
            {/* Bilden väljs manuellt senare */}
            <PhotoSlot ratio="21 / 9" label="bred bild, närbild på löparskor mot grus eller asfalt i rörelse" radius={36} />
          </Reveal>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginTop: 28 }}>
            <Link to="/app" className="btnBlue" style={{ fontSize: 16, padding: '14px 28px' }}>
              Starta din challenge<IconArrow size={17} strokeWidth={2.2} />
            </Link>
            <Link to="/traning" style={{ fontWeight: 600, fontSize: 15 }}>Alla träningsformer</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
