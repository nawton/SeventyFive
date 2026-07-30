import {
  createOrganization, getMyOrganizations, joinOrganizationByCode, getOrgMembers,
  createCoachWorkout, getMyAdoptions, adoptCoachWorkout, updateMyShareLevel,
  getOrgLeaderboard, getOrgTotals, getAdoptionStatus, linkGroupToOrg, getOrgMemberStats,
  type CoachWorkout,
} from '../organizations'
import { supabase } from '@/lib/supabase'
import { installTables, argsOf } from '@/testUtils/supabaseChain'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), auth: { getSession: jest.fn() } },
}))
jest.mock('@/services/workoutSchedule', () => ({
  createWorkoutSession: jest.fn().mockResolvedValue({ id: 'sess-1' }),
}))

const fromMock = supabase.from as jest.Mock
const rpcMock = supabase.rpc as jest.Mock

beforeEach(() => jest.clearAllMocks())

describe('organizations — förening och medlemmar', () => {
  it('skapar föreningen med trimmat namn och beskrivning', async () => {
    const calls = installTables(fromMock, {
      organizations: { data: { id: 'o1', name: 'Växjö LK', join_code: 'ABC123' }, error: null },
    })
    const org = await createOrganization('u1', '  Växjö LK  ', ' Löpning varje torsdag ')
    expect(org.join_code).toBe('ABC123')
    expect(argsOf(calls, 'organizations', 'insert')[0][0]).toEqual({
      created_by: 'u1', name: 'Växjö LK', description: 'Löpning varje torsdag',
    })
  })

  it('mina föreningar får medlemsantal och min roll', async () => {
    installTables(fromMock, {
      organization_members: [
        { data: [{ org_id: 'o1', role: 'admin' }], error: null },
        { data: [{ org_id: 'o1' }, { org_id: 'o1' }, { org_id: 'o1' }], error: null },
      ],
      organizations: { data: [{ id: 'o1', name: 'Växjö LK' }], error: null },
    })
    const orgs = await getMyOrganizations('u1')
    expect(orgs).toHaveLength(1)
    expect(orgs[0].memberCount).toBe(3)
    expect(orgs[0].myRole).toBe('admin')
  })

  it('join via kod versaliserar och trimmar innan RPC:n', async () => {
    rpcMock.mockResolvedValue({ data: { id: 'o1', name: 'Växjö LK' }, error: null })
    const org = await joinOrganizationByCode('  abc123 ')
    expect(rpcMock).toHaveBeenCalledWith('join_organization', { code: 'ABC123' })
    expect(org.id).toBe('o1')
  })

  it('medlemslistan hämtar profiler och sorterar admin först', async () => {
    installTables(fromMock, {
      organization_members: { data: [
        { user_id: 'u2', role: 'member', share_level: 'base' },
        { user_id: 'u1', role: 'admin', share_level: 'full' },
        { user_id: 'u3', role: 'coach', share_level: 'detailed' },
      ], error: null },
    })
    rpcMock.mockResolvedValue({ data: [
      { id: 'u1', name: 'Anton', avatar_url: null },
      { id: 'u2', name: 'Elin', avatar_url: null },
      { id: 'u3', name: 'Hugo', avatar_url: null },
    ], error: null })
    const members = await getOrgMembers('o1')
    expect(members.map(m => m.role)).toEqual(['admin', 'coach', 'member'])
    expect(members[0].name).toBe('Anton')
    expect(members[1].share_level).toBe('detailed')
  })

  it('delningsnivån uppdateras bara för min egen rad', async () => {
    const calls = installTables(fromMock, { organization_members: { data: null, error: null } })
    await updateMyShareLevel('o1', 'u1', 'detailed')
    expect(argsOf(calls, 'organization_members', 'update')[0][0]).toEqual({ share_level: 'detailed' })
    expect(argsOf(calls, 'organization_members', 'eq')).toEqual([['org_id', 'o1'], ['user_id', 'u1']])
  })
})

