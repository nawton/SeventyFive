import { useEffect, useState } from 'react'
import { Routes, Route, Link, NavLink, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Privacy from './pages/Privacy'
import Support from './pages/Support'
import GetApp from './pages/GetApp'
import Features from './pages/Features'
import Activities from './pages/Activities'
import Subscription from './pages/Subscription'

/** Klientrouting behåller skrollpositionen — nollställ vid sidbyte */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  // Menyn stänger sig själv vid sidbyte, och låser skrollen medan den är öppen
  useEffect(() => { setMenuOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  return (
    <>
      <ScrollToTop />
      <header className="nav">
        <Link to="/" className="brand">Seventy<span>Five</span></Link>
        {/* Policy och support bor i sidfoten, navbaren säljer appen */}
        <nav className="navLinks">
          <NavLink to="/funktioner">Funktioner</NavLink>
          <NavLink to="/aktiviteter">Aktiviteter</NavLink>
          <NavLink to="/prenumeration">Prenumeration</NavLink>
        </nav>
        {/* Båda leder till Skaffa appen-sidan tills App Store-länken finns */}
        <div className="navActions">
          <Link to="/app" className="btnGhost">Logga in</Link>
          <Link to="/app" className="btnAccent">Gå med gratis</Link>
          <button
            type="button"
            className={`burger${menuOpen ? ' open' : ''}`}
            aria-label={menuOpen ? 'Stäng menyn' : 'Öppna menyn'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(v => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* Mobilmenyn: alltid monterad så stängningen också animeras */}
      <div
        className={`menuBackdrop${menuOpen ? ' open' : ''}`}
        onClick={() => setMenuOpen(false)}
      />
      <nav className={`mobileMenu${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen}>
        <NavLink to="/funktioner">Funktioner</NavLink>
        <NavLink to="/aktiviteter">Aktiviteter</NavLink>
        <NavLink to="/prenumeration">Prenumeration</NavLink>
        <div className="menuDivider" />
        <NavLink to="/integritetspolicy">Integritetspolicy</NavLink>
        <NavLink to="/support">Support</NavLink>
        <Link to="/app" className="btnAccent menuCta">Gå med gratis</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/funktioner" element={<Features />} />
        <Route path="/aktiviteter" element={<Activities />} />
        <Route path="/prenumeration" element={<Subscription />} />
        <Route path="/integritetspolicy" element={<Privacy />} />
        <Route path="/support" element={<Support />} />
        <Route path="/app" element={<GetApp />} />
        <Route path="*" element={<Home />} />
      </Routes>

      <footer>
        <p>
          © 2026 Nawton · <Link to="/integritetspolicy">Integritetspolicy</Link> · <Link to="/support">Support</Link>
        </p>
      </footer>
    </>
  )
}
