import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { PageHero, Phone, PhotoSlot } from '../components/Sections'
import { IconCheck, IconArrow } from '../components/icons'
import shotCalendar from '../assets/screens/IMG_8741.PNG'
import shotMuscles from '../assets/screens/IMG_8737.PNG'
import shotGps from '../assets/screens/IMG_8736.PNG'
import shotLive from '../assets/screens/IMG_8744.PNG'
import shotSplits from '../assets/screens/IMG_8743.PNG'
import shotLog from '../assets/screens/IMG_8735.PNG'
import shotSessions from '../assets/screens/IMG_8749.PNG'

const CATS = [
  { id: 'styrka', to: '/traning/styrka', title: 'Styrketräning', body: 'Bygg pass övning för övning och logga set, reps och vikt medan du kör.', shot: shotLog, alt: 'Dagens gympass med övningar och senaste vikter' },
  { id: 'lopning', to: '/traning/lopning', title: 'Löpning', body: 'GPS-spårning med rutt, tempo, distans och kalorier i realtid.', shot: shotGps, alt: 'Löpning med karta över Stockholm, mål och röstguidning' },
  { id: 'cykling', to: '/traning/cykling', title: 'Cykling', body: 'Logga rundor med distans och tid, och se veckans volym växa.', shot: shotLive, alt: 'Sessionslistan med veckans cardiopass' },
  { id: 'promenad', to: '/traning/promenader', title: 'Promenader', body: 'Vardagsrörelsen räknas, på Normal-nivån godkänns promenader som pass.', shot: shotSessions, alt: 'Promenad längs Norr Mälarstrand med rutt på kartan' },
  { id: 'rorlighet', to: '/traning/lopning', title: 'Tempoutveckling', body: 'Snittempo vecka för vecka, så du ser formen komma även när dagarna känns tunga.', shot: shotSplits, alt: 'Tempoutveckling per vecka' },
]

const CHECKS = [
  'Skapa egna träningspass eller utgå från färdiga upplägg',
  'Planera veckans träning i kalendern',
  'Logga set, repetitioner, vikt, tid och distans',
  'Se tidigare resultat och slå dina egna rekord',
  'Följ din träningsvolym och bygg rutiner som håller',
]

const WEEK = [
  { day: 'MÅNDAG', title: 'Överkropp', sub: 'Gym · 60 min' },
  { day: 'TISDAG', title: 'Löpning', sub: 'Utomhus · 5 km' },
  { day: 'ONSDAG', title: 'Underkropp', sub: 'Gym · 60 min' },
  { day: 'TORSDAG', title: 'Promenad', sub: 'Utomhus · 45 min' },
  { day: 'FREDAG', title: 'Helkropp', sub: 'Gym · 60 min' },
  { day: 'LÖRDAG', title: 'Löpning', sub: 'Utomhus · 7 km' },
  { day: 'SÖNDAG', title: 'Rörlighet', sub: 'Hemma · 30 min', dark: true },
]

