-- ============================================================================
-- Ta bort tankstreck (" — " och " – ") ur all användartext i databasen.
-- Seedfilerna är redan uppdaterade; det här rättar befintliga rader.
-- Kör i Supabase SQL Editor (eller via supabase db push).
-- ============================================================================

-- Uppgiftsmallar (t.ex. "Kostplan — noll socker")
UPDATE task_templates
SET name = replace(replace(name, ' — ', ', '), ' – ', ', ')
WHERE name LIKE '% — %' OR name LIKE '% – %';

UPDATE task_templates
SET description = replace(replace(description, ' — ', ', '), ' – ', ', ')
WHERE description LIKE '% — %' OR description LIKE '% – %';

-- Nivåernas regellistor (JSON med {"rule": "Strikt diet — noll kompromisser"})
UPDATE challenge_levels
SET rules = replace(replace(rules::text, ' — ', ', '), ' – ', ', ')::jsonb
WHERE rules::text LIKE '% — %' OR rules::text LIKE '% – %';

-- Övningsbeskrivningar ("Närgripet grepp — mer triceps ...")
UPDATE exercises
SET description = replace(replace(description, ' — ', ', '), ' – ', ', ')
WHERE description LIKE '% — %' OR description LIKE '% – %';
