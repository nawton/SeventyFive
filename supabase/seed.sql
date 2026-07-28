-- =============================================================================
-- SEED DATA, SEVENTYFIVE BY NAWTON
-- Denna fil körs efter migrationer för att fylla databasen med grunddata.
-- Kör: npx supabase db reset (lokalt) eller manuellt via SQL Editor.
-- =============================================================================


-- =============================================================================
-- CHALLENGE LEVELS
-- =============================================================================
INSERT INTO challenge_levels (id, slug, display_name, description, rules) VALUES
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'normal',
  'Normal',
  'Perfekt för dig som är redo att bygga en livsstil. Krävande men hållbar.',
  '[
    {"rule": "4 träningspass i veckan", "icon": "dumbbell"},
    {"rule": "Följ din kostplan", "icon": "utensils"},
    {"rule": "Drick 2 liter vatten", "icon": "droplet"},
    {"rule": "Läsning och progressfoton är valfria", "icon": "book"},
    {"rule": "En dags marginal per vecka", "icon": "check"}
  ]'
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'hard',
  'Hard',
  'För dig som vill testa din gräns på riktigt. Ingen återvändo.',
  '[
    {"rule": "Träningspass varje dag, ett utomhus", "icon": "dumbbell"},
    {"rule": "Håll din kost, noll fuskmat", "icon": "ban"},
    {"rule": "Drick 3 liter vatten", "icon": "droplet"},
    {"rule": "Läs 10 sidor varje dag", "icon": "book"},
    {"rule": "Ta ett progressfoto varje dag", "icon": "camera"}
  ]'
),
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'extreme',
  'Extreme',
  'Eliten. Byggt för dem som vill förändra vem de är på 75 dagar.',
  '[
    {"rule": "2 träningspass per dag, ett utomhus", "icon": "dumbbell"},
    {"rule": "Strikt kostplan, inga undantag", "icon": "ban"},
    {"rule": "Drick 4 liter vatten", "icon": "droplet"},
    {"rule": "Läs 10 sidor varje dag", "icon": "book"},
    {"rule": "Ta ett progressfoto varje dag", "icon": "camera"},
    {"rule": "Kall dusch varje morgon", "icon": "snowflake"}
  ]'
)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- TASK TEMPLATES, NORMAL
-- =============================================================================
INSERT INTO task_templates (level_id, type, name, description, target_value, unit) VALUES
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'workout',
  'Träningspass',
  'Minst 45 minuter. Fyra pass i veckan är målet, vila övriga dagar.',
  45,
  'minutes'
),
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'water',
  'Vatten',
  'Drick minst 2 liter vatten under dagen.',
  2,
  'liter'
),
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'reading',
  'Läsning (valfri)',
  'Läs 10 sidor om du vill. Valfri på Normal, dagen godkänns utan.',
  10,
  'pages'
),
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'diet',
  'Kostplan',
  'Följ din valda kostplan.',
  NULL,
  NULL
),
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'photo',
  'Framstegsfoto (valfritt)',
  'Ta ett foto om du vill. Valfritt på Normal, dagen godkänns utan.',
  NULL,
  NULL
)
ON CONFLICT (level_id, type, name) DO NOTHING;


-- =============================================================================
-- TASK TEMPLATES, HARD
-- =============================================================================
INSERT INTO task_templates (level_id, type, name, description, target_value, unit) VALUES
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'workout',
  'Träningspass',
  'Minst 45 minuter varje dag. Ett av veckans pass utomhus.',
  45,
  'minutes'
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'water',
  'Vatten',
  'Drick minst 3 liter vatten under dagen.',
  3,
  'liter'
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'reading',
  'Läsning',
  'Läs minst 10 sidor i en bok varje dag.',
  10,
  'pages'
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'diet',
  'Kost utan fusk',
  'Håll din kost. Noll fuskmat.',
  NULL,
  NULL
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'photo',
  'Framstegsfoto',
  'Ta ett framstegsfoto varje dag.',
  NULL,
  NULL
),
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'cold_shower',
  'Kall dusch',
  'Kall dusch varje morgon.',
  NULL,
  NULL
)
ON CONFLICT (level_id, type, name) DO NOTHING;


-- =============================================================================
-- TASK TEMPLATES, EXTREME
-- =============================================================================
INSERT INTO task_templates (level_id, type, name, description, target_value, unit) VALUES
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'workout',
  'Pass 1',
  'Första passet, minst 45 minuter. Ett av dagens pass utomhus.',
  45,
  'minutes'
),
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'workout',
  'Pass 2',
  'Andra passet, minst 45 minuter.',
  45,
  'minutes'
),
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'water',
  'Vatten',
  'Drick minst 4 liter vatten under dagen.',
  4,
  'liter'
),
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'reading',
  'Läsning',
  'Läs minst 10 sidor i en bok varje dag.',
  10,
  'pages'
),
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'diet',
  'Strikt kostplan',
  'Inga undantag, ingen fuskmat, ingen alkohol.',
  NULL,
  NULL
),
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'photo',
  'Framstegsfoto',
  'Ta ett framstegsfoto varje dag.',
  NULL,
  NULL
)
ON CONFLICT (level_id, type, name) DO NOTHING;


-- =============================================================================
-- EXERCISES (urval av Nawtons övningsbibliotek)
-- =============================================================================
INSERT INTO exercises (name, description, category, difficulty) VALUES
('Knäböj',         'Grundövning för ben och core. Håll ryggen rak.',     'strength', 'beginner'),
('Marklyft',       'Helkroppsövning. Fundamentet i styrketräning.',       'strength', 'intermediate'),
('Bänkpress',      'Överkroppsövning för bröst, axlar och triceps.',      'strength', 'intermediate'),
('Pull-ups',       'Rygg och biceps. Kontrollerad rörelse hela vägen.',   'strength', 'advanced'),
('Militärpress',   'Axelövning med skivstång eller hantlar.',             'strength', 'intermediate'),
('Löpning',        'Stärker hjärta och lungor. Bygg din bas.',            'cardio',   'beginner'),
('Intervallspring', 'Hög intensitet, korta intervall. Bränner maximalt.', 'cardio',   'advanced'),
('Hopprep',        'Koordination och kondition. Enkelt, effektivt.',      'cardio',   'beginner'),
('Cykling',        'Lågbelastad konditionsträning.',                      'cardio',   'beginner'),
('Rodd',           'Total överkropp med minimalt ledslitage.',            'cardio',   'intermediate'),
('Yoga flow',      'Rörlighet, andning och mental klarhet.',              'mobility', 'beginner'),
('Hip flexor stretch', 'Öppnar höfterna efter lång tid i sittande.',      'mobility', 'beginner'),
('Foam rolling',   'Återhämtning och mjukvävnadsbehandling.',             'mobility', 'beginner'),
('Tabata',         '4 minuter som känns som 40. 20s on, 10s off.',        'hiit',     'advanced'),
('Burpees',        'Fullkroppsövning med hög puls. Inga ursäkter.',       'hiit',     'intermediate')
ON CONFLICT (name, category) DO NOTHING;
