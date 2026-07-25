import { useEffect } from 'react'
import { Routes, Route, Link, NavLink, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Privacy from './pages/Privacy'
import Support from './pages/Support'

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
        <nav>
          <NavLink to="/integritetspolicy">Integritetspolicy</NavLink>
          <NavLink to="/support">Support</NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/integritetspolicy" element={<Privacy />} />
        <Route path="/support" element={<Support />} />
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
