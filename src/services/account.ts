import { supabase } from '@/lib/supabase'

async function removeFolderContents(bucket: string, userId: string): Promise<void> {
  const { data } = await supabase.storage.from(bucket).list(userId)
  if (data?.length) {
    await supabase.storage.from(bucket).remove(data.map(f => `${userId}/${f.name}`))
  }
}

/** Städar lagrade filer inför kontoradering. Best effort — en misslyckad
    filradering får aldrig blockera själva kontoraderingen. */
export async function deleteAccountStorage(userId: string): Promise<void> {
  await Promise.allSettled([
    // Avataren lagras platt som <uid>.jpg direkt i bucket-roten (inte i en
    // egen mapp), så den kan inte listas som progress-photos/pass-photos.
    supabase.storage.from('avatars').remove([`${userId}.jpg`]),
    removeFolderContents('progress-photos', userId),
    removeFolderContents('pass-photos', userId),
  ])
}

/** Raderar kontot permanent: lagrade filer (best effort) och sedan alla
    databasrader + auth-användaren via delete_user_account-RPC:n. */
export async function deleteAccount(userId: string): Promise<void> {
  await deleteAccountStorage(userId)
  const { error } = await supabase.rpc('delete_user_account')
  if (error) throw error
}
