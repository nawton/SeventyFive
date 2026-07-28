-- =============================================================================
-- NIVÅREGLERNA PÅ RIKTIGT + NIVÅBYTE EN GÅNG PER UTMANING
--
-- 1. user_challenges.level_changed_at — sätts när nivån byts; appen tillåter
--    bara ett byte per utmaning. Historiken lämnas orörd vid byte, de nya
--    reglerna seedas från nästa dags logg.
-- 2. Uppgiftsmallarna skrivs om så de speglar Jämför nivåerna-tabellen:
--    Normal: 45 min pass (mål 4/vecka), kostplan, 2 L vatten,
--            läsning och foto VALFRIA (kan hoppas över i appen)
--    Hard:   pass varje dag (ett utomhus/vecka), noll fuskmat, 3 L,
--            10 sidor/dag, foto varje dag
--    Extreme: 2 pass/dag, strikt kost, 4 L, 10 sidor/dag, foto varje dag,
--            kall dusch varje morgon (ny uppgift)
--    Raderna UPPDATERAS på plats (aldrig delete) så gamla dagars
--    avbockningar behåller sina kopplingar.
-- 3. challenge_levels.rules (visningslistan) synkas med samma texter.
--
-- Idempotent: kan köras om utan effekt.
-- =============================================================================

ALTER TABLE user_challenges ADD COLUMN IF NOT EXISTS level_changed_at timestamptz;

-- ── Normal ───────────────────────────────────────────────────────────────────
UPDATE task_templates SET
  name = 'Träningspass',
  description = 'Minst 45 minuter. Fyra pass i veckan är målet, vila övriga dagar.',
  target_value = 45, unit = 'minutes'
WHERE level_id = 'a1b2c3d4-0001-0001-0001-000000000001' AND type = 'workout' AND user_id IS NULL;

UPDATE task_templates SET
  name = 'Vatten',
  description = 'Drick minst 2 liter vatten under dagen.',
  target_value = 2, unit = 'liter'
WHERE level_id = 'a1b2c3d4-0001-0001-0001-000000000001' AND type = 'water' AND user_id IS NULL;

UPDATE task_templates SET
  name = 'Läsning (valfri)',
  description = 'Läs 10 sidor om du vill. Valfri på Normal, dagen godkänns utan.',
  target_value = 10, unit = 'pages'
WHERE level_id = 'a1b2c3d4-0001-0001-0001-000000000001' AND type = 'reading' AND user_id IS NULL;

UPDATE task_templates SET
  name = 'Kostplan',
  description = 'Följ din valda kostplan.'
WHERE level_id = 'a1b2c3d4-0001-0001-0001-000000000001' AND type = 'diet' AND user_id IS NULL;

UPDATE task_templates SET
  name = 'Framstegsfoto (valfritt)',
  description = 'Ta ett foto om du vill. Valfritt på Normal, dagen godkänns utan.'
WHERE level_id = 'a1b2c3d4-0001-0001-0001-000000000001' AND type = 'photo' AND user_id IS NULL;

-- ── Hard ─────────────────────────────────────────────────────────────────────
UPDATE task_templates SET
  name = 'Träningspass',
  description = 'Minst 45 minuter varje dag. Ett av veckans pass utomhus.',
  target_value = 45, unit = 'minutes'
WHERE level_id = 'a1b2c3d4-0002-0002-0002-000000000002' AND type = 'workout' AND user_id IS NULL;

UPDATE task_templates SET
  name = 'Vatten',
  description = 'Drick minst 3 liter vatten under dagen.',
  target_value = 3, unit = 'liter'
WHERE level_id = 'a1b2c3d4-0002-0002-0002-000000000002' AND type = 'water' AND user_id IS NULL;

UPDATE task_templates SET
  name = 'Läsning',
  description = 'Läs minst 10 sidor i en bok varje dag.',
  target_value = 10, unit = 'pages'
WHERE level_id = 'a1b2c3d4-0002-0002-0002-000000000002' AND type = 'reading' AND user_id IS NULL;

UPDATE task_templates SET
  name = 'Kost utan fusk',
  description = 'Håll din kost. Noll fuskmat.'
