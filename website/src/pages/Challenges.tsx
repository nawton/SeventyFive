import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { PageHero } from '../components/Sections'
import { IconCheck } from '../components/icons'

const LEVELS = [
  {
    title: 'Normal',
    body: 'För dig som vill skapa bättre vanor och bygga en stabil rutin. Krävande nog att förändra, snällt nog för ett fullt liv.',
    cta: 'Börja med Normal', variant: 'plain' as const,
  },
  {
    title: 'Hard',
    body: 'För dig som vill utmana dig själv med högre krav och tydligare struktur. Varje dag räknas, inga undantag.',
    cta: 'Börja med Hard', variant: 'rec' as const,
  },
  {
    title: 'Extreme',
    body: 'För dig som redan har en stark grund och vill genomföra den mest krävande versionen. En miss nollställer allt.',
    cta: 'Börja med Extreme', variant: 'dark' as const,
  },
]

const CMP: Array<[string, string, string, string]> = [
  ['Dagliga uppgifter', '4 st', '5 st', '6 st'],
  ['Träningskrav', '4 pass/vecka', '1 pass/dag, ett utomhus', '2 pass/dag'],
  ['Vattenmål', '2 liter', '3 liter', '4 liter'],
  ['Läsning', 'Valfritt', '10 sidor/dag', '10 sidor/dag'],
  ['Progressbilder', 'Valfritt', 'Varje dag', 'Varje dag'],
  ['Återhämtning', '3 vilodagar/vecka', 'Lätta pass räknas', 'Inga vilodagar'],
  ['Flexibilitet', 'Hög', 'Låg', 'Ingen'],
  ['Omstart vid missad dag', 'Nej, 1 dags marginal/vecka', 'Ja, från dag 1', 'Ja, från dag 1'],
]

const STEPS = [
  { num: '01', title: 'Välj din nivå', body: 'Normal, Hard eller Extreme, utifrån var du är just nu.' },
  { num: '02', title: 'Följ dagens uppgifter', body: 'Checka av träning, vatten, läsning och dina egna vanor.' },
  { num: '03', title: 'Logga och följ upp', body: 'Pass, progressbilder och streak byggs upp automatiskt.' },
  { num: '04', title: 'Genomför alla 75', body: 'Dag för dag, tills du står där med 75 av 75.' },
]

const RULES = [
  'Alla dagens uppgifter måste checkas av före midnatt',
  'Träningspass måste vara minst 45 minuter',
  'På Hard och Extreme nollställer en missad dag din streak',
  'Nivån väljs vid start och kan höjas under resan',
  'Träningsschemat är flexibelt så länge dagens krav uppfylls',
  'Utmaningen är klar när dag 75 är avcheckad',
]

const JOURNEY = [
  { day: 'Dag 1', sub: 'Du börjar' },
  { day: 'Dag 7', sub: 'Den första rutinen' },
  { day: 'Dag 15', sub: 'Nya vanor formas' },
  { day: 'Dag 30', sub: 'Du märker skillnad' },
  { day: 'Dag 50', sub: 'Disciplinen tar över' },
  { day: 'Dag 75', sub: 'Utmaningen är genomförd', dark: true },
]

