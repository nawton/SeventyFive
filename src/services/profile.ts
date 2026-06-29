import * as FileSystem from 'expo-file-system/legacy'
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
  const path = `${userId}.jpg`

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Inte inloggad')

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
  const anonKey    = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

  // FileSystem.uploadAsync uses native HTTP — avoids fetch polyfill issues
  // and works with both file:// and ph:// URIs from ImagePicker
  const uploadUrl = `${supabaseUrl}/storage/v1/object/avatars/${path}`
  const result = await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: 'POST',
    uploadType: 0, // FileSystemUploadType.BINARY_CONTENT
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
  })

  if (result.status >= 400) {
    let msg = result.body
    try { msg = JSON.parse(result.body)?.message ?? result.body } catch { /* */ }
    throw new Error(`Kunde inte ladda upp bilden (${result.status}): ${msg}. Kontrollera att storage-bucketen "avatars" finns i Supabase.`)
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
