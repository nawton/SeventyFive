import { Link } from 'react-router-dom'
import { Reveal } from '../../components/Reveal'
import { PageHero, Phone, Split, SectionText, P, PhotoSlot } from '../../components/Sections'
import { IconCheck, IconArrow } from '../../components/icons'
import shotSessions from '../../assets/screens/IMG_8744.PNG'

const CHECKS = [
  'GPS-spårning med rutt, distans och tid',
  'Kalorier beräknade för cykling',
  'Rundorna samlas i sessionslistan med allt annat',
  'Räknas fullt ut i utmaningen och veckans topplista',
]

export default function Cykling() {
  return (
    <main style={{ flex: 1 }}>
      <PageHero
        kicker="Träning · Cykling"
        title="Volymträning på två hjul"
        lead="Samma GPS-spårning som löpningen: rutt, distans, tid och kalorier. Perfekt som volym eller aktiv återhämtning mellan de tunga passen."
        orange
      />

      <section style={{ padding: 'clamp(10px, 2vw, 30px) 0' }}>
        <div className="container">
          <Reveal>
            {/* Bilden väljs manuellt senare */}
            <PhotoSlot ratio="21 / 9" label="bred bild, cyklist på öppen landsväg, gärna kvällsljus" radius={36} />
          </Reveal>
        </div>
      </section>

      <Split>
        <SectionText kicker="Rundorna" title="Alla pass samlade, oavsett sport">
          <P>
            Cykelturerna loggas med samma precision som löprundorna och hamnar
            i samma sessionslista, så veckans totala volym alltid finns på ett
            ställe.
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
            <Phone src={shotSessions} alt="Sessionslistan med veckans cardiopass" />
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
