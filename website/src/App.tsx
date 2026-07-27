import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { SiteNav } from './components/SiteNav'
import { SiteFooter } from './components/SiteFooter'
import Home from './pages/Home'
import AppPage from './pages/AppPage'
import Traning from './pages/Traning'
import Challenges from './pages/Challenges'
import ProgressPage from './pages/ProgressPage'
import Community from './pages/Community'
import About from './pages/About'
import GpsDemo from './pages/GpsDemo'
import Login from './pages/Login'
import Privacy from './pages/Privacy'
import Support from './pages/Support'
import GetApp from './pages/GetApp'

/** Sidbyte skrollar till toppen, ankarlänkar (#daglig m.fl.) till sitt mål */
function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const t = window.setTimeout(() => {
        document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' })
      }, 60)
      return () => window.clearTimeout(t)
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <SiteNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/appen" element={<AppPage />} />
        <Route path="/traning" element={<Traning />} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/community" element={<Community />} />
        <Route path="/om" element={<About />} />
        <Route path="/gps-demo" element={<GpsDemo />} />
        <Route path="/logga-in" element={<Login />} />
        <Route path="/integritetspolicy" element={<Privacy />} />
        <Route path="/support" element={<Support />} />
        <Route path="/app" element={<GetApp />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <SiteFooter />
    </>
  )
}
