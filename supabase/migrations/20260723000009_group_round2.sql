-- GRUPPRUNDA 2:
--  • invite_to_group-RPC: inbjudan till någon som redan väntar = godkänd direkt
--  • Dolda grupper: syns inte i sökningen — UUID:t (QR/inbjudan) är nyckeln,
--    get_group_by_id slår upp oavsett dold
--  • Ägarens kontoradering överlåter gruppen till äldsta medlemmen
--  • Spärrade medlemmar: banned-raden ligger kvar och blockerar återinträde
--  • Veckotopplista i databasen (hela veckan, inte bara senaste flödessidan)

-- ── Dolda grupper ────────────────────────────────────────────────────────────
ALTER TABLE groups ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- Egen rad oavsett status (inbjuden/väntande ska se gruppen de bjudits till)
CREATE OR REPLACE FUNCTION has_membership_row(gid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members WHERE group_id = gid AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION has_membership_row(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_membership_row(UUID) TO authenticated;

DROP POLICY "Grupper syns för inloggade" ON groups;
CREATE POLICY "Grupper: synliga för alla, dolda bara för berörda"
  ON groups FOR SELECT
  USING (auth.uid() IS NOT NULL AND (NOT hidden OR has_membership_row(id)));

-- QR-koden/djuplänken bär grupp-id:t — den som har det får slå upp gruppen
-- (UUID:er går inte att gissa; det är samma kontrakt som en olistad länk)
CREATE OR REPLACE FUNCTION get_group_by_id(gid UUID)
RETURNS SETOF groups
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM groups WHERE id = gid AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION get_group_by_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_group_by_id(UUID) TO authenticated;

-- ── Spärrade medlemmar ───────────────────────────────────────────────────────
ALTER TABLE group_members DROP CONSTRAINT group_members_status_check;
ALTER TABLE group_members ADD CONSTRAINT group_members_status_check
  CHECK (status IN ('pending', 'accepted', 'invited', 'banned'));

-- Spärrad kan inte radera sin egen rad (annars vore spärren meningslös)
DROP POLICY "Man lämnar själv, ägaren tar bort" ON group_members;
CREATE POLICY "Man lämnar själv (ej spärrad), ägaren tar bort"
  ON group_members FOR DELETE
  USING (
    (auth.uid() = user_id AND status <> 'banned')
    OR EXISTS (SELECT 1 FROM groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  );

-- ── Inbjudningar via RPC ─────────────────────────────────────────────────────
-- Behörigheten speglar RLS-policyn, men: en inbjudan till någon som redan
-- har en väntande förfrågan godkänner den direkt (inbjudan ÄR ett ja).
-- Spärrade och redan medlemmar/inbjudna hoppas över tyst.
CREATE OR REPLACE FUNCTION invite_to_group(gid UUID, uids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM group_members me
    JOIN groups g ON g.id = gid
    WHERE me.group_id = gid AND me.user_id = auth.uid() AND me.status = 'accepted'
      AND (g.allow_member_invites OR g.owner_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'du får inte bjuda in till den här gruppen';
  END IF;
  FOREACH uid IN ARRAY uids LOOP
    CONTINUE WHEN uid = auth.uid() OR is_blocked_pair(auth.uid(), uid);
    UPDATE group_members SET status = 'accepted'
      WHERE group_id = gid AND user_id = uid AND status = 'pending';
    IF NOT FOUND THEN
      INSERT INTO group_members (group_id, user_id, role, status, invited_by)
      VALUES (gid, uid, 'member', 'invited', auth.uid())
      ON CONFLICT (group_id, user_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION invite_to_group(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION invite_to_group(UUID, UUID[]) TO authenticated;

-- ── Ägarens konto raderas → gruppen ärvs av äldsta medlemmen ────────────────
CREATE OR REPLACE FUNCTION reassign_groups_before_profile_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g RECORD;
  heir UUID;
BEGIN
  FOR g IN SELECT id FROM groups WHERE owner_id = OLD.id LOOP
    SELECT user_id INTO heir FROM group_members
    WHERE group_id = g.id AND user_id <> OLD.id AND status = 'accepted'
    ORDER BY created_at ASC
    LIMIT 1;
    IF heir IS NOT NULL THEN
      UPDATE groups SET owner_id = heir WHERE id = g.id;
      UPDATE group_members SET role = 'owner' WHERE group_id = g.id AND user_id = heir;
      -- den gamla ägarens medlemsrad försvinner via cascade
    END IF;
    -- ingen arvtagare: gruppen följer med ägaren ut (cascade)
  END LOOP;
  RETURN OLD;
END $$;

CREATE TRIGGER profiles_reassign_groups
  BEFORE DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION reassign_groups_before_profile_delete();

-- ── Veckotopplista i databasen ───────────────────────────────────────────────
-- Summerar HELA perioden (flödessidan i appen är begränsad till 60 rader).
-- Samma synlighets- och sportregler som get_group_feed.
CREATE OR REPLACE FUNCTION get_group_leaderboard(gid UUID, since TIMESTAMPTZ)
RETURNS TABLE (user_id UUID, km NUMERIC, cardio_passes INT, gym_days INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT w.user_id,
         COALESCE(SUM(CASE WHEN w.exercises->0->>'category' = 'cardio'
           THEN COALESCE((w.exercises->0->>'distance_km')::numeric, 0) ELSE 0 END), 0) AS km,
         (COUNT(*) FILTER (WHERE w.exercises->0->>'category' = 'cardio'))::int AS cardio_passes,
         (COUNT(DISTINCT CASE WHEN w.exercises->0->>'category' IS DISTINCT FROM 'cardio'
           THEN COALESCE(w.exercises->0->>'workout_date', (w.created_at)::date::text) END))::int AS gym_days
  FROM user_workouts w
  JOIN groups g ON g.id = gid
  WHERE w.created_at >= since
    AND g.show_feed
    AND g.show_leaderboard
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
  GROUP BY w.user_id
$$;

REVOKE ALL ON FUNCTION get_group_leaderboard(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_group_leaderboard(UUID, TIMESTAMPTZ) TO authenticated;
