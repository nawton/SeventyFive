import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

// Avslöjning vid skroll: elementet glider upp och tonar in när det når
// viewporten, med valfri fördröjning så syskon trillar in i tur och ordning.
export function Reveal({ delay = 0, className, style, children }: {
  delay?: number
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.style.opacity = '0'
    el.style.transform = 'translateY(26px)'
    el.style.transition = 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.22,1,0.36,1)'
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return
      el.style.transitionDelay = delay + 'ms'
      el.style.opacity = '1'
      el.style.transform = 'none'
      io.unobserve(el)
    }), { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [delay])
  return <div ref={ref} className={className} style={style}>{children}</div>
}

/** Räknare som tickar upp till målet när den blir synlig */
export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fmt = (n: number) => n.toLocaleString('sv-SE')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = fmt(value) + suffix
      return
    }
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return
      io.unobserve(el)
      const t0 = performance.now()
      const dur = 1600
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / dur)
        el.textContent = fmt(Math.round(value * (1 - Math.pow(1 - p, 3)))) + suffix
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }), { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [value, suffix])
  return <span ref={ref}>{value.toLocaleString('sv-SE')}{suffix}</span>
}

/** Progresslinjen som fylls till 100 % när den skrollas fram */
export function ProgressLine() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.transition = 'none'
      el.style.width = '100%'
      return
    }
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { el.style.width = '100%'; io.unobserve(el) }
    }), { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div className="plTrack">
      <div ref={ref} className="plFill" />
    </div>
  )
}
