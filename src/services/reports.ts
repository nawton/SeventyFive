import { supabase } from '@/lib/supabase'

// =============================================================================
// RAPPORTER — anmäl användare, inlägg eller kommentarer. Skrivs till
// reports-tabellen som bara teamet kan läsa (ingen select-policy).
// =============================================================================

export type ReportKind = 'user' | 'post' | 'comment'

export async function reportContent(
  kind: ReportKind, targetId: string, details?: string,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const uid = session?.user?.id
  if (!uid) return
  const { error } = await supabase.from('reports').insert({
    reporter_id: uid,
    target_kind: kind,
    target_id: targetId,
    details: details?.trim() || null,
  })
  if (error) throw error
}
