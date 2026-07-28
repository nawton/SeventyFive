import { EN_COMMON } from './en.common'
import { EN_DASHBOARD } from './en.dashboard'
import { EN_SCHEDULE } from './en.schedule'
import { EN_STATS } from './en.stats'
import { EN_SOCIAL } from './en.social'
import { EN_PROFILE } from './en.profile'
import { EN_AUTH } from './en.auth'
import { EN_CARDIO } from './en.cardio'
import { EN_EXERCISES } from './en.exercises'

// Sammanslagen ordbok — ett område per fil så flera kan jobba parallellt
export const EN: Record<string, string> = {
  ...EN_COMMON,
  ...EN_DASHBOARD,
  ...EN_SCHEDULE,
  ...EN_STATS,
  ...EN_SOCIAL,
  ...EN_PROFILE,
  ...EN_AUTH,
  ...EN_CARDIO,
  ...EN_EXERCISES,
}
