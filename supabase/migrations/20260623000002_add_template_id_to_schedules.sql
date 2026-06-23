-- Lägger till template_id på user_schedules så vi vet vilken mall användaren valt.
-- NULL = inte valt ännu, 'custom' = eget schema, övrigt = en av de inbyggda mallarna.
ALTER TABLE user_schedules
  ADD COLUMN IF NOT EXISTS template_id TEXT;
