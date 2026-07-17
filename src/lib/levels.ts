import type { Ionicons } from '@expo/vector-icons'
import type { MedalTier } from '@/components/MedalBadge'

// =============================================================================
// NIVÅSYSTEM
// Poäng tjänas på allt man gör i appen; nivåerna (Brons → Diamant) kräver att
// man samlar poäng från många olika håll — trösklarna är kalibrerade så att en
// fullbordad 75-dagarsutmaning (~7 500 p) landar på Diamant.
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

export const POINT_RULES: Array<{ label: string; pts: number; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { label: 'Klarad utmaningsdag',    pts: 50,  icon: 'checkmark-circle-outline' },
  { label: 'Avbockat schemapass',    pts: 20,  icon: 'barbell-outline' },
  { label: 'GPS-spårat cardiopass',  pts: 30,  icon: 'walk-outline' },
  { label: 'Loggat styrkepass',      pts: 20,  icon: 'fitness-outline' },
  { label: 'Personligt rekord',      pts: 40,  icon: 'trophy-outline' },
  { label: 'Upplåst medalj',         pts: 100, icon: 'ribbon-outline' },
]

export interface PointsInput {
  completedDays: number
  sessionCount: number
  cardioCount: number
  strengthCount: number
  prCount: number
  medalsUnlocked: number
}

export function computePoints(i: PointsInput): number {
  return (
    i.completedDays  * 50 +
    i.sessionCount   * 20 +
    i.cardioCount    * 30 +
    i.strengthCount  * 20 +
    i.prCount        * 40 +
    i.medalsUnlocked * 100
  )
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
