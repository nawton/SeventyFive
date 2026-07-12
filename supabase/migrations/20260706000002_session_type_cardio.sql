-- =============================================================================
-- SCHEMALAGDA CARDIO-PASS
-- Lägger till session_type och cardio_type på workout_sessions så att
-- användaren kan schemalägga löpning/cykling/promenad precis som gympass.
-- workout_completions får distans- och tidsfält för cardio-avklarningar.
-- =============================================================================

ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'gym',
  ADD COLUMN IF NOT EXISTS cardio_type  TEXT;

ALTER TABLE workout_completions
  ADD COLUMN IF NOT EXISTS distance_km       DECIMAL,
  ADD COLUMN IF NOT EXISTS duration_seconds  INTEGER;
