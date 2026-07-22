-- Flödet i EN fråga istället för två anrop per vän: egna + godkända
-- följares pass, nyast först, med cursor-paginering (before). SECURITY
-- INVOKER — user_workouts RLS gäller precis som vanligt, så funktionen
-- kan aldrig lämna ut mer än vad direktläsning hade gjort.

CREATE OR REPLACE FUNCTION get_feed(before TIMESTAMPTZ, page_size INT)
RETURNS TABLE (id UUID, user_id UUID, name TEXT, created_at TIMESTAMPTZ, exercises JSONB)
LANGUAGE sql
STABLE
AS $$
  SELECT w.id, w.user_id, w.name, w.created_at, w.exercises
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

REVOKE ALL ON FUNCTION get_feed(TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_feed(TIMESTAMPTZ, INT) TO authenticated;

-- Flödessorteringen behöver ett index när passen blir många
CREATE INDEX IF NOT EXISTS user_workouts_user_created_idx
  ON user_workouts (user_id, created_at DESC);
