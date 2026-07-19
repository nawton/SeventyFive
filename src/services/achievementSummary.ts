import { computeAchievements } from '@/lib/achievements'
import { getCardioWorkouts, getStrengthWorkouts } from '@/services/workouts'
import { getCompletedSessionsHistory } from '@/services/workoutSchedule'
import { getPersonalRecords } from '@/services/personalRecords'
import { countCompletedDays, getStreak } from '@/services/dailyLog'
import { toLocalDateString, startOfWeek } from '@/lib/date'

// Kompakt sammanfattning av medaljer och rekord — för profilens
// Rekord & medaljer-rad. Samma beräkning som rekordsidan, utan UI-data.

export interface AchievementSummary {
  medalsUnlocked: number
  medalsTotal: number
  /** Personliga styrkerekord + satta cardiorekord */
  recordCount: number
}

export async function getAchievementSummary(
  userId: string,
  challengeId: string | null,
): Promise<AchievementSummary> {
  const [cardio, strength, sessionHistory, prs] = await Promise.all([
    getCardioWorkouts(userId, 500).catch(() => []),
    getStrengthWorkouts(userId, 500).catch(() => []),
    getCompletedSessionsHistory(userId).catch(() => []),
    getPersonalRecords(userId).catch(() => []),
  ])
  const [completedDays, streak] = challengeId
    ? await Promise.all([
        countCompletedDays(challengeId).catch(() => 0),
        getStreak(challengeId).catch(() => 0),
      ])
    : [0, 0]

  let longestKm = 0
  let bestPaceSec = Infinity
  let bestPace3kSec = Infinity
  let fastestSplitSec = Infinity
  const byWeek = new Map<string, number>()
  for (const w of cardio) {
    longestKm = Math.max(longestKm, w.data.distance_km)
    if (w.data.distance_km > 0.1) {
      const pace = w.data.duration_seconds / w.data.distance_km
      if (pace > 0 && pace < bestPaceSec) bestPaceSec = pace
      if (w.data.distance_km >= 3 && pace > 0 && pace < bestPace3kSec) bestPace3kSec = pace
    }
    for (const sp of w.data.splits ?? []) {
      if (/^\d+\s*(km|mi)$/.test(sp.label) && sp.paceSec > 0 && sp.paceSec < fastestSplitSec) {
        fastestSplitSec = sp.paceSec
      }
    }
    const key = toLocalDateString(startOfWeek(new Date(w.created_at)))
    byWeek.set(key, (byWeek.get(key) ?? 0) + w.data.distance_km)
  }
  let biggestWeekKm = 0
  byWeek.forEach(v => { biggestWeekKm = Math.max(biggestWeekKm, v) })

  const medals = computeAchievements({
    completedDays,
    streak,
    totalWorkouts: strength.length + cardio.length + sessionHistory.length,
    totalCardio: cardio.length,
    totalKm: cardio.reduce((sum, w) => sum + w.data.distance_km, 0),
    prCount: prs.length,
    longestRunKm: longestKm,
    bestPace3kSec,
    biggestWeekKm,
  })

  const cardioRecords = [
    longestKm > 0,
    bestPaceSec < Infinity,
    fastestSplitSec < Infinity,
    biggestWeekKm > 0,
  ].filter(Boolean).length

  return {
    medalsUnlocked: medals.filter(m => m.unlocked).length,
    medalsTotal: medals.length,
    recordCount: prs.length + cardioRecords,
  }
}
