-- SYNLIGHETSREGLAGE FÖR STATISTIKEN: delningsnivån säger VAD som delas,
-- share_with säger VEM som ser detaljerna — coacher/admin (standard)
-- eller hela föreningen. Basnivån (antal pass) är alltid föreningsgemensam
-- så topplistan och totalerna fortsätter fungera som lagkänsla.

ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS share_with TEXT NOT NULL DEFAULT 'staff'
  CHECK (share_with IN ('staff', 'org'));

-- Medlemsstatistiken: betraktarens effektiva nivå räknas fram —
-- jag själv → full, coach/admin → medlemmens nivå, vanlig medlem →
-- medlemmens nivå bara om hen delar med hela föreningen, annars bas.
CREATE OR REPLACE FUNCTION get_org_member_stats(oid UUID, member UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  lvl TEXT;
  with_who TEXT;
  staff_only BOOLEAN := FALSE;
  result JSONB;
  week_start  TIMESTAMPTZ := now() - interval '7 days';
  month_start TIMESTAMPTZ := now() - interval '28 days';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE org_id = oid AND user_id = auth.uid())
     OR NOT EXISTS (SELECT 1 FROM organization_members WHERE org_id = oid AND user_id = member) THEN
    RETURN NULL;
  END IF;

  SELECT share_level, share_with INTO lvl, with_who
  FROM organization_members WHERE org_id = oid AND user_id = member;

  IF member = auth.uid() THEN
    lvl := 'full';
  ELSIF NOT is_org_staff(oid, auth.uid()) AND with_who = 'staff' THEN
    staff_only := TRUE;
    lvl := 'base';
  END IF;

  WITH w AS (
    SELECT created_at, exercises->0 AS e
    FROM user_workouts
    WHERE user_id = member AND created_at >= month_start
  ),
  base AS (
    SELECT
      (COUNT(*) FILTER (WHERE created_at >= week_start AND e->>'category' = 'cardio'))::int
        + (COUNT(DISTINCT CASE WHEN created_at >= week_start AND e->>'category' IS DISTINCT FROM 'cardio'
            THEN COALESCE(e->>'workout_date', created_at::date::text) END))::int AS passes_week,
      (COUNT(*) FILTER (WHERE e->>'category' = 'cardio'))::int
        + (COUNT(DISTINCT CASE WHEN e->>'category' IS DISTINCT FROM 'cardio'
            THEN COALESCE(e->>'workout_date', created_at::date::text) END))::int AS passes_month,
      COALESCE(SUM(CASE WHEN created_at >= week_start AND e->>'category' = 'cardio'
        THEN COALESCE((e->>'distance_km')::numeric, 0) ELSE 0 END), 0) AS km_week,
      COALESCE(SUM(CASE WHEN e->>'category' = 'cardio'
        THEN COALESCE((e->>'distance_km')::numeric, 0) ELSE 0 END), 0) AS km_month
    FROM w
  ),
  vol AS (
    SELECT
      COALESCE(SUM(CASE WHEN wk.created_at >= week_start
        THEN (st->>'reps')::numeric * COALESCE((st->>'weight_kg')::numeric, 0) ELSE 0 END), 0) AS vol_week,
      COALESCE(SUM((st->>'reps')::numeric * COALESCE((st->>'weight_kg')::numeric, 0)), 0) AS vol_month
    FROM w wk, jsonb_array_elements(COALESCE(wk.e->'sets', '[]'::jsonb)) st
    WHERE wk.e->>'category' IS DISTINCT FROM 'cardio'
  ),
  toplift AS (
    SELECT wk.e->>'exercise_name' AS name, MAX((st->>'weight_kg')::numeric) AS kg
    FROM w wk, jsonb_array_elements(COALESCE(wk.e->'sets', '[]'::jsonb)) st
    WHERE wk.e->>'category' IS DISTINCT FROM 'cardio'
      AND COALESCE((st->>'weight_kg')::numeric, 0) > 0
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 1
  ),
  topex AS (
    SELECT jsonb_agg(x.row ORDER BY x.vol DESC) AS arr FROM (
      SELECT
        jsonb_build_object(
          'name', wk.e->>'exercise_name',
          'sets', COUNT(st.*),
          'top_kg', MAX(COALESCE((st->>'weight_kg')::numeric, 0)),
          'volume', COALESCE(SUM((st->>'reps')::numeric * COALESCE((st->>'weight_kg')::numeric, 0)), 0)
        ) AS row,
        COALESCE(SUM((st->>'reps')::numeric * COALESCE((st->>'weight_kg')::numeric, 0)), 0) AS vol
      FROM w wk, jsonb_array_elements(COALESCE(wk.e->'sets', '[]'::jsonb)) st
      WHERE wk.e->>'category' IS DISTINCT FROM 'cardio'
      GROUP BY wk.e->>'exercise_name'
      ORDER BY vol DESC
      LIMIT 5
    ) x
  )
  SELECT jsonb_build_object(
    'share_level', lvl,
    'staff_only', staff_only,
    'passes_week', base.passes_week,
    'passes_month', base.passes_month,
    'km_week',      CASE WHEN lvl IN ('detailed', 'full') THEN base.km_week ELSE NULL END,
    'km_month',     CASE WHEN lvl IN ('detailed', 'full') THEN base.km_month ELSE NULL END,
    'volume_week',  CASE WHEN lvl IN ('detailed', 'full') THEN vol.vol_week ELSE NULL END,
    'volume_month', CASE WHEN lvl IN ('detailed', 'full') THEN vol.vol_month ELSE NULL END,
    'top_lift',     CASE WHEN lvl IN ('detailed', 'full')
                      THEN (SELECT jsonb_build_object('name', name, 'kg', kg) FROM toplift) ELSE NULL END,
    'top_exercises', CASE WHEN lvl = 'full' THEN COALESCE((SELECT arr FROM topex), '[]'::jsonb) ELSE NULL END
  ) INTO result
  FROM base, vol;

  RETURN result;
END $$;

-- Topplistans km följer samma regel: syns för coacher, eller för alla
-- när medlemmen delar med hela föreningen
CREATE OR REPLACE FUNCTION get_org_leaderboard(oid UUID, since TIMESTAMPTZ)
RETURNS TABLE (user_id UUID, km NUMERIC, cardio_passes INT, gym_days INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT m.user_id,
         CASE WHEN m.share_level IN ('detailed', 'full')
               AND (m.user_id = auth.uid() OR m.share_with = 'org' OR is_org_staff(oid, auth.uid()))
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
  GROUP BY m.user_id, m.share_level, m.share_with
$$;
