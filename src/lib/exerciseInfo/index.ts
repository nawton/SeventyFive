import type { ExerciseInfo } from './types'
import { PART_1 } from './part1'
import { PART_2 } from './part2'
import { PART_3 } from './part3'
import { PART_4 } from './part4'

export type { ExerciseInfo, ExerciseStep } from './types'

/** Övningsinfo per svenskt biblioteksnamn. Egna övningar saknar poster. */
export const EXERCISE_INFO: Record<string, ExerciseInfo> = {
  ...PART_1,
  ...PART_2,
  ...PART_3,
  ...PART_4,
}
