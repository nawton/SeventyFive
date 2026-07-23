-- TRE GRUPPLUCKOR TÄPPS:
--  1. Blockeringar respekteras i inbjudningar, och invited_by lagras så
--     notisen kan säga vem som bjöd in (och RLS garanterar att det stämmer)
--  2. Medlemslistor i privata grupper syns bara för medlemmar — egna raden
--     är alltid synlig så gå-med-statusen funkar
--  3. Push-notiser för inbjudningar, medlemsförfrågningar och godkännanden

ALTER TABLE group_members
  ADD COLUMN invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

DROP POLICY "Medlemmar bjuder in" ON group_members;
CREATE POLICY "Medlemmar bjuder in"
  ON group_members FOR INSERT
  WITH CHECK (
    user_id <> auth.uid()
    AND role = 'member'
    AND status = 'invited'
    AND invited_by = auth.uid()
    AND NOT is_blocked_pair(auth.uid(), user_id)
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

-- Självanslutning kan inte låtsas vara inbjuden av någon
DROP POLICY "Man går med som sig själv" ON group_members;
CREATE POLICY "Man går med som sig själv"
  ON group_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'member'
    AND invited_by IS NULL
    AND status = (
      CASE WHEN (SELECT g.is_private FROM groups g WHERE g.id = group_id)
        THEN 'pending' ELSE 'accepted' END
    )
  );

-- Definer-hjälpare: en subfråga på samma tabell inne i SELECT-policyn ger
-- oändlig rekursion — funktionen går förbi RLS och bryter cirkeln
CREATE OR REPLACE FUNCTION is_accepted_member(gid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = gid AND user_id = auth.uid() AND status = 'accepted'
  );
$$;

REVOKE ALL ON FUNCTION is_accepted_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_accepted_member(UUID) TO authenticated;

DROP POLICY "Medlemskap syns för inloggade" ON group_members;
CREATE POLICY "Medlemskap: egna rader, offentliga grupper, grupper man är med i"
  ON group_members FOR SELECT
  USING (
    auth.uid() = user_id
    OR is_accepted_member(group_id)
    OR EXISTS (SELECT 1 FROM groups g WHERE g.id = group_id AND NOT g.is_private)
  );

-- Push: inbjudan/förfrågan vid INSERT, godkänd förfrågan vid UPDATE.
-- Ägarens egen accepted-rad (add_group_owner) matchar ingen av villkoren,
-- och invited → accepted är personens eget val — ingen notis då heller.
CREATE TRIGGER group_members_push
  AFTER INSERT ON group_members
  FOR EACH ROW
  WHEN (NEW.status IN ('invited', 'pending'))
  EXECUTE FUNCTION notify_push();

CREATE TRIGGER group_members_accept_push
  AFTER UPDATE ON group_members
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status = 'accepted')
  EXECUTE FUNCTION notify_push();
