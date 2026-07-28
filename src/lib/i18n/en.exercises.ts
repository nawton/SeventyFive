// Engelska översättningar — svenska texten är nyckeln.
// Övningsbiblioteket och de genererade passnamnen: lagras på svenska i
// databasen (data), översätts vid VISNING via t(). Namn som redan är
// engelska (Pull-ups, Dips, Hip thrust …) behöver ingen post — fallbacken
// visar dem som de är.
export const EN_EXERCISES: Record<string, string> = {
  // ── Genererade passnamn (scheduleGenerator) ──
  'Bröst & Triceps': 'Chest & Triceps',
  'Rygg & Biceps': 'Back & Biceps',
  'Ben & Mage': 'Legs & Core',
  'Axlar & Mage': 'Shoulders & Core',
  'Underkropp & Mage': 'Lower Body & Core',
  'Helkropp': 'Full Body',
  'Helkropp A': 'Full Body A',
  'Helkropp B': 'Full Body B',
  'Helkropp C': 'Full Body C',

  // ── Bröst ──
  'Bänkpress': 'Bench press',
  'Hantelpress liggande': 'Dumbbell bench press',
  'Lutande bänkpress': 'Incline bench press',
  'Decline bänkpress': 'Decline bench press',
  'Kabelkorsning': 'Cable crossover',
  'Smalbänkpress': 'Close-grip bench press',

  // ── Rygg ──
  'Marklyft': 'Deadlift',
  'Latsdrag framifrån': 'Lat pulldown',
  'Latsdrag bakåt': 'Behind-the-neck pulldown',
  'Rodd med skivstång': 'Barbell row',
  'Enarms hantelrodd': 'One-arm dumbbell row',
  'Kabelrodd sittande': 'Seated cable row',
  'T-bar rodd': 'T-bar row',

  // ── Ben ──
  'Knäböj': 'Squat',
  'Benpress': 'Leg press',
  'Utfall': 'Lunges',
  'Bulgariska utfall': 'Bulgarian split squats',
  'Rumänsk marklyft': 'Romanian deadlift',
  'Sumo marklyft': 'Sumo deadlift',
  'Bencurl liggande': 'Lying leg curl',
  'Benextension': 'Leg extension',
  'Vadpress stående': 'Standing calf raise',
  'Steg-ups': 'Step-ups',

  // ── Axlar ──
  'Militärpress': 'Overhead press',
  'Hantelpress axlar': 'Dumbbell shoulder press',
  'Sidolyft': 'Lateral raises',
  'Frontlyft': 'Front raises',
  'Bakre deltalyft': 'Rear delt raises',
  'Axellyft med kabel': 'Cable lateral raise',

  // ── Armar ──
  'Bicepscurl': 'Biceps curl',
  'Hammercurl': 'Hammer curl',
  'Koncentrationscurl': 'Concentration curl',
  'Kabelbiceps': 'Cable biceps curl',
  'Tricepsstötning kabel': 'Triceps pushdown',
  'Tricepspress smal': 'Close-grip triceps press',

  // ── Mage ──
  'Plankan': 'Plank',
  'Sidoplanka': 'Side plank',
  'Situps': 'Sit-ups',
  'Hängande benlyft': 'Hanging leg raises',
  'Kabelcrunch': 'Cable crunch',

  // ── Cardio och övrigt ──
  'Löpning': 'Running',
  'Intervallspring': 'Interval running',
  'Hopprep': 'Jump rope',
  'Cykling': 'Cycling',
  'Rodd': 'Rowing',
  'Frivändning': 'Power clean',
}
