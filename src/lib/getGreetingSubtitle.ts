/**
 * Regelbaserad underrubrik på hemskärmen.
 * Ren funktion — inga sidoeffekter, lätt att enhetstesta.
 */
export function getGreetingSubtitle(
  hour: number,
  completedCount: number,
  totalCount: number,
  currentDay: number,
): string {
  const remaining = Math.max(0, totalCount - completedCount)
  const allDone   = totalCount > 0 && completedCount === totalCount

  if (allDone) {
    return `Dag ${currentDay} i hamn. Vi ses imorgon.`
  }

  // Natt 21–05
  if (hour >= 21 || hour < 5) {
    if (remaining === 1) return 'En uppgift kvar — sista chansen.'
    if (remaining > 1)  return `${remaining} uppgifter kvar — sista chansen idag.`
    return 'Dags att vila.'
  }

  // Morgon 05–12
  if (hour < 12) {
    if (completedCount === 0) return 'Ny dag, nytt blad. Börja med vattnet?'
    if (remaining === 1)      return 'En uppgift kvar — du är nästan i mål.'
    return `Bra start! ${remaining} uppgifter kvar.`
  }

  // Eftermiddag 12–17
  if (hour < 17) {
    if (completedCount === 0) return 'Eftermiddag och inget loggat än — kom igång nu.'
    if (remaining === 1)      return 'En uppgift kvar — du fixar den.'
    return `${remaining} uppgifter kvar — håll farten.`
  }

  // Kväll 17–21
  if (completedCount === 0) return 'Kväll och inget klart ännu — nu kör vi.'
  if (remaining === 1)      return 'En uppgift kvar — spurta hem.'
  return `${remaining} uppgifter kvar — kom igen.`
}
