import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Samma Supabase-projekt som appen — anon-nyckeln är publik per design,
// all åtkomst skyddas av RLS. Saknas miljövariablerna (t.ex. i en byggmiljö
// utan secrets) blir klienten null och inloggningssidan säger det ärligt.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null
