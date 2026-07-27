import { getExercises, CATEGORY_LABELS, DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '../exercises'
import { supabase } from '@/lib/supabase'
import { installTables, argsOf } from '@/testUtils/supabaseChain'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }))

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

describe('etiketterna', () => {
  it('alla kategorier och svårighetsgrader har svenska etiketter och färger', () => {
    expect(Object.values(CATEGORY_LABELS)).toEqual(['Styrka', 'Cardio', 'Rörlighet', 'HIIT'])
    expect(Object.keys(DIFFICULTY_LABELS)).toEqual(Object.keys(DIFFICULTY_COLORS))
    for (const color of Object.values(DIFFICULTY_COLORS)) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })
})
