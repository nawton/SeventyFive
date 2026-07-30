-- FIX: att skapa en förening small alltid med "Kunde inte skapa".
-- INSERT ... RETURNING kräver att raden är synlig enligt SELECT-policyn,
-- men policyn krävde medlemskap och admin-raden skapas först i AFTER-
-- triggern — vid RETURNING-ögonblicket var skaparen inte medlem än.
-- Skaparen får nu alltid se sin egen förening (hen är ju admin ändå).

DROP POLICY IF EXISTS "Föreningen syns för medlemmar" ON organizations;
DROP POLICY IF EXISTS "Föreningen syns för skaparen och medlemmarna" ON organizations;
CREATE POLICY "Föreningen syns för skaparen och medlemmarna"
  ON organizations FOR SELECT
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = id AND m.user_id = auth.uid()
    )
  );
