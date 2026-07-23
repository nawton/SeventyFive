-- FLER GRUPPINSTÄLLNINGAR — allt databasstött, inget bara-i-UI:t:
--  • show_leaderboard: veckans topplista på gruppsidan kan stängas av
--  • allow_member_invites: avstängt = bara ägaren får bjuda in (RLS)
--  • transfer_group_ownership: ägaren kan överlåta gruppen till en medlem

ALTER TABLE groups ADD COLUMN show_leaderboard BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE groups ADD COLUMN allow_member_invites BOOLEAN NOT NULL DEFAULT TRUE;

-- Inbjudningspolicyn får villkoret: medlemsinbjudningar kräver att ägaren
-- tillåter dem — ägaren själv får alltid bjuda in
DROP POLICY "Medlemmar bjuder in" ON group_members;
CREATE POLICY "Medlemmar bjuder in"
  ON group_members FOR INSERT
  WITH CHECK (
    user_id <> auth.uid()
    AND role = 'member'
    AND status = 'invited'
    AND EXISTS (
      SELECT 1 FROM group_members me
      WHERE me.group_id = group_members.group_id
        AND me.user_id = auth.uid()
        AND me.status = 'accepted'
    )
    AND EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
        AND (g.allow_member_invites OR g.owner_id = auth.uid())
    )
  );

-- Överlåtelse i ett svep: ägarbytet och båda rollraderna hänger ihop,
-- därför definer-RPC i stället för klient-uppdateringar
CREATE OR REPLACE FUNCTION transfer_group_ownership(gid UUID, new_owner UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = gid AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'bara ägaren kan överlåta gruppen';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = gid AND user_id = new_owner AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'mottagaren måste vara accepterad medlem';
  END IF;
  UPDATE groups SET owner_id = new_owner WHERE id = gid;
  UPDATE group_members SET role = 'member' WHERE group_id = gid AND user_id = auth.uid();
  UPDATE group_members SET role = 'owner'  WHERE group_id = gid AND user_id = new_owner;
END $$;

REVOKE ALL ON FUNCTION transfer_group_ownership(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transfer_group_ownership(UUID, UUID) TO authenticated;
