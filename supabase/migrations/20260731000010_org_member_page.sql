-- MEDLEMSSIDAN I FÖRENINGEN: coachen ska se vad medlemmen gjort som
-- standard — delningsnivån får default 'full' (detaljerna skyddas redan
-- av share_with = 'staff'). Stats-RPC:n byggs ut med det sidan visar:
--   last_active     senaste passdatum ("aktiv idag")
--   last_gym        senaste gympasset: datum, titel, övningar, set, volym
--   coach_progress  progression per övning, MEN bara övningar som
--                   förekommer i föreningens tränarpass — coachen följer
--                   det coachen skickat ut. Senaste toppvikt + delta mot
--                   passet innan, 12 veckors fönster.

ALTER TABLE organization_members ALTER COLUMN share_level SET DEFAULT 'full';
-- Före lansering: inga riktiga användare, lyft befintliga rader till nya standarden
UPDATE organization_members SET share_level = 'full' WHERE share_level = 'base';

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
  prog_start  TIMESTAMPTZ := now() - interval '84 days';
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

  WITH wall AS (
    SELECT created_at, exercises->0 AS e
    FROM user_workouts
    WHERE user_id = member AND created_at >= prog_start
  ),
  w AS (SELECT * FROM wall WHERE created_at >= month_start),
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
  act AS (
    SELECT MAX(COALESCE(e->>'workout_date', created_at::date::text)) AS last_active FROM wall
  ),
  vol AS (
    SELECT
      COALESCE(SUM(CASE WHEN wk.created_at >= week_start
        THEN (st->>'reps')::numeric * COALESCE((st->>'weight_kg')::numeric, 0) ELSE 0 END), 0) AS vol_week,
      COALESCE(SUM((st->>'reps')::numeric * COALESCE((st->>'weight_kg')::numeric, 0)), 0) AS vol_month
    FROM w wk, jsonb_array_elements(COALESCE(wk.e->'sets', '[]'::jsonb)) st
    WHERE wk.e->>'category' IS DISTINCT FROM 'cardio'
  ),
  lastg_key AS (
    SELECT COALESCE(wk.e->>'workout_date', wk.created_at::date::text) AS d,
           COALESCE(wk.e->>'pass_key', '') AS pk
    FROM wall wk
    WHERE wk.e->>'category' IS DISTINCT FROM 'cardio'
    ORDER BY 1 DESC, wk.created_at DESC
    LIMIT 1
  ),
  lastg AS (
    SELECT k.d, k.pk,
      COUNT(DISTINCT wk.e->>'exercise_name')::int AS exercises,
      COALESCE(SUM(jsonb_array_length(COALESCE(wk.e->'sets', '[]'::jsonb))), 0)::int AS sets,
      COALESCE((
        SELECT SUM((st->>'reps')::numeric * COALESCE((st->>'weight_kg')::numeric, 0))
        FROM wall wk2, jsonb_array_elements(COALESCE(wk2.e->'sets', '[]'::jsonb)) st
        WHERE COALESCE(wk2.e->>'workout_date', wk2.created_at::date::text) = k.d
          AND COALESCE(wk2.e->>'pass_key', '') = k.pk
          AND wk2.e->>'category' IS DISTINCT FROM 'cardio'
      ), 0) AS volume,
      (SELECT gpm.title FROM gym_pass_meta gpm
        WHERE gpm.user_id = member AND gpm.workout_date::text = k.d AND gpm.pass_key = k.pk) AS title
    FROM lastg_key k
    JOIN wall wk ON COALESCE(wk.e->>'workout_date', wk.created_at::date::text) = k.d
      AND COALESCE(wk.e->>'pass_key', '') = k.pk
      AND wk.e->>'category' IS DISTINCT FROM 'cardio'
    GROUP BY k.d, k.pk
  ),
  coach_ex AS (
    SELECT DISTINCT jsonb_array_elements(cw.exercises)->>'exercise_name' AS name
    FROM coach_workouts cw
    WHERE cw.org_id = oid AND cw.session_type = 'gym'
  ),
  sess AS (
    SELECT wk.e->>'exercise_name' AS name,
           COALESCE(wk.e->>'workout_date', wk.created_at::date::text) AS d,
           MAX(COALESCE((st->>'weight_kg')::numeric, 0)) AS top
    FROM wall wk, jsonb_array_elements(COALESCE(wk.e->'sets', '[]'::jsonb)) st
    WHERE wk.e->>'category' IS DISTINCT FROM 'cardio'
      AND wk.e->>'exercise_name' IN (SELECT name FROM coach_ex)
    GROUP BY 1, 2
  ),
  prog AS (
    SELECT jsonb_agg(x ORDER BY x->>'name') AS arr FROM (
      SELECT jsonb_build_object(
        'name', s1.name,
        'kg', (ARRAY_AGG(s1.top ORDER BY s1.d DESC))[1],
        'delta', (ARRAY_AGG(s1.top ORDER BY s1.d DESC))[1]
               - COALESCE((ARRAY_AGG(s1.top ORDER BY s1.d DESC))[2], (ARRAY_AGG(s1.top ORDER BY s1.d DESC))[1])
      ) AS x
      FROM sess s1
      GROUP BY s1.name
      ORDER BY MAX(s1.d) DESC
      LIMIT 8
    ) sub
  )
  SELECT jsonb_build_object(
    'share_level', lvl,
    'staff_only', staff_only,
    'last_active', (SELECT last_active FROM act),
    'passes_week', base.passes_week,
    'passes_month', base.passes_month,
    'km_week',      CASE WHEN lvl IN ('detailed', 'full') THEN base.km_week ELSE NULL END,
    'km_month',     CASE WHEN lvl IN ('detailed', 'full') THEN base.km_month ELSE NULL END,
    'volume_week',  CASE WHEN lvl IN ('detailed', 'full') THEN vol.vol_week ELSE NULL END,
    'volume_month', CASE WHEN lvl IN ('detailed', 'full') THEN vol.vol_month ELSE NULL END,
    'last_gym',     CASE WHEN lvl IN ('detailed', 'full') THEN
                      (SELECT jsonb_build_object('date', d, 'title', title, 'exercises', exercises, 'sets', sets, 'volume', volume) FROM lastg)
                    ELSE NULL END,
    'coach_progress', CASE WHEN lvl = 'full' THEN COALESCE((SELECT arr FROM prog), '[]'::jsonb) ELSE NULL END
  ) INTO result
  FROM base, vol;

  RETURN result;
END $$;
