import { MEDAL_IMAGES } from '../medalImages'
import { computeAchievements } from '../achievements'

it('alla medaljbilder pekar på riktiga medalj-id:n', () => {
  const validIds = new Set(computeAchievements({
    completedDays: 0, streak: 0, totalWorkouts: 0, totalCardio: 0, totalKm: 0,
    prCount: 0, longestRunKm: 0, bestPace3kSec: Infinity, biggestWeekKm: 0,
  }).map(m => m.id))

  for (const [id, source] of Object.entries(MEDAL_IMAGES)) {
    expect(validIds.has(id)).toBe(true)
    expect(source).toBeTruthy()
  }
})
