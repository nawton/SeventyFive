-- FIX: organization_members SELECT-policyn var för bred (auth.uid() IS NOT
-- NULL) — vilket lät VILKEN inloggad användare som helst läsa medlemskap,
-- roller och delningsnivå för ALLA föreningar, inte bara sina egna.
-- Skopas nu till egna föreningar via en definer-funktion — samma mönster
-- som redan löste rekursionen i tränarpassens policyer (20260731000003),
-- eftersom en självrefererande USING-klausul på organization_members
-- annars biter sig i svansen (42P17) så fort SELECT-policyn också
-- refererar tabellen. Rollbytes-/lämna-policyerna körde tidigare egna
-- EXISTS-subfrågor mot samma tabell — ofarligt bara för att SELECT-policyn
-- saknade självreferens. De byts till samma definer-funktioner så inget
-- beror på den ordningen längre.

CREATE OR REPLACE FUNCTION is_org_member(oid UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = oid AND user_id = uid
  )
$$;

CREATE OR REPLACE FUNCTION is_org_admin(oid UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = oid AND user_id = uid AND role = 'admin'
  )
$$;

REVOKE ALL ON FUNCTION is_org_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION is_org_admin(UUID, UUID)  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_org_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_admin(UUID, UUID)  TO authenticated;

DROP POLICY IF EXISTS "Föreningsmedlemskap syns för inloggade" ON organization_members;
DROP POLICY IF EXISTS "Föreningsmedlemskap syns för föreningens medlemmar" ON organization_members;
CREATE POLICY "Föreningsmedlemskap syns för föreningens medlemmar"
  ON organization_members FOR SELECT
  USING (is_org_member(org_id, auth.uid()));

DROP POLICY IF EXISTS "Admin ändrar roller och delning ändras av en själv" ON organization_members;
CREATE POLICY "Admin ändrar roller och delning ändras av en själv"
  ON organization_members FOR UPDATE
  USING (user_id = auth.uid() OR is_org_admin(org_id, auth.uid()));

DROP POLICY IF EXISTS "Man lämnar själv, admin tar bort" ON organization_members;
CREATE POLICY "Man lämnar själv, admin tar bort"
  ON organization_members FOR DELETE
  USING (user_id = auth.uid() OR is_org_admin(org_id, auth.uid()));
