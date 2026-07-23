-- GRUPPER (Strava-klubbar i vår tappning): skaparguide med sport, taggar,
-- namn/bild/beskrivning, privat/offentlig och plats. Ägaren blir medlem
-- automatiskt via definer-trigger. Privata grupper ger väntande medlemskap
-- som ägaren godkänner; offentliga går att gå med i direkt — regeln
-- upprätthålls i INSERT-policyn, inte i appkod.

CREATE TABLE groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  description TEXT        NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  avatar_url  TEXT,
  sport       TEXT        NOT NULL DEFAULT 'all'
              CHECK (sport IN ('all', 'running', 'cycling', 'walking', 'gym')),
  tags        TEXT[]      NOT NULL DEFAULT '{}' CHECK (array_length(tags, 1) IS NULL OR array_length(tags, 1) <= 3),
  is_private  BOOLEAN     NOT NULL DEFAULT FALSE,
  location    TEXT,       -- NULL = Global
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Grupper är upptäckbara (namn/beskrivning) för alla inloggade — innehåll
-- framöver (gruppflöden) skyddas separat per medlemskap
CREATE POLICY "Grupper syns för inloggade"
  ON groups FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Man skapar sin egen grupp"
  ON groups FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Ägaren uppdaterar gruppen"
  ON groups FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Ägaren raderar gruppen"
  ON groups FOR DELETE
  USING (auth.uid() = owner_id);

CREATE TABLE group_members (
  group_id   UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  status     TEXT        NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX group_members_user_idx ON group_members (user_id, status);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medlemskap syns för inloggade"
  ON group_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Gå med som sig själv: offentlig grupp → accepted direkt,
-- privat grupp → pending tills ägaren godkänner
CREATE POLICY "Man går med som sig själv"
  ON group_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'member'
    AND status = (
      CASE WHEN (SELECT g.is_private FROM groups g WHERE g.id = group_id)
        THEN 'pending' ELSE 'accepted' END
    )
  );

CREATE POLICY "Ägaren godkänner medlemmar"
  ON group_members FOR UPDATE
  USING (EXISTS (SELECT 1 FROM groups g WHERE g.id = group_id AND g.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));

CREATE POLICY "Man lämnar själv, ägaren tar bort"
  ON group_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  );

-- Ägaren blir accepterad medlem direkt när gruppen skapas
CREATE OR REPLACE FUNCTION add_group_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO group_members (group_id, user_id, role, status)
  VALUES (NEW.id, NEW.owner_id, 'owner', 'accepted');
  RETURN NEW;
END $$;

CREATE TRIGGER groups_add_owner
  AFTER INSERT ON groups
  FOR EACH ROW EXECUTE FUNCTION add_group_owner();

-- Gruppbilder: i avatars-bucketen under groups/<skapar-id>-... så bara
-- uppladdaren kan skriva sina egna gruppbilder (publik läsning finns redan)
CREATE POLICY "Gruppbilder laddas upp av skaparen"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND name LIKE 'groups/' || auth.uid()::text || '-%');

CREATE POLICY "Gruppbilder ersätts av skaparen"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND name LIKE 'groups/' || auth.uid()::text || '-%')
  WITH CHECK (bucket_id = 'avatars' AND name LIKE 'groups/' || auth.uid()::text || '-%');
