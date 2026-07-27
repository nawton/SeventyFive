import { Reveal } from '../components/Reveal'
import { PageHero, Phone } from '../components/Sections'
import { IconFlame, IconMedal } from '../components/icons'
import shotProgress from '../assets/screens/IMG_8740.PNG'
import shotGymStats from '../assets/screens/IMG_8752.PNG'

const WEEKDAYS = [
  { d: 'M', v: 0.8 }, { d: 'T', v: 0.8 }, { d: 'O', v: 0.5 }, { d: 'T', v: 0.8 },
  { d: 'F', v: 0.8 }, { d: 'L', v: -1 }, { d: 'S', v: 0 },
]

export default function ProgressPage() {
  return (
    <main style={{ flex: 1 }}>
      <PageHero
        kicker="Progress"
        title="Utveckling du faktiskt kan se"
        lead="Följ varje träningspass, vana och genomförd dag på samma plats."
      />

      <section style={{ padding: 'clamp(30px, 4vw, 60px) 0' }}>
        <div className="container">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 18 }}>
            <Reveal>
              <div className="softCard" style={{ padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, height: '100%' }}>
                <h3 style={{ fontWeight: 700, fontSize: 17, alignSelf: 'flex-start' }}>Din challenge</h3>
                <div style={{ position: 'relative', width: 130, height: 130 }}>
                  <svg width="130" height="130" viewBox="0 0 130 130">
                    <circle cx="65" cy="65" r="55" fill="none" stroke="#EAECF2" strokeWidth="10" />
                    <circle cx="65" cy="65" r="55" fill="none" stroke="var(--blue)" strokeWidth="10" strokeLinecap="round" strokeDasharray="345.6" strokeDashoffset="152" transform="rotate(-90 65 65)" />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-hd)', fontWeight: 800, fontSize: 26, lineHeight: 1 }}>42</span>
                    <span style={{ fontSize: 12, color: 'var(--mut)' }}>av 75 dagar</span>
                  </div>
                </div>
                <p style={{ color: 'var(--ink3)', fontSize: 14, textAlign: 'center' }}>56 % av resan avklarad</p>
              </div>
            </Reveal>
            <Reveal delay={60}>
              <div style={{ background: '#101B45', borderRadius: 28, padding: 28, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
                <h3 style={{ fontWeight: 700, fontSize: 17, color: '#FFFFFF' }}>Streak</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ color: '#FF8A50' }}><IconFlame size={36} strokeWidth={1.8} /></span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-hd)', fontWeight: 800, fontSize: 38, color: '#FFFFFF', lineHeight: 1 }}>42</div>
                    <div style={{ color: '#9DA9D6', fontSize: 13, marginTop: 3 }}>dagar i rad</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[1, 1, 1, 1, 1, 1, 0].map((on, i) => (
                    <span key={i} style={{ flex: 1, height: 7, borderRadius: 4, background: on ? '#FF8A50' : 'rgba(255,255,255,0.18)' }} />
                  ))}
                </div>
                <p style={{ color: '#9DA9D6', fontSize: 14, lineHeight: 1.6 }}>Personligt rekord: 42 dagar, pågående.</p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="softCard" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
                <h3 style={{ fontWeight: 700, fontSize: 17 }}>Träningsvolym per vecka</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100, flex: 1 }}>
                  {[38, 52, 47, 68, 80, 100].map((h, i) => (
                    <span key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '6px 6px 3px 3px', background: i === 5 ? 'linear-gradient(180deg, #3B5BDB, #2338A8)' : `rgba(59,91,219,${0.3 + i * 0.09})` }} />
                  ))}
                </div>
                <p style={{ color: 'var(--ink3)', fontSize: 14, lineHeight: 1.6 }}>Sex veckor in, volymen pekar uppåt.</p>
              </div>
            </Reveal>
            <Reveal>
              <div className="softCard" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
                <h3 style={{ fontWeight: 700, fontSize: 17 }}>Distans över tid</h3>
                <svg viewBox="0 0 260 100" style={{ width: '100%', height: 100 }}>
                  <polyline points="0,82 40,74 80,78 120,58 160,62 200,38 260,22" fill="none" stroke="var(--orange)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="260" cy="22" r="5" fill="var(--orange)" />
                </svg>
                <p style={{ color: 'var(--ink3)', fontSize: 14, lineHeight: 1.6 }}>Inte spikrak, men åt rätt håll.</p>
              </div>
            </Reveal>
            <Reveal delay={60}>
              <div className="softCard" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
                <h3 style={{ fontWeight: 700, fontSize: 17 }}>Veckan</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                  {WEEKDAYS.map((w, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 600 }}>{w.d}</span>
                      <span style={{ width: '100%', aspectRatio: '1', borderRadius: 10, background: w.v === -1 ? 'rgba(242,101,42,0.75)' : w.v === 0 ? '#EAECF2' : `rgba(59,91,219,${w.v})` }} />
                    </div>
                  ))}
                </div>
                <p style={{ color: 'var(--ink3)', fontSize: 14, lineHeight: 1.6 }}>Sex av sju dagar avklarade denna vecka.</p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="softCard" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
                <h3 style={{ fontWeight: 700, fontSize: 17 }}>Medaljer</h3>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: '50%', background: 'rgba(242,101,42,0.12)', color: 'var(--orange-t)' }}><IconMedal size={24} /></span>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: '50%', background: 'rgba(59,91,219,0.1)', color: 'var(--blue)' }}><IconFlame size={24} strokeWidth={1.8} /></span>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: '50%', background: '#F0F2F7', color: '#B9BFCE', border: '1.5px dashed #C9CFDC', fontSize: 22, fontWeight: 600 }}>+</span>
                </div>
                <p style={{ color: 'var(--ink3)', fontSize: 14, lineHeight: 1.6 }}>18 av 26 upplåsta. Nästa: Halvvägs, dag 50.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section style={{ padding: 'clamp(30px, 4vw, 60px) 0 0' }}>
        <div className="container">
          <div className="softCard" style={{ borderRadius: 'clamp(28px, 4vw, 44px)', padding: 'clamp(28px, 4vw, 56px)', boxShadow: 'var(--shadow-md)' }}>
            <div className="grid gridSplit">
              <Reveal>
                <div className="kicker" style={{ marginBottom: 12 }}>Direkt ur appen</div>
                <h2 className="secTitleSm">Allt samlat i Framsteg-fliken</h2>
                <p style={{ color: 'var(--ink2)', fontSize: 17, lineHeight: 1.7, marginBottom: 14 }}>
                  Daglig progress, veckostatistik, aktivitetsgrafer,
                  träningshistorik, personliga rekord och genomförda challenges.
                  Appen räknar, du tränar.
                </p>
                <p style={{ color: 'var(--ink2)', fontSize: 17, lineHeight: 1.7 }}>
                  Statistiken uppdateras i samma sekund som du checkar av något.
                </p>
              </Reveal>
              <Reveal delay={120}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
                  <Phone src={shotProgress} alt="Framsteg-vyn med dag 42, klarade dagar och veckan" width="min(44%, 210px)" />
                  <Phone src={shotGymStats} alt="Muskelfördelningen som radardiagram med set per muskelgrupp" width="min(44%, 210px)" style={{ marginTop: 32 }} />
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
