-- FÄSTNINGSRÄTT: ägaren väljer om alla medlemmar får fästa inlägg eller
-- bara hen själv (standard: bara skaparen, som tidigare beteende).
-- Regeln bor i RPC:n — fortfarande max ett fäst inlägg per grupp.

ALTER TABLE groups ADD COLUMN only_owner_pins BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION set_group_post_pinned(pid UUID, is_pinned BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gid UUID;
BEGIN
  SELECT group_id INTO gid FROM group_posts WHERE id = pid;
  IF gid IS NULL THEN
    RAISE EXCEPTION 'inlägget finns inte';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = gid
      AND (g.owner_id = auth.uid()
        OR (NOT g.only_owner_pins AND EXISTS (
          SELECT 1 FROM group_members me
          WHERE me.group_id = gid AND me.user_id = auth.uid() AND me.status = 'accepted')))
  ) THEN
    RAISE EXCEPTION 'du får inte fästa inlägg i den här gruppen';
  END IF;
  IF is_pinned THEN
    UPDATE group_posts SET pinned = FALSE WHERE group_id = gid AND pinned;
  END IF;
  UPDATE group_posts SET pinned = is_pinned WHERE id = pid;
END $$;
