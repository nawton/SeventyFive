import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Reveal, CountUp, ProgressLine } from '../components/Reveal'
import {
  IconCheck, IconArrow, IconChevDown, IconLayers, IconTasks, IconChart,
  IconMedal, IconFlame, IconBell, IconUsers,
} from '../components/icons'
import shotHome from '../assets/screens/IMG_8733.PNG'
import shotProgress from '../assets/screens/IMG_8740.PNG'
import shotCalendar from '../assets/screens/IMG_8735.PNG'
import shotGps from '../assets/screens/IMG_8736.PNG'
import shotMedals from '../assets/screens/IMG_8739.PNG'
import shotMuscles from '../assets/screens/IMG_8737.PNG'
import shotDistance from '../assets/screens/IMG_8745.PNG'
import shotGroup from '../assets/screens/IMG_8750.PNG'

const CHIPS = ['Dagliga uppgifter', 'Träningsplanering', 'Statistik och streaks', 'Personlig utveckling']

const STEPS = [
  { icon: <IconLayers />, num: '01', title: 'Välj din challenge-nivå', body: 'Normal, Hard eller Extreme, välj den nivå som matchar var du är just nu.' },
  { icon: <IconTasks />, num: '02', title: 'Följ dina dagliga uppgifter', body: 'Checka av dagens vanor: träning, vatten, läsning och det du lovat dig själv.' },
  { icon: <IconChart />, num: '03', title: 'Logga träning och framsteg', body: 'Spara pass, progressbilder och anteckningar. Statistiken byggs upp automatiskt.' },
  { icon: <IconMedal />, num: '04', title: 'Genomför alla 75 dagar', body: 'Dag för dag växer din streak, tills du står där med 75 av 75 avklarade.' },
]

// OBS: exempelomdömen, byts mot riktiga användaromdömen före lansering
const QUOTES = [
  { q: 'Jag har startat hundra rutiner som runnit ut i sanden. Det som blev annorlunda den här gången var streaken, efter tre veckor ville jag inte förlora den. Nu tränar jag regelbundet för första gången i mitt liv.', init: 'JL', name: 'Johanna Lindqvist', sub: 'Klarade Hard-nivån' },
  { q: 'Det stora för mig var inte träningen utan energin. Runt dag 30 märkte jag att jag orkade mer på jobbet, sov bättre och slutade skjuta upp saker. Disciplinen spillde över på allt annat.', init: 'ME', name: 'Marcus Ek', sub: 'Dag 75 avklarad, två gånger' },
  { q: 'När jag checkade av dag 75 satt jag bara tyst en stund. Jag hade bevisat för mig själv att jag kan hålla ett löfte i två och en halv månad. Den stoltheten går inte att köpa.', init: 'SN', name: 'Sara Nyström', sub: 'Började som nybörjare på Normal' },
]

const FAQ = [
  { q: 'Vad är en 75-dagars challenge?', a: 'Du väljer ett antal dagliga vanor, till exempel träning, vatten, läsning och kost, och genomför dem varje dag i 75 dagar i rad. Poängen är inte perfektion på en enskild dag, utan att bevisa för dig själv att du kan hålla i över tid.' },
  { q: 'Vad händer om jag missar en dag?', a: 'Det beror på din nivå. På Normal har du en dags marginal per vecka. På Hard och Extreme nollställs din streak och du börjar om från dag ett, det är en del av utmaningen. Appen visar alltid tydligt var du står.' },
  { q: 'Kan jag välja olika svårighetsnivåer?', a: 'Ja. Det finns tre nivåer, Normal, Hard och Extreme, med olika krav på träning, vanor och marginal. Du väljer nivå när du startar och kan byta inför en ny runda.' },
  { q: 'Behöver jag träna varje dag?', a: 'Inte nödvändigtvis. På Normal tränar du fyra dagar i veckan. Hard och Extreme kräver daglig träning, på Extreme dessutom två pass om dagen. Promenader räknas som träning på de lägre nivåerna.' },
  { q: 'Kan jag ändra mitt träningsschema?', a: 'Ja, veckoschemat är flexibelt. Du kan flytta pass, byta typ av träning och anpassa upplägget efter din vecka, så länge dagens krav uppfylls.' },
  { q: 'Vilka enheter finns appen till?', a: 'SeventyFive byggs för iPhone och lanseras snart på App Store. Ditt konto och din data synkas i molnet, så du kan byta enhet utan att tappa något.' },
  { q: 'Kan jag följa mina framsteg?', a: 'Ja, det är en av kärnfunktionerna. Du ser din streak, träningshistorik, distans, tränade muskler och en översikt över alla 75 dagar. Statistiken uppdateras automatiskt varje gång du checkar av något.' },
  { q: 'Passar appen för nybörjare?', a: 'Absolut. Normal-nivån är byggd just för dig som börjar från noll, rimliga krav, en dags marginal per vecka och färdiga träningsupplägg att utgå från. Många av de bästa 75-dagarsresorna börjar där.' },
]

