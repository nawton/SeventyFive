import { supabase } from '@/lib/supabase'
import { uploadImage } from '@/lib/storage'

// =============================================================================
// PASSMETADATA — titel, kommentar och foto från granskningsskärmen efter
// passet. En rad per användare och träningsdag, samma synlighet som passen
// (ägaren + godkända följare). Fotot ligger i den publika bucketen
// pass-photos under användarens egen mapp.
// =============================================================================

const BUCKET = 'pass-photos'

export interface GymPassMeta {
  user_id: string
  workout_date: string
  pass_key: string
  title: string | null
  note: string | null
  photo_path: string | null
}

/** Publik URL utan supabase-klienten, samma mönster som övningsbilderna. */
export function passPhotoUrl(path: string): string | null {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL
  return base ? `${base}/storage/v1/object/public/${BUCKET}/${path}` : null
}

export async function getPassMeta(userId: string, workoutDate: string, passKey = ''): Promise<GymPassMeta | null> {
  const { data, error } = await supabase
    .from('gym_pass_meta')
    .select('user_id, workout_date, pass_key, title, note, photo_path')
    .eq('user_id', userId)
    .eq('workout_date', workoutDate)
    .eq('pass_key', passKey)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Titel och kommentar för flödeskorten: en fråga för alla synliga
    inlägg, RLS filtrerar bort det betraktaren inte får se. Nycklas på
    inläggets id. */
export async function getPassMetaForPosts(posts: Array<{
  id: string
  kind: string
  authorId: string
  workoutDate?: string
  passKey?: string
}>): Promise<Record<string, { title: string | null; note: string | null; photo_path: string | null }>> {
  const gym = posts.filter(p => p.kind === 'strength' && p.workoutDate)
  if (gym.length === 0) return {}
  const userIds = [...new Set(gym.map(p => p.authorId))]
  const { data, error } = await supabase
    .from('gym_pass_meta')
    .select('user_id, workout_date, pass_key, title, note, photo_path')
    .in('user_id', userIds)
  if (error || !data) return {}
  const byKey = new Map<string, GymPassMeta>()
  for (const m of data as GymPassMeta[]) byKey.set(`${m.user_id}|${m.workout_date}|${m.pass_key}`, m)
  const out: Record<string, { title: string | null; note: string | null; photo_path: string | null }> = {}
  for (const p of gym) {
    const m = byKey.get(`${p.authorId}|${p.workoutDate}|${p.passKey ?? ''}`)
    if (m && (m.title || m.note || m.photo_path)) {
      out[p.id] = { title: m.title, note: m.note, photo_path: m.photo_path }
    }
  }
  return out
}

/** Sparar granskningen. Tom titel/kommentar lagras som null, fotot laddas
    upp först så en misslyckad uppladdning aldrig lämnar en rad utan bild. */
export async function savePassMeta(params: {
  workoutDate: string
  /** Passets unika nyckel — skiljer två pass samma dag åt */
  passKey?: string
  title: string
  note: string
  /** Lokal bild-URI från väljaren — utelämnas när inget foto valts */
  photoUri?: string | null
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Inte inloggad')
  const userId = session.user.id

  let photo_path: string | null | undefined
  if (params.photoUri) {
    // Tidsstämpel i namnet: cachade gamla foton ska inte spöka efter byte
    photo_path = `${userId}/${params.workoutDate}-${Date.now()}.jpg`
    await uploadImage(BUCKET, photo_path, params.photoUri)
  }

  const row: Record<string, unknown> = {
    user_id: userId,
    workout_date: params.workoutDate,
    pass_key: params.passKey ?? '',
    title: params.title.trim() || null,
    note: params.note.trim() || null,
    updated_at: new Date().toISOString(),
  }
  if (photo_path !== undefined) row.photo_path = photo_path

  const { error } = await supabase
    .from('gym_pass_meta')
    .upsert(row, { onConflict: 'user_id,workout_date,pass_key' })
  if (error) throw error
}
