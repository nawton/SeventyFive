import { supabase } from '@/lib/supabase'
import { createWorkoutSession } from '@/services/workoutSchedule'
import { toLocalDateString } from '@/lib/date'

// =============================================================================
// FÖRENINGAR — lagret ovanpå grupperna. Man går med via en 6-teckenskod
// (definer-RPC så koden aldrig läcker), admin/coach publicerar TRÄNARPASS
// som medlemmarna lägger in i sitt eget schema med ett tryck. Adoptionen
// spåras så coachen ser vilka som tagit passet.
// =============================================================================

export type OrgRole = 'admin' | 'coach' | 'member'
export type ShareLevel = 'base' | 'detailed' | 'full'

export interface Organization {
  id: string
  created_by: string
  name: string
  description: string
  avatar_url: string | null
  join_code: string
  created_at: string
}

export interface OrgMember {
  id: string
  name: string | null
  avatar_url: string | null
  role: OrgRole
  share_level: ShareLevel
}

interface MiniProfile { id: string; name: string | null; avatar_url: string | null }

export async function createOrganization(userId: string, name: string, description: string): Promise<Organization> {
  const { data, error } = await supabase
    .from('organizations')
    .insert({ created_by: userId, name: name.trim(), description: description.trim() })
    .select()
    .single()
  if (error) throw error
  return data as Organization
}

export async function getMyOrganizations(userId: string): Promise<Array<Organization & { memberCount: number; myRole: OrgRole }>> {
  const { data: mine, error } = await supabase
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', userId)
  if (error || !mine || mine.length === 0) return []
  const ids = mine.map(m => m.org_id)
  const [{ data: orgs }, { data: counts }] = await Promise.all([
    supabase.from('organizations').select('*').in('id', ids),
    supabase.from('organization_members').select('org_id').in('org_id', ids),
  ])
  const roleById = new Map(mine.map(m => [m.org_id, m.role as OrgRole]))
  const countById = new Map<string, number>()
  for (const c of counts ?? []) countById.set(c.org_id, (countById.get(c.org_id) ?? 0) + 1)
  return ((orgs ?? []) as Organization[]).map(o => ({
    ...o,
    memberCount: countById.get(o.id) ?? 1,
    myRole: roleById.get(o.id) ?? 'member',
  }))
}

/** Gå med via kod — RPC:n slår upp koden utan att föreningsraden är läsbar */
export async function joinOrganizationByCode(code: string): Promise<Organization> {
  const { data, error } = await supabase.rpc('join_organization', { code: code.trim().toUpperCase() })
  if (error) throw error
  return data as Organization
}

export async function getOrganization(orgId: string): Promise<Organization | null> {
  const { data } = await supabase.from('organizations').select('*').eq('id', orgId).maybeSingle()
  return (data as Organization) ?? null
}

export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('user_id, role, share_level')
    .eq('org_id', orgId)
  if (error || !data || data.length === 0) return []
  const ids = data.map(m => m.user_id)
  const { data: profiles } = await supabase.rpc('follow_profiles', { ids })
  const byId = new Map<string, MiniProfile>(
    ((profiles ?? []) as MiniProfile[]).map(p => [p.id, p]))
  const rank: Record<OrgRole, number> = { admin: 0, coach: 1, member: 2 }
  return data.map(m => {
    const p = byId.get(m.user_id)
    return {
      id: m.user_id,
      name: p?.name ?? null,
      avatar_url: p?.avatar_url ?? null,
      role: m.role as OrgRole,
      share_level: m.share_level as ShareLevel,
    }
  }).sort((a, b) => rank[a.role] - rank[b.role])
}

export async function updateMemberRole(orgId: string, userId: string, role: OrgRole): Promise<void> {
  const { error } = await supabase
    .from('organization_members')
    .update({ role })
    .eq('org_id', orgId)
    .eq('user_id', userId)
  if (error) throw error
}

