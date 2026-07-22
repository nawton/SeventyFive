// Gemensamma tal- och tidsformat för statistiken — en enda sanning i stället
// för kopior i varje vy (en buggfix här når alla).

/** "1 h 23 min" eller "45 min" */
export function fmtDuration(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600)
  const m = Math.round((totalSecs % 3600) / 60)
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

/** Tempo "5:42" (min/enhet) — '--:--' vid ogiltigt värde */
export function fmtPace(secsPerUnit: number): string {
  if (!Number.isFinite(secsPerUnit) || secsPerUnit <= 0) return '--:--'
  const m = Math.floor(secsPerUnit / 60)
  const s = Math.floor(secsPerUnit % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Klocktid "1:23:45" eller "23:45" */
export function fmtTime(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Relativ tid "nu" / "12 min" / "3 h" / "2 d" — för kommentarer och notiser */
export function timeAgo(iso: string, now = new Date()): string {
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'nu'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}
