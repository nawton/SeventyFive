import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '@/lib/supabase'

/**
 * Laddar upp en lokal bild till Supabase Storage.
 * FileSystem.uploadAsync använder nativ HTTP — undviker fetch-polyfill-problem
 * och fungerar med både file:// och ph:// URI:er från ImagePicker.
 */
export async function uploadImage(bucket: string, path: string, uri: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Inte inloggad')

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
  const anonKey     = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`
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
    throw new Error(`Kunde inte ladda upp bilden (${result.status}): ${msg}. Kontrollera att storage-bucketen "${bucket}" finns i Supabase.`)
  }
}
