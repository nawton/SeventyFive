import type { Ionicons } from '@expo/vector-icons'
import type { MedalTier } from '@/components/MedalBadge'
import { parseLocalDate, startOfWeek, toLocalDateString } from '@/lib/date'

// =============================================================================
// NIVÅSYSTEM
// Poäng tjänas på aktiviteter — men med tak per dag/vecka (à la Runna) så det
// inte går att farma poäng genom att spamma samma aktivitet. Taken appliceras
// historiskt på riktiga datum. Trösklarna är kalibrerade så att en fullbordad
// 75-dagarsutmaning landar på Diamant.
// =============================================================================

export interface LevelTier {
  id: string
  name: string
  threshold: number
  tier: MedalTier
}

export const LEVEL_TIERS: LevelTier[] = [
  { id: 'bronze',   name: 'Brons',   threshold: 0,    tier: 'bronze' },
  { id: 'silver',   name: 'Silver',  threshold: 750,  tier: 'silver' },
  { id: 'gold',     name: 'Guld',    threshold: 2000, tier: 'gold' },
  { id: 'platinum', name: 'Platina', threshold: 4500, tier: 'platinum' },
  { id: 'diamond',  name: 'Diamant', threshold: 7500, tier: 'diamond' },
]

// ─── Poängregler med tak ─────────────────────────────────────────────────────

const PTS = {
  day:      50,
  session:  20,
  cardio:   30,
  strength: 20,
  pr:       40,
  medal:    100,
} as const

const CAPS = {
  sessionsPerDay:   2,   // avbockade schemapass
  cardioPerDay:     1,   // GPS-pass
  strengthPerWeek:  3,   // loggade styrkepass
  prPerWeek:        3,   // personliga rekord
} as const

export const POINT_RULES: Array<{
  label: string
  pts: number
  cap: string
  icon: React.ComponentProps<typeof Ionicons>['name']
}> = [
  { label: 'Klarad utmaningsdag',   pts: PTS.day,      cap: 'Max 1 per dag',    icon: 'checkmark-circle-outline' },
  { label: 'Avbockat schemapass',   pts: PTS.session,  cap: `Max ${CAPS.sessionsPerDay} per dag`,   icon: 'barbell-outline' },
  { label: 'GPS-spårat cardiopass', pts: PTS.cardio,   cap: `Max ${CAPS.cardioPerDay} per dag`,     icon: 'walk-outline' },
  { label: 'Loggat styrkepass',     pts: PTS.strength, cap: `Max ${CAPS.strengthPerWeek} per vecka`, icon: 'fitness-outline' },
  { label: 'Personligt rekord',     pts: PTS.pr,       cap: `Max ${CAPS.prPerWeek} per vecka`,      icon: 'trophy-outline' },
  { label: 'Upplåst medalj',        pts: PTS.medal,    cap: 'Engångs',          icon: 'ribbon-outline' },
]

// ─── Engångspoäng ────────────────────────────────────────────────────────────

export const ONE_TIME_RULES: Array<{
  id: keyof OneTimeInput
  label: string
  pts: number
  icon: React.ComponentProps<typeof Ionicons>['name']
}> = [
  { id: 'hasAvatar',        label: 'Lägg till en profilbild',            pts: 50,  icon: 'person-circle-outline' },
  { id: 'hasProgressPhoto', label: 'Ladda upp ditt första framstegsfoto', pts: 50,  icon: 'camera-outline' },
  { id: 'hasSchedule',      label: 'Skapa ett träningsschema',           pts: 100, icon: 'calendar-outline' },
  { id: 'hasCustomRule',    label: 'Lägg till en egen regel',            pts: 50,  icon: 'create-outline' },
]

export interface OneTimeInput {
  hasAvatar: boolean
  hasProgressPhoto: boolean
  hasSchedule: boolean
  hasCustomRule: boolean
}

// ─── Beräkning ───────────────────────────────────────────────────────────────

