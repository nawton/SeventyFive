CREATE TABLE exercise_completions (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  exercise_id    UUID        NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  completed_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(exercise_id, user_id, completed_date)
);

CREATE INDEX idx_exercise_completions_user ON exercise_completions(user_id, completed_date);

ALTER TABLE exercise_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own exercise completions"
  ON exercise_completions FOR ALL TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
