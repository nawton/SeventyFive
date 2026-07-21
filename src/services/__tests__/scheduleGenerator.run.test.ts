import { buildRunSessions, rewritePaces, plannedRunTypes, updateRunPaces } from '../scheduleGenerator'
import { parseRunTarget, resolveRunProgression } from '@/lib/runProgression'
import { supabase } from '@/lib/supabase'
import { setFiveKTime } from '@/lib/prefs'

// Supabase och prefs mockas — löplogiken är det som testas
jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('@/lib/prefs', () => ({ setFiveKTime: jest.fn().mockResolvedValue(undefined) }))

const FIVE_K_25MIN = 25 * 60 // P = 300 s/km = 5:00

describe('buildRunSessions', () => {
  it('ger fem pass i prioritetsordning med rätt målspecifikt extrapass', () => {
    const names = (d: string) => buildRunSessions(d, 'intermediate', null).map(s => s.name)
    expect(names('5k')).toEqual(['Långpass', 'Intervaller', 'Återhämtning', 'Tempopass', 'Fartlek'])
    expect(names('half')[4]).toBe('Distanspass')
    expect(names('marathon')[4]).toBe('Maratonfart')
  })

  it('okänt mål faller tillbaka på 5k-tabellen', () => {
    expect(buildRunSessions('ultra', 'beginner', null)[0].notes)
      .toBe(buildRunSessions('5k', 'beginner', null)[0].notes)
  })

  it('nybörjare på marathon börjar försiktigt men når 30 km', () => {
    const long = buildRunSessions('marathon', 'beginner', null)[0]
    expect(long.notes).toBe('Start 8 km · +1,5 km per vecka · max 30 km')
  })

  it('varje progressivt pass round-trippar genom parseRunTarget', () => {
    // Kontraktet mellan generatorn och progressionsläsaren: inget pass får
    // skrivas i ett format som läsaren tolkar som "plain" (= ingen progression)
    for (const dist of ['5k', '10k', 'half', 'marathon']) {
      for (const exp of ['beginner', 'intermediate', 'advanced'] as const) {
        const sessions = buildRunSessions(dist, exp, FIVE_K_25MIN)
        for (const s of sessions) {
          const t = parseRunTarget(s.notes ?? null, 0)
          if (s.name === 'Återhämtning') {
            expect(t.kind).toBe('plain')
          } else if (s.name === 'Intervaller') {
            expect(t.kind).toBe('interval')
          } else {
            expect(t.kind).toBe('distance')
          }
          // Och progressionen ska ge en läsbar rad för vecka 1
          expect(resolveRunProgression(s.notes ?? null, 0)).toBeTruthy()
        }
      }
    }
  })

  it('5 km-testet 25:00 ger beprövade tempozoner', () => {
    const [long, interval, recovery, tempo, extra] =
      buildRunSessions('marathon', 'intermediate', FIVE_K_25MIN).map(s => s.notes!)
    expect(long).toContain('ca 6:00–6:30 /km')      // lugnt: +60–90 s
    expect(tempo).toContain('ca 5:15–5:25 /km')     // tempo: +15–25 s
    expect(interval).toContain('ca 4:55 /km')       // intervaller: −5 s
    expect(recovery).toContain('ca 6:00–6:30 /km')
    expect(extra).toContain('ca 5:45–6:00 /km')     // maratonfart: +45–60 s
  })

  it('distanspasset (half) får sin egen zon', () => {
    const extra = buildRunSessions('half', 'beginner', FIVE_K_25MIN)[4].notes!
    expect(extra).toContain('ca 5:35–5:50 /km')     // +35–50 s
  })

  it('orimliga testtider ignoreras hellre än löjliga tempon', () => {
    for (const bad of [325 /* 5:25 — ett tempo, inte en 5k-tid */, 100 * 60, 0]) {
      const notes = buildRunSessions('5k', 'beginner', bad).map(s => s.notes!)
      for (const n of notes) expect(n).not.toContain(' ca ')
    }
  })

  it('fartlek får aldrig ett tempoförslag', () => {
    const fartlek = buildRunSessions('5k', 'advanced', FIVE_K_25MIN)[4].notes!
    expect(fartlek).toContain('fartlek')
    expect(fartlek).not.toContain(' ca ')
  })
})

