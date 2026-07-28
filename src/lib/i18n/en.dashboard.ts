// Engelska översättningar — svenska texten är nyckeln.
// Fylls på per skärmområde, saknade nycklar faller tillbaka på svenskan.
export const EN_DASHBOARD: Record<string, string> = {
  // ── dashboard.tsx: greeting ──
  'God natt': 'Good night',
  'God morgon': 'Good morning',
  'God eftermiddag': 'Good afternoon',
  'God kväll': 'Good evening',

  // ── dashboard.tsx: rollover margin alert ──
  'Marginalen räddade dig': 'The grace day saved you',
  'Dag {n} räknas som missad, men på Normal har du en dags marginal per vecka. Utmaningen fortsätter.':
    'Day {n} counts as missed, but on Normal you get one grace day per week. The challenge continues.',
  'Dagarna {days} räknas som missade, men marginalen på Normal täcker dem. Utmaningen fortsätter.':
    'Days {days} count as missed, but the grace day on Normal covers them. The challenge continues.',

  // ── dashboard.tsx: workout not logged alert ──
  'Inget pass loggat idag': 'No workout logged today',
  'Kör ett pass först, allt räknas! Inget gym? Ta ett hemmapass: armhävningar, situps och utfall, eller en rask promenad med GPS:en igång.':
    'Get a workout in first, everything counts! No gym? Do a home workout: push-ups, sit-ups and lunges, or a brisk walk with your GPS running.',
  'Senare': 'Later',
  'Logga pass': 'Log workout',

  // ── dashboard.tsx: progress photo alert ──
  'Dagens framstegsfoto': "Today's progress photo",
  'Framstegsfotot är en av reglerna på {level}: ett foto varje dag.':
    'The progress photo is one of the rules on {level}: one photo every day.',
  'din nivå': 'your level',
  'Avbryt': 'Cancel',
  'Ta foto': 'Take photo',
  'Vill du ta ett foto nu eller hoppa över idag? På Normal godkänns dagen även utan foto.':
    'Do you want to take a photo now or skip today? On Normal the day is approved even without a photo.',
  'Hoppa över idag': 'Skip today',

  // ── dashboard.tsx: reading task alerts ──
  'Ta bort läsloggen?': 'Remove the reading log?',
  'Uppgiften markeras som ej klar.': 'The task will be marked as not done.',
  'Ta bort': 'Remove',
  'Dagens läsning': "Today's reading",
  'Läsningen är valfri på Normal. Logga det du läst eller hoppa över idag.':
    'Reading is optional on Normal. Log what you read or skip today.',
  'Logga läsning': 'Log reading',

  // ── dashboard.tsx: custom rule errors ──
  'Fel': 'Error',
  'Kunde inte spara regeln.': 'Could not save the rule.',
  'Ta bort regel': 'Remove rule',
  'Vill du ta bort "{name}"? Regeln och dess historik försvinner.':
    'Do you want to remove "{name}"? The rule and its history will disappear.',
  'Kunde inte ta bort regeln.': 'Could not remove the rule.',

  // ── dashboard.tsx: load error ──
  'Kunde inte ladda dagens uppgifter': "Could not load today's tasks",
  'Försök igen': 'Try again',

  // ── dashboard.tsx: hero card & ring ──
  'KLART': 'DONE',
  'DAG': 'DAY',
  'av utmaningen': 'of the challenge',

  // ── dashboard.tsx: social pulse ──
  'ny händelse': 'new event',
  'nya händelser': 'new events',
  'vänförfrågan': 'friend request',
  'vänförfrågningar': 'friend requests',
  'gruppnotis': 'group notification',
  'gruppnotiser': 'group notifications',
  'oläst meddelande': 'unread message',
  'olästa meddelanden': 'unread messages',

  // ── dashboard.tsx: today's sessions ──
  'DAGENS PASS': "TODAY'S WORKOUTS",
  'Vilodag': 'Rest day',
  'Inga pass planerade idag': 'No workouts planned today',
  'Cardiopass': 'Cardio session',
  '{n} övningar': '{n} exercises',

  // ── dashboard.tsx: tasks section ──
  'DAGENS UPPGIFTER': "TODAY'S TASKS",
  'glas': 'glasses',
  '{n} sidor': '{n} pages',
  'Överhoppat idag': 'Skipped today',
  'Läggs till i profilen': 'Added to your profile',

  // ── dashboard.tsx: rules section ──
  'REGLER': 'RULES',
  'Lägg till': 'Add',
  'Lägg till en egen daglig regel': 'Add your own daily rule',

  // ── dashboard.tsx: fail / done ──
  'Rapportera dag missad': 'Report day as missed',
  'Dagen är rapporterad som missad.': 'The day has been reported as missed.',

  // ── FailModal.tsx ──
  'Rapportera dagen som missad': 'Report the day as missed',
  'Var ärlig mot dig själv. Dagen kan bara rapporteras med en plan för hur imorgon blir bättre.':
    'Be honest with yourself. The day can only be reported with a plan for how tomorrow will be better.',
  'VAD HÄNDE?': 'WHAT HAPPENED?',
  'Jag missade för att …': 'I missed it because …',
  'DIN PLAN FÖR IMORGON': 'YOUR PLAN FOR TOMORROW',
  'Imorgon gör jag istället …': 'Tomorrow I will instead …',
  'Rapportera missad dag': 'Report missed day',

  // ── RestartPromptModal.tsx ──
  'Dagen är missad': 'The day is missed',
  'Du missade dag {n}': 'You missed day {n}',
  'Du missade {n} dagar': 'You missed {n} days',
  'Utmaningen bygger på att varje dag räknas. Vad gör du nu?':
    'The challenge is built on every day counting. What do you do now?',
  'Ingen dag loggades som klar. Utmaningen bygger på att varje dag räknas. Vad gör du nu?':
    'No day was logged as done. The challenge is built on every day counting. What do you do now?',
  'Att starta om är inte att förlora, det är att ta utmaningen på allvar. Att fortsätta är okej, men dagen räknas som missad i din statistik.':
    "Restarting isn't losing, it's taking the challenge seriously. Continuing is fine too, but the day counts as missed in your stats.",
  'På din nivå är regeln enkel: en missad dag betyder omstart från dag 1. Allt du loggat, dina pass och rekord finns kvar, det är bara dagräkningen som börjar om.':
    "On your level the rule is simple: a missed day means restarting from day 1. Everything you've logged, your workouts and records stay, only the day count starts over.",
  'Starta om från dag 1': 'Restart from day 1',
  'Fortsätt ändå': 'Continue anyway',

  // ── VictoryModal.tsx ──
  'Du klarade utmaningen': 'You completed the challenge',
  '75 dagar. Varje dag räknades, och du räknade dem alla.':
    '75 days. Every day counted, and you counted them all.',
  'Nivå': 'Level',
  'Klara dagar': 'Days completed',
  'Starta en ny utmaning': 'Start a new challenge',

  // ── ReadingLogModal.tsx ──
  // ('Logga läsning' already defined above under dashboard.tsx reading alerts)
  'Minst {n} sidor i en riktig bok, inte poddar eller artiklar.':
    'At least {n} pages in a real book, not podcasts or articles.',
  'Vad läste du idag?': 'What did you read today?',
  'BOK': 'BOOK',
  'Boktitel (valfritt)': 'Book title (optional)',
  'SIDOR': 'PAGES',
  'Markera som läst': 'Mark as read',

  // ── AddRuleSheet.tsx ──
  'Ny regel': 'New rule',
  'NAMN': 'NAME',
  't.ex. Kall dusch varje morgon': 'e.g. Cold shower every morning',
  'IKON': 'ICON',
  'Spara regel': 'Save rule',
  // Icon option labels
  'Klar': 'Done',
  'Morgon': 'Morning',
  'Kväll': 'Evening',
  'Sömn': 'Sleep',
  'Vatten': 'Water',
  'Kost': 'Diet',
  'Läsning': 'Reading',
  'Journaling': 'Journaling',
  'Meditation': 'Meditation',
  'Promenad': 'Walk',
  'Cykling': 'Cycling',
  'Kall dusch': 'Cold shower',
  'Ingen skärm': 'No screen',
  'Musik': 'Music',
  'Energi': 'Energy',
  'Träning': 'Training',
  // ── ScheduleIntroSheet.tsx ──
  'Skapa ditt schema': 'Create your schedule',
  'Kom igång med ett anpassat träningsprogram. Svara på några frågor så bygger vi veckans pass åt dig.':
    "Get started with a custom workout plan. Answer a few questions and we'll build your week's sessions for you.",
  'Skapa schema': 'Create schedule',
  'Nej tack, visa inte igen': "No thanks, don't show again",

  // ── getGreetingSubtitle.ts ──
  'Dag {n} i hamn. Vi ses imorgon.': 'Day {n} in the bag. See you tomorrow.',
  'En uppgift kvar, sista chansen.': 'One task left, last chance.',
  '{n} uppgifter kvar, sista chansen idag.': '{n} tasks left, last chance today.',
  'Dags att vila.': 'Time to rest.',
  'Ny dag, nytt blad. Börja med vattnet?': 'New day, fresh start. Start with the water?',
  'En uppgift kvar, du är nästan i mål.': "One task left, you're almost there.",
  'Bra start! {n} uppgifter kvar.': 'Great start! {n} tasks left.',
  'Eftermiddag och inget loggat än, kom igång nu.': "It's afternoon and nothing's logged yet, get going now.",
  'En uppgift kvar, du fixar den.': "One task left, you've got this.",
  '{n} uppgifter kvar, håll farten.': '{n} tasks left, keep it up.',
  'Kväll och inget klart ännu, nu kör vi.': "It's evening and nothing's done yet, let's go.",
  'En uppgift kvar, spurta hem.': 'One task left, sprint to the finish.',
  '{n} uppgifter kvar, kom igen.': '{n} tasks left, come on.',
}
