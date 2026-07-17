import type { Ionicons } from '@expo/vector-icons'

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
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  unlocked: boolean
  /** T.ex. "12/25" för låsta medaljer med mätbart mål */
  progress?: string
}

export function computeAchievements(input: AchievementInput): Achievement[] {
  const { completedDays, streak, totalWorkouts, totalCardio, totalKm, prCount } = input

  const days = (goal: number) =>
    completedDays >= goal ? undefined : `${completedDays}/${goal}`

  return [
    { id: 'day1',       title: 'Första dagen',    description: 'Klara din första dag',              icon: 'flag-outline',      unlocked: completedDays >= 1 },
    { id: 'day10',      title: 'Dag 10',          description: 'Klara 10 dagar',                    icon: 'calendar-outline',  unlocked: completedDays >= 10, progress: days(10) },
    { id: 'day25',      title: 'En tredjedel',    description: 'Klara 25 dagar',                    icon: 'calendar-outline',  unlocked: completedDays >= 25, progress: days(25) },
    { id: 'day50',      title: 'Halvvägs',        description: 'Klara 50 dagar',                    icon: 'calendar-outline',  unlocked: completedDays >= 50, progress: days(50) },
    { id: 'day75',      title: 'Hela vägen',      description: 'Klara alla 75 dagar',               icon: 'trophy-outline',    unlocked: completedDays >= 75, progress: days(75) },
    { id: 'streak7',    title: 'En hel vecka',    description: '7 dagars streak',                   icon: 'flame-outline',     unlocked: streak >= 7,  progress: streak >= 7 ? undefined : `${streak}/7` },
    { id: 'streak30',   title: 'Ostoppbar',       description: '30 dagars streak',                  icon: 'flame-outline',     unlocked: streak >= 30, progress: streak >= 30 ? undefined : `${streak}/30` },
    { id: 'workout1',   title: 'Första passet',   description: 'Genomför ditt första pass',         icon: 'barbell-outline',   unlocked: totalWorkouts >= 1 },
    { id: 'workout25',  title: '25 pass',         description: 'Genomför 25 pass',                  icon: 'barbell-outline',   unlocked: totalWorkouts >= 25, progress: totalWorkouts >= 25 ? undefined : `${totalWorkouts}/25` },
    { id: 'workout75',  title: '75 pass',         description: 'Genomför 75 pass',                  icon: 'barbell-outline',   unlocked: totalWorkouts >= 75, progress: totalWorkouts >= 75 ? undefined : `${totalWorkouts}/75` },
    { id: 'run1',       title: 'Första rundan',   description: 'Spåra ditt första cardiopass',      icon: 'walk-outline',      unlocked: totalCardio >= 1 },
    { id: 'km25',       title: '25 kilometer',    description: 'Nå 25 km total distans',            icon: 'map-outline',       unlocked: totalKm >= 25,  progress: totalKm >= 25 ? undefined : `${Math.floor(totalKm)}/25 km` },
    { id: 'km100',      title: '100 kilometer',   description: 'Nå 100 km total distans',           icon: 'map-outline',       unlocked: totalKm >= 100, progress: totalKm >= 100 ? undefined : `${Math.floor(totalKm)}/100 km` },
    { id: 'pr1',        title: 'Första rekordet', description: 'Sätt ditt första personliga rekord', icon: 'trophy-outline',   unlocked: prCount >= 1 },
    { id: 'pr5',        title: 'Rekordjägare',    description: 'Håll rekord i 5 olika övningar',    icon: 'trophy-outline',    unlocked: prCount >= 5, progress: prCount >= 5 ? undefined : `${prCount}/5` },
  ]
}