export interface PointsEvents {
  completedDays: number     // klarade utmaningsdagar (max 1/dag per definition)
  sessionDates: string[]    // YYYY-MM-DD per avbockat schemapass
  cardioDates: string[]     // datum per GPS-cardiopass
  strengthDates: string[]   // datum per loggat styrkepass
  prDates: string[]         // datum per personligt rekord
  medalsUnlocked: number
}

/** En rad i "Dina poäng"-breakdownen. */
export interface PointSource {
  label: string
  detail: string
  pts: number
  icon: React.ComponentProps<typeof Ionicons>['name']
}

/** Summerar antal händelser med tak per kalenderdag. */
function countCappedPerDay(dates: string[], maxPerDay: number): number {
  const byDay: Record<string, number> = {}
  for (const d of dates) byDay[d] = (byDay[d] ?? 0) + 1
  return Object.values(byDay).reduce((sum, n) => sum + Math.min(n, maxPerDay), 0)
}

/** Summerar antal händelser med tak per kalendervecka (mån–sön). */
function countCappedPerWeek(dates: string[], maxPerWeek: number): number {
  const byWeek: Record<string, number> = {}
  for (const d of dates) {
    const key = toLocalDateString(startOfWeek(parseLocalDate(d)))
    byWeek[key] = (byWeek[key] ?? 0) + 1
  }
  return Object.values(byWeek).reduce((sum, n) => sum + Math.min(n, maxPerWeek), 0)
}

export function computePoints(e: PointsEvents, one: OneTimeInput): {
  total: number
  sources: PointSource[]
} {
  const sessions = countCappedPerDay(e.sessionDates, CAPS.sessionsPerDay)
  const cardio   = countCappedPerDay(e.cardioDates, CAPS.cardioPerDay)
  const strength = countCappedPerWeek(e.strengthDates, CAPS.strengthPerWeek)
  const prs      = countCappedPerWeek(e.prDates, CAPS.prPerWeek)
  const oneTimePts = ONE_TIME_RULES.reduce((sum, r) => sum + (one[r.id] ? r.pts : 0), 0)

  const sources: PointSource[] = [
    { label: 'Klarade dagar',    detail: `${e.completedDays} dagar`,  pts: e.completedDays * PTS.day,   icon: 'checkmark-circle-outline' },
    { label: 'Schemapass',       detail: `${sessions} pass`,          pts: sessions * PTS.session,      icon: 'barbell-outline' },
    { label: 'Cardiopass',       detail: `${cardio} pass`,            pts: cardio * PTS.cardio,         icon: 'walk-outline' },
    { label: 'Styrkepass',       detail: `${strength} pass`,          pts: strength * PTS.strength,     icon: 'fitness-outline' },
    { label: 'Personliga rekord', detail: `${prs} rekord`,            pts: prs * PTS.pr,                icon: 'trophy-outline' },
    { label: 'Medaljer',         detail: `${e.medalsUnlocked} upplåsta`, pts: e.medalsUnlocked * PTS.medal, icon: 'ribbon-outline' },
    { label: 'Engångsmål',       detail: `${ONE_TIME_RULES.filter(r => one[r.id]).length} av ${ONE_TIME_RULES.length}`, pts: oneTimePts, icon: 'star-outline' },
  ].filter(sr => sr.pts > 0)

  return {
    total: sources.reduce((sum, sr) => sum + sr.pts, 0),
    sources,
  }
}

export function levelFor(points: number): {
  current: LevelTier
  next: LevelTier | null
  /** 0–1 mot nästa nivå (1 om högsta nivån nåtts) */
  progress: number
} {
  let current = LEVEL_TIERS[0]
  for (const t of LEVEL_TIERS) {
    if (points >= t.threshold) current = t
  }
  const idx  = LEVEL_TIERS.indexOf(current)
  const next = LEVEL_TIERS[idx + 1] ?? null
  const progress = next
    ? Math.min(1, (points - current.threshold) / (next.threshold - current.threshold))
    : 1
  return { current, next, progress }
}
