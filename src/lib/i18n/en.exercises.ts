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

  // ── Skapa egen övning (CreateExerciseSheet + ExercisePickerSheet) ──
  'Skapa egen övning': 'Create custom exercise',
  'Hittar du inte din övning? Lägg till den själv.': 'Cannot find your exercise? Add it yourself.',
  'Skapa "{name}"': 'Create "{name}"',
  'Skapa övning': 'Create exercise',
  'ÖVNINGSNAMN': 'EXERCISE NAME',
  'T.ex. Landmine press': 'E.g. Landmine press',
  'Utrustning': 'Equipment',
  'Primär muskelgrupp': 'Primary muscle group',
  'Övriga muskler': 'Other muscles',
  'Övningstyp': 'Exercise type',
  'Välj': 'Select',
  'Välj (valfritt)': 'Select (optional)',
  'Välj utrustning': 'Select equipment',
  'Välj övningstyp': 'Select exercise type',
  'Övningen blir bara synlig för dig och dyker upp i övningsväljaren under sin muskelgrupp.': 'The exercise is only visible to you and shows up in the exercise picker under its muscle group.',
  'Sparar …': 'Saving …',
  'Fler muskler': 'More muscles',
  'Lägg till muskel': 'Add muscle',
  'Lägg till muskler': 'Add muscles',

  // Utrustning
  'Ingen utrustning': 'No equipment',
  'Skivstång': 'Barbell',
  'Hantlar': 'Dumbbells',
  'Kettlebell': 'Kettlebell',
  'Maskin': 'Machine',
  'Viktskiva': 'Plate',
  'Gummiband': 'Resistance band',
  'Suspensionsband': 'Suspension band',
  'Annat': 'Other',

  // Övningstyper
  'Vikt & reps': 'Weight & reps',
  'Kroppsvikt': 'Bodyweight reps',
  'Kroppsvikt med vikt': 'Weighted bodyweight',
  'Assisterad kroppsvikt': 'Assisted bodyweight',
  'Endast tid': 'Duration',
  'Tid & vikt': 'Duration & weight',
  'Bänkpress, Hantelcurl': 'Bench press, dumbbell curls',
  'Pull-ups, Situps, Burpees': 'Pull-ups, sit-ups, burpees',
  'Viktade pull-ups, viktade dips': 'Weighted pull-ups, weighted dips',
  'Assisterade pull-ups och dips': 'Assisted pull-ups and dips',
  'Plankan, yoga, stretching': 'Planks, yoga, stretching',
  'Viktad planka, wall sit': 'Weighted plank, wall sit',
  'Distans & tid': 'Distance & duration',
  'Vikt & distans': 'Weight & distance',
  'Löpning, cykling, rodd': 'Running, cycling, rowing',
  'Farmers walk, sled push': 'Farmers walk, sled push',
  'Exempel: {names}': 'Example: {names}',
  'TID': 'TIME',

  // Delmuskelfilter (bröstets och axelns regioner)
  'Övre': 'Upper',
  'Mellersta': 'Middle',
  'Nedre': 'Lower',
  'Främre': 'Front',
  'Bakre': 'Rear',
}
