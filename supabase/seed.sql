-- =============================================================================
-- SEED DATA — SEVENTYFIVE BY NAWTON
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
  'Nawton Flow',
  'Perfekt för dig som är redo att bygga en livsstil. Krävande men hållbar.',
  '[
    {"rule": "Träna 30 minuter om dagen", "icon": "dumbbell"},
    {"rule": "Drick 2 liter vatten", "icon": "droplet"},
    {"rule": "Läs 10 sidor", "icon": "book"},
    {"rule": "Följ din kostplan", "icon": "utensils"},
    {"rule": "Ta ett framstegsfoto", "icon": "camera"}
  ]'
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'hard',
  'Nawton Hard',
  'För dig som vill testa din gräns på riktigt. Ingen återvändo.',
  '[
    {"rule": "Träna 45 minuter om dagen", "icon": "dumbbell"},
    {"rule": "Drick 3 liter vatten", "icon": "droplet"},
    {"rule": "Läs 20 sidor", "icon": "book"},
    {"rule": "Inga socker eller alkohol", "icon": "ban"},
    {"rule": "Ta ett framstegsfoto", "icon": "camera"},
    {"rule": "5 minuters kall dusch", "icon": "snowflake"}
  ]'
),
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'extreme',
  'Nawton Extreme',
  'Eliten. Byggt för dem som vill förändra vem de är på 75 dagar.',
  '[
    {"rule": "Träna 60 minuter × 2 per dag", "icon": "dumbbell"},
    {"rule": "Drick 4 liter vatten", "icon": "droplet"},
    {"rule": "Läs 30 sidor", "icon": "book"},
    {"rule": "Strikt diet — noll kompromisser", "icon": "ban"},
    {"rule": "Ta ett framstegsfoto", "icon": "camera"},
    {"rule": "10 minuters kall dusch", "icon": "snowflake"},
    {"rule": "Skriv en daglig reflektion", "icon": "pen"}
  ]'
)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- TASK TEMPLATES — NORMAL
-- =============================================================================
INSERT INTO task_templates (level_id, type, name, description, target_value, unit) VALUES
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'workout',
  'Träning',
  'Minst 30 minuter fysisk aktivitet. Välj ditt eget pass.',
  30,
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
  'Läsning',
  'Läs minst 10 sidor i en bok. Inte podcasts, inte artiklar.',
  10,
  'pages'
),
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'diet',
  'Kostplan',
  'Följ din valda kostplan utan undantag.',
  NULL,
  NULL
),
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'photo',
  'Framstegsfoto',
  'Ta ett foto för att dokumentera din fysiska förändring.',
  NULL,
  NULL
)
ON CONFLICT (level_id, type, name) DO NOTHING;


-- =============================================================================
-- TASK TEMPLATES — HARD
-- =============================================================================
INSERT INTO task_templates (level_id, type, name, description, target_value, unit) VALUES
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'workout',
  'Träning',
  'Minst 45 minuter hårt träningspass.',
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
  'Läs minst 20 sidor i en bok.',
  20,
  'pages'
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'diet',
  'Kostplan — noll socker',
  'Strikt kostplan. Inget socker, ingen alkohol.',
  NULL,
  NULL
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'photo',
  'Framstegsfoto',
  'Ta ett foto för att dokumentera din fysiska förändring.',
  NULL,
  NULL
)
ON CONFLICT (level_id, type, name) DO NOTHING;


-- =============================================================================
-- TASK TEMPLATES — EXTREME
-- =============================================================================
INSERT INTO task_templates (level_id, type, name, description, target_value, unit) VALUES
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'workout',
  'Pass 1',
  'Första träningspasset på minst 60 minuter.',
  60,
  'minutes'
),
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'workout',
  'Pass 2',
  'Andra träningspasset på minst 60 minuter.',
  60,
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
  'Läs minst 30 sidor i en bok.',
  30,
  'pages'
),
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'diet',
  'Strikt diet',
  'Noll kompromisser. Ren mat, inga undantag.',
  NULL,
  NULL
),
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'photo',
  'Framstegsfoto',
  'Ta ett foto för att dokumentera din fysiska förändring.',
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
