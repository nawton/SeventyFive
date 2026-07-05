import { supabase } from '@/lib/supabase'
import { uploadImage } from '@/lib/storage'

// Privat bucket — bilderna nås via signerade URL:er, inte publika länkar.
const BUCKET = 'progress-photos'
const SIGNED_URL_TTL = 60 * 60 // 1 timme, hämtas om vid varje feed-laddning

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProgressPhotoItem {
  id: string
  dayNumber: number
  caption: string | null
  createdAt: string
  /** Sökväg i storage-bucketen (lagras i photo_url-kolumnen) */
  path: string
  /** Signerad URL för visning — null om signeringen misslyckades */
  url: string | null
}

// ─── Functions ────────────────────────────────────────────────────────────────

export async function getProgressPhotos(userId: string): Promise<ProgressPhotoItem[]> {
  const { data, error } = await supabase
    .from('progress_photos')
    .select('id, day_number, caption, created_at, photo_url')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = data ?? []
  if (rows.length === 0) return []

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(rows.map(r => r.photo_url), SIGNED_URL_TTL)
  const urlByPath = new Map((signed ?? []).map(s => [s.path, s.signedUrl]))

  return rows.map(r => ({
    id: r.id,
    dayNumber: r.day_number,
    caption: r.caption,
    createdAt: r.created_at,
    path: r.photo_url,
    url: urlByPath.get(r.photo_url) ?? null,
  }))
}

export async function addProgressPhoto(params: {
  userId: string
  challengeId: string
  dayNumber: number
  uri: string
  caption: string | null
}): Promise<void> {
  const path = `${params.userId}/${Date.now()}-day${params.dayNumber}.jpg`
  await uploadImage(BUCKET, path, params.uri)

  const { error } = await supabase.from('progress_photos').insert({
    user_id: params.userId,
    challenge_id: params.challengeId,
    day_number: params.dayNumber,
    photo_url: path,
    caption: params.caption,
  })
  if (error) throw error
}

/** Finns minst ett foto för en viss dag i utmaningen? Används för att verifiera fotouppgiften. */
export async function hasPhotoForDay(
  userId: string,
  challengeId: string,
  dayNumber: number
): Promise<boolean> {
  const { data, error } = await supabase
    .from('progress_photos')
    .select('id')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId)
    .eq('day_number', dayNumber)
    .limit(1)
  if (error) throw error
  return (data ?? []).length > 0
}

export async function deleteProgressPhoto(id: string, path: string): Promise<void> {
  const { error } = await supabase.from('progress_photos').delete().eq('id', id)
  if (error) throw error
  // Bäst-effort: raden är borta, en kvarglömd fil i storage gör ingen skada
  await supabase.storage.from(BUCKET).remove([path])
}
