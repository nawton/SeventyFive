-- GRUPPFLÖDE: gruppens huvudsida visar medlemmarnas pass i stället för
-- medlemslistan, filtrerat på gruppens sport. Att gå med i en grupp innebär
-- att ens pass syns i just den gruppens flöde — inte att hela historiken
-- öppnas: profiler och huvudflödet styrs fortfarande av följ + integritet.
-- Rutter strippas per kartinställning (visible_exercises) och block gäller.

CREATE OR REPLACE FUNCTION shares_group_with(other UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT NOT is_blocked_pair(auth.uid(), other)
    AND EXISTS (
      SELECT 1
      FROM group_members me
      JOIN group_members dem ON dem.group_id = me.group_id
      WHERE me.user_id = auth.uid() AND me.status = 'accepted'
        AND dem.user_id = other AND dem.status = 'accepted'
    );
$$;

REVOKE ALL ON FUNCTION shares_group_with(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shares_group_with(UUID) TO authenticated;

-- Bara accepterade medlemmar ser flödet; sportfiltret bor i databasen så
-- klienten inte kan glömma det. gym = allt som inte är cardio, en specifik
-- cardiosport matchar passets typ, 'all' släpper igenom allt.
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
  WHERE w.created_at < before
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

REVOKE ALL ON FUNCTION get_group_feed(UUID, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_group_feed(UUID, TIMESTAMPTZ, INT) TO authenticated;

-- Grupposter ska gå att öppna, gilla och kommentera även utan följ-relation
CREATE OR REPLACE FUNCTION get_shared_workout(wid UUID)
RETURNS TABLE (id UUID, user_id UUID, name TEXT, created_at TIMESTAMPTZ, exercises JSONB)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT w.id, w.user_id, w.name, w.created_at,
         visible_exercises(w.user_id, w.exercises)
  FROM user_workouts w
  WHERE w.id = wid
    AND (can_view_workouts_of(w.user_id) OR shares_group_with(w.user_id));
$$;

DROP POLICY "Man gillar som sig själv, pass man får se" ON post_likes;
CREATE POLICY "Man gillar som sig själv, pass man får se"
  ON post_likes FOR INSERT
  WITH CHECK (
    auth.uid() = liker_id
    AND (can_view_workouts_of(owner_id) OR shares_group_with(owner_id))
    AND post_key_belongs_to(post_key, owner_id)
  );

DROP POLICY "Man kommenterar som sig själv, pass man får se" ON post_comments;
CREATE POLICY "Man kommenterar som sig själv, pass man får se"
  ON post_comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND (can_view_workouts_of(owner_id) OR shares_group_with(owner_id))
    AND post_key_belongs_to(post_key, owner_id)
  );
