import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { IconChevDown, IconClose, IconMenu } from './icons'

// =============================================================================
// NAVIGATIONEN — fast överst, transparent tills man skrollar, dropdowns på
// desktop och en lucka som glider in från höger på mobil.
// =============================================================================

type SubItem = { title: string; desc: string; href: string }
type NavDef = { key: string; label: string; href: string; items?: SubItem[] }

const DEFS: NavDef[] = [
  { key: 'hem', label: 'Hem', href: '/' },
  {
    key: 'appen', label: 'Appen', href: '/appen', items: [
      { title: 'Dagliga uppgifter', desc: 'Se vad som behöver genomföras och checka av varje uppgift.', href: '/appen#daglig' },
      { title: 'Träningslogg', desc: 'Logga pass med övningar, set och data.', href: '/appen#logg' },
      { title: 'Statistik och streaks', desc: 'Följ klarade dagar och framsteg över tid.', href: '/appen#statistik' },
      { title: 'Progressbilder', desc: 'Följ din fysiska utveckling privat.', href: '/appen#progressbilder' },
      { title: 'Veckoschema', desc: 'Planera veckans pass i förväg.', href: '/traning#schema' },
      { title: 'Medaljer och achievements', desc: 'Lås upp milstolpar längs resan.', href: '/appen#medaljer' },
      { title: 'Påminnelser', desc: 'Notiser innan dagen rinner iväg.', href: '/appen#fler' },
      { title: 'Challenge-nivåer', desc: 'Normal, Hard eller Extreme.', href: '/challenges#nivaer' },
    ],
  },
  {
    key: 'traning', label: 'Träning', href: '/traning', items: [
      { title: 'Styrketräning', desc: 'Bygg pass med set, reps och vikt.', href: '/traning#styrka' },
      { title: 'Löpning', desc: 'GPS-spårning med tempo och distans.', href: '/traning#lopning' },
      { title: 'Cykling', desc: 'Logga rundor och se din utveckling.', href: '/traning#cykling' },
      { title: 'Promenader', desc: 'Vardagsrörelse som räknas.', href: '/traning#promenad' },
      { title: 'Egna träningspass', desc: 'Skapa upplägg som passar dig.', href: '/traning#egna' },
      { title: 'Träningshistorik', desc: 'Alla pass samlade på ett ställe.', href: '/traning#historik' },
      { title: 'Träningsschema', desc: 'Planera veckan längs en tidslinje.', href: '/traning#schema' },
      { title: 'Testa GPS-kartan live', desc: 'Interaktiv demo av spårningen.', href: '/gps-demo' },
    ],
  },
  {
    key: 'challenges', label: 'Challenges', href: '/challenges', items: [
      { title: 'Normal', desc: 'En stabil start med marginal.', href: '/challenges#nivaer' },
      { title: 'Hard', desc: 'Den klassiska utmaningen.', href: '/challenges#nivaer' },
      { title: 'Extreme', desc: 'Noll marginal, maximal kravbild.', href: '/challenges#nivaer' },
      { title: 'Så fungerar det', desc: 'Utmaningens fyra steg.', href: '/challenges#sa-fungerar' },
      { title: 'Challenge-regler', desc: 'Det som gäller alla 75 dagar.', href: '/challenges#regler' },
      { title: 'Jämför nivåer', desc: 'Se kraven sida vid sida.', href: '/challenges#jamfor' },
    ],
  },
  { key: 'progress', label: 'Progress', href: '/progress' },
  { key: 'demo', label: 'Demo', href: '/demo' },
  {
    key: 'community', label: 'Community', href: '/community', items: [
      { title: 'Aktivitetsflöde', desc: 'Se vänners pass och avklarade dagar.', href: '/community#flode' },
      { title: 'Topplistor', desc: 'Veckans mest aktiva.', href: '/community#topplistor' },
      { title: 'Grupper', desc: 'Träna tillsammans med ditt gäng.', href: '/community#grupper' },
      { title: 'Gemensamma utmaningar', desc: 'Starta en challenge ihop.', href: '/community#utmaningar' },
    ],
  },
  { key: 'om', label: 'Om oss', href: '/om' },
]

