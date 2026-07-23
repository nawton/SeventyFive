-- INBJUDNINGAR TILL GRUPPER: en accepterad medlem bjuder in andra — raden
-- får status 'invited' och bara den inbjudna kan tacka ja (via RPC:n nedan)
-- eller nej (radera sin rad, policyn finns redan). Inbjudan går förbi
-- väntande-steget i privata grupper — det är hela poängen med att bjudas in.

ALTER TABLE group_members DROP CONSTRAINT group_members_status_check;
ALTER TABLE group_members ADD CONSTRAINT group_members_status_check
  CHECK (status IN ('pending', 'accepted', 'invited'));

-- Bara medlemmar som själva är accepterade får bjuda in, aldrig sig själva
-- (annars kunde man kringgå pending-steget i privata grupper)
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
  );

-- Accepterandet sker via definer-RPC i stället för UPDATE-policy: en policy
-- kan inte hindra att raden flyttas till en annan grupp eller får ägarroll,
-- funktionen rör bara status på exakt den egna inbjudan
CREATE OR REPLACE FUNCTION accept_group_invite(gid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE group_members SET status = 'accepted'
  WHERE group_id = gid AND user_id = auth.uid() AND status = 'invited';
END $$;
