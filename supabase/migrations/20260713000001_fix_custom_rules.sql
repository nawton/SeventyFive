-- =============================================================================
-- FIX: EGNA REGLER (custom task templates)
-- 1) Ursprungliga CHECK-constrainten tillåter inte type = 'custom',
--    så createCustomRule misslyckas på databasnivå.
-- 2) Dedupe-migrationens UNIQUE (level_id, type, name) gäller även användarnas
--    egna regler — namnkrockar mellan användare (eller egna dubbletter) stoppar
--    regelskapandet. Ska bara gälla admin-mallarna (user_id IS NULL).
-- =============================================================================

ALTER TABLE task_templates DROP CONSTRAINT IF EXISTS task_templates_type_check;
ALTER TABLE task_templates ADD CONSTRAINT task_templates_type_check
  CHECK (type IN ('workout', 'diet', 'water', 'reading', 'photo', 'custom'));

ALTER TABLE task_templates DROP CONSTRAINT IF EXISTS task_templates_level_type_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS task_templates_admin_level_type_name_key
  ON task_templates (level_id, type, name)
  WHERE user_id IS NULL;

-- Samma användare ska inte kunna skapa exakt samma regel två gånger i samma
-- utmaning, men olika användare får ha samma namn.
CREATE UNIQUE INDEX IF NOT EXISTS task_templates_user_challenge_name_key
  ON task_templates (user_id, challenge_id, name)
  WHERE user_id IS NOT NULL;

-- 3) Städa läckta rader: seedningen har kunnat skapa completions som pekar på
--    ANDRA användares custom-regler (mallar är publikt läsbara och frågan
--    filtrerade bara på level_id). Ta bort completions vars mall ägs av någon
--    annan än utmaningens ägare.
DELETE FROM task_completions tc
USING task_templates tt, daily_logs dl, user_challenges uc
WHERE tc.task_template_id = tt.id
  AND tc.daily_log_id     = dl.id
  AND dl.challenge_id     = uc.id
  AND tt.user_id IS NOT NULL
  AND tt.user_id <> uc.user_id;