describe('organizations — tränarpass', () => {
  it('riktat pass skriver mottagarna efter att passet skapats', async () => {
    const calls = installTables(fromMock, {
      coach_workouts: { data: { id: 'w1', name: 'Intervaller' }, error: null },
      coach_workout_recipients: { data: null, error: null },
    })
    await createCoachWorkout({
      orgId: 'o1', createdBy: 'u1', name: ' Intervaller ', notes: '',
      sessionType: 'cardio', cardioType: 'running', exercises: [],
      audience: 'selected', recipientIds: ['u2', 'u3'],
    })
    expect(argsOf(calls, 'coach_workouts', 'insert')[0][0]).toMatchObject({
      org_id: 'o1', name: 'Intervaller', audience: 'selected', cardio_type: 'running',
    })
    expect(argsOf(calls, 'coach_workout_recipients', 'insert')[0][0]).toEqual([
      { workout_id: 'w1', user_id: 'u2' },
      { workout_id: 'w1', user_id: 'u3' },
    ])
  })

  it('pass till hela föreningen skriver inga mottagare', async () => {
    const calls = installTables(fromMock, {
      coach_workouts: { data: { id: 'w1' }, error: null },
    })
    await createCoachWorkout({
      orgId: 'o1', createdBy: 'u1', name: 'Benpass', notes: '',
      sessionType: 'gym', exercises: [{ exercise_name: 'Knäböj', sets: 5, reps: '5' }],
      audience: 'org',
    })
    expect(calls['coach_workout_recipients']).toBeUndefined()
  })

  it('mina adoptioner blir en uppsättning pass-id', async () => {
    installTables(fromMock, {
      coach_workout_adoptions: { data: [{ workout_id: 'w1' }, { workout_id: 'w3' }], error: null },
    })
    const set = await getMyAdoptions('u1', ['w1', 'w2', 'w3'])
    expect(set.has('w1')).toBe(true)
    expect(set.has('w2')).toBe(false)
  })

  it('topplistan behåller dold distans som null och totalerna räknar allt', async () => {
    rpcMock.mockResolvedValueOnce({ data: [
      { user_id: 'u1', km: '12.5', cardio_passes: 2, gym_days: 3 },
      { user_id: 'u2', km: null, cardio_passes: 1, gym_days: 0 },
    ], error: null })
    const board = await getOrgLeaderboard('o1', '2026-07-27T00:00:00Z')
    expect(rpcMock).toHaveBeenCalledWith('get_org_leaderboard', { oid: 'o1', since: '2026-07-27T00:00:00Z' })
    expect(board[0].km).toBe(12.5)
    expect(board[1].km).toBeNull()

    rpcMock.mockResolvedValueOnce({ data: [{ km: '31.2', passes: 9 }], error: null })
    const totals = await getOrgTotals('o1', '2026-07-27T00:00:00Z')
    expect(totals).toEqual({ km: 31.2, passes: 9 })
  })

  it('efterlevnaden hämtar profiler och sorterar klara först', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: [
        { user_id: 'u2', adopted_at: '2026-07-29', completed: false },
        { user_id: 'u3', adopted_at: '2026-07-29', completed: true },
      ], error: null })
      .mockResolvedValueOnce({ data: [
        { id: 'u2', name: 'Elin', avatar_url: null },
        { id: 'u3', name: 'Hugo', avatar_url: null },
      ], error: null })
    const status = await getAdoptionStatus('w1')
    expect(rpcMock).toHaveBeenNthCalledWith(1, 'get_workout_adoption_status', { wid: 'w1' })
    expect(status.map(a => a.name)).toEqual(['Hugo', 'Elin'])
    expect(status[0].completed).toBe(true)
  })

  it('gruppkopplingen uppdaterar org_id på gruppen', async () => {
    const calls = installTables(fromMock, { groups: { data: null, error: null } })
    await linkGroupToOrg('g1', 'o1')
    expect(argsOf(calls, 'groups', 'update')[0][0]).toEqual({ org_id: 'o1' })
    expect(argsOf(calls, 'groups', 'eq')).toEqual([['id', 'g1']])
  })

  it('adoption skapar ett ONCE-pass i schemat och stämplar adoptionen', async () => {
    const { createWorkoutSession } = jest.requireMock('@/services/workoutSchedule')
    const calls = installTables(fromMock, {
      coach_workout_adoptions: { data: null, error: null },
    })
    const workout: CoachWorkout = {
      id: 'w1', org_id: 'o1', created_by: 'c1', name: 'Torsdagsintervaller',
      notes: 'Håll jämnt tempo', session_type: 'cardio', cardio_type: 'running',
      exercises: [], audience: 'org', group_id: null, created_at: '2026-07-30',
    }
    await adoptCoachWorkout('u1', workout, new Date('2026-07-30T12:00:00'))
    const [uid, name, weekdays, exs, notes, type, cardio] = createWorkoutSession.mock.calls[0]
    expect(uid).toBe('u1')
    expect(name).toBe('ONCE:2026-07-30:Torsdagsintervaller')
    expect(weekdays).toEqual([])
    expect(exs).toEqual([])
    expect(notes).toBe('Håll jämnt tempo')
    expect(type).toBe('cardio')
    expect(cardio).toBe('running')
    const upsert = argsOf(calls, 'coach_workout_adoptions', 'upsert')[0]
    expect(upsert[0]).toEqual({ workout_id: 'w1', user_id: 'u1', session_id: 'sess-1' })
    expect(upsert[1]).toEqual({ onConflict: 'workout_id,user_id' })
  })
})

describe('organizations — medlemsstatistik', () => {
  it('mappar RPC-svaret och behåller dolda fält som null', async () => {
    rpcMock.mockResolvedValueOnce({ data: {
      share_level: 'base', passes_week: 3, passes_month: '9',
      km_week: null, km_month: null, volume_week: null, volume_month: null,
      top_lift: null, top_exercises: null,
    }, error: null })
    const st = await getOrgMemberStats('o1', 'u2')
    expect(rpcMock).toHaveBeenCalledWith('get_org_member_stats', { oid: 'o1', member: 'u2' })
    expect(st).toMatchObject({ share_level: 'base', passes_week: 3, passes_month: 9, km_month: null, top_exercises: null })
  })

  it('full delning ger volym, tyngsta lyft och toppövningar', async () => {
    rpcMock.mockResolvedValueOnce({ data: {
      share_level: 'full', passes_week: 4, passes_month: 12,
      km_week: '5.2', km_month: '21.4', volume_week: '8200', volume_month: '31000',
      top_lift: { name: 'Marklyft', kg: 140 },
      top_exercises: [{ name: 'Marklyft', sets: 12, top_kg: 140, volume: 9800 }],
    }, error: null })
    const st = await getOrgMemberStats('o1', 'u2')
    expect(st?.km_month).toBe(21.4)
    expect(st?.volume_month).toBe(31000)
    expect(st?.top_lift?.kg).toBe(140)
    expect(st?.top_exercises?.[0].name).toBe('Marklyft')
  })
})
