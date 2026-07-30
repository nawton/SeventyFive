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

// ── Grupper i föreningen ─────────────────────────────────────────────────────

export interface OrgGroup { id: string; name: string; avatar_url: string | null }

export async function getOrgGroups(orgId: string): Promise<OrgGroup[]> {
  const { data } = await supabase
    .from('groups')
    .select('id, name, avatar_url')
    .eq('org_id', orgId)
    .order('name')
  return (data ?? []) as OrgGroup[]
}

/** Grupper jag äger som ännu inte hör till någon förening — kandidater
    att koppla. Triggern i databasen kräver att ägaren är föreningsmedlem. */
export async function getMyLinkableGroups(userId: string): Promise<OrgGroup[]> {
  const { data } = await supabase
    .from('groups')
    .select('id, name, avatar_url')
    .eq('owner_id', userId)
    .is('org_id', null)
    .order('name')
  return (data ?? []) as OrgGroup[]
}

export async function linkGroupToOrg(groupId: string, orgId: string | null): Promise<void> {
  const { error } = await supabase.from('groups').update({ org_id: orgId }).eq('id', groupId)
  if (error) throw error
}

// ── Topplista och totaler ────────────────────────────────────────────────────

export interface OrgLeaderboardRow {
  user_id: string
  /** null = medlemmen delar bara basnivån (antal pass) */
  km: number | null
  cardio_passes: number
  gym_days: number
}

export async function getOrgLeaderboard(orgId: string, sinceIso: string): Promise<OrgLeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_org_leaderboard', { oid: orgId, since: sinceIso })
  if (error || !data) return []
  return (data as Array<Record<string, unknown>>).map(r => ({
    user_id: String(r.user_id),
    km: r.km == null ? null : Number(r.km),
    cardio_passes: Number(r.cardio_passes ?? 0),
    gym_days: Number(r.gym_days ?? 0),
  }))
}

export async function getOrgTotals(orgId: string, sinceIso: string): Promise<{ km: number; passes: number }> {
  const { data } = await supabase.rpc('get_org_totals', { oid: orgId, since: sinceIso })
  const row = Array.isArray(data) ? data[0] : data
  return { km: Number(row?.km ?? 0), passes: Number(row?.passes ?? 0) }
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

/** Coachens efterlevnadsvy: vilka som lagt in passet och vilka som kört
    det. Bara staff i passets förening får svar (definer-RPC). */
export interface AdoptionStatus {
  id: string
  name: string | null
  avatar_url: string | null
  completed: boolean
}

export async function getAdoptionStatus(workoutId: string): Promise<AdoptionStatus[]> {
  const { data } = await supabase.rpc('get_workout_adoption_status', { wid: workoutId })
  if (!data || (data as unknown[]).length === 0) return []
  const rows = data as Array<{ user_id: string; completed: boolean }>
  const ids = rows.map(r => r.user_id)
  const { data: profiles } = await supabase.rpc('follow_profiles', { ids })
  const byId = new Map<string, MiniProfile>(
    ((profiles ?? []) as MiniProfile[]).map(p => [p.id, p]))
  return rows
    .map(r => ({
      id: r.user_id,
      name: byId.get(r.user_id)?.name ?? null,
      avatar_url: byId.get(r.user_id)?.avatar_url ?? null,
      completed: !!r.completed,
    }))
    .sort((a, b) => Number(b.completed) - Number(a.completed))
}

// ── Medlemsstatistik enligt delningsnivån ────────────────────────────────────

export interface OrgMemberStats {
  share_level: ShareLevel
  passes_week: number
  passes_month: number
  /** null = medlemmen delar inte nivån som krävs */
  km_week: number | null
  km_month: number | null
  volume_week: number | null
  volume_month: number | null
  top_lift: { name: string; kg: number } | null
  top_exercises: Array<{ name: string; sets: number; top_kg: number; volume: number }> | null
}

/** Statistiken en medlem delar med föreningen — definer-RPC:n filtrerar
    efter medlemmens delningsnivå, egen statistik är alltid full */
export async function getOrgMemberStats(orgId: string, userId: string): Promise<OrgMemberStats | null> {
  const { data, error } = await supabase.rpc('get_org_member_stats', { oid: orgId, member: userId })
  if (error || !data) return null
  const d = data as Record<string, unknown>
  return {
    share_level: (d.share_level ?? 'base') as ShareLevel,
    passes_week: Number(d.passes_week ?? 0),
    passes_month: Number(d.passes_month ?? 0),
    km_week: d.km_week == null ? null : Number(d.km_week),
    km_month: d.km_month == null ? null : Number(d.km_month),
    volume_week: d.volume_week == null ? null : Number(d.volume_week),
    volume_month: d.volume_month == null ? null : Number(d.volume_month),
    top_lift: (d.top_lift as OrgMemberStats['top_lift']) ?? null,
    top_exercises: (d.top_exercises as OrgMemberStats['top_exercises']) ?? null,
  }
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