describe('plannedRunTypes', () => {
  it('tar de N första passen för N dagar', () => {
    expect(plannedRunTypes('5k', 3)).toEqual(['Långpass', 'Intervaller', 'Återhämtning'])
    expect(plannedRunTypes('marathon', 5)).toHaveLength(5)
  })
  it('minst ett pass även för noll dagar', () => {
    expect(plannedRunTypes('5k', 0)).toEqual(['Långpass'])
  })
  it('fler dagar än passtyper ger inte dubbletter', () => {
    expect(plannedRunTypes('5k', 7)).toHaveLength(5)
  })
})

describe('rewritePaces', () => {
  const P20 = 20 * 60 // ny testtid 20:00 → P = 240 = 4:00

  it('byter ut gammalt tempoförslag mot nytt utan att röra progressionen', () => {
    expect(rewritePaces('Start 2 km · +0,5 km per vecka · max 5 km · ca 6:00–6:30 /km', P20))
      .toBe('Start 2 km · +0,5 km per vecka · max 5 km · ca 5:00–5:30 /km')
  })
  it('lägger till tempo på pass som saknade det', () => {
    expect(rewritePaces('Start 5×1000 m · +1 per vecka · max 8×1000 m', P20))
      .toBe('Start 5×1000 m · +1 per vecka · max 8×1000 m · ca 3:55 /km')
  })
  it('varje passtyp får sin egen zon', () => {
    expect(rewritePaces('Start 4 km · +1 km per vecka · max 10 km i tempofart · ca 5:15–5:25 /km', P20))
      .toContain('ca 4:15–4:25 /km')
    expect(rewritePaces('Start 4 km · +1 km per vecka · max 10 km i maratonfart', P20))
      .toContain('ca 4:45–5:00 /km')
    expect(rewritePaces('Start 6 km · +1 km per vecka · max 10 km i jämn, behaglig fart', P20))
      .toContain('ca 4:35–4:50 /km')
    expect(rewritePaces('25–35 min i lugnt tempo · ca 6:00–6:30 /km', P20))
      .toContain('ca 5:00–5:30 /km')
  })
  it('fartlek förblir utan tempo — även om ett gammalt låg kvar', () => {
    expect(rewritePaces('Start 3 km · +0,5 km per vecka · max 5 km fartlek · ca 5:00–5:30 /km', P20))
      .toBe('Start 3 km · +0,5 km per vecka · max 5 km fartlek')
  })
  it('egna anteckningar rörs aldrig', () => {
    expect(rewritePaces('möt Anna vid spåret kl 18', P20)).toBe('möt Anna vid spåret kl 18')
  })
})

describe('updateRunPaces', () => {
  it('uppdaterar bara schemalagda cardio-pass vars notes faktiskt ändras', async () => {
    const rows = [
      { id: 'a', session_type: 'cardio', weekdays: [1], notes: 'Start 2 km · +0,5 km per vecka · max 5 km · ca 6:00–6:30 /km' },
      { id: 'b', session_type: 'cardio', weekdays: [2], notes: 'möt Anna vid spåret' },       // egna — orörda
      { id: 'c', session_type: 'gym',    weekdays: [3], notes: 'Start 2 km · max 5 km' },     // gym — ignoreras
      { id: 'd', session_type: 'cardio', weekdays: [],  notes: 'Start 2 km · max 5 km' },     // utan schemadagar
      { id: 'e', session_type: 'cardio', weekdays: [5], notes: null },                        // utan notes
    ]
    const updates: { id: string; notes: string }[] = []
    ;(supabase.from as jest.Mock).mockImplementation(() => ({
      select: () => ({ eq: () => Promise.resolve({ data: rows, error: null }) }),
      update: (payload: { notes: string }) => ({
        eq: (_col: string, id: string) => {
          updates.push({ id, notes: payload.notes })
          return Promise.resolve({ error: null })
        },
      }),
    }))

    const changed = await updateRunPaces('user-1', 20 * 60)
    expect(changed).toBe(1)
    expect(updates).toEqual([{ id: 'a', notes: 'Start 2 km · +0,5 km per vecka · max 5 km · ca 5:00–5:30 /km' }])
    expect(setFiveKTime).toHaveBeenCalledWith(20 * 60)
  })

  it('kastar vidare databasfel', async () => {
    ;(supabase.from as jest.Mock).mockImplementation(() => ({
      select: () => ({ eq: () => Promise.resolve({ data: null, error: new Error('nätverk') }) }),
    }))
    await expect(updateRunPaces('user-1', 1500)).rejects.toThrow('nätverk')
  })
})
