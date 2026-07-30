-- FÖRENINGENS ANDRA VARV: efterlevnadsvyn och topplistan.
--
-- get_workout_adoption_status: coachens "vilka har kört passet?". Bara
-- staff i passets förening får svar. "Kört" för gympass = minst ett set
-- avbockat på den adopterade schemaraden; för cardiopass = ett loggat
-- cardiopass av rätt typ efter adoptionen (bästa ärliga proxyn).
--
-- get_org_leaderboard: per medlem sedan ett datum. Antal pass är basnivån
-- och visas alltid; km kräver delningsnivå detailed/full och blir annars
-- NULL. Blockerade par filtreras som i grupptopplistan.
--
-- get_org_totals: föreningens summor (km + pass) över ALLA medlemmar —
-- aggregatet pekar inte ut någon och driver "tillsammans"-känslan.

CREATE OR REPLACE FUNCTION get_workout_adoption_status(wid UUID)
RETURNS TABLE (user_id UUID, adopted_at TIMESTAMPTZ, completed BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT a.user_id,
         a.created_at AS adopted_at,
         CASE WHEN w.session_type = 'gym' THEN EXISTS (
           SELECT 1 FROM exercise_completions ec
           JOIN session_exercises se ON se.id = ec.exercise_id
           WHERE se.session_id = a.session_id AND ec.user_id = a.user_id
         ) ELSE EXISTS (
           SELECT 1 FROM user_workouts uw
           WHERE uw.user_id = a.user_id
             AND uw.created_at >= a.created_at
             AND uw.exercises->0->>'category' = 'cardio'
             AND (w.cardio_type IS NULL OR uw.exercises->0->>'type' = w.cardio_type)
         ) END AS completed
  FROM coach_workout_adoptions a
  JOIN coach_workouts w ON w.id = a.workout_id
  WHERE a.workout_id = wid
    AND is_workout_staff(wid, auth.uid())
$$;

REVOKE ALL ON FUNCTION get_workout_adoption_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_workout_adoption_status(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION get_org_leaderboard(oid UUID, since TIMESTAMPTZ)
RETURNS TABLE (user_id UUID, km NUMERIC, cardio_passes INT, gym_days INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT m.user_id,
         CASE WHEN m.share_level IN ('detailed', 'full')
           THEN COALESCE(SUM(CASE WHEN w.exercises->0->>'category' = 'cardio'
             THEN COALESCE((w.exercises->0->>'distance_km')::numeric, 0) ELSE 0 END), 0)
           ELSE NULL END AS km,
         (COUNT(*) FILTER (WHERE w.exercises->0->>'category' = 'cardio'))::int AS cardio_passes,
         (COUNT(DISTINCT CASE WHEN w.exercises->0->>'category' IS DISTINCT FROM 'cardio'
           THEN COALESCE(w.exercises->0->>'workout_date', (w.created_at)::date::text) END))::int AS gym_days
  FROM organization_members m
  LEFT JOIN user_workouts w
    ON w.user_id = m.user_id AND w.created_at >= since
  WHERE m.org_id = oid
    AND EXISTS (
      SELECT 1 FROM organization_members me
      WHERE me.org_id = oid AND me.user_id = auth.uid())
    AND NOT is_blocked_pair(auth.uid(), m.user_id)
  GROUP BY m.user_id, m.share_level
$$;

REVOKE ALL ON FUNCTION get_org_leaderboard(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_org_leaderboard(UUID, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION get_org_totals(oid UUID, since TIMESTAMPTZ)
RETURNS TABLE (km NUMERIC, passes INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(SUM(CASE WHEN w.exercises->0->>'category' = 'cardio'
           THEN COALESCE((w.exercises->0->>'distance_km')::numeric, 0) ELSE 0 END), 0) AS km,
         COUNT(w.id)::int AS passes
  FROM organization_members m
  JOIN user_workouts w
    ON w.user_id = m.user_id AND w.created_at >= since
  WHERE m.org_id = oid
    AND EXISTS (
      SELECT 1 FROM organization_members me
      WHERE me.org_id = oid AND me.user_id = auth.uid())
$$;

REVOKE ALL ON FUNCTION get_org_totals(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_org_totals(UUID, TIMESTAMPTZ) TO authenticated;

-- user_workouts saknade index på skapandetid per användare — både grupp-
-- och föreningstopplistan filtrerar på det
CREATE INDEX IF NOT EXISTS user_workouts_user_created_idx
  ON user_workouts (user_id, created_at DESC);
