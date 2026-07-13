-- =============================================================================
-- 1) LÅS NER advance_challenge_days()
-- Postgres ger EXECUTE till PUBLIC som standard på nya funktioner, så trots
-- GRANT till service_role kunde vem som helst med anon-nyckeln köra funktionen
-- via PostgREST RPC. pg_cron-jobbet påverkas inte (kör som postgres-ägaren).
-- =============================================================================

REVOKE EXECUTE ON FUNCTION advance_challenge_days() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION advance_challenge_days() FROM anon;
REVOKE EXECUTE ON FUNCTION advance_challenge_days() FROM authenticated;
GRANT  EXECUTE ON FUNCTION advance_challenge_days() TO service_role;

-- =============================================================================
-- 2) SÄKERSTÄLL exercise_completions
-- Klientkoden slutar svälja fel vid övningsbockningar — då måste tabellen
-- garanterat finnas. Idempotent kopia av 20260701000001.
-- =============================================================================

CREATE TABLE IF NOT EXISTS exercise_completions (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  exercise_id    UUID        NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  completed_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(exercise_id, user_id, completed_date)
);

CREATE INDEX IF NOT EXISTS idx_exercise_completions_user
  ON exercise_completions(user_id, completed_date);

ALTER TABLE exercise_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own exercise completions" ON exercise_completions;
CREATE POLICY "Users manage own exercise completions"
  ON exercise_completions FOR ALL TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