WHERE level_id = 'a1b2c3d4-0002-0002-0002-000000000002' AND type = 'diet' AND user_id IS NULL;

UPDATE task_templates SET
  name = 'Framstegsfoto',
  description = 'Ta ett framstegsfoto varje dag.'
WHERE level_id = 'a1b2c3d4-0002-0002-0002-000000000002' AND type = 'photo' AND user_id IS NULL;

-- ── Extreme ──────────────────────────────────────────────────────────────────
UPDATE task_templates SET
  description = 'Minst 45 minuter. Ett av dagens två pass utomhus.',
  target_value = 45, unit = 'minutes'
WHERE level_id = 'a1b2c3d4-0003-0003-0003-000000000003' AND type = 'workout' AND user_id IS NULL;

UPDATE task_templates SET
  name = 'Vatten',
  description = 'Drick minst 4 liter vatten under dagen.',
  target_value = 4, unit = 'liter'
WHERE level_id = 'a1b2c3d4-0003-0003-0003-000000000003' AND type = 'water' AND user_id IS NULL;

UPDATE task_templates SET
  name = 'Läsning',
  description = 'Läs minst 10 sidor i en bok varje dag.',
  target_value = 10, unit = 'pages'
WHERE level_id = 'a1b2c3d4-0003-0003-0003-000000000003' AND type = 'reading' AND user_id IS NULL;

UPDATE task_templates SET
  name = 'Strikt kostplan',
  description = 'Inga undantag, ingen fuskmat, ingen alkohol.'
WHERE level_id = 'a1b2c3d4-0003-0003-0003-000000000003' AND type = 'diet' AND user_id IS NULL;

UPDATE task_templates SET
  name = 'Framstegsfoto',
  description = 'Ta ett framstegsfoto varje dag.'
WHERE level_id = 'a1b2c3d4-0003-0003-0003-000000000003' AND type = 'photo' AND user_id IS NULL;

-- Kalla duschen är ny på Extreme — läggs bara till om den saknas
INSERT INTO task_templates (level_id, type, name, description, target_value, unit)
SELECT 'a1b2c3d4-0003-0003-0003-000000000003', 'cold_shower', 'Kall dusch',
       'Kall dusch varje morgon.', NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM task_templates
  WHERE level_id = 'a1b2c3d4-0003-0003-0003-000000000003'
    AND type = 'cold_shower' AND user_id IS NULL
);

-- ── Visningslistorna (challenge_levels.rules) ────────────────────────────────
UPDATE challenge_levels SET rules = '[
  {"rule": "4 träningspass i veckan", "icon": "dumbbell"},
  {"rule": "Följ din kostplan", "icon": "utensils"},
  {"rule": "Drick 2 liter vatten", "icon": "droplet"},
  {"rule": "Läsning och progressfoton är valfria", "icon": "book"},
  {"rule": "En dags marginal per vecka", "icon": "check"}
]'::jsonb WHERE slug = 'normal';

UPDATE challenge_levels SET rules = '[
  {"rule": "Träningspass varje dag, ett utomhus", "icon": "dumbbell"},
  {"rule": "Håll din kost, noll fuskmat", "icon": "ban"},
  {"rule": "Drick 3 liter vatten", "icon": "droplet"},
  {"rule": "Läs 10 sidor varje dag", "icon": "book"},
  {"rule": "Ta ett progressfoto varje dag", "icon": "camera"}
]'::jsonb WHERE slug = 'hard';

UPDATE challenge_levels SET rules = '[
  {"rule": "2 träningspass per dag, ett utomhus", "icon": "dumbbell"},
  {"rule": "Strikt kostplan, inga undantag", "icon": "ban"},
  {"rule": "Drick 4 liter vatten", "icon": "droplet"},
  {"rule": "Läs 10 sidor varje dag", "icon": "book"},
  {"rule": "Ta ett progressfoto varje dag", "icon": "camera"},
  {"rule": "Kall dusch varje morgon", "icon": "snowflake"}
]'::jsonb WHERE slug = 'extreme';
