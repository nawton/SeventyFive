import { Link } from 'react-router-dom'

export function SiteFooter() {
  return (
    <div style={{ marginTop: 'clamp(40px, 6vw, 80px)' }}>
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 64 }}>
        <path d="M0,52 C360,86 1080,4 1440,48 L1440,80 L0,80 Z" fill="#0B1330" />
      </svg>
      <footer className="sfFooter">
        <div className="container" style={{ padding: 0 }}>
          <div className="footGrid">
            <div style={{ minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
                <span className="brandBadge" style={{ width: 34, height: 34, borderRadius: 11, fontSize: 13.5 }}>75</span>
                <span style={{ fontFamily: 'var(--font-hd)', fontWeight: 700, fontSize: 17, color: '#FFFFFF' }}>SeventyFive</span>
              </div>
              <p className="footBrandText">
                En 75-dagars challenge som hjälper dig bygga disciplin, hälsa
                och bättre rutiner, en dag i taget.
              </p>
            </div>
            <div>
              <div className="footColTitle">Produkt</div>
              <div className="footLinks">
                <Link to="/appen">Appen</Link>
                <Link to="/appen#daglig">Funktioner</Link>
                <Link to="/traning">Träning</Link>
                <Link to="/challenges">Challenges</Link>
                <Link to="/progress">Progress</Link>
              </div>
            </div>
            <div>
              <div className="footColTitle">Community</div>
              <div className="footLinks">
                <Link to="/community">Community</Link>
                <Link to="/community#topplistor">Topplistor</Link>
                <Link to="/community#grupper">Grupper</Link>
              </div>
            </div>
            <div>
              <div className="footColTitle">Företag</div>
              <div className="footLinks">
                <Link to="/om">Om oss</Link>
                <Link to="/support">Support</Link>
                <Link to="/integritetspolicy">Integritetspolicy</Link>
              </div>
            </div>
            <div>
              <div className="footColTitle">Ladda ner</div>
              <div className="footLinks">
                <Link to="/app">Snart på App Store</Link>
                <Link to="/logga-in">Logga in</Link>
              </div>
            </div>
          </div>
          <div className="footBottom">
            <span>© 2026 Nawton. Alla rättigheter förbehållna.</span>
            <span>75 dagar. Ett starkare liv.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