/** Min egen delningsnivå i föreningen — styr vad andra ser av min statistik */
export async function updateMyShareLevel(orgId: string, userId: string, level: ShareLevel): Promise<void> {
  const { error } = await supabase
    .from('organization_members')
    .update({ share_level: level })
    .eq('org_id', orgId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function leaveOrganization(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function removeOrgMember(orgId: string, userId: string): Promise<void> {
  return leaveOrganization(orgId, userId)
}

// ── Tränarpass ───────────────────────────────────────────────────────────────

export type CoachAudience = 'org' | 'group' | 'selected'

export interface CoachExercise { exercise_name: string; sets: number | null; reps: string | null }

export interface CoachWorkout {
  id: string
  org_id: string
  created_by: string
  name: string
  notes: string
  session_type: 'gym' | 'cardio'
  cardio_type: string | null
  exercises: CoachExercise[]
  audience: CoachAudience
  group_id: string | null
  created_at: string
}

export async function createCoachWorkout(input: {
  orgId: string
  createdBy: string
  name: string
  notes: string
  sessionType: 'gym' | 'cardio'
  cardioType?: string | null
  exercises: CoachExercise[]
  audience: CoachAudience
  groupId?: string | null
  /** Mottagare när audience = 'selected' */
  recipientIds?: string[]
}): Promise<CoachWorkout> {
  const { data, error } = await supabase
    .from('coach_workouts')
    .insert({
      org_id: input.orgId,
      created_by: input.createdBy,
      name: input.name.trim(),
      notes: input.notes.trim(),
      session_type: input.sessionType,
      cardio_type: input.cardioType ?? null,
      exercises: input.exercises,
      audience: input.audience,
      group_id: input.groupId ?? null,
    })
    .select()
    .single()
  if (error) throw error
  const workout = data as CoachWorkout
  if (input.audience === 'selected' && input.recipientIds?.length) {
    const { error: rErr } = await supabase
      .from('coach_workout_recipients')
      .insert(input.recipientIds.map(uid => ({ workout_id: workout.id, user_id: uid })))
    if (rErr) throw rErr
  }
  return workout
}

/** Passen jag ser i föreningen — RLS filtrerar efter målgrupp */
export async function getCoachWorkouts(orgId: string): Promise<CoachWorkout[]> {
  const { data, error } = await supabase
    .from('coach_workouts')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as CoachWorkout[]
}

export async function deleteCoachWorkout(workoutId: string): Promise<void> {
  const { error } = await supabase.from('coach_workouts').delete().eq('id', workoutId)
  if (error) throw error
}

/** Mina adoptioner i föreningen — nycklat på tränarpassets id */
export async function getMyAdoptions(userId: string, workoutIds: string[]): Promise<Set<string>> {
  if (workoutIds.length === 0) return new Set()
  const { data } = await supabase
    .from('coach_workout_adoptions')
    .select('workout_id')
    .eq('user_id', userId)
    .in('workout_id', workoutIds)
  return new Set((data ?? []).map(r => r.workout_id))
}

/** Coachens överblick: vilka som lagt in passet i sitt schema */
export async function getWorkoutAdoptions(workoutId: string): Promise<Array<{ id: string; name: string | null; avatar_url: string | null }>> {
  const { data } = await supabase
    .from('coach_workout_adoptions')
    .select('user_id')
    .eq('workout_id', workoutId)
  if (!data || data.length === 0) return []
  const ids = data.map(r => r.user_id)
  const { data: profiles } = await supabase.rpc('follow_profiles', { ids })
  const byId = new Map<string, MiniProfile>(
    ((profiles ?? []) as MiniProfile[]).map(p => [p.id, p]))
  return ids.map(id => ({
    id,
    name: byId.get(id)?.name ?? null,
    avatar_url: byId.get(id)?.avatar_url ?? null,
  }))
}

/** Lägger in tränarpasset som ett engångspass i mitt schema idag och
    stämplar adoptionen så coachen ser att jag tagit det */
export async function adoptCoachWorkout(userId: string, workout: CoachWorkout, date?: Date): Promise<void> {
  const ds = toLocalDateString(date ?? new Date())
  const session = await createWorkoutSession(
    userId,
    `ONCE:${ds}:${workout.name}`,
    [],
    workout.exercises,
    workout.notes || null,
    workout.session_type,
    workout.cardio_type,
  )
  const { error } = await supabase
    .from('coach_workout_adoptions')
    .upsert(
      { workout_id: workout.id, user_id: userId, session_id: session.id },
      { onConflict: 'workout_id,user_id' },
    )
  if (error) throw error
}
