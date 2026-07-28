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
  title: string | null
  note: string | null
  photo_path: string | null
}

/** Publik URL utan supabase-klienten, samma mönster som övningsbilderna. */
export function passPhotoUrl(path: string): string | null {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL
  return base ? `${base}/storage/v1/object/public/${BUCKET}/${path}` : null
}

export async function getPassMeta(userId: string, workoutDate: string): Promise<GymPassMeta | null> {
  const { data, error } = await supabase
    .from('gym_pass_meta')
    .select('user_id, workout_date, title, note, photo_path')
    .eq('user_id', userId)
    .eq('workout_date', workoutDate)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Sparar granskningen. Tom titel/kommentar lagras som null, fotot laddas
    upp först så en misslyckad uppladdning aldrig lämnar en rad utan bild. */
export async function savePassMeta(params: {
  workoutDate: string
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
    title: params.title.trim() || null,
    note: params.note.trim() || null,
    updated_at: new Date().toISOString(),
  }
  if (photo_path !== undefined) row.photo_path = photo_path

  const { error } = await supabase
    .from('gym_pass_meta')
    .upsert(row, { onConflict: 'user_id,workout_date' })
  if (error) throw error
}
