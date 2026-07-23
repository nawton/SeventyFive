-- GRUPPINLÄGG ("Post something"): textinlägg i gruppen, synliga bara för
-- accepterade medlemmar. Ägaren kan låsa publiceringen till sig själv
-- (only_owner_posts) och varje medlem väljer notisnivå: alla inlägg,
-- bara skaparens, eller av — allt upprätthålls i databasen.
-- Idempotent skriven: ett första push-försök avbröts halvvägs.

-- Kolumnerna först — INSERT-policyn nedan refererar only_owner_posts
ALTER TABLE groups ADD COLUMN IF NOT EXISTS only_owner_posts BOOLEAN NOT NULL DEFAULT FALSE;

-- Notisnivå per medlemskap: alla inlägg / bara skaparens / av
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS notify_posts TEXT NOT NULL DEFAULT 'all'
  CHECK (notify_posts IN ('all', 'owner', 'off'));

CREATE TABLE IF NOT EXISTS group_posts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS group_posts_group_idx ON group_posts (group_id, created_at DESC);

ALTER TABLE group_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Medlemmar läser gruppens inlägg" ON group_posts;
CREATE POLICY "Medlemmar läser gruppens inlägg"
  ON group_posts FOR SELECT
  USING (is_accepted_member(group_id));

DROP POLICY IF EXISTS "Medlemmar skriver om ägaren tillåter" ON group_posts;
CREATE POLICY "Medlemmar skriver om ägaren tillåter"
  ON group_posts FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND is_accepted_member(group_id)
    AND EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_id
        AND (NOT g.only_owner_posts OR g.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Författaren eller ägaren raderar inlägg" ON group_posts;
CREATE POLICY "Författaren eller ägaren raderar inlägg"
  ON group_posts FOR DELETE
  USING (
    auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  );

-- Nivån sätts via definer-RPC: en generell self-UPDATE-policy på
-- group_members hade även släppt igenom statusändringar
CREATE OR REPLACE FUNCTION set_group_notify(gid UUID, level TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF level NOT IN ('all', 'owner', 'off') THEN
    RAISE EXCEPTION 'ogiltig notisnivå';
  END IF;
  UPDATE group_members SET notify_posts = level
  WHERE group_id = gid AND user_id = auth.uid();
END $$;

REVOKE ALL ON FUNCTION set_group_notify(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_group_notify(UUID, TEXT) TO authenticated;

DROP TRIGGER IF EXISTS group_posts_push ON group_posts;
CREATE TRIGGER group_posts_push
  AFTER INSERT ON group_posts
  FOR EACH ROW EXECUTE FUNCTION notify_push();
