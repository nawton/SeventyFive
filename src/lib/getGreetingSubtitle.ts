import { t } from '@/lib/i18n'

/**
 * Regelbaserad underrubrik på hemskärmen.
 * Ren funktion, inga sidoeffekter, lätt att enhetstesta.
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
    return t('Dag {n} i hamn. Vi ses imorgon.', { n: currentDay })
  }

  // Natt 21–05
  if (hour >= 21 || hour < 5) {
    if (remaining === 1) return t('En uppgift kvar, sista chansen.')
    if (remaining > 1)  return t('{n} uppgifter kvar, sista chansen idag.', { n: remaining })
    return t('Dags att vila.')
  }

  // Morgon 05–12
  if (hour < 12) {
    if (completedCount === 0) return t('Ny dag, nytt blad. Börja med vattnet?')
    if (remaining === 1)      return t('En uppgift kvar, du är nästan i mål.')
    return t('Bra start! {n} uppgifter kvar.', { n: remaining })
  }

  // Eftermiddag 12–17
  if (hour < 17) {
    if (completedCount === 0) return t('Eftermiddag och inget loggat än, kom igång nu.')
    if (remaining === 1)      return t('En uppgift kvar, du fixar den.')
    return t('{n} uppgifter kvar, håll farten.', { n: remaining })
  }

  // Kväll 17–21
  if (completedCount === 0) return t('Kväll och inget klart ännu, nu kör vi.')
  if (remaining === 1)      return t('En uppgift kvar, spurta hem.')
  return t('{n} uppgifter kvar, kom igen.', { n: remaining })
}
