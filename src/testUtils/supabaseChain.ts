// =============================================================================
// Delad Supabase-mock för tjänstetester: from(tabell) ger en kedjbar,
// awaitbar fråga vars svar styrs per tabell. Alla anrop spelas in så
// testerna kan verifiera exakt vilka filter och rader som skickades.
// =============================================================================

export interface TableResult {
  data?: unknown
  error?: { code?: string; message?: string } | null
  count?: number | null
}

export interface RecordedCall { method: string; args: unknown[] }

/**
 * Kopplar in svar per tabell på en from-mock. Ges en array används svaren
 * i tur och ordning (sista återanvänds). Returnerar inspelningen:
 * calls[tabell] = en lista per from()-anrop, med metodanropen i ordning.
 */
export function installTables(
  fromMock: jest.Mock,
  config: Record<string, TableResult | TableResult[]>,
): Record<string, RecordedCall[][]> {
  const queues: Record<string, TableResult[]> = {}
  for (const [table, r] of Object.entries(config)) {
    queues[table] = Array.isArray(r) ? [...r] : [r]
  }
  const calls: Record<string, RecordedCall[][]> = {}

  fromMock.mockImplementation((table: string) => {
    const queue = queues[table] ?? [{ data: [], error: null, count: null }]
    const result = queue.length > 1 ? queue.shift()! : queue[0]
    const rec: RecordedCall[] = []
    ;(calls[table] ??= []).push(rec)

    const chain: Record<string, unknown> = {}
    const methods = [
      'select', 'eq', 'neq', 'in', 'gt', 'gte', 'lt', 'lte', 'is', 'or',
      'order', 'limit', 'insert', 'update', 'delete', 'upsert',
    ]
    for (const m of methods) {
      chain[m] = (...args: unknown[]) => { rec.push({ method: m, args }); return chain }
    }
    chain.maybeSingle = () => Promise.resolve(result)
    chain.single = () => Promise.resolve(result)
    chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(res, rej)
    return chain
  })

  return calls
}

/** Argumenten för första förekomsten av en metod i ett visst from()-anrop */
export function argsOf(
  calls: Record<string, RecordedCall[][]>,
  table: string,
  method: string,
  invocation = 0,
): unknown[][] {
  return (calls[table]?.[invocation] ?? [])
    .filter(c => c.method === method)
    .map(c => c.args)
}

/** En kanal-mock för realtidsprenumerationer: .on().on().subscribe() */
export function installChannel(supabaseLike: {
  channel: jest.Mock
  removeChannel: jest.Mock
}) {
  const listeners: Array<{ config: unknown }> = []
  const handle = { id: 'channel' }
  const chain: { on: jest.Mock; subscribe: jest.Mock } = {
    on: jest.fn(),
    subscribe: jest.fn(() => handle),
  }
  chain.on.mockImplementation((_event: string, config: unknown) => { listeners.push({ config }); return chain })
  supabaseLike.channel.mockReturnValue(chain)
  supabaseLike.removeChannel.mockResolvedValue(undefined)
  return { chain, handle, listeners }
}
