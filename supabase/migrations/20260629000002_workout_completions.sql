-- =============================================================================
-- TRÄNINGSPASSAVKLARNINGAR
-- Lagrar vilket pass som klarades av och vilket datum
-- session_id + completed_date är unikt → ett pass kan bara klaras en gång per dag
-- =============================================================================

CREATE TABLE workout_completions (
  id             UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id     UUID    NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  user_id        UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  completed_date DATE    NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, completed_date)
);

CREATE INDEX idx_workout_completions_user ON workout_completions(user_id, completed_date);

ALTER TABLE workout_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own completions"
  ON workout_completions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
