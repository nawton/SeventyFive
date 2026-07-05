import { supabase } from '@/lib/supabase'
import { uploadImage } from '@/lib/storage'

export interface ProfileData {
  name: string | null
  avatar_url: string | null
}

export async function getProfile(userId: string): Promise<ProfileData | null> {
  const { data } = await supabase
    .from('profiles')
    .select('name, avatar_url')
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

export async function uploadAvatar(userId: string, uri: string): Promise<string> {
  const path = `${userId}.jpg`
  await uploadImage('avatars', path, uri)
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
