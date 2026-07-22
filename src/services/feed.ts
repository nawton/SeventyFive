import { supabase } from '@/lib/supabase'
import type { CardioWorkout } from '@/services/cardioWorkouts'
import type { StrengthWorkout, StrengthData } from '@/services/strengthWorkouts'

// =============================================================================
// FLÖDET — hämtas via get_feed-RPC:n: EN fråga över egna + godkända
// vänners pass istället för två anrop per person, med cursor-paginering
// (before = äldsta radens tidsstämpel). RLS på user_workouts gäller inne
// i funktionen, så synligheten är identisk med direktläsning.
// =============================================================================

export const FEED_PAGE_SIZE = 60

export interface FeedPage {
  cardio:   Array<{ userId: string; workout: CardioWorkout }>
  strength: Array<{ userId: string; workout: StrengthWorkout }>
  /** Antal råa rader — når vi sidstorleken finns det troligen fler */
  count: number
  /** Cursor till nästa sida */
  oldest: string | null
}

interface FeedRow {
  id: string
  user_id: string
  name: string
  created_at: string
  exercises: unknown
}

/** Mappar RPC-rader till cardio/styrka — delas av alla flödesvägar */
function mapRows(rows: FeedRow[]): Pick<FeedPage, 'cardio' | 'strength'> {
  const cardio: FeedPage['cardio'] = []
  const strength: FeedPage['strength'] = []
  for (const row of rows) {
    const entry = Array.isArray(row.exercises) ? row.exercises[0] : null
    if (!entry) continue
    if (entry.category === 'cardio') {
      cardio.push({
        userId: row.user_id,
        workout: {
          id: row.id,
          name: row.name,
          created_at: row.created_at,
          data: {
            category: 'cardio',
            type:             entry.type             ?? 'running',
            distance_km:      Number(entry.distance_km ?? 0),
            duration_seconds: Number(entry.duration_seconds ?? 0),
            calories:         Number(entry.calories ?? 0),
            route:            entry.route,
            splits:           entry.splits,
            intervals:        entry.intervals,
            intervals_planned: entry.intervals_planned,
            effort:           entry.effort,
          },
        },
      })
    } else {
      strength.push({
        userId: row.user_id,
        workout: {
          id: row.id,
          name: row.name,
          created_at: row.created_at,
          data: entry as StrengthData,
        },
      })
    }
  }
  return { cardio, strength }
}

export async function fetchFeedPage(beforeIso?: string): Promise<FeedPage> {
  const { data, error } = await supabase.rpc('get_feed', {
    before: beforeIso ?? new Date().toISOString(),
    page_size: FEED_PAGE_SIZE,
  })
  if (error || !data) return { cardio: [], strength: [], count: 0, oldest: null }
  const rows = data as FeedRow[]
  return {
    ...mapRows(rows),
    count: rows.length,
    oldest: rows.length > 0 ? rows[rows.length - 1].created_at : null,
  }
}

/** En användares historik — rutter strippas av servern om ägaren döljer
    kartor; RLS avgör om man alls får se passen */
export async function fetchUserWorkouts(targetId: string): Promise<Pick<FeedPage, 'cardio' | 'strength'>> {
  const { data, error } = await supabase.rpc('get_user_workouts', {
    target: targetId,
    max_rows: 500,
  })
  if (error || !data) return { cardio: [], strength: [] }
  return mapRows(data as FeedRow[])
}

/** Ett enstaka pass (diskussionssidan) — samma serverstrippning */
export async function getSharedWorkout(workoutId: string): Promise<CardioWorkout | null> {
  const { data, error } = await supabase.rpc('get_shared_workout', { wid: workoutId })
  if (error || !data) return null
  const { cardio } = mapRows(data as FeedRow[])
  return cardio[0]?.workout ?? null
}
