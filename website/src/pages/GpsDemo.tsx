import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { IconArrow } from '../components/icons'

export default function GpsDemo() {
  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 80 }}>
      <div className="container" style={{ padding: 'clamp(16px, 3vw, 32px) 24px 12px' }}>
        <Reveal>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'rgba(242,101,42,0.08)', border: '1px solid rgba(242,101,42,0.3)', color: 'var(--orange-t)', fontSize: 13.5, fontWeight: 600, letterSpacing: 0.4, padding: '7px 16px', borderRadius: 999, marginBottom: 16 }}>
            <span className="pulseDot" />Live-demo
          </div>
          <h1 style={{ fontWeight: 800, fontSize: 'clamp(30px, 4.5vw, 48px)', letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 14 }}>Testa GPS-spårningen direkt</h1>
          <p style={{ color: 'var(--ink2)', fontSize: 17, lineHeight: 1.65, maxWidth: 640 }}>
            Appens riktiga passvy i tre delar: kartan, detaljvyn med stora
            siffror och splits där varje block är en kilometer. Svep mellan
            vyerna i telefonen precis som i appen, och spela upp en riktig
            7 km-runda runt Djurgården.
          </p>
        </Reveal>
      </div>
      <div className="container" style={{ padding: '20px 24px 0', flex: 1 }}>
        <Reveal delay={80}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 'min(390px, 92vw)', background: '#0F1115', borderRadius: 54, padding: 11, boxShadow: '0 40px 90px rgba(20,25,45,0.35)' }}>
              <iframe
                src="/map-demo.html"
                title="Interaktiv GPS-demo med karta, detaljvy och splits"
                style={{ display: 'block', width: '100%', aspectRatio: '9 / 18.5', border: 'none', borderRadius: 44, background: '#F4F5F7' }}
              />
            </div>
          </div>
          <p style={{ color: 'var(--mut)', fontSize: 13, margin: '16px 4px 0', textAlign: 'center' }}>
            Djurgården runt, 7,0 km. Kartdata © OpenStreetMap-bidragsgivarna © CARTO.
          </p>
        </Reveal>
      </div>
      <div className="container" style={{ padding: 'clamp(30px, 4vw, 48px) 24px clamp(40px, 5vw, 64px)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <Link to="/app" className="btnBlue" style={{ fontSize: 16, padding: '14px 28px' }}>
          Starta din challenge<IconArrow size={17} strokeWidth={2.2} />
        </Link>
        <Link to="/appen" style={{ fontWeight: 600, fontSize: 15 }}>Se alla funktioner</Link>
      </div>
    </main>
  )
}
