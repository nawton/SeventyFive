import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { IconFlame, IconHeart, IconMedal, IconArrow } from '../components/icons'
import {
  DEMO_CHALLENGE, DEMO_VOLUME, DEMO_DISTANCE, DEMO_MUSCLES,
  DEMO_LEADERBOARD, DEMO_FEED, DEMO_DAYS, DEMO_SPLITS, initials,
} from '../lib/demoData'

// =============================================================================
// DEMO — en interaktiv skyltdocka för appens vyer, byggd på exempeldata.
// Märkningen högst upp gör tydligt att inget här är riktig statistik.
// =============================================================================

const C = 2 * Math.PI * 55

function Ring() {
  const done = DEMO_CHALLENGE.day / DEMO_CHALLENGE.total
  return (
    <div style={{ position: 'relative', width: 150, height: 150 }}>
      <svg width="150" height="150" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r="55" fill="none" stroke="#EAECF2" strokeWidth="10" />
        <circle cx="65" cy="65" r="55" fill="none" stroke="var(--blue)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${C * done} ${C}`} transform="rotate(-90 65 65)" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-hd)', fontWeight: 800, fontSize: 30, lineHeight: 1 }}>{DEMO_CHALLENGE.day}</span>
        <span style={{ fontSize: 12, color: 'var(--mut)' }}>av {DEMO_CHALLENGE.total} dagar</span>
      </div>
    </div>
  )
}

function DistanceChart() {
  const max = Math.max(...DEMO_DISTANCE.map(d => d.km))
  const pts = DEMO_DISTANCE.map((d, i) => {
    const x = 20 + (i * (260 - 40)) / (DEMO_DISTANCE.length - 1)
    const y = 96 - (d.km / max) * 78
    return { ...d, x, y }
  })
  const line = pts.map(p => `${p.x},${p.y}`).join(' ')
  const area = `20,96 ${line} 240,96`
  return (
    <svg viewBox="0 0 260 116" style={{ width: '100%' }}>
      <polygon points={area} fill="rgba(43,75,215,0.08)" />
      <polyline points={line} fill="none" stroke="var(--blue)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(p => <circle key={p.label} cx={p.x} cy={p.y} r="4" fill="var(--blue)" />)}
      {pts.map(p => (
        <text key={p.label + 't'} x={p.x} y={110} textAnchor="middle" fontSize="9.5" fill="#8A93A8">{p.label}</text>
      ))}
      <text x={pts[pts.length - 1].x} y={pts[pts.length - 1].y - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--blue)">{DEMO_DISTANCE[DEMO_DISTANCE.length - 1].km} km</text>
    </svg>
  )
}

