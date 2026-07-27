// =============================================================================
// EXEMPELDATA för demosidan och andra ytor på sajten. Allt här är påhittat
// och visas alltid under en tydlig "demo"-märkning, aldrig som riktig
// statistik. Namnen är generiska exempelnamn.
// =============================================================================

export const DEMO_CHALLENGE = {
  day: 42,
  total: 75,
  level: 'Hard',
  streak: 42,
  completed: 39,
  missed: 3,
  successRate: 93,
}

/** Kg lyft per vecka, senaste sex veckorna */
export const DEMO_VOLUME = [
  { label: 'v.25', kg: 3200 },
  { label: 'v.26', kg: 4100 },
  { label: 'v.27', kg: 3800 },
  { label: 'v.28', kg: 5200 },
  { label: 'v.29', kg: 6100 },
  { label: 'v.30', kg: 6800 },
]

/** Km per månad, senaste sex månaderna */
export const DEMO_DISTANCE = [
  { label: 'feb', km: 12 },
  { label: 'mars', km: 18 },
  { label: 'apr', km: 24 },
  { label: 'maj', km: 22 },
  { label: 'juni', km: 31 },
  { label: 'juli', km: 38 },
]

/** Fördelning av loggade set per muskelgrupp */
export const DEMO_MUSCLES = [
  { name: 'Ben', pct: 26 },
  { name: 'Bröst', pct: 22 },
  { name: 'Rygg', pct: 19 },
  { name: 'Armar', pct: 13 },
  { name: 'Axlar', pct: 12 },
  { name: 'Mage', pct: 8 },
]

export const DEMO_LEADERBOARD = [
  { name: 'Elin Berg', km: 32.4, passes: 9 },
  { name: 'Hugo Lind', km: 28.1, passes: 8 },
  { name: 'Alex Ström', km: 24.6, passes: 10 },
  { name: 'Vera Holm', km: 19.2, passes: 7 },
  { name: 'Noah Falk', km: 14.8, passes: 6 },
]

export const DEMO_FEED = [
  { name: 'Elin Berg', action: 'sprang 8,2 km på 44:51', time: 'för 18 minuter sedan', likes: 12, kind: 'cardio' as const },
  { name: 'Alex Ström', action: 'genomförde dag 42 av 75', time: 'för 1 timme sedan', likes: 23, kind: 'day' as const },
  { name: 'Hugo Lind', action: 'loggade Överkropp, 14 400 kg volym', time: 'för 2 timmar sedan', likes: 9, kind: 'gym' as const },
  { name: 'Vera Holm', action: 'låste upp medaljen En hel vecka', time: 'för 3 timmar sedan', likes: 17, kind: 'medal' as const },
  { name: 'Noah Falk', action: 'promenerade 4,1 km i lunchsolen', time: 'för 5 timmar sedan', likes: 6, kind: 'cardio' as const },
]

/** 75-dagarsöversikten: klarade, missade och kommande dagar */
export const DEMO_DAYS: Array<'done' | 'missed' | 'left'> = Array.from({ length: 75 }, (_, i) => {
  if (i >= 42) return 'left'
  if (i === 11 || i === 23 || i === 30) return 'missed'
  return 'done'
})

/** Splits från ett exempelpass, min/km per kilometer */
export const DEMO_SPLITS = [
  { km: 1, pace: '5:41' },
  { km: 2, pace: '5:28' },
  { km: 3, pace: '5:35' },
  { km: 4, pace: '5:19' },
  { km: 5, pace: '4:58' },
]

export const initials = (name: string) =>
  name.split(' ').map(w => w[0]).join('').toUpperCase()
