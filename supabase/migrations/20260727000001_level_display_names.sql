-- =============================================================================
-- Nivåerna heter bara Normal, Hard och Extreme — inget Nawton i namnen.
-- Visas i appen under Allmänt → Aktiv utmaning och på hemskärmens badge.
-- Idempotent: kör om utan effekt när namnen redan är bytta.
-- =============================================================================

UPDATE challenge_levels SET display_name = 'Normal'  WHERE slug = 'normal';
UPDATE challenge_levels SET display_name = 'Hard'    WHERE slug = 'hard';
UPDATE challenge_levels SET display_name = 'Extreme' WHERE slug = 'extreme';
