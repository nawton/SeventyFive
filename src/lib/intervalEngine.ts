import type { RunSegment } from './runProgression'
import type { CardioInterval } from '@/services/cardioWorkouts'

// =============================================================================
// INTERVALLMOTORN — ren logik för guidade pass (uppvärmning → arbete/vila →
// nedvarvning). Ingen React, inga sido-effekter: motorn muterar sitt state,
// samlar resultat och returnerar HÄNDELSER som GPS-skärmen översätter till
// röst, haptik och UI-uppdateringar. Det gör den enhetstestbar och håller
// cardio.tsx smalare.
//
// Anropas från både 1 s-timern (tidssegment) och GPS-callbacken (distans-
// segment); idempotent — ett andra anrop i samma tick ser det nya segmentet
// med positiv återstående och gör ingenting.
// =============================================================================

export interface EngineState {
  idx: number             // aktuellt segmentindex
  segStartDistKm: number  // total distans (km) vid segmentets start
  segStartElapsed: number // total tid (s) vid segmentets start
  restWarned: boolean     // 10 s-varningen given för aktuellt vilosegment
  completedWork: number   // avklarade arbetssegment
  done: boolean           // hela upplägget klart (rundan fortsätter ändå)
}

export type EngineEvent =
  /** Vila med ≤10 s kvar — haptik Medium + "Tio sekunder kvar" */
  | { type: 'restWarning'; phrase: string }
  /** Segmentbyte — haptik Success + övergångsfras */
  | { type: 'transition'; phrase: string }
  /** Sista segmentet klart — haptik Success + slutfras. Ingen auto-stopp. */
  | { type: 'workoutComplete'; phrase: string }

export function createEngineState(): EngineState {
  return { idx: 0, segStartDistKm: 0, segStartElapsed: 0, restWarned: false, completedWork: 0, done: false }
}

export function segRemaining(
  seg: RunSegment,
  st: EngineState,
  now: { distanceKm: number; elapsedS: number },
): number {
  return seg.distanceM
    ? seg.distanceM - (now.distanceKm - st.segStartDistKm) * 1000
    : (seg.durationS ?? 0) - (now.elapsedS - st.segStartElapsed)
}

/** "1,5 kilometer" / "600 meter" — för uppläsning */
export function spokenDist(m: number): string {
  if (m >= 1000 && m % 100 === 0) {
    return `${String(m / 1000).replace('.', ',')} kilometer`
  }
  return `${m} meter`
}

export function spokenSegmentIntro(seg: RunSegment): string {
  if (seg.kind === 'work') {
    // Intervaller läses i meter ("Intervall 3 av 6. 1000 meter."),
    // tempo/maratonfart/fartlek i kilometer
    return seg.label.startsWith('Intervall')
      ? `${seg.label}. ${seg.distanceM} meter.`
      : `${seg.label}: ${spokenDist(seg.distanceM ?? 0)}.`
  }
  if (seg.durationS) {
    return `${seg.label}: ${Math.round(seg.durationS / 60)} minuter i lugnt tempo.`
  }
  return `${seg.label}: ${spokenDist(seg.distanceM ?? 0)} i lugnt tempo.`
}

export function transitionPhrase(finished: RunSegment, next: RunSegment): string {
  if (next.kind === 'rest') {
    return `Intervall klar. Vila ${next.durationS} sekunder.`
  }
  if (next.kind === 'cooldown') {
    const prefix = finished.label.startsWith('Intervall')
      ? 'Sista intervallen klar. '
      : 'Bra jobbat! '
    return `${prefix}${spokenSegmentIntro(next)}`
  }
  return spokenSegmentIntro(next)
}

/**
 * Kör motorn ett tick: ger 10 s-varning i vilosegment, avancerar genom alla
 * segment vars mål är nådda, registrerar arbetsresultat i `results` och
 * returnerar händelserna som uppstod. `changed` = segmentbyte skedde (UI-
 * snapshot behöver uppdateras).
 */
export function advanceEngine(
  st: EngineState,
  segs: RunSegment[],
  now: { distanceKm: number; elapsedS: number },
  results: CardioInterval[],
): { changed: boolean; events: EngineEvent[] } {
  const events: EngineEvent[] = []
  if (st.done) return { changed: false, events }

  // 10 s-varning innan vilan tar slut — löparen hinner göra sig redo
  const cur = segs[st.idx]
  if (cur.kind === 'rest' && cur.durationS && !st.restWarned) {
    const remain = segRemaining(cur, st, now)
    if (remain <= 10 && remain > 0) {
      st.restWarned = true
      events.push({ type: 'restWarning', phrase: 'Tio sekunder kvar. Gör dig redo.' })
    }
  }

  // Avancera — idx växer strikt, loopen terminerar vid segs.length.
  // Epsilon fångar flyttalsrester när distansen landar exakt på målet
  // (0,4 km beräknat som 1,9−1,5 ger 399,99999… m)
  let changed = false
  const EPS = 1e-6
  while (st.idx < segs.length && segRemaining(segs[st.idx], st, now) <= EPS) {
    const finished = segs[st.idx]
    if (finished.kind === 'work') {
      st.completedWork += 1
      // Faktiskt resultat — mäts INNAN segStart-markörerna nollställs.
      // Distanssegment: måldistansen (triggern), faktisk tid från klockan.
      // Tidssegment (fartlek): måltiden, faktisk distans från GPS:en.
      const durationS = finished.durationS ?? Math.max(1, now.elapsedS - st.segStartElapsed)
      const distanceM = finished.distanceM ?? Math.round((now.distanceKm - st.segStartDistKm) * 1000)
      results.push({
        label: finished.label,
        distanceM,
        durationS,
        paceSec: distanceM > 0 ? Math.round(durationS / (distanceM / 1000)) : 0,
      })
    }
    st.idx += 1
    st.segStartDistKm = now.distanceKm
    st.segStartElapsed = now.elapsedS
    st.restWarned = false
    changed = true
    if (st.idx >= segs.length) {
      st.done = true
      events.push({ type: 'workoutComplete', phrase: 'Passet är klart! Bra jobbat. Avsluta passet när du vill.' })
    } else {
      events.push({ type: 'transition', phrase: transitionPhrase(finished, segs[st.idx]) })
    }
  }
  return { changed, events }
}
