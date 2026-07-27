import { Reveal } from '../components/Reveal'
import { PageHero } from '../components/Sections'
import { IconCheck } from '../components/icons'

const PLANS = [
  'Fler gemensamma challenges och gruppfunktioner',
  'Utökad statistik och personliga rekord',
  'Stöd för fler aktivitetstyper och wearables',
]

export default function About() {
  return (
    <main style={{ flex: 1 }}>
      <PageHero
        kicker="Om oss"
        title="Skapad för att göra förändring enklare"
        lead="De flesta vet redan vad de borde göra: träna, sova, dricka vatten, lägga undan telefonen. Det svåra är inte kunskapen, det är att fortsätta tillräckligt länge för att se resultat."
      />

      <section style={{ padding: 'clamp(30px, 4vw, 60px) 0' }}>
        <div className="container">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20 }}>
            <Reveal>
              <div className="softCard" style={{ padding: 30, height: '100%' }}>
                <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>Vår idé</h2>
                <p style={{ color: 'var(--ink2)', fontSize: 15.5, lineHeight: 1.7 }}>
                  Motivation kommer och går, struktur består. Genom att göra
                  varje dag konkret och mätbar flyttar appen fokus från "hur ska
                  jag orka 75 dagar" till "vad ska jag göra idag".
                </p>
              </div>
            </Reveal>
            <Reveal delay={60}>
              <div className="softCard" style={{ padding: 30, height: '100%' }}>
                <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>Varför 75 dagar</h2>
                <p style={{ color: 'var(--ink2)', fontSize: 15.5, lineHeight: 1.7 }}>
                  75 dagar är tillräckligt länge för att vanor ska sätta sig och
                  kroppen ska hinna förändras, men tillräckligt kort för att ha
                  ett tydligt slut att kämpa mot. Det är en utmaning, inte en
                  livsdom.
                </p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="navyCard" style={{ borderRadius: 28, padding: 30, height: '100%' }}>
                <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 12, color: '#FFFFFF' }}>Vad vi tror på</h2>
                <p style={{ color: '#C7CDE8', fontSize: 15.5, lineHeight: 1.7 }}>
                  Att hålla löften till sig själv bygger mer självförtroende än
                  något annat. Små handlingar, upprepade varje dag, slår stora
                  planer som aldrig blir av.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section style={{ padding: 'clamp(30px, 4vw, 60px) 0' }}>
        <div className="container">
          <div className="softCard" style={{ borderRadius: 'clamp(28px, 4vw, 44px)', padding: 'clamp(28px, 4vw, 56px)', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 'clamp(30px, 4vw, 56px)' }}>
              <Reveal>
                <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 14 }}>Hur appen utvecklas</h2>
                <p style={{ color: 'var(--ink2)', fontSize: 15.5, lineHeight: 1.7, marginBottom: 12 }}>
                  SeventyFive byggs i nära dialog med personerna som använder
                  den. Funktioner som träningsloggen, muskelkartan och grupperna
                  kommer direkt från användarnas önskemål.
                </p>
                <p style={{ color: 'var(--ink2)', fontSize: 15.5, lineHeight: 1.7 }}>
                  Appen uppdateras löpande under pågående challenges, utan att
                  störa din streak.
                </p>
              </Reveal>
              <Reveal delay={80}>
                <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 14 }}>Framtida planer</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {PLANS.map(p => (
                    <span key={p} className="checkLine" style={{ fontSize: 15.5 }}>
                      <span style={{ color: 'var(--orange)' }}><IconCheck size={16} strokeWidth={2.5} /></span>{p}
                    </span>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <section id="kontakt" style={{ scrollMarginTop: 90, padding: 'clamp(30px, 4vw, 60px) 0 0' }}>
        <div className="container">
          <div className="navyCard" style={{ padding: 'clamp(32px, 5vw, 64px)', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,101,42,0.16), transparent 62%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <Reveal><h2 style={{ fontWeight: 800, fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '-0.025em', marginBottom: 16, color: '#FFFFFF' }}>Kontakt</h2></Reveal>
              <Reveal delay={60}>
                <p style={{ color: '#C7CDE8', fontSize: 17, lineHeight: 1.7, margin: '0 auto 28px', maxWidth: 480 }}>
                  Frågor, idéer eller feedback? Vi läser allt, och mycket av det
                  hamnar i appen.
                </p>
              </Reveal>
              <Reveal delay={120}>
                <a href="mailto:support@nawton.net" className="btnOrangeLg" style={{ fontSize: 16.5, padding: '15px 32px' }}>
                  support@nawton.net
                </a>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
