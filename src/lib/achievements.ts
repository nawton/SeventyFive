import type { Ionicons } from '@expo/vector-icons'
import type { MedalTier } from '@/components/MedalBadge'

// =============================================================================
// MEDALJER
// Beräknas ur befintlig data varje gång skärmen öppnas — inget sparas.
// =============================================================================

export interface AchievementInput {
  completedDays: number     // klarade utmaningsdagar
  streak: number            // nuvarande streak
  totalWorkouts: number     // loggade pass (styrka + cardio + avbockade schemapass)
  totalCardio: number       // antal GPS-cardiopass
  totalKm: number           // total GPS-distans
  prCount: number           // antal övningar med rekord
  longestRunKm: number      // längsta enskilda cardiopass
  bestPace3kSec: number     // bästa tempo (sek/km) på pass ≥ 3 km, Infinity om inget
  biggestWeekKm: number     // mest distans under en och samma vecka
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  tier: MedalTier
  unlocked: boolean
  /** T.ex. "12/25" för låsta medaljer med mätbart mål */
  progress?: string
}

export function computeAchievements(input: AchievementInput): Achievement[] {
  const {
    completedDays, streak, totalWorkouts, totalCardio, totalKm, prCount,
    longestRunKm, bestPace3kSec, biggestWeekKm,
  } = input

  const days = (goal: number) =>
    completedDays >= goal ? undefined : `${completedDays}/${goal}`

  return [
    { id: 'day1',       title: 'Första dagen',    description: 'Klara din första dag',              icon: 'flag',      tier: 'bronze',   unlocked: completedDays >= 1 },
    { id: 'day10',      title: 'Dag 10',          description: 'Klara 10 dagar',                    icon: 'calendar',  tier: 'bronze',   unlocked: completedDays >= 10, progress: days(10) },
    { id: 'day25',      title: 'En tredjedel',    description: 'Klara 25 dagar',                    icon: 'calendar',  tier: 'silver',   unlocked: completedDays >= 25, progress: days(25) },
    { id: 'day50',      title: 'Halvvägs',        description: 'Klara 50 dagar',                    icon: 'calendar',  tier: 'gold',     unlocked: completedDays >= 50, progress: days(50) },
    { id: 'day75',      title: 'Hela vägen',      description: 'Klara alla 75 dagar',               icon: 'trophy',    tier: 'platinum', unlocked: completedDays >= 75, progress: days(75) },
    { id: 'streak7',    title: 'En hel vecka',    description: '7 dagars streak',                   icon: 'flame',     tier: 'silver',   unlocked: streak >= 7,  progress: streak >= 7 ? undefined : `${streak}/7` },
    { id: 'streak30',   title: 'Ostoppbar',       description: '30 dagars streak',                  icon: 'flame',     tier: 'gold',     unlocked: streak >= 30, progress: streak >= 30 ? undefined : `${streak}/30` },
    { id: 'workout1',   title: 'Första passet',   description: 'Genomför ditt första pass',         icon: 'barbell',   tier: 'bronze',   unlocked: totalWorkouts >= 1 },
    { id: 'workout25',  title: '25 pass',         description: 'Genomför 25 pass',                  icon: 'barbell',   tier: 'silver',   unlocked: totalWorkouts >= 25, progress: totalWorkouts >= 25 ? undefined : `${totalWorkouts}/25` },
    { id: 'workout75',  title: '75 pass',         description: 'Genomför 75 pass',                  icon: 'barbell',   tier: 'gold',     unlocked: totalWorkouts >= 75, progress: totalWorkouts >= 75 ? undefined : `${totalWorkouts}/75` },
    { id: 'run1',       title: 'Första rundan',   description: 'Spåra ditt första cardiopass',      icon: 'walk',      tier: 'bronze',   unlocked: totalCardio >= 1 },
    { id: 'km25',       title: '25 kilometer',    description: 'Nå 25 km total distans',            icon: 'map',       tier: 'silver',   unlocked: totalKm >= 25,  progress: totalKm >= 25 ? undefined : `${Math.floor(totalKm)}/25 km` },
    { id: 'km100',      title: '100 kilometer',   description: 'Nå 100 km total distans',           icon: 'map',       tier: 'gold',     unlocked: totalKm >= 100, progress: totalKm >= 100 ? undefined : `${Math.floor(totalKm)}/100 km` },
    { id: 'pr1',        title: 'Första rekordet', description: 'Sätt ditt första personliga rekord', icon: 'trophy',   tier: 'silver',   unlocked: prCount >= 1 },
    { id: 'pr5',        title: 'Rekordjägare',    description: 'Håll rekord i 5 olika övningar',    icon: 'trophy',    tier: 'gold',     unlocked: prCount >= 5, progress: prCount >= 5 ? undefined : `${prCount}/5` },

    // ── Utökade medaljer ──
    { id: 'streak3',    title: 'Tre i rad',       description: '3 dagars streak',                   icon: 'flame',     tier: 'bronze',   unlocked: streak >= 3,  progress: streak >= 3 ? undefined : `${streak}/3` },
    { id: 'workout150', title: 'Maskinen',        description: 'Genomför 150 pass',                 icon: 'barbell',   tier: 'platinum', unlocked: totalWorkouts >= 150, progress: totalWorkouts >= 150 ? undefined : `${totalWorkouts}/150` },
    { id: 'run10',      title: 'Tio rundor',      description: 'Spåra 10 cardiopass',               icon: 'walk',      tier: 'silver',   unlocked: totalCardio >= 10, progress: totalCardio >= 10 ? undefined : `${totalCardio}/10` },
    { id: 'run50',      title: 'Vägslitaren',     description: 'Spåra 50 cardiopass',               icon: 'walk',      tier: 'gold',     unlocked: totalCardio >= 50, progress: totalCardio >= 50 ? undefined : `${totalCardio}/50` },
    { id: 'km250',      title: '250 kilometer',   description: 'Nå 250 km total distans',           icon: 'map',       tier: 'platinum', unlocked: totalKm >= 250, progress: totalKm >= 250 ? undefined : `${Math.floor(totalKm)}/250 km` },
    { id: 'km500',      title: '500 kilometer',   description: 'Nå 500 km total distans',           icon: 'map',       tier: 'diamond',  unlocked: totalKm >= 500, progress: totalKm >= 500 ? undefined : `${Math.floor(totalKm)}/500 km` },
    { id: 'mil10',      title: 'Milen',           description: 'Spring 10 km i ett och samma pass', icon: 'fitness',   tier: 'gold',     unlocked: longestRunKm >= 10,   progress: longestRunKm >= 10 ? undefined : `${longestRunKm.toFixed(1)}/10 km` },
    { id: 'halfmara',   title: 'Halvmara',        description: '21,1 km i ett och samma pass',      icon: 'fitness',   tier: 'platinum', unlocked: longestRunKm >= 21.1, progress: longestRunKm >= 21.1 ? undefined : `${longestRunKm.toFixed(1)}/21,1 km` },
    { id: 'pace5',      title: 'Snabbfoting',     description: 'Tempo under 5:00 per km på minst 3 km', icon: 'flash', tier: 'gold',     unlocked: bestPace3kSec <= 300 },
    { id: 'week30',     title: 'Storvecka',       description: '30 km under en och samma vecka',    icon: 'trending-up', tier: 'gold',   unlocked: biggestWeekKm >= 30, progress: biggestWeekKm >= 30 ? undefined : `${Math.floor(biggestWeekKm)}/30 km` },
    { id: 'pr10',       title: 'Rekordsamlare',   description: 'Håll rekord i 10 olika övningar',   icon: 'trophy',    tier: 'platinum', unlocked: prCount >= 10, progress: prCount >= 10 ? undefined : `${prCount}/10` },
  ]
}