const LEVELS = [
  {
    key: 'normal', title: 'Normal', titleStyle: {},
    body: 'En stabil start för dig som vill bygga grunden. Krävande nog att förändra dina vanor, snällt nog att gå att kombinera med ett fullt liv.',
    points: ['Träning 4 dagar i veckan', '2 liter vatten om dagen', 'En dags marginal per vecka'],
    dark: false,
  },
  {
    key: 'hard', title: 'Hard', titleStyle: { color: 'var(--blue)' },
    body: 'Den klassiska utmaningen. Varje dag räknas, inga undantag. Här händer den verkliga förändringen för de flesta.',
    points: ['Träning varje dag, ett pass utomhus', '3 liter vatten och 10 sidor läsning', 'Daglig progressbild'],
    dark: false, rec: true,
  },
  {
    key: 'extreme', title: 'Extreme', titleStyle: {},
    body: 'För dig som redan har disciplinen och vill testa var gränsen går. Missar du en dag börjar du om från dag ett.',
    points: ['Två pass om dagen, varje dag', 'Strikt kost utan undantag', 'Noll marginal, en miss nollställer'],
    dark: true,
  },
]

const LEVEL_DETAILS: Record<string, { label: string; rows: Array<[string, string]>; cta: string }> = {
  normal: {
    label: 'Normal',
    cta: 'Börja med Normal',
    rows: [
      ['Dagliga uppgifter', '4 om dagen'],
      ['Träningskrav', '4 pass i veckan'],
      ['Vattenmål', '2 liter om dagen'],
      ['Läsning', 'Valfritt'],
      ['Progressbilder', 'Valfritt'],
      ['Återhämtning', '3 vilodagar i veckan'],
      ['Flexibilitet', 'Hög'],
      ['Missad dag', '1 dags marginal per vecka'],
    ],
  },
  hard: {
    label: 'Hard',
    cta: 'Börja med Hard',
    rows: [
      ['Dagliga uppgifter', '5 om dagen'],
      ['Träningskrav', '1 pass om dagen, ett utomhus'],
      ['Vattenmål', '3 liter om dagen'],
      ['Läsning', '10 sidor om dagen'],
      ['Progressbilder', 'Varje dag'],
      ['Återhämtning', 'Lätta pass räknas'],
      ['Flexibilitet', 'Låg'],
      ['Missad dag', 'Omstart från dag 1'],
    ],
  },
  extreme: {
    label: 'Extreme',
    cta: 'Börja med Extreme',
    rows: [
      ['Dagliga uppgifter', '6 om dagen'],
      ['Träningskrav', '2 pass om dagen'],
      ['Vattenmål', '4 liter om dagen'],
      ['Läsning', '10 sidor om dagen'],
      ['Progressbilder', 'Varje dag'],
      ['Återhämtning', 'Inga vilodagar'],
      ['Flexibilitet', 'Ingen'],
      ['Missad dag', 'Omstart från dag 1'],
    ],
  },
}

function Wave({ fill, flip }: { fill: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 1440 70" preserveAspectRatio="none" className="wave">
      {flip
        ? <path d="M0,28 C400,-8 1000,72 1440,30 L1440,0 L0,0 Z" fill={fill} />
        : <path d="M0,40 C360,75 1080,0 1440,42 L1440,70 L0,70 Z" fill={fill} />}
    </svg>
  )
}

