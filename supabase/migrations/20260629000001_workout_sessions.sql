-- =============================================================================
-- PERSONLIGA TRÄNINGSSCHEMAN
-- workout_sessions  — ett namngivet pass med veckodagar
-- session_exercises — övningar kopplade till ett pass
-- =============================================================================

CREATE TABLE workout_sessions (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  weekdays    INTEGER[]   NOT NULL DEFAULT '{}',  -- 1=Mån 2=Tis 3=Ons 4=Tor 5=Fre 6=Lör 7=Sön
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE session_exercises (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id     UUID        NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_name  TEXT        NOT NULL,
  sets           INTEGER,
  reps           TEXT,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Index för snabba uppslag per användare ────────────────────────────────────
CREATE INDEX idx_workout_sessions_user  ON workout_sessions(user_id);
CREATE INDEX idx_session_exercises_sess ON session_exercises(session_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE workout_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions"
  ON workout_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own session exercises"
  ON session_exercises FOR ALL TO authenticated
  USING  (session_id IN (SELECT id FROM workout_sessions WHERE user_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT id FROM workout_sessions WHERE user_id = auth.uid()));
