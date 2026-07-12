import { supabase } from '@/lib/supabase'

export interface CustomRule {
  id: string
  name: string
  icon: string
  sort_order: number
}

export async function getCustomRules(userId: string, challengeId: string): Promise<CustomRule[]> {
  const { data, error } = await supabase
    .from('task_templates')
    .select('id, name, icon, sort_order')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as CustomRule[]
}

export async function createCustomRule(
  userId: string,
  challengeId: string,
  levelId: string,
  name: string,
  icon: string,
): Promise<CustomRule> {
  const { data: existing } = await supabase
    .from('task_templates')
    .select('sort_order')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = ((existing as any)?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('task_templates')
    .insert({
      user_id:      userId,
      challenge_id: challengeId,
      level_id:     levelId,
      name,
      icon,
      type:         'custom',
      sort_order:   nextOrder,
    })
    .select('id, name, icon, sort_order')
    .single()
  if (error) throw error
  return data as CustomRule
}

export async function deleteCustomRule(id: string): Promise<void> {
  const { error } = await supabase.from('task_templates').delete().eq('id', id)
  if (error) throw error
}

export async function updateCustomRule(id: string, name: string, icon: string): Promise<void> {
  const { error } = await supabase
    .from('task_templates')
    .update({ name, icon })
    .eq('id', id)
  if (error) throw error
}