function activeKey(pathname: string): string {
  if (pathname === '/') return 'hem'
  if (pathname.startsWith('/appen')) return 'appen'
  if (pathname.startsWith('/traning') || pathname.startsWith('/gps-demo')) return 'traning'
  if (pathname.startsWith('/challenges')) return 'challenges'
  if (pathname.startsWith('/progress')) return 'progress'
  if (pathname.startsWith('/demo')) return 'demo'
  if (pathname.startsWith('/community')) return 'community'
  if (pathname.startsWith('/om')) return 'om'
  return ''
}

export function SiteNav() {
  const { pathname } = useLocation()
  const active = activeKey(pathname)
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [drawer, setDrawer] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Sidbyte stänger både dropdown och mobilluckan
  useEffect(() => { setOpen(null); setDrawer(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawer])

  const enter = (key: string) => { window.clearTimeout(closeTimer.current); setOpen(key) }
  const leave = (key: string) => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(o => (o === key ? null : o)), 180)
  }

  return (
    <>
      <header className={`sfNav${scrolled ? ' scrolled' : ''}`}>
        <div className="sfNavInner">
          <Link to="/" className="navBrand">
            <span className="brandBadge">75</span>
            <span className="brandName">SeventyFive</span>
          </Link>

          <nav className="navCenter">
            {DEFS.map(d => (
              <div
                key={d.key}
                className="navItem"
                onMouseEnter={() => d.items && enter(d.key)}
                onMouseLeave={() => d.items && leave(d.key)}
              >
                <NavLink to={d.href} className={`navLink${active === d.key ? ' active' : ''}`}>
                  {d.label}
                  {d.items && (
                    <span className={`navChev${open === d.key ? ' open' : ''}`}>
                      <IconChevDown size={13} strokeWidth={2.2} />
                    </span>
                  )}
                </NavLink>
                {d.items && open === d.key && (
                  <div className="navDrop" onMouseEnter={() => enter(d.key)} onMouseLeave={() => leave(d.key)}>
                    <div className="navDropCard">
                      {d.items.map(s => (
                        <Link key={s.title} to={s.href} className="dropItem" onClick={() => setOpen(null)}>
                          <span className="dropTitle"><span className="dropDot" />{s.title}</span>
                          <span className="dropDesc">{s.desc}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="navAuth">
            <Link to="/logga-in" className="navLogin">Logga in</Link>
            <Link to="/app" className="btnCta">Starta din challenge</Link>
          </div>

          <button type="button" className="navBurger" aria-label="Öppna meny" onClick={() => setDrawer(true)}>
            <IconMenu size={22} />
          </button>
        </div>
      </header>

      {drawer && (
        <>
          <div className="drawerBackdrop" onClick={() => setDrawer(false)} />
          <div className="drawer">
            <div className="drawerHead">
              <span>Meny</span>
              <button type="button" className="drawerClose" aria-label="Stäng meny" onClick={() => setDrawer(false)}>
                <IconClose size={20} />
              </button>
            </div>
            <div className="drawerBody">
              {DEFS.map(d => (
                <div key={d.key}>
                  <Link to={d.href} className={`drawerGroup${active === d.key ? ' active' : ''}`}>{d.label}</Link>
                  {d.items?.map(s => (
                    <Link key={s.title} to={s.href} className="drawerSub">{s.title}</Link>
                  ))}
                </div>
              ))}
            </div>
            <div className="drawerFoot">
              <Link to="/logga-in" className="drawerLogin">Logga in</Link>
              <Link to="/app" className="drawerCta">Starta din challenge</Link>
            </div>
          </div>
        </>
      )}
    </>
  )
}
