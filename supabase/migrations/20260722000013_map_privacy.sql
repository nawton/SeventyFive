-- Kartsynlighet: två riktiga val. trim_route_ends klipper start/slut ur
-- rutten redan när passet SPARAS (privacy by construction — punkterna
-- lagras aldrig; hanteras i appens sparaflöde). hide_route_maps döljer
-- hela rutten för andra: visible_exercises() strippar route-fältet i
-- alla delade läsvägar (flödet, väns historik, enstaka pass) medan
-- ägaren alltid ser sin egen karta.

ALTER TABLE profiles ADD COLUMN trim_route_ends BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN hide_route_maps BOOLEAN NOT NULL DEFAULT FALSE;

-- SECURITY DEFINER: måste läsa ÄGARENS flagga trots profiles-RLS
CREATE OR REPLACE FUNCTION visible_exercises(owner UUID, exercises JSONB)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT CASE
    WHEN auth.uid() = owner THEN exercises
    WHEN COALESCE((SELECT p.hide_route_maps FROM profiles p WHERE p.id = owner), FALSE)
      THEN COALESCE(
        (SELECT jsonb_agg(e - 'route') FROM jsonb_array_elements(exercises) e),
        exercises
      )
    ELSE exercises
  END;
$$;

REVOKE ALL ON FUNCTION visible_exercises(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION visible_exercises(UUID, JSONB) TO authenticated;

-- Flödet strippar rutter för ägare som döljer kartor
CREATE OR REPLACE FUNCTION get_feed(before TIMESTAMPTZ, page_size INT)
RETURNS TABLE (id UUID, user_id UUID, name TEXT, created_at TIMESTAMPTZ, exercises JSONB)
LANGUAGE sql
STABLE
AS $$
  SELECT w.id, w.user_id, w.name, w.created_at,
         visible_exercises(w.user_id, w.exercises)
  FROM user_workouts w
  WHERE w.created_at < before
    AND (
      w.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = auth.uid()
          AND f.followee_id = w.user_id
          AND f.status = 'accepted'
      )
    )
  ORDER BY w.created_at DESC
  LIMIT LEAST(GREATEST(page_size, 1), 100);
$$;

-- En användares historik (atletsidan/aktivitetslistan) — SECURITY INVOKER
-- så user_workouts-RLS avgör åtkomsten, med strippade rutter
CREATE OR REPLACE FUNCTION get_user_workouts(target UUID, max_rows INT)
RETURNS TABLE (id UUID, user_id UUID, name TEXT, created_at TIMESTAMPTZ, exercises JSONB)
LANGUAGE sql
STABLE
AS $$
  SELECT w.id, w.user_id, w.name, w.created_at,
         visible_exercises(w.user_id, w.exercises)
  FROM user_workouts w
  WHERE w.user_id = target
  ORDER BY w.created_at DESC
  LIMIT LEAST(GREATEST(max_rows, 1), 500);
$$;

REVOKE ALL ON FUNCTION get_user_workouts(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_workouts(UUID, INT) TO authenticated;

-- Ett enstaka pass (diskussionssidan) — samma princip
CREATE OR REPLACE FUNCTION get_shared_workout(wid UUID)
RETURNS TABLE (id UUID, user_id UUID, name TEXT, created_at TIMESTAMPTZ, exercises JSONB)
LANGUAGE sql
STABLE
AS $$
  SELECT w.id, w.user_id, w.name, w.created_at,
         visible_exercises(w.user_id, w.exercises)
  FROM user_workouts w
  WHERE w.id = wid;
$$;

REVOKE ALL ON FUNCTION get_shared_workout(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_shared_workout(UUID) TO authenticated;
