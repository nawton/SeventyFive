import { supabase } from '@/lib/supabase'
import { uploadImage } from '@/lib/storage'

export interface ProfileData {
  name: string | null
  avatar_url: string | null
  /** YYYY-MM-DD */
  birth_date: string | null
  gender: string | null
  weight_kg: number | null
  height_cm: number | null
  /** Offentlig profil: följare godkänns automatiskt */
  is_public: boolean | null
  /** Går att hitta via sökningen */
  searchable: boolean | null
  /** Vem ser pass och statistik: 'followers' (godkända) eller 'private' */
  activity_visibility: 'followers' | 'private' | null
}

export async function getProfile(userId: string): Promise<ProfileData | null> {
  const { data } = await supabase
    .from('profiles')
    .select('name, avatar_url, birth_date, gender, weight_kg, height_cm, is_public, searchable, activity_visibility')
    .eq('id', userId)
    .maybeSingle()
  return data
}

export async function updateProfile(userId: string, updates: Partial<ProfileData>): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates })
  if (error) throw error
}

export interface ProfileSearchHit {
  id: string
  name: string | null
  avatar_url: string | null
}

/** Sök andra användare på namn — går via search_profiles-RPC:n som bara
    lämnar ut id/namn/avatar (profilernas RLS är annars egna rader) */
export async function searchProfiles(query: string): Promise<ProfileSearchHit[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  const { data, error } = await supabase.rpc('search_profiles', { search: trimmed })
  if (error || !data) return []
  return data as ProfileSearchHit[]
}

export async function uploadAvatar(userId: string, uri: string): Promise<string> {
  const path = `${userId}.jpg`
  await uploadImage('avatars', path, uri)
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
