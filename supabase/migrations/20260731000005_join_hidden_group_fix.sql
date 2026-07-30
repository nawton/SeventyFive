-- FIX: gå med i DOLD grupp via QR-kod small alltid. Join-policyn slog upp
-- gruppens is_private med en subfråga som går genom RLS — men en dold
-- grupp är osynlig för den som ännu inte är medlem, så subfrågan gav NULL
-- och policyn krävde 'accepted' även för privata grupper. Appen skickar
-- korrekt 'pending' för privata → RLS-avslag → "Något gick fel".
-- Definer-funktionen slår upp rätt status förbi RLS, så kontraktet
-- blir detsamma för synliga och dolda grupper: offentlig → accepted
-- direkt, privat → pending tills ägaren godkänner.

CREATE OR REPLACE FUNCTION group_join_status(gid UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT CASE WHEN g.is_private THEN 'pending' ELSE 'accepted' END
  FROM groups g WHERE g.id = gid
$$;

REVOKE ALL ON FUNCTION group_join_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION group_join_status(UUID) TO authenticated;

DROP POLICY IF EXISTS "Man går med som sig själv" ON group_members;
CREATE POLICY "Man går med som sig själv"
  ON group_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'member'
    AND invited_by IS NULL
    AND status = group_join_status(group_id)
  );