export default function Traning() {
  return (
    <main style={{ flex: 1 }}>
      <PageHero
        kicker="Träning"
        title="Träning som passar din vardag"
        lead="Skapa egna pass, följ ett schema och samla all träning på samma plats."
        orange
      />

      <section style={{ padding: 'clamp(10px, 2vw, 30px) 0' }}>
        <div className="container">
          <Reveal>
            {/* Bilden väljs manuellt senare */}
            <PhotoSlot ratio="21 / 8" label="bred bild, träningsgrupp eller löpare i bergslandskap, motljus" radius={40} />
          </Reveal>
        </div>
      </section>

      <section style={{ padding: 'clamp(30px, 4vw, 60px) 0' }}>
        <div className="container">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20 }}>
            {CATS.map((c, i) => (
              <Reveal key={c.id} delay={(i % 3) * 60}>
                <Link to={c.to} id={c.id} className="softCard hoverLift" style={{ scrollMarginTop: 90, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', color: 'inherit' }}>
                  <div style={{ aspectRatio: '16/10', overflow: 'hidden', borderBottom: '1px solid var(--line)', background: '#E9ECF4' }}>
                    <img src={c.shot} alt={c.alt} loading="lazy" style={{ width: '100%', display: 'block', marginTop: '-8%' }} />
                  </div>
                  <div style={{ padding: '22px 24px 26px' }}>
                    <h3 style={{ fontWeight: 700, fontSize: 19, marginBottom: 8 }}>{c.title}</h3>
                    <p style={{ color: 'var(--ink3)', fontSize: 14.5, lineHeight: 1.6, marginBottom: 10 }}>{c.body}</p>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 14, color: 'var(--blue)' }}>
                      Läs mer<IconArrow size={15} strokeWidth={2.2} />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
            <Reveal delay={120}>
              <div id="egna-akt" style={{ scrollMarginTop: 90, background: 'linear-gradient(160deg, #151A2E, #101B45)', borderRadius: 28, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '30px 28px', gap: 12 }}>
                <h3 style={{ fontWeight: 700, fontSize: 19, color: '#FFFFFF' }}>Egna aktiviteter</h3>
                <p style={{ color: '#C7CDE8', fontSize: 14.5, lineHeight: 1.65 }}>
                  Klättring, padel, simning eller något helt annat. Skapa egna
                  aktivitetstyper så att all rörelse räknas in i din challenge.
                </p>
                <Link to="/appen#logg" style={{ color: '#FF9D68', fontWeight: 600, fontSize: 14.5 }}>Så funkar loggningen</Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="egna" style={{ scrollMarginTop: 90, padding: 'clamp(30px, 4vw, 60px) 0' }}>
        <div className="container">
          <div className="softCard" style={{ borderRadius: 'clamp(28px, 4vw, 44px)', padding: 'clamp(28px, 4vw, 56px)', boxShadow: 'var(--shadow-md)' }}>
            <div className="grid gridSplit">
              <Reveal>
                <div className="kicker" style={{ marginBottom: 12 }}>Bygg din träning</div>
                <h2 className="secTitleSm" style={{ marginBottom: 18 }}>Skapa pass, planera veckan och följ volymen</h2>
                <div id="historik" style={{ scrollMarginTop: 110, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {CHECKS.map(c => (
                    <span key={c} className="checkLine">
                      <span style={{ color: 'var(--orange)' }}><IconCheck size={17} strokeWidth={2.5} /></span>{c}
                    </span>
                  ))}
                </div>
              </Reveal>
              <Reveal delay={120}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
                  <Phone src={shotCalendar} alt="Kalendern med en hel månad klarade dagar" width="min(44%, 210px)" />
                  <Phone src={shotMuscles} alt="Tränade muskler visualiserade på kroppskarta" width="min(44%, 210px)" style={{ marginTop: 32 }} />
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <section id="schema" style={{ scrollMarginTop: 90, padding: 'clamp(40px, 5vw, 80px) 0 0' }}>
        <div className="container">
          <Reveal>
            <div style={{ maxWidth: 640, marginBottom: 'clamp(36px, 5vw, 56px)' }}>
              <div className="kicker">Veckoschema</div>
              <h2 className="secTitleSm">En vecka i appen</h2>
              <p style={{ color: 'var(--ink2)', fontSize: 17, lineHeight: 1.65 }}>
                Så här kan ett upplägg se ut på Hard-nivån. Flytta, byt och
                anpassa passen efter din vecka.
              </p>
            </div>
          </Reveal>
          <div style={{ position: 'relative' }}>
            <svg viewBox="0 0 1200 110" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 40, width: '100%', height: 110, pointerEvents: 'none' }}>
              <path d="M0,55 C200,12 400,98 600,55 C800,12 1000,98 1200,55" fill="none" stroke="rgba(242,101,42,0.35)" strokeWidth="1.5" strokeDasharray="6 8" />
            </svg>
            <div className="grid" style={{ position: 'relative', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 14 }}>
              {WEEK.map((w, i) => (
                <Reveal key={w.day} delay={i * 50} style={{ marginTop: i % 2 === 1 ? 'clamp(0px, 2.5vw, 30px)' : 0 }}>
                  <div style={w.dark
                    ? { background: 'linear-gradient(160deg, #151A2E, #101B45)', borderRadius: 22, padding: '20px 18px', boxShadow: '0 8px 24px rgba(16,27,69,0.25)', height: '100%' }
                    : { background: '#FFFFFF', border: '1px solid var(--line)', borderRadius: 22, padding: '20px 18px', boxShadow: '0 4px 18px rgba(20,25,45,0.05)', height: '100%' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: w.dark ? '#9DA9D6' : 'var(--mut)', marginBottom: 8 }}>{w.day}</div>
                    <div style={{ fontFamily: 'var(--font-hd)', fontWeight: 700, fontSize: 15, color: w.dark ? '#FFFFFF' : 'var(--ink)' }}>{w.title}</div>
                    <div style={{ color: w.dark ? '#9DA9D6' : 'var(--ink3)', fontSize: 13, marginTop: 4 }}>{w.sub}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
