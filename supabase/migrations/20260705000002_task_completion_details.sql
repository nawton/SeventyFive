-- =============================================================================
-- DETALJER PÅ TASK COMPLETIONS
-- Kvantitativ progress per uppgift, lagrad som JSONB:
--   water:   {"glasses": 5}            — antal glas à 250 ml
--   reading: {"book": "...", "pages": 12} — boktitel och lästa sidor
-- =============================================================================
ALTER TABLE task_completions ADD COLUMN details JSONB;
