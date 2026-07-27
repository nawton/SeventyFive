import { getCustomRules, createCustomRule, deleteCustomRule, updateCustomRule } from '../rules'
import { supabase } from '@/lib/supabase'
import { installTables, argsOf } from '@/testUtils/supabaseChain'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }))

const fromMock = supabase.from as jest.Mock

beforeEach(() => jest.clearAllMocks())

describe('getCustomRules', () => {
  it('hämtar reglerna i sorteringsordning', async () => {
    const rows = [
      { id: 'r1', name: 'Läs 10 sidor', icon: 'book', sort_order: 0 },
      { id: 'r2', name: 'Kalldusch', icon: 'droplet', sort_order: 1 },
    ]
    const calls = installTables(fromMock, { task_templates: { data: rows } })
    expect(await getCustomRules('u1', 'c1')).toEqual(rows)
    expect(argsOf(calls, 'task_templates', 'eq')).toEqual([['user_id', 'u1'], ['challenge_id', 'c1']])
    expect(argsOf(calls, 'task_templates', 'order')[0]).toEqual(['sort_order', { ascending: true }])
  })

  it('kastar vidare fel och tål null-data', async () => {
    installTables(fromMock, { task_templates: { data: null, error: { message: 'rls' } } })
    await expect(getCustomRules('u1', 'c1')).rejects.toMatchObject({ message: 'rls' })

    installTables(fromMock, { task_templates: { data: null } })
    expect(await getCustomRules('u1', 'c1')).toEqual([])
  })
})

describe('createCustomRule', () => {
  const created = { id: 'r9', name: 'Meditera', icon: 'wind', sort_order: 5 }

  it('lägger regeln sist genom att fortsätta på högsta sort_order', async () => {
    const calls = installTables(fromMock, {
      task_templates: [{ data: { sort_order: 4 } }, { data: created }],
    })
    expect(await createCustomRule('u1', 'c1', 'lvl1', 'Meditera', 'wind')).toEqual(created)

    expect(argsOf(calls, 'task_templates', 'insert', 1)[0][0]).toEqual({
      user_id: 'u1', challenge_id: 'c1', level_id: 'lvl1',
      name: 'Meditera', icon: 'wind', type: 'custom', sort_order: 5,
    })
    // Ingen daglogg angiven → ingen avbockningsrad skapas
    expect(calls.task_completions).toBeUndefined()
  })

  it('första regeln får sort_order 0', async () => {
    const calls = installTables(fromMock, {
      task_templates: [{ data: null }, { data: { ...created, sort_order: 0 } }],
    })
    await createCustomRule('u1', 'c1', 'lvl1', 'Meditera', 'wind')
    expect(argsOf(calls, 'task_templates', 'insert', 1)[0][0]).toMatchObject({ sort_order: 0 })
  })

  it('med dagloggen skapas dagens avbockning direkt, obockad', async () => {
    const calls = installTables(fromMock, {
      task_templates: [{ data: null }, { data: created }],
      task_completions: { data: null },
    })
    await createCustomRule('u1', 'c1', 'lvl1', 'Meditera', 'wind', 'log1')
    expect(argsOf(calls, 'task_completions', 'insert')[0][0]).toEqual({
      daily_log_id: 'log1', task_template_id: 'r9', completed: false,
    })
  })

  it('kastar vidare fel från både regeln och avbockningen', async () => {
    installTables(fromMock, {
      task_templates: [{ data: null }, { data: null, error: { message: 'stopp' } }],
    })
    await expect(createCustomRule('u1', 'c1', 'lvl1', 'X', 'y')).rejects.toMatchObject({ message: 'stopp' })

    installTables(fromMock, {
      task_templates: [{ data: null }, { data: created }],
      task_completions: { data: null, error: { message: 'fk' } },
    })
    await expect(createCustomRule('u1', 'c1', 'lvl1', 'X', 'y', 'log1')).rejects.toMatchObject({ message: 'fk' })
  })
})

describe('deleteCustomRule', () => {
  it('raderar avbockningarna före mallen, FK:n saknar cascade', async () => {
    const calls = installTables(fromMock, {
      task_completions: { data: null },
      task_templates: { data: null },
    })
    await deleteCustomRule('r1')

    expect(fromMock.mock.calls.map(c => c[0])).toEqual(['task_completions', 'task_templates'])
    expect(argsOf(calls, 'task_completions', 'eq')[0]).toEqual(['task_template_id', 'r1'])
    expect(argsOf(calls, 'task_templates', 'eq')[0]).toEqual(['id', 'r1'])
  })

  it('rör inte mallen om avbockningarna inte gick att radera', async () => {
    const calls = installTables(fromMock, {
      task_completions: { data: null, error: { message: 'stopp' } },
    })
    await expect(deleteCustomRule('r1')).rejects.toMatchObject({ message: 'stopp' })
    expect(calls.task_templates).toBeUndefined()
  })
})

describe('updateCustomRule', () => {
  it('uppdaterar namn och ikon på rätt rad', async () => {
    const calls = installTables(fromMock, { task_templates: { data: null } })
    await updateCustomRule('r1', 'Läs 20 sidor', 'book-open')
    expect(argsOf(calls, 'task_templates', 'update')[0][0]).toEqual({ name: 'Läs 20 sidor', icon: 'book-open' })
    expect(argsOf(calls, 'task_templates', 'eq')[0]).toEqual(['id', 'r1'])
  })

  it('kastar vidare fel', async () => {
    installTables(fromMock, { task_templates: { data: null, error: { message: 'nej' } } })
    await expect(updateCustomRule('r1', 'X', 'y')).rejects.toMatchObject({ message: 'nej' })
  })
})