export default function Home() {
  const [level, setLevel] = useState('hard')
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <main style={{ flex: 1 }}>
      {/* ============ HERO ============ */}
      <section style={{ position: 'relative', padding: 'clamp(110px, 15vh, 160px) 0 clamp(50px, 7vw, 90px)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -220, right: -160, width: 640, height: 640, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,91,219,0.14), transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -140, left: -180, width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,101,42,0.1), transparent 65%)', pointerEvents: 'none' }} />
        <div className="container grid gridSplit" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 'clamp(40px, 6vw, 72px)' }}>
          <div>
            <Reveal><div className="heroBadge"><span className="pulseDot" />75 dagar som förändrar dina vanor</div></Reveal>
            <Reveal delay={80}>
              <h1 className="display">75 dagar.<br />Ett <span className="gradBlue">starkare</span> liv.</h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="lead" style={{ marginBottom: 34 }}>
                Bygg disciplin, skapa bättre vanor och följ din utveckling varje
                dag med en challenge som hjälper dig att bli den bästa versionen
                av dig själv.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 40 }}>
                <Link to="/app" className="btnBlue">Starta din challenge<IconArrow size={18} strokeWidth={2.2} /></Link>
                <Link to="/appen" className="btnWhite">Utforska appen</Link>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <div className="chipRow">
                {CHIPS.map(c => (
                  <span className="chip" key={c}><span style={{ color: 'var(--orange)' }}><IconCheck size={16} strokeWidth={2.5} /></span>{c}</span>
                ))}
              </div>
            </Reveal>
          </div>
          <Reveal delay={200}>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
              <div style={{ position: 'absolute', top: '10%', left: '10%', width: '80%', height: '80%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,91,219,0.16), transparent 66%)', filter: 'blur(26px)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', inset: '-2% 4%', border: '1.5px dashed rgba(59,91,219,0.25)', borderRadius: '50%', animation: 'sfSpin 60s linear infinite', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: '2%', right: '4%', width: 14, height: 14, borderRadius: '50%', background: 'rgba(242,101,42,0.7)', animation: 'sfFloat 6s ease-in-out infinite', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', width: 'min(64%, 280px)', zIndex: 2 }}>
                <div className="phone" style={{ borderRadius: 44, padding: 10, boxShadow: '0 40px 80px rgba(20,25,45,0.35)' }}>
                  <img src={shotHome} alt="Appens hemskärm med dagens uppgifter och challenge-progress" style={{ borderRadius: 35 }} />
                </div>
              </div>
              <div style={{ position: 'absolute', right: 'max(0px, calc(50% - 290px))', bottom: '-4%', width: 'min(46%, 205px)', zIndex: 3, animation: 'sfFloat 7s ease-in-out infinite' }}>
                <div className="phone phoneSm">
                  <img src={shotProgress} alt="Framsteg-vyn med dag 42 av 75 och veckostatistik" />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ SIFFERBANDET ============ */}
      <div style={{ position: 'relative' }}>
        <Wave fill="#101B45" />
        <section className="navyBand" style={{ padding: 'clamp(30px, 4vw, 54px) 24px clamp(50px, 6vw, 80px)' }}>
          <div className="container" style={{ padding: 0 }}>
            {/* OBS: exempeldata, byts mot riktiga siffror efter lansering */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 'clamp(24px, 4vw, 48px)', textAlign: 'center' }}>
              <Reveal><div className="statNum"><CountUp value={75} /></div><div className="statLbl">dagar av fullt fokus</div></Reveal>
              <Reveal delay={80}><div className="statNum"><CountUp value={5} /></div><div className="statLbl">dagliga vanor</div></Reveal>
              <Reveal delay={160}><div className="statNum"><CountUp value={100} suffix=" %" /></div><div className="statLbl">fokus på din utveckling</div></Reveal>
              <Reveal delay={240}><div className="statNum" style={{ color: '#FF8A50' }}><CountUp value={15000} suffix="+" /></div><div className="statLbl">genomförda aktiviteter</div></Reveal>
            </div>
            <Reveal delay={300}>
              <p style={{ textAlign: 'center', color: '#8792C2', fontSize: 15.5, margin: 'clamp(32px, 4vw, 48px) auto 0', maxWidth: 520 }}>
                Skapad för personer som är redo att sluta skjuta upp sin utveckling.
              </p>
            </Reveal>
          </div>
        </section>
        <Wave fill="#101B45" flip />
      </div>

      {/* ============ SÅ FUNGERAR DET ============ */}
      <section id="sa-fungerar" style={{ scrollMarginTop: 90, padding: 'clamp(60px, 8vw, 110px) 0', position: 'relative' }}>
        <div className="container">
          <Reveal>
            <div style={{ maxWidth: 640, marginBottom: 'clamp(48px, 6vw, 72px)' }}>
              <div className="kicker">Så fungerar det</div>
              <h2 className="secTitle">Fyra steg. Sjuttiofem dagar.</h2>
              <p style={{ color: 'var(--ink2)', fontSize: 17, lineHeight: 1.65 }}>
                Utmaningen är enkel att förstå men kräver att du dyker upp varje
                dag. Så här ser resan ut.
              </p>
            </div>
          </Reveal>
          <div style={{ position: 'relative' }}>
            <svg viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 34, width: '100%', height: 120, pointerEvents: 'none' }}>
              <path d="M0,60 C200,14 400,106 600,60 C800,14 1000,106 1200,60" fill="none" stroke="rgba(59,91,219,0.3)" strokeWidth="1.5" strokeDasharray="6 8" />
            </svg>
            <div className="grid" style={{ position: 'relative', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 22 }}>
              {STEPS.map((s, i) => (
                <Reveal key={s.num} delay={i * 80} style={{ marginTop: i % 2 === 1 ? 'clamp(0px, 3vw, 36px)' : 0 }}>
                  <div className="softCard hoverLift" style={{ borderRadius: 26, padding: '30px 26px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                      <span className={`stepIcon${s.num === '04' ? ' orange' : ''}`}>{s.icon}</span>
                      <span className="stepNum">{s.num}</span>
                    </div>
                    <h3 style={{ fontWeight: 700, fontSize: 19, marginBottom: 10 }}>{s.title}</h3>
                    <p style={{ color: 'var(--ink3)', fontSize: 15, lineHeight: 1.6 }}>{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ FUNKTIONER (BENTO) ============ */}
      <section id="funktioner" style={{ scrollMarginTop: 90, padding: 'clamp(40px, 6vw, 80px) 0', position: 'relative', overflow: 'hidden' }}>
        <div className="container">
          <Reveal>
            <div style={{ maxWidth: 640, marginBottom: 'clamp(48px, 6vw, 72px)' }}>
              <div className="kicker">Funktioner</div>
              <h2 className="secTitle">Allt du behöver för att hålla i 75 dagar</h2>
              <p style={{ color: 'var(--ink2)', fontSize: 17, lineHeight: 1.65 }}>
                Direkt ur appen: kalender, träningslogg, medaljer och
                kartspårning, allt samlat på ett ställe.
              </p>
            </div>
          </Reveal>
          <div className="grid gridAuto" style={{ alignItems: 'stretch' }}>
            <Reveal style={{ gridRow: 'span 2' }}>
              <div className="softCard hoverLift" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '26px 26px 18px' }}>
                  <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Veckoschema och pass</h3>
                  <p style={{ color: 'var(--ink3)', fontSize: 14.5, lineHeight: 1.6 }}>Kalendern visar varje dags pass och uppgifter. Öppna, checka av och logga direkt.</p>
                </div>
                <div style={{ flex: 1, padding: '0 26px', overflow: 'hidden', display: 'flex', alignItems: 'flex-start' }}>
                  <img src={shotCalendar} alt="Appens kalender med träningspass och gympass" style={{ display: 'block', width: '100%', borderRadius: '24px 24px 0 0', border: '1px solid rgba(20,22,28,0.08)', borderBottom: 'none' }} />
                </div>
              </div>
            </Reveal>
            <Reveal delay={60} style={{ gridRow: 'span 2' }}>
              <div className="softCard hoverLift" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '26px 26px 18px' }}>
                  <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Cardio med GPS</h3>
                  <p style={{ color: 'var(--ink3)', fontSize: 14.5, lineHeight: 1.6 }}>Spåra löpning, cykling och promenader med karta, tempo och kalorier.</p>
                </div>
                <div style={{ flex: 1, padding: '0 26px', overflow: 'hidden', display: 'flex', alignItems: 'flex-start' }}>
                  <img src={shotGps} alt="Löpningsvy med karta över Stockholm, mål och röstguidning" style={{ display: 'block', width: '100%', borderRadius: '24px 24px 0 0', border: '1px solid rgba(20,22,28,0.08)', borderBottom: 'none' }} />
                </div>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="hoverLift" style={{ background: '#101B45', borderRadius: 28, padding: 28, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
                <h3 style={{ fontWeight: 700, fontSize: 18, color: '#FFFFFF' }}>Streaks och statistik</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ color: '#FF8A50' }}><IconFlame size={34} strokeWidth={1.8} /></span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-hd)', fontWeight: 800, fontSize: 34, letterSpacing: '-0.02em', color: '#FFFFFF', lineHeight: 1 }}>32</div>
                    <div style={{ color: '#9DA9D6', fontSize: 13, marginTop: 3 }}>dagar i rad</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[1, 1, 1, 1, 1, 0, 0].map((on, i) => (
                    <span key={i} style={{ flex: 1, height: 7, borderRadius: 4, background: on ? '#FF8A50' : 'rgba(255,255,255,0.18)' }} />
                  ))}
                </div>
                <p style={{ color: '#9DA9D6', fontSize: 14.5, lineHeight: 1.6 }}>Se din streak växa och låt den bli anledningen att inte hoppa över en dag.</p>
              </div>
            </Reveal>
            <Reveal delay={180} style={{ gridRow: 'span 2' }}>
              <div className="softCard hoverLift" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '26px 26px 18px' }}>
                  <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Medaljer och achievements</h3>
                  <p style={{ color: 'var(--ink3)', fontSize: 14.5, lineHeight: 1.6 }}>26 medaljer att låsa upp, från första dagen till hela vägen i mål.</p>
                </div>
                <div style={{ flex: 1, padding: '0 26px', overflow: 'hidden', display: 'flex', alignItems: 'flex-start' }}>
                  <img src={shotMedals} alt="Medaljsamlingen, 18 av 26 upplåsta" style={{ display: 'block', width: '100%', borderRadius: '24px 24px 0 0', border: '1px solid rgba(20,22,28,0.08)', borderBottom: 'none' }} />
                </div>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="softCard hoverLift" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
                <h3 style={{ fontWeight: 700, fontSize: 18 }}>Daglig checklista</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[{ t: 'Träningspass 45 min', done: true }, { t: 'Drick 3 liter vatten', done: true }, { t: 'Läs 10 sidor', done: false }].map(row => (
                    <div key={row.t} style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#F4F5F9', borderRadius: 14, padding: '11px 14px' }}>
                      {row.done ? (
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 21, height: 21, borderRadius: 7, background: 'var(--blue)', color: '#FFFFFF' }}>
                          <IconCheck size={12} strokeWidth={3.4} />
                        </span>
                      ) : (
                        <span style={{ width: 21, height: 21, borderRadius: 7, border: '2px solid rgba(91,100,120,0.35)' }} />
                      )}
                      <span style={{ fontSize: 14, color: row.done ? 'var(--ink3)' : 'var(--mut)', textDecoration: row.done ? 'line-through' : 'none', textDecorationColor: 'rgba(91,100,120,0.5)' }}>{row.t}</span>
                    </div>
                  ))}
                </div>
                <p style={{ color: 'var(--ink3)', fontSize: 14.5, lineHeight: 1.6 }}>Dina dagliga vanor, tydligt avprickade. Varje ruta du checkar bygger din dag.</p>
              </div>
            </Reveal>
            <Reveal delay={240} style={{ gridRow: 'span 2' }}>
              <div className="softCard hoverLift" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '26px 26px 18px' }}>
                  <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Se vad du tränat</h3>
                  <p style={{ color: 'var(--ink3)', fontSize: 14.5, lineHeight: 1.6 }}>Muskelkartan färgas in utifrån dina avbockade övningar, vecka för vecka.</p>
                </div>
                <div style={{ flex: 1, padding: '0 26px', overflow: 'hidden', display: 'flex', alignItems: 'flex-start' }}>
                  <img src={shotMuscles} alt="Tränade muskler visualiserade på kroppskarta" style={{ display: 'block', width: '100%', borderRadius: '24px 24px 0 0', border: '1px solid rgba(20,22,28,0.08)', borderBottom: 'none' }} />
                </div>
              </div>
            </Reveal>
            <Reveal delay={180}>
              <div className="softCard hoverLift" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
                <span className="stepIcon" style={{ width: 46, height: 46, borderRadius: 15 }}><IconBell /></span>
                <h3 style={{ fontWeight: 700, fontSize: 18 }}>Påminnelser</h3>
                <p style={{ color: 'var(--ink3)', fontSize: 14.5, lineHeight: 1.6 }}>Smarta notiser när dagen håller på att rinna iväg, innan det är för sent.</p>
              </div>
            </Reveal>
            <Reveal delay={240}>
              <div className="softCard hoverLift" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
                <span className="stepIcon orange" style={{ width: 46, height: 46, borderRadius: 15 }}><IconUsers /></span>
                <h3 style={{ fontWeight: 700, fontSize: 18 }}>Grupper och topplistor</h3>
                <p style={{ color: 'var(--ink3)', fontSize: 14.5, lineHeight: 1.6 }}>Bjud in familj och vänner, dela flödet och tävla om veckans topplista.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ PROGRESS ============ */}
      <div style={{ position: 'relative' }}>
        <svg viewBox="0 0 1440 70" preserveAspectRatio="none" className="wave"><path d="M0,42 C420,78 980,-6 1440,40 L1440,70 L0,70 Z" fill="#FFFFFF" /></svg>
        <section id="framsteg" style={{ scrollMarginTop: 90, background: '#FFFFFF', padding: 'clamp(40px, 6vw, 80px) 0' }}>
          <div className="container">
            <div className="grid gridSplit" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))' }}>
              <Reveal>
                <div className="kicker">Din utveckling</div>
                <h2 className="secTitle" style={{ fontSize: 'clamp(32px, 4.5vw, 50px)' }}>Se hur varje liten handling bygger något större</h2>
                <p style={{ color: 'var(--ink2)', fontSize: 17, lineHeight: 1.7, marginBottom: 18, textWrap: 'pretty' }}>
                  En avklarad checklista känns liten i stunden. Men appen samlar
                  din träning, dina vanor, din distans och din streak på samma
                  plats, och efter några veckor ser du mönstret: du är någon som
                  gör det du sagt att du ska göra.
                </p>
                <p style={{ color: 'var(--ink2)', fontSize: 17, lineHeight: 1.7 }}>
                  Varje dag du genomför läggs till din resa, och grafen pekar
                  bara åt ett håll.
                </p>
              </Reveal>
              <Reveal delay={120}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{ width: 'min(46%, 220px)' }}>
                    <div className="phone" style={{ borderRadius: 38, boxShadow: '0 26px 60px rgba(20,25,45,0.25)' }}>
                      <img src={shotProgress} alt="Framsteg-vyn med utmaningens översikt och veckostatistik" style={{ borderRadius: 30 }} />
                    </div>
                  </div>
                  <div style={{ width: 'min(46%, 220px)', marginTop: 36 }}>
                    <div className="phone" style={{ borderRadius: 38, boxShadow: '0 26px 60px rgba(20,25,45,0.25)' }}>
                      <img src={shotDistance} alt="Distansgraf över veckan med fördelning per aktivitet" style={{ borderRadius: 30 }} />
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
            <Reveal>
              <div style={{ marginTop: 'clamp(48px, 6vw, 72px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                  <span style={{ fontFamily: 'var(--font-hd)', fontWeight: 700, fontSize: 15 }}>Dag 1</span>
                  <span style={{ fontFamily: 'var(--font-hd)', fontWeight: 700, fontSize: 15, color: 'var(--blue)' }}>Dag 75</span>
                </div>
                <ProgressLine />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, color: 'var(--mut)', fontSize: 13 }}>
                  <span>Första steget</span><span>Vanorna sitter</span><span>Ny standard</span><span>I mål</span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
        <svg viewBox="0 0 1440 70" preserveAspectRatio="none" className="wave"><path d="M0,26 C420,-10 980,74 1440,28 L1440,0 L0,0 Z" fill="#FFFFFF" /></svg>
      </div>

      {/* ============ NIVÅER ============ */}
      <section id="nivaer" style={{ scrollMarginTop: 90, padding: 'clamp(50px, 7vw, 100px) 0' }}>
        <div className="container">
          <Reveal>
            <div style={{ maxWidth: 640, margin: '0 auto clamp(48px, 6vw, 72px)', textAlign: 'center' }}>
              <div className="kicker">Nivåer</div>
              <h2 className="secTitle">Välj nivån som utmanar dig</h2>
              <p style={{ color: 'var(--ink2)', fontSize: 17, lineHeight: 1.65 }}>
                Alla nivåer bygger på samma princip: 75 dagar i rad. Skillnaden
                är hur mycket varje dag kräver. Du kan alltid byta senare.
              </p>
            </div>
          </Reveal>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 22, alignItems: 'stretch' }}>
            {LEVELS.map((lv, i) => {
              const selected = level === lv.key
              return (
                <Reveal key={lv.key} delay={i * 90}>
                  <div
                    onClick={() => setLevel(lv.key)}
                    style={{
                      position: 'relative', cursor: 'pointer', height: '100%',
                      background: lv.dark ? 'linear-gradient(165deg, #151A2E, #101B45)' : '#FFFFFF',
                      border: lv.dark ? '1px solid rgba(242,101,42,0.4)' : lv.rec ? '1px solid rgba(59,91,219,0.35)' : '1px solid rgba(20,22,28,0.08)',
                      borderRadius: 30, padding: '34px 30px',
                      display: 'flex', flexDirection: 'column', gap: 16,
                      boxShadow: lv.dark ? '0 14px 44px rgba(16,27,69,0.3)' : lv.rec ? '0 10px 34px rgba(43,75,215,0.12)' : 'var(--shadow-sm)',
                      transition: 'transform 0.3s ease',
                    }}
                  >
                    {selected && (
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: 30, pointerEvents: 'none',
                        border: lv.dark ? '2px solid rgba(255,138,80,0.85)' : '2px solid rgba(59,91,219,0.85)',
                        boxShadow: lv.dark ? '0 0 60px rgba(242,101,42,0.35)' : '0 0 44px rgba(59,91,219,0.25)',
                      }} />
                    )}
                    <div style={{ fontFamily: 'var(--font-hd)', fontWeight: 700, fontSize: 22, ...(lv.dark ? { background: 'linear-gradient(120deg, #FF9D68, #F2652A)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : lv.titleStyle) }}>{lv.title}</div>
                    <p style={{ color: lv.dark ? '#AEB6D9' : 'var(--ink3)', fontSize: 15, lineHeight: 1.65, flex: 1 }}>{lv.body}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 10 }}>
                      {lv.points.map(p => (
                        <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 9, color: lv.dark ? '#C7CDE8' : 'var(--ink2)', fontSize: 14 }}>
                          <span style={{ color: lv.dark ? '#FF8A50' : 'var(--blue)', display: 'flex' }}><IconCheck size={15} strokeWidth={2.5} /></span>{p}
                        </span>
                      ))}
                    </div>
                  </div>
                </Reveal>
              )
            })}
          </div>
          {/* Detaljpanelen följer vald nivå, klicket på ett kort byter innehåll */}
          <div key={level} style={{ animation: 'lvlIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)' }}>
            <div className="softCard" style={{ marginTop: 26, borderRadius: 28, padding: 'clamp(24px, 3vw, 36px)', boxShadow: 'var(--shadow-md)', display: 'flex', flexWrap: 'wrap', gap: 'clamp(24px, 4vw, 48px)', alignItems: 'center' }}>
              <div style={{ flex: '1 1 380px' }}>
                <h3 style={{ fontWeight: 800, fontSize: 22, marginBottom: 16 }}>
                  Så ser resan ut på <span className={level === 'extreme' ? 'gradOrange' : 'gradBlue'}>{LEVEL_DETAILS[level].label}</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px 24px' }}>
                  {LEVEL_DETAILS[level].rows.map(([k, v]) => (
                    <div key={k} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 9 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--mut)' }}>{k}</div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ flex: '0 1 240px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Link to="/app" className={level === 'extreme' ? 'btnOrangeLg' : 'btnBlue'} style={{ justifyContent: 'center', fontSize: 16, padding: '15px 26px' }}>
                  {LEVEL_DETAILS[level].cta}
                </Link>
                <Link to="/challenges#jamfor" style={{ textAlign: 'center', fontWeight: 600, fontSize: 14.5 }}>
                  Jämför nivåerna i detalj
                </Link>
              </div>
            </div>
          </div>
          <Reveal>
            <p style={{ textAlign: 'center', color: 'var(--mut)', fontSize: 14.5, margin: '36px 0 0' }}>
              Osäker? Börja på Normal, du kan höja nivån när som helst under resan.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ============ MOTIVATION ============ */}
      <div style={{ margin: 'clamp(30px, 5vw, 60px) 0' }}>
        <section className="navyCard" style={{ position: 'relative', minHeight: 480, display: 'flex', alignItems: 'center', padding: 'clamp(70px, 9vw, 120px) 24px', overflow: 'hidden', maxWidth: 1320, margin: '0 auto', width: 'calc(100% - 28px)' }}>
          <div style={{ position: 'absolute', top: -140, right: -100, width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,101,42,0.2), transparent 62%), radial-gradient(circle, rgba(59,91,219,0.15), transparent 70%)', pointerEvents: 'none' }} />
          <div className="container" style={{ position: 'relative' }}>
            <Reveal>
              <div style={{ maxWidth: 560, background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 34, padding: 'clamp(30px, 4vw, 48px)' }}>
                <h2 style={{ fontWeight: 800, fontSize: 'clamp(30px, 4vw, 46px)', letterSpacing: '-0.025em', lineHeight: 1.12, marginBottom: 20, color: '#FFFFFF' }}>Det handlar inte bara om träning</h2>
                <p style={{ color: '#C7CDE8', fontSize: 17, lineHeight: 1.7, marginBottom: 16, textWrap: 'pretty' }}>
                  De 75 dagarna handlar lika mycket om det som händer mellan
                  passen: att gå och lägga sig i tid, dricka vattnet, läsa
                  sidorna, och märka att du faktiskt gör det.
                </p>
                <p style={{ color: '#C7CDE8', fontSize: 17, lineHeight: 1.7 }}>
                  Varje löfte du håller till dig själv bygger självförtroende.
                  Det är den mentala styrkan som sitter kvar långt efter dag 75.
                </p>
              </div>
            </Reveal>
          </div>
        </section>
      </div>

      {/* ============ OMDÖMEN ============ */}
      <section id="resultat" style={{ scrollMarginTop: 90, padding: 'clamp(40px, 6vw, 80px) 0' }}>
        <div className="container">
          <div className="grid gridSplit" style={{ marginBottom: 'clamp(48px, 6vw, 64px)' }}>
            <Reveal>
              <div className="kicker">Resultat</div>
              <h2 className="secTitle">Vad 75 dagar kan göra</h2>
              <p style={{ color: 'var(--ink2)', fontSize: 17, lineHeight: 1.65, marginBottom: 14 }}>
                Röster från personer som tagit sig hela vägen, och gjort resan
                tillsammans.
              </p>
              <p style={{ color: 'var(--ink2)', fontSize: 17, lineHeight: 1.65 }}>
                Skapa en grupp med familj och vänner, dela flödet och låt
                veckans topplista göra jobbet med motivationen.
              </p>
            </Reveal>
            <Reveal delay={120}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 'min(60%, 250px)' }}>
                  <div className="phone">
                    <img src={shotGroup} alt="Gruppvy med veckans topplista och delat flöde" />
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
          {/* OBS: exempelomdömen, byts mot riktiga före lansering */}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))', gap: 22 }}>
            {QUOTES.map((q, i) => (
              <Reveal key={q.init} delay={i * 90}>
                <div className="softCard hoverLift" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
                  <span style={{ fontFamily: 'var(--font-hd)', fontWeight: 800, fontSize: 40, lineHeight: 0.6, color: 'rgba(59,91,219,0.5)' }}>&#8220;</span>
                  <p style={{ color: '#3A4154', fontSize: 15.5, lineHeight: 1.7, flex: 1 }}>{q.q}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                    <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(59,91,219,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-hd)', fontWeight: 700, fontSize: 15, color: 'var(--blue)' }}>{q.init}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{q.name}</div>
                      <div style={{ color: 'var(--mut)', fontSize: 13 }}>{q.sub}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" style={{ scrollMarginTop: 90, padding: 'clamp(50px, 7vw, 100px) 0' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 'clamp(40px, 5vw, 56px)' }}>
              <div className="kicker">Vanliga frågor</div>
              <h2 className="secTitle" style={{ fontSize: 'clamp(32px, 4.5vw, 48px)' }}>Bra att veta innan du börjar</h2>
            </div>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={i * 40}>
                <div className="faqItem">
                  <button type="button" className="faqBtn" onClick={() => setOpenFaq(o => (o === i ? null : i))}>
                    {f.q}
                    <span className={`faqChev${openFaq === i ? ' open' : ''}`} style={{ color: 'var(--blue)' }}>
                      <IconChevDown size={18} strokeWidth={2.2} />
                    </span>
                  </button>
                  <div className={`faqBody${openFaq === i ? ' open' : ''}`}>
                    <div><p>{f.a}</p></div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section id="cta" className="navyCard" style={{ scrollMarginTop: 90, position: 'relative', padding: 'clamp(70px, 10vw, 140px) 24px', overflow: 'hidden', margin: '0 auto', maxWidth: 1320, width: 'calc(100% - 28px)' }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 900, height: 900, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,101,42,0.2), transparent 62%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(88vw, 640px)', aspectRatio: '1', pointerEvents: 'none' }}>
          <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%', animation: 'sfSpin 40s linear infinite' }}>
            <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="4 10" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <Reveal><h2 style={{ fontWeight: 800, fontSize: 'clamp(36px, 5.5vw, 64px)', letterSpacing: '-0.03em', lineHeight: 1.06, marginBottom: 22, color: '#FFFFFF' }}>Din förändring börjar med dag ett</h2></Reveal>
          <Reveal delay={80}>
            <p style={{ color: '#C7CDE8', fontSize: 'clamp(17px, 2vw, 19px)', lineHeight: 1.7, margin: '0 auto 38px', maxWidth: 520, textWrap: 'pretty' }}>
              Du behöver inte förändra hela ditt liv idag. Du behöver bara börja
              och fortsätta en dag i taget.
            </p>
          </Reveal>
          <Reveal delay={160}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 30 }}>
              <Link to="/app" className="btnOrangeLg">Starta min 75-dagarsresa<IconArrow size={20} strokeWidth={2.4} /></Link>
            </div>
          </Reveal>
          <Reveal delay={240}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, border: '1px solid rgba(255,255,255,0.25)', borderRadius: 999, padding: '10px 22px', color: '#9DA9D6', fontSize: 14, fontWeight: 600 }}>
              <span className="pulseDot" />Snart på App Store
            </span>
          </Reveal>
        </div>
      </section>
    </main>
  )
}
