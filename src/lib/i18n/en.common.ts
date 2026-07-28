// Engelska översättningar — svenska texten är nyckeln.
// Fylls på per skärmområde, saknade nycklar faller tillbaka på svenskan.
export const EN_COMMON: Record<string, string> = {
  // Relativa tider (src/lib/format.ts timeAgo)
  'nu': 'now',
  '{n} min': '{n} min',
  '{n} h': '{n} h',
  '{n} d': '{n} d',

  // Nivåernas uppgiftsnamn (task_templates i databasen — appcopy, inte användardata)
  'Läsning (valfri)': 'Reading (optional)',
  'Kostplan': 'Meal plan',
  'Framstegsfoto (valfritt)': 'Progress photo (optional)',
  'Kost utan fusk': 'No cheat meals',
  'Framstegsfoto': 'Progress photo',
  'Strikt kostplan': 'Strict meal plan',
  'Pass 1': 'Session 1',
  'Pass 2': 'Session 2',
  'Kall dusch': 'Cold shower',
  // Äldre mallnamn som kan ligga kvar hos testkonton
  'Kostplan, noll socker': 'Meal plan, zero sugar',
  'Strikt diet': 'Strict diet',
}
