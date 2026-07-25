import { useEffect } from 'react'
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
        </div>
      </header>

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
