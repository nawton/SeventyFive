import {
  getExercises, createCustomExercise, deleteCustomExercise,
  CATEGORY_LABELS, DIFFICULTY_LABELS, DIFFICULTY_COLORS,
  EQUIPMENT_LABELS, EXERCISE_TYPE_INFO,
} from '../exercises'
import { getMusclesForName } from '@/lib/muscles'
import { supabase } from '@/lib/supabase'
import { installTables, argsOf } from '@/testUtils/supabaseChain'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn() } } }))

const fromMock = supabase.from as jest.Mock

beforeEach(() => jest.clearAllMocks())

describe('getExercises', () => {
  it('hämtar biblioteket sorterat på kategori och namn', async () => {
    const rows = [{ id: 'e1', name: 'Bänkpress', category: 'strength' }]
    const calls = installTables(fromMock, { exercises: { data: rows, error: null } })
    expect(await getExercises()).toEqual(rows)
    expect(argsOf(calls, 'exercises', 'order')).toEqual([['category'], ['name']])
  })

  it('null-data blir tom lista och fel kastas vidare', async () => {
    installTables(fromMock, { exercises: { data: null, error: null } })
    expect(await getExercises()).toEqual([])
    installTables(fromMock, { exercises: { data: null, error: { message: 'nere' } } })
    await expect(getExercises()).rejects.toBeTruthy()
  })
})

describe('egna övningar', () => {
  const signIn = (uid: string | null) => {
    ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: uid ? { user: { id: uid } } : null },
    })
  }

  it('skapas med ägare, muskler och typ, och musklerna registreras för kartan', async () => {
    signIn('u1')
    const created = {
      id: 'ex9', name: 'Landmine press', category: 'strength',
      user_id: 'u1', primary_muscle: 'chest', other_muscles: ['deltoids'], exercise_type: 'weight_reps',
    }
    const calls = installTables(fromMock, { exercises: { data: created } })

    const result = await createCustomExercise({
      name: '  Landmine press  ',
      equipment: 'barbell',
      primaryMuscle: 'chest',
      otherMuscles: ['deltoids'],
      exerciseType: 'weight_reps',
    })
    expect(result).toEqual(created)
    expect(argsOf(calls, 'exercises', 'insert')[0][0]).toMatchObject({
      user_id: 'u1', name: 'Landmine press', category: 'strength',
      equipment: 'barbell', primary_muscle: 'chest',
      other_muscles: ['deltoids'], exercise_type: 'weight_reps',
    })
    // Muskelkartan känner igen det egna namnet — trots att inget nyckelord matchar
    expect(getMusclesForName('Landmine press')).toEqual(['chest', 'deltoids'])
  })

  it('utloggad kan inte skapa, fel kastas vidare', async () => {
    signIn(null)
    await expect(createCustomExercise({
      name: 'X', equipment: 'none', primaryMuscle: 'abs', otherMuscles: [], exerciseType: 'duration',
    })).rejects.toThrow('Inte inloggad')
    expect(fromMock).not.toHaveBeenCalled()

    signIn('u1')
    installTables(fromMock, { exercises: { data: null, error: { message: 'rls' } } })
    await expect(createCustomExercise({
      name: 'X', equipment: 'none', primaryMuscle: 'abs', otherMuscles: [], exerciseType: 'duration',
    })).rejects.toMatchObject({ message: 'rls' })
  })

  it('raderas på id, RLS skyddar andras', async () => {
    const calls = installTables(fromMock, { exercises: { data: null } })
    await deleteCustomExercise('ex9')
    expect(argsOf(calls, 'exercises', 'eq')[0]).toEqual(['id', 'ex9'])
  })

  it('getExercises registrerar egna övningars muskler vid inläsning', async () => {
    installTables(fromMock, { exercises: { data: [
      { id: 'e1', name: 'Bänkpress', category: 'strength', user_id: null },
      { id: 'e2', name: 'Min specialrodd', category: 'strength', user_id: 'u1',
        primary_muscle: 'upper-back', other_muscles: ['biceps'] },
    ] } })
    await getExercises()
    expect(getMusclesForName('Min specialrodd')).toEqual(['upper-back', 'biceps'])
  })

  it('utrustnings- och typkonstanterna är kompletta', () => {
    expect(Object.keys(EQUIPMENT_LABELS)).toHaveLength(9)
    for (const info of Object.values(EXERCISE_TYPE_INFO)) {
      expect(info.label.length).toBeGreaterThan(2)
      expect(info.badges.length).toBeGreaterThan(0)
    }
  })
})

describe('etiketterna', () => {
  it('alla kategorier och svårighetsgrader har svenska etiketter och färger', () => {
    expect(Object.values(CATEGORY_LABELS)).toEqual(['Styrka', 'Cardio', 'Rörlighet', 'HIIT'])
    expect(Object.keys(DIFFICULTY_LABELS)).toEqual(Object.keys(DIFFICULTY_COLORS))
    for (const color of Object.values(DIFFICULTY_COLORS)) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })
})
