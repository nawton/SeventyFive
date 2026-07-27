import { Reveal } from '../components/Reveal'
import { PageHero, Phone } from '../components/Sections'
import { IconUsers, IconTrophy, IconTarget, IconHeart } from '../components/icons'
import shotGroup from '../assets/screens/IMG_8750.PNG'
import shotFeed from '../assets/screens/IMG_8748.PNG'

// OBS: exempeldata i flödeslistan, byts mot riktig data efter lansering
const FEED = [
  { init: 'A', color: 'blue', text: 'Alex genomförde dag 25', time: 'för 12 minuter sedan', likes: 14 },
  { init: 'S', color: 'orange', text: 'Sara sprang 7,4 km', time: 'för 40 minuter sedan', likes: 9 },
  { init: 'L', color: 'blue', text: 'Leo låste upp medaljen 30 dagar', time: 'för 2 timmar sedan', likes: 21 },
  { init: 'M', color: 'orange', text: 'Maja genomförde veckans femte träningspass', time: 'för 3 timmar sedan', likes: 17 },
]

const CARDS = [
  { id: 'grupper', icon: <IconUsers size={21} />, orange: false, title: 'Grupper', body: 'Skapa en grupp med familj eller vänner och gör resan tillsammans, med delat flöde och gemensam statistik.' },
  { id: 'topplistor', icon: <IconTrophy size={21} />, orange: true, title: 'Topplistor', body: 'Veckans mest aktiva i din grupp. Lite tävling gör att passet blir av även de tröga dagarna.' },
  { id: 'utmaningar', icon: <IconTarget size={21} />, orange: false, title: 'Gemensamma challenges', body: 'Starta 75 dagar samtidigt som dina vänner och håll varandra ansvariga hela vägen.' },
  { id: 'gilla', icon: <IconHeart size={21} />, orange: true, title: 'Gilla och kommentera', body: 'Heja på varandras aktiviteter. Din profil kan vara privat eller offentlig, du väljer vad som delas.' },
]

export default function Community() {
  return (
    <main style={{ flex: 1 }}>
      <PageHero
        kicker="Community"
        title="Det är lättare när man gör det tillsammans"
        lead="Dela dina framsteg, följ vänner och hitta motivation från personer på samma resa."
      />

      <section id="flode" style={{ scrollMarginTop: 90, padding: 'clamp(30px, 4vw, 60px) 0' }}>
        <div className="container">
          <div className="grid gridSplit">
            <Reveal>
              <h2 className="secTitleSm">Ett flöde som håller dig igång</h2>
              <p style={{ color: 'var(--ink2)', fontSize: 17, lineHeight: 1.7, marginBottom: 22 }}>
                Se vänners pass, avklarade dagar och medaljer i realtid. Gilla,
                kommentera och heja på, ett flöde där varje post är någon som
                gjorde jobbet.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {FEED.map((f, i) => (
                  <Reveal key={f.text} delay={i * 60}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#FFFFFF', border: '1px solid var(--line)', borderRadius: 20, padding: '16px 18px', boxShadow: '0 4px 16px rgba(20,25,45,0.05)' }}>
                      <span style={{ width: 42, height: 42, borderRadius: '50%', background: f.color === 'blue' ? 'rgba(59,91,219,0.1)' : 'rgba(242,101,42,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-hd)', fontWeight: 700, fontSize: 14, color: f.color === 'blue' ? 'var(--blue)' : 'var(--orange-t)', flex: '0 0 auto' }}>{f.init}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14.5 }}>{f.text}</div>
                        <div style={{ color: 'var(--mut)', fontSize: 13 }}>{f.time}</div>
                      </div>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--mut)', fontSize: 13 }}>
                        <span style={{ color: 'var(--orange)', display: 'flex' }}><IconHeart size={15} /></span>{f.likes}
                      </span>
                    </div>
                  </Reveal>
                ))}
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Phone src={shotGroup} alt="Gruppen Team Sthlm med veckans topplista och flöde" />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section style={{ padding: 'clamp(30px, 4vw, 60px) 0' }}>
        <div className="container">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 18 }}>
            {CARDS.map((c, i) => (
              <Reveal key={c.id} delay={i * 60}>
                <div id={c.id} className="softCard" style={{ scrollMarginTop: 90, borderRadius: 26, padding: 26, height: '100%' }}>
                  <span className={`stepIcon${c.orange ? ' orange' : ''}`} style={{ width: 44, height: 44, borderRadius: 14, marginBottom: 14 }}>{c.icon}</span>
                  <h3 style={{ fontWeight: 700, fontSize: 17.5, marginBottom: 8 }}>{c.title}</h3>
                  <p style={{ color: 'var(--ink3)', fontSize: 14.5, lineHeight: 1.6 }}>{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: 'clamp(30px, 4vw, 60px) 0 0' }}>
        <div className="container">
          <div className="grid gridSplit">
            <Reveal>
              <h2 className="secTitleSm">Flödet i fickan</h2>
              <p style={{ color: 'var(--ink2)', fontSize: 17, lineHeight: 1.7, marginBottom: 14 }}>
                Cardio med karta, gympass med volym, gilla-markeringar och
                kommentarer. Flödet visar dina vänners riktiga pass, inte
                bara siffror.
              </p>
              <p style={{ color: 'var(--ink2)', fontSize: 17, lineHeight: 1.7 }}>
                Vill du vara ifred? Privat konto gör att bara godkända följare
                ser din aktivitet, och kartor kan döljas helt eller nära hemmet.
              </p>
            </Reveal>
            <Reveal delay={120}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Phone src={shotFeed} alt="Aktivitetsflödet med en GPS-spårad promenad på Kungsholmen" />
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </main>
  )
}
