import { advanceEngine, createEngineState, segRemaining, type EngineState, type EngineEvent } from '../intervalEngine'
import type { RunSegment } from '../runProgression'
import type { CardioInterval } from '@/services/cardioWorkouts'

// Litet testpass: värmning → 2×400 m med 90 s vila → nedvarvning
const SEGS: RunSegment[] = [
  { kind: 'warmup', distanceM: 1500, label: 'Uppvärmning' },
  { kind: 'work', distanceM: 400, label: 'Intervall 1 av 2' },
  { kind: 'rest', durationS: 90, label: 'Vila' },
  { kind: 'work', distanceM: 400, label: 'Intervall 2 av 2' },
  { kind: 'cooldown', distanceM: 1500, label: 'Nedvarvning' },
]

function run(st: EngineState, results: CardioInterval[], distanceKm: number, elapsedS: number): EngineEvent[] {
  return advanceEngine(st, SEGS, { distanceKm, elapsedS }, results).events
}

describe('advanceEngine — helt pass', () => {
  it('går igenom alla segment med rätt händelser och resultat', () => {
    const st = createEngineState()
    const results: CardioInterval[] = []

    expect(run(st, results, 0.5, 180)).toEqual([])                     // mitt i värmningen
    expect(run(st, results, 1.5, 540)[0].phrase).toContain('Intervall 1 av 2') // värmning klar
    expect(run(st, results, 1.9, 660)[0].phrase).toContain('Vila 90') // intervall 1 klar
    expect(run(st, results, 1.9, 741)[0].type).toBe('restWarning')    // 9 s kvar av vilan
    expect(run(st, results, 1.9, 742)).toEqual([])                    // varningen ges bara EN gång
    expect(run(st, results, 1.9, 750)[0].phrase).toContain('Intervall 2 av 2') // vilan slut
    expect(run(st, results, 2.3, 870)[0].phrase).toContain('Nedvarvning')      // sista intervallen klar
    const done = run(st, results, 3.8, 1470)
    expect(done[0].type).toBe('workoutComplete')
    expect(run(st, results, 4.0, 1500)).toEqual([])                   // efter done: inget

    expect(st.completedWork).toBe(2)
    expect(st.done).toBe(true)
    // Per-intervall-resultat: 400 m på 120 s = 300 s/km
    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({ label: 'Intervall 1 av 2', distanceM: 400, durationS: 120, paceSec: 300 })
  })

  it('är idempotent — dubbelt tick i samma ögonblick ger inget extra', () => {
    const st = createEngineState()
    const results: CardioInterval[] = []
    expect(run(st, results, 1.5, 540)).toHaveLength(1) // värmning klar → intervall 1
    expect(run(st, results, 1.5, 540)).toEqual([])     // GPS + timer i samma tick
    expect(st.completedWork).toBe(0)
  })

  it('hanterar flyttalsrester på exakta segmentgränser', () => {
    // 1,9 − 1,5 = 0,3999… → utan epsilon fastnar motorn en tick
    const st = createEngineState()
    const results: CardioInterval[] = []
    run(st, results, 1.5, 540)
    expect(run(st, results, 1.9, 660)).toHaveLength(1)
  })

  it('GPS-lucka krediterar inte nästa segment retroaktivt', () => {
    // Medveten design: när ett segment avslutas startar nästa från NULÄGET.
    // En lång GPS-lucka (0 → 2,0 km i ett tick) avslutar värmningen men
    // ger inte luckans överskott till intervall 1 — annars skulle
    // intervallresultat fabriceras ur GPS-bortfall.
    const st = createEngineState()
    const results: CardioInterval[] = []
    const events = run(st, results, 2.0, 700)
    expect(events.map(e => e.type)).toEqual(['transition'])
    expect(st.idx).toBe(1)              // intervall 1 börjar från 2,0 km
    expect(st.segStartDistKm).toBe(2.0)
    expect(results).toHaveLength(0)
  })

  it('fartlek-arbete mäter faktisk distans från GPS:en', () => {
    const fartlek: RunSegment[] = [
      { kind: 'warmup', durationS: 600, label: 'Uppvärmning' },
      { kind: 'work', distanceM: 3000, label: 'Fartlek' },
      { kind: 'cooldown', durationS: 300, label: 'Nedvarvning' },
    ]
    const st = createEngineState()
    const results: CardioInterval[] = []
    advanceEngine(st, fartlek, { distanceKm: 0.8, elapsedS: 600 }, results)  // värmning klar (tid)
    advanceEngine(st, fartlek, { distanceKm: 3.8, elapsedS: 1560 }, results) // 3 km i 960 s
    expect(results[0]).toMatchObject({ distanceM: 3000, durationS: 960, paceSec: 320 })
  })
})

describe('segRemaining', () => {
  it('mäter distanssegment relativt segmentstarten', () => {
    const st = createEngineState()
    st.segStartDistKm = 2.0
    expect(segRemaining(SEGS[1], st, { distanceKm: 2.3, elapsedS: 999 })).toBeCloseTo(100)
  })
  it('mäter tidssegment relativt segmentstarten', () => {
    const st = createEngineState()
    st.segStartElapsed = 100
    expect(segRemaining(SEGS[2], st, { distanceKm: 999, elapsedS: 160 })).toBe(30)
  })
})
