import { supabase } from '@/lib/supabase'

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
  const ext = uri.split('.').pop() ?? 'jpg'
  const path = `avatars/${userId}.${ext}`

  const response = await fetch(uri)
  const blob = await response.blob()

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: `image/${ext}` })

  if (error) throw error

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
