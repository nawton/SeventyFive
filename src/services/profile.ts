import * as FileSystem from 'expo-file-system'
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

  // Read file as base64 — works with ph:// and file:// URIs in React Native
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  })

  // Convert base64 → Uint8Array (fetch() can't read local file URIs in RN)
  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, bytes, { upsert: true, contentType: 'image/jpeg' })

  if (error) {
    // Common cause: storage bucket "avatars" doesn't exist yet.
    // Run supabase/create_avatars_bucket.sql in Supabase SQL Editor.
    throw new Error(`Kunde inte ladda upp bilden: ${error.message}. Kontrollera att storage-bucketen "avatars" finns i Supabase.`)
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
