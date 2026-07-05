-- =============================================================================
-- DEDUPLICERING AV SEED-DATA
-- seed.sql och add_exercises.sql har körts mer än en gång — alla uppgiftsmallar
-- och övningar finns dubbelt. Vi behåller en rad per naturlig nyckel och lägger
-- unika constraints så omkörda seeds aldrig kan skapa dubbletter igen.
-- =============================================================================

-- 1) Uppgiftsmallar: ta först bort task_completions som pekar på dubbletterna
--    (annars stoppar foreign key-constrainten raderingen), sedan dubbletterna
--    själva. Behåller raden med lägst id per (nivå, typ, namn).
WITH keep AS (
  SELECT DISTINCT ON (level_id, type, name) id
  FROM task_templates
  ORDER BY level_id, type, name, id
)
DELETE FROM task_completions
WHERE task_template_id NOT IN (SELECT id FROM keep);

WITH keep AS (
  SELECT DISTINCT ON (level_id, type, name) id
  FROM task_templates
  ORDER BY level_id, type, name, id
)
DELETE FROM task_templates
WHERE id NOT IN (SELECT id FROM keep);

ALTER TABLE task_templates
  ADD CONSTRAINT task_templates_level_type_name_key UNIQUE (level_id, type, name);

-- 2) Övningsbiblioteket: behåll äldsta raden per (namn, kategori)
WITH keep AS (
  SELECT DISTINCT ON (name, category) id
  FROM exercises
  ORDER BY name, category, created_at, id
)
DELETE FROM exercises
WHERE id NOT IN (SELECT id FROM keep);

ALTER TABLE exercises
  ADD CONSTRAINT exercises_name_category_key UNIQUE (name, category);
