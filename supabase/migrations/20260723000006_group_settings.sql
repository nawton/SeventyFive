-- GRUPPINSTÄLLNINGAR: ägaren kan stänga av aktivitetsflödet för gruppen.
-- Regeln bor i get_group_feed — avstängt flöde är avstängt även för en
-- fifflande klient, inte bara gömt i UI:t. Privat/offentlig fanns redan
-- (is_private) och får nu även ett snabbreglage i inställningarna.

ALTER TABLE groups ADD COLUMN show_feed BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION get_group_feed(gid UUID, before TIMESTAMPTZ, page_size INT)
RETURNS TABLE (id UUID, user_id UUID, name TEXT, created_at TIMESTAMPTZ, exercises JSONB)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT w.id, w.user_id, w.name, w.created_at,
         visible_exercises(w.user_id, w.exercises)
  FROM user_workouts w
  JOIN groups g ON g.id = gid
  WHERE g.show_feed
    AND w.created_at < before
    AND EXISTS (
      SELECT 1 FROM group_members me
      WHERE me.group_id = gid AND me.user_id = auth.uid() AND me.status = 'accepted')
    AND EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = gid AND gm.user_id = w.user_id AND gm.status = 'accepted')
    AND NOT is_blocked_pair(auth.uid(), w.user_id)
    AND (
      g.sport = 'all'
      OR (g.sport = 'gym'  AND w.exercises->0->>'category' IS DISTINCT FROM 'cardio')
      OR (g.sport <> 'gym' AND w.exercises->0->>'category' = 'cardio'
          AND w.exercises->0->>'type' = g.sport)
    )
  ORDER BY w.created_at DESC
  LIMIT LEAST(GREATEST(page_size, 1), 100);
$$;