export default function Challenges() {
  return (
    <main style={{ flex: 1 }}>
      <PageHero
        kicker="Challenges"
        title="Välj utmaningen som passar ditt mål"
        lead="Alla nivåer bygger på samma princip: 75 dagar i rad. Skillnaden är hur mycket varje dag kräver."
        orange
      />

      <section id="nivaer" style={{ scrollMarginTop: 90, padding: 'clamp(30px, 4vw, 60px) 0' }}>
        <div className="container">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 22, alignItems: 'stretch' }}>
            {LEVELS.map((lv, i) => (
              <Reveal key={lv.title} delay={i * 90}>
                <div style={{
                  position: 'relative', height: '100%',
                  background: lv.variant === 'dark' ? 'linear-gradient(165deg, #151A2E, #101B45)' : '#FFFFFF',
                  border: lv.variant === 'dark' ? '1px solid rgba(242,101,42,0.4)' : lv.variant === 'rec' ? '1px solid rgba(59,91,219,0.4)' : '1px solid rgba(20,22,28,0.08)',
                  borderRadius: 30, padding: '34px 30px',
                  display: 'flex', flexDirection: 'column', gap: 14,
                  boxShadow: lv.variant === 'dark' ? '0 14px 44px rgba(16,27,69,0.3)' : lv.variant === 'rec' ? '0 12px 38px rgba(43,75,215,0.14)' : 'var(--shadow-sm)',
                }}>
                  <div style={{ fontFamily: 'var(--font-hd)', fontWeight: 700, fontSize: 22, ...(lv.variant === 'dark' ? { background: 'linear-gradient(120deg, #FF9D68, #F2652A)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : lv.variant === 'rec' ? { color: 'var(--blue)' } : { color: 'var(--ink)' }) }}>{lv.title}</div>
                  <p style={{ color: lv.variant === 'dark' ? '#AEB6D9' : 'var(--ink3)', fontSize: 15, lineHeight: 1.65, flex: 1 }}>{lv.body}</p>
                  <Link to="/app" style={
                    lv.variant === 'rec'
                      ? { display: 'flex', justifyContent: 'center', background: 'linear-gradient(140deg, #3B5BDB, #2338A8)', color: '#FFFFFF', fontWeight: 600, fontSize: 15, padding: 13, borderRadius: 999, boxShadow: '0 8px 24px rgba(43,75,215,0.3)' }
                      : lv.variant === 'dark'
                        ? { display: 'flex', justifyContent: 'center', background: 'linear-gradient(140deg, #FF9D68, #F2652A)', color: '#14100B', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 999 }
                        : { display: 'flex', justifyContent: 'center', border: '1px solid rgba(20,22,28,0.12)', color: '#2A2F3C', fontWeight: 600, fontSize: 15, padding: 12, borderRadius: 999 }
                  }>{lv.cta}</Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="jamfor" style={{ scrollMarginTop: 90, padding: 'clamp(30px, 4vw, 60px) 0' }}>
        <div className="container">
          <Reveal><h2 className="secTitleSm" style={{ marginBottom: 26 }}>Jämför nivåerna</h2></Reveal>
          <Reveal delay={80}>
            <div className="cmpWrap">
              <div className="cmpGrid">
                <div className="cmpHead" style={{ paddingLeft: 24, color: 'var(--mut)', fontSize: 13, letterSpacing: 1 }}>KRAV</div>
                <div className="cmpHead">Normal</div>
                <div className="cmpHead cmpHard" style={{ color: 'var(--blue)' }}>Hard</div>
                <div className="cmpHead" style={{ color: 'var(--orange-t)' }}>Extreme</div>
                {CMP.map(([label, n, h, x], i) => {
                  const last = i === CMP.length - 1 ? ' last' : ''
                  return [
                    <div key={label + '0'} className={`cmpLbl${last}`}>{label}</div>,
                    <div key={label + '1'} className={last}>{n}</div>,
                    <div key={label + '2'} className={`cmpHard${last}`}>{h}</div>,
                    <div key={label + '3'} className={last}>{x}</div>,
                  ]
                })}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="sa-fungerar" style={{ scrollMarginTop: 90, padding: 'clamp(30px, 4vw, 60px) 0' }}>
        <div className="container">
          <Reveal><h2 className="secTitleSm" style={{ marginBottom: 26 }}>Så fungerar det</h2></Reveal>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 18 }}>
            {STEPS.map((s, i) => (
              <Reveal key={s.num} delay={i * 60}>
                <div className="softCard" style={{ borderRadius: 24, padding: 24, height: '100%' }}>
                  <div className="stepNum" style={{ marginBottom: 10 }}>{s.num}</div>
                  <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{s.title}</h3>
                  <p style={{ color: 'var(--ink3)', fontSize: 14.5, lineHeight: 1.6 }}>{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="regler" style={{ scrollMarginTop: 90, padding: 'clamp(30px, 4vw, 60px) 0' }}>
        <div className="container">
          <div className="navyCard" style={{ padding: 'clamp(28px, 4vw, 56px)' }}>
            <Reveal><h2 className="secTitleSm" style={{ color: '#FFFFFF', marginBottom: 22 }}>Challenge-reglerna</h2></Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '14px 28px' }}>
              {RULES.map((r, i) => (
                <Reveal key={r} delay={i * 40}>
                  <span style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: '#C7CDE8', fontSize: 15.5, lineHeight: 1.6 }}>
                    <span style={{ color: '#FF8A50', flex: '0 0 auto', marginTop: 3, display: 'flex' }}><IconCheck size={17} strokeWidth={2.5} /></span>{r}
                  </span>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="resa" style={{ scrollMarginTop: 90, padding: 'clamp(40px, 5vw, 80px) 0 0' }}>
        <div className="container">
          <Reveal>
            <div style={{ maxWidth: 640, marginBottom: 'clamp(36px, 5vw, 56px)' }}>
              <div className="kicker">Resan</div>
              <h2 className="secTitleSm">Från dag 1 till dag 75</h2>
              <p style={{ color: 'var(--ink2)', fontSize: 17, lineHeight: 1.65 }}>
                Utvecklingen är sällan spikrak, men den pekar åt rätt håll.
              </p>
            </div>
          </Reveal>
          <div style={{ position: 'relative' }}>
            <svg viewBox="0 0 1200 110" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 14, width: '100%', height: 110, pointerEvents: 'none' }}>
              <path d="M0,70 C150,20 300,95 500,55 C700,15 900,90 1200,35" fill="none" stroke="rgba(242,101,42,0.4)" strokeWidth="2" strokeDasharray="7 9" />
            </svg>
            <div className="grid" style={{ position: 'relative', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 16 }}>
              {JOURNEY.map((j, i) => (
                <Reveal key={j.day} delay={i * 60} style={{ marginTop: i % 2 === 1 ? 'clamp(0px, 3vw, 40px)' : 0 }}>
                  <div style={j.dark
                    ? { display: 'flex', flexDirection: 'column', gap: 8, background: 'linear-gradient(160deg, #151A2E, #101B45)', borderRadius: 20, padding: 18, boxShadow: '0 8px 24px rgba(16,27,69,0.25)', height: '100%' }
                    : { display: 'flex', flexDirection: 'column', gap: 8, background: '#FFFFFF', border: '1px solid var(--line)', borderRadius: 20, padding: 18, boxShadow: '0 4px 18px rgba(20,25,45,0.05)', height: '100%' }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'linear-gradient(140deg, #FF9D68, #F2652A)' }} />
                    <span style={{ fontFamily: 'var(--font-hd)', fontWeight: 800, fontSize: 15, color: j.dark ? '#FFFFFF' : 'var(--ink)' }}>{j.day}</span>
                    <span style={{ color: j.dark ? '#9DA9D6' : 'var(--ink3)', fontSize: 13.5, lineHeight: 1.5 }}>{j.sub}</span>
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