export default function Demo() {
  const maxVol = Math.max(...DEMO_VOLUME.map(v => v.kg))
  return (
    <main style={{ flex: 1 }}>
      <section style={{ position: 'relative', padding: 'clamp(120px, 16vh, 160px) 0 clamp(24px, 3vw, 40px)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -200, right: -140, width: 560, height: 560, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,91,219,0.13), transparent 65%)', pointerEvents: 'none' }} />
        <div className="container">
          <Reveal>
            <div style={{ maxWidth: 680 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'rgba(242,101,42,0.08)', border: '1px solid rgba(242,101,42,0.3)', color: 'var(--orange-t)', fontSize: 13.5, fontWeight: 600, letterSpacing: 0.4, padding: '7px 16px', borderRadius: 999, marginBottom: 16 }}>
                <span className="pulseDot" />Demo med exempeldata
              </div>
              <h1 className="pageTitle">Så här ser resan ut inifrån</h1>
              <p style={{ color: 'var(--ink2)', fontSize: 'clamp(17px, 2vw, 19px)', lineHeight: 1.65, maxWidth: 560, textWrap: 'pretty' }}>
                Ett smakprov på appens statistik, flöde och topplistor. Allt på
                den här sidan är påhittad exempeldata, dina egna siffror byggs
                av dina riktiga pass.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Utmaningen: ring, streak och nyckeltal */}
      <section style={{ padding: 'clamp(20px, 3vw, 40px) 0' }}>
        <div className="container">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 18 }}>
            <Reveal>
              <div className="softCard" style={{ padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, height: '100%' }}>
                <h3 style={{ fontWeight: 700, fontSize: 17, alignSelf: 'flex-start' }}>Utmaningen</h3>
                <Ring />
                <p style={{ color: 'var(--ink3)', fontSize: 14 }}>{DEMO_CHALLENGE.level}-nivån, {Math.round((DEMO_CHALLENGE.day / DEMO_CHALLENGE.total) * 100)} % av resan</p>
              </div>
            </Reveal>
            <Reveal delay={60}>
              <div style={{ background: '#101B45', borderRadius: 28, padding: 28, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
                <h3 style={{ fontWeight: 700, fontSize: 17, color: '#FFFFFF' }}>Streak</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ color: '#FF8A50' }}><IconFlame size={36} strokeWidth={1.8} /></span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-hd)', fontWeight: 800, fontSize: 38, color: '#FFFFFF', lineHeight: 1 }}>{DEMO_CHALLENGE.streak}</div>
                    <div style={{ color: '#9DA9D6', fontSize: 13, marginTop: 3 }}>dagar i rad</div>
                  </div>
                </div>
                <p style={{ color: '#9DA9D6', fontSize: 14, lineHeight: 1.6 }}>Längsta streaken hittills, och den växer fortfarande.</p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="softCard" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
                <h3 style={{ fontWeight: 700, fontSize: 17 }}>Nyckeltal</h3>
                {[
                  { l: 'Klarade dagar', v: String(DEMO_CHALLENGE.completed), c: '#1F9D55' },
                  { l: 'Missade dagar', v: String(DEMO_CHALLENGE.missed), c: '#D93843' },
                  { l: 'Framgång', v: DEMO_CHALLENGE.successRate + ' %', c: 'var(--blue)' },
                ].map(r => (
                  <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
                    <span style={{ color: 'var(--ink3)', fontSize: 14.5 }}>{r.l}</span>
                    <span style={{ fontFamily: 'var(--font-hd)', fontWeight: 700, fontSize: 15, color: r.c }}>{r.v}</span>
                  </div>
                ))}
                <p style={{ color: 'var(--mut)', fontSize: 13, marginTop: 'auto' }}>Uppdateras varje gång något checkas av.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Grafer: volym, distans, muskler */}
      <section style={{ padding: 'clamp(20px, 3vw, 40px) 0' }}>
        <div className="container">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 18 }}>
            <Reveal>
              <div className="softCard" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
                <h3 style={{ fontWeight: 700, fontSize: 17 }}>Träningsvolym</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 110, flex: 1 }}>
                  {DEMO_VOLUME.map((v, i) => (
                    <div key={v.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                      <span style={{ width: '100%', height: `${(v.kg / maxVol) * 100}%`, borderRadius: '6px 6px 3px 3px', background: i === DEMO_VOLUME.length - 1 ? 'linear-gradient(180deg, #3B5BDB, #2338A8)' : `rgba(59,91,219,${0.28 + i * 0.1})` }} />
                      <span style={{ fontSize: 10, color: 'var(--mut)' }}>{v.label}</span>
                    </div>
                  ))}
                </div>
                <p style={{ color: 'var(--ink3)', fontSize: 14 }}>{DEMO_VOLUME[DEMO_VOLUME.length - 1].kg.toLocaleString('sv-SE')} kg lyft senaste veckan.</p>
              </div>
            </Reveal>
            <Reveal delay={60}>
              <div className="softCard" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
                <h3 style={{ fontWeight: 700, fontSize: 17 }}>Distans per månad</h3>
                <DistanceChart />
                <p style={{ color: 'var(--ink3)', fontSize: 14 }}>Från soffan till 38 km i månaden på ett halvår.</p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="softCard" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
                <h3 style={{ fontWeight: 700, fontSize: 17 }}>Muskelfördelning</h3>
                {DEMO_MUSCLES.map(m => (
                  <div key={m.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{m.name}</span>
                      <span style={{ color: 'var(--mut)' }}>{m.pct} %</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: '#EAECF2', overflow: 'hidden' }}>
                      <div style={{ width: `${(m.pct / DEMO_MUSCLES[0].pct) * 100}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #3B5BDB, #2338A8)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 75-dagarsöversikten + splits */}
      <section style={{ padding: 'clamp(20px, 3vw, 40px) 0' }}>
        <div className="container">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 18 }}>
            <Reveal>
              <div className="softCard" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h3 style={{ fontWeight: 700, fontSize: 17 }}>Alla 75 dagar</h3>
                  <span style={{ fontSize: 13, color: 'var(--mut)' }}>{DEMO_CHALLENGE.completed} klara · {DEMO_CHALLENGE.missed} missade</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gap: 5 }}>
                  {DEMO_DAYS.map((d, i) => (
                    <span key={i} title={`Dag ${i + 1}`} style={{
                      aspectRatio: '1', borderRadius: 4,
                      background: d === 'done' ? 'rgba(59,91,219,0.8)' : d === 'missed' ? 'rgba(242,101,42,0.75)' : '#EAECF2',
                    }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 18, fontSize: 12.5, color: 'var(--mut)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(59,91,219,0.8)' }} />Klarad</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(242,101,42,0.75)' }} />Missad</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#EAECF2' }} />Kvar</span>
                </div>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div className="softCard" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
                <h3 style={{ fontWeight: 700, fontSize: 17 }}>Splits, lördagens 5 km</h3>
                {DEMO_SPLITS.map((s, i) => {
                  const fastest = s.pace === '4:58'
                  return (
                    <div key={s.km} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 26, fontSize: 13, color: 'var(--mut)' }}>{s.km}</span>
                      <div style={{ flex: 1, height: 26, borderRadius: 8, background: fastest ? 'linear-gradient(90deg, #3B5BDB, #2338A8)' : 'rgba(59,91,219,0.12)', display: 'flex', alignItems: 'center', paddingLeft: 12, width: `${70 + i * 6}%` }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: fastest ? '#FFFFFF' : 'var(--blue)', fontFamily: 'var(--font-hd)' }}>{s.pace} /km</span>
                      </div>
                    </div>
                  )
                })}
                <p style={{ color: 'var(--ink3)', fontSize: 14, marginTop: 'auto' }}>Sista kilometern snabbast, precis som det ska vara.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Community: topplista + flöde */}
      <section style={{ padding: 'clamp(20px, 3vw, 40px) 0' }}>
        <div className="container">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 18 }}>
            <Reveal>
              <div className="softCard" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 6, height: '100%' }}>
                <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>Veckans topplista</h3>
                {DEMO_LEADERBOARD.map((p, i) => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '10px 0', borderBottom: i < DEMO_LEADERBOARD.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <span style={{ fontFamily: 'var(--font-hd)', fontWeight: 800, fontSize: 15, color: i === 0 ? 'var(--orange-t)' : 'var(--blue)', width: 18 }}>{i + 1}</span>
                    <span style={{ width: 38, height: 38, borderRadius: '50%', background: i % 2 === 0 ? 'rgba(59,91,219,0.1)' : 'rgba(242,101,42,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-hd)', fontWeight: 700, fontSize: 13, color: i % 2 === 0 ? 'var(--blue)' : 'var(--orange-t)' }}>{initials(p.name)}</span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14.5 }}>{p.name}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-hd)', fontWeight: 700, fontSize: 14.5 }}>{p.km.toFixed(1).replace('.', ',')} km</div>
                      <div style={{ fontSize: 12, color: 'var(--mut)' }}>{p.passes} pass</div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h3 style={{ fontWeight: 700, fontSize: 17, fontFamily: 'var(--font-hd)', padding: '4px 2px' }}>Flödet just nu</h3>
                {DEMO_FEED.map(f => (
                  <div key={f.action} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#FFFFFF', border: '1px solid var(--line)', borderRadius: 20, padding: '14px 18px', boxShadow: '0 4px 16px rgba(20,25,45,0.05)' }}>
                    <span style={{ width: 42, height: 42, borderRadius: '50%', background: f.kind === 'gym' || f.kind === 'medal' ? 'rgba(242,101,42,0.1)' : 'rgba(59,91,219,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-hd)', fontWeight: 700, fontSize: 13, color: f.kind === 'gym' || f.kind === 'medal' ? 'var(--orange-t)' : 'var(--blue)', flex: '0 0 auto' }}>{initials(f.name)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14.5 }}>{f.name.split(' ')[0]} {f.action}</div>
                      <div style={{ color: 'var(--mut)', fontSize: 12.5 }}>{f.time}</div>
                    </div>
                    {f.kind === 'medal' && <span style={{ color: 'var(--orange-t)', display: 'flex' }}><IconMedal size={18} /></span>}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--mut)', fontSize: 13 }}>
                      <span style={{ color: 'var(--orange)', display: 'flex' }}><IconHeart size={15} /></span>{f.likes}
                    </span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Avslut */}
      <section style={{ padding: 'clamp(30px, 4vw, 50px) 0 0' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <Reveal>
            <p style={{ color: 'var(--ink3)', fontSize: 15.5, maxWidth: 520, margin: '0 auto 24px' }}>
              Allt ovan är exempeldata. Den riktiga versionen fylls av dina
              pass, din streak och dina vänner.
            </p>
            <Link to="/app" className="btnBlue">Starta din challenge<IconArrow size={18} strokeWidth={2.2} /></Link>
          </Reveal>
        </div>
      </section>
    </main>
  )
}
