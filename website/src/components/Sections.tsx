import type { CSSProperties, ReactNode } from 'react'
import { Reveal } from './Reveal'

/** Sidhuvud för undersidorna: kicker, rubrik och ingress med radiell ton */
export function PageHero({ kicker, title, lead, orange }: {
  kicker: string
  title: ReactNode
  lead: string
  orange?: boolean
}) {
  return (
    <section style={{ position: 'relative', padding: 'clamp(120px, 16vh, 160px) 0 clamp(30px, 4vw, 50px)', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: -200, right: -140, width: 560, height: 560, borderRadius: '50%',
        background: orange
          ? 'radial-gradient(circle, rgba(242,101,42,0.12), transparent 65%)'
          : 'radial-gradient(circle, rgba(59,91,219,0.13), transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div className="container">
        <Reveal>
          <div style={{ maxWidth: 680 }}>
            <div className="kicker">{kicker}</div>
            <h1 className="pageTitle">{title}</h1>
            <p style={{ color: 'var(--ink2)', fontSize: 'clamp(17px, 2vw, 19px)', lineHeight: 1.65, maxWidth: 560, textWrap: 'pretty' }}>{lead}</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/** Telefonram för appskärmar */
export function Phone({ src, alt, width = 'min(62%, 260px)', style }: {
  src: string
  alt: string
  width?: string
  style?: CSSProperties
}) {
  return (
    <div style={{ width, ...style }}>
      <div className="phone">
        <img src={src} alt={alt} loading="lazy" />
      </div>
    </div>
  )
}

/** Tvåspaltssektion: text + innehåll, valfritt inbäddad i ett vitt kort */
export function Split({ id, card, children }: { id?: string; card?: boolean; children: ReactNode }) {
  const inner = (
    <div className="grid gridSplit">{children}</div>
  )
  return (
    <section id={id} style={{ scrollMarginTop: 90, padding: 'clamp(30px, 4vw, 60px) 0' }}>
      <div className="container">
        {card ? (
          <div className="softCard" style={{ borderRadius: 'clamp(28px, 4vw, 44px)', padding: 'clamp(28px, 4vw, 56px)', boxShadow: 'var(--shadow-md)' }}>
            {inner}
          </div>
        ) : inner}
      </div>
    </section>
  )
}

export function SectionText({ kicker, title, children }: { kicker?: string; title: string; children: ReactNode }) {
  return (
    <Reveal>
      {kicker && <div className="kicker" style={{ marginBottom: 12 }}>{kicker}</div>}
      <h2 className="secTitleSm">{title}</h2>
      {children}
    </Reveal>
  )
}

export function P({ children, last }: { children: ReactNode; last?: boolean }) {
  return <p style={{ color: 'var(--ink2)', fontSize: 17, lineHeight: 1.7, marginBottom: last ? 0 : 14 }}>{children}</p>
}

/** Tom bildram: markerar var ett riktigt foto ska in senare. Bilderna
    väljs manuellt, lägg aldrig in något här på eget bevåg. */
export function PhotoSlot({ ratio = '16 / 10', label, radius = 28 }: {
  ratio?: string
  label: string
  radius?: number
}) {
  return (
    <div style={{
      aspectRatio: ratio,
      background: 'linear-gradient(160deg, #E9ECF4, #DDE2EE)',
      border: '1.5px dashed rgba(59, 91, 219, 0.35)',
      borderRadius: radius,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 10, padding: 20,
    }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#8A93A8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="M4 18l5-5 3 3 4-4 4 4" />
      </svg>
      <span style={{ fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: 12, color: '#6B7590', textAlign: 'center', lineHeight: 1.5, maxWidth: '85%' }}>
        Bildplats: {label}
      </span>
    </div>
  )
}
